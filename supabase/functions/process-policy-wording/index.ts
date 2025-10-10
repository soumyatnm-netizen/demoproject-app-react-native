import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// CORS helpers
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers")
    ?? "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(req) },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    console.log('=== Process Policy Wording Function Started ===');
    
    const { documentId } = await req.json();
    
    if (!documentId) {
      return json(req, 400, { ok: false, error: 'Missing documentId' });
    }

    console.log('Processing policy wording document:', documentId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('[openai] keyPresent:', openAIApiKey ? 'yes' : 'no');

    if (!openAIApiKey) {
      return json(req, 500, { ok: false, error: 'OPENAI_API_KEY not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return json(req, 404, { ok: false, error: `Document not found: ${docError?.message}` });
    }

    console.log('Document found:', document.storage_path);

    // Get signed URL for the PDF
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 300); // 5 min expiry

    if (urlError || !urlData?.signedUrl) {
      return json(req, 500, { ok: false, error: 'Failed to get document URL' });
    }

    console.log('Fetching PDF from signed URL...');
    const pdfResponse = await fetch(urlData.signedUrl);
    if (!pdfResponse.ok) {
      return json(req, 500, { ok: false, error: 'Failed to fetch PDF from storage' });
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const sizeMB = (pdfBytes.byteLength / (1024 * 1024)).toFixed(2);
    console.log('[pdf] fetched bytes:', pdfBytes.byteLength, '(', sizeMB, 'MB)', 'host:', new URL(urlData.signedUrl).host);

    // Upload PDF to OpenAI Files API
    const pdfFile = new File([pdfBytes], document.filename || 'policy.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('purpose', 'assistants');

    console.log('Uploading PDF to OpenAI Files API...');
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: formData
    });

    const uploadText = await uploadResponse.text();
    if (!uploadResponse.ok) {
      console.error('[OpenAI] Upload error:', uploadText.slice(0, 400));
      return json(req, 500, { ok: false, error: `OpenAI upload failed: ${uploadText.slice(0, 400)}` });
    }

    const uploadData = JSON.parse(uploadText);
    const fileId = uploadData.id;
    console.log('[openai] uploaded fileId:', fileId);

    // Import schemas
    const { POLICY_WORDING_SCHEMA } = await import("../_shared/openai-schemas.ts");

    // Call OpenAI Responses API with native PDF
    console.log('Calling OpenAI Responses API...');
    const responsesBody = {
      model: 'gpt-4o-mini',
      modalities: ['text'],
      instructions: 'You analyse insurance policy wordings for brokers. Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements. Flag ambiguities and broker actions. Include citations. Only output valid JSON per the schema.',
      input: [
        {
          type: 'user',
          content: [
            { type: 'input_file', input_file: { file_id: fileId } },
            { type: 'input_text', input_text: 'Analyze the attached policy wording PDF and return structured JSON per schema.' }
          ]
        }
      ],
      text: {
        format: 'json_schema',
        json_schema: POLICY_WORDING_SCHEMA
      }
    };

    const responsesResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responsesBody)
    });

    const responsesText = await responsesResponse.text();
    if (!responsesResponse.ok) {
      console.error('[OpenAI] Responses error:', responsesText.slice(0, 400));
      return json(req, 500, { ok: false, error: `OpenAI Responses failed: ${responsesText.slice(0, 400)}` });
    }

    const responsesData = JSON.parse(responsesText);
    const outputText = responsesData?.output?.[0]?.content?.[0]?.text 
      || responsesData?.content?.[0]?.text 
      || responsesData?.choices?.[0]?.message?.content;
    
    const analysisData = typeof outputText === 'string' ? JSON.parse(outputText) : outputText;
    console.log('[openai] model:', responsesData?.model, 'usage:', JSON.stringify(responsesData?.usage ?? null));

    // Store the analysis in the database
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: 'Extracted',
        policy_version: null,
        policy_date: null,
        insured_name: null,
        policy_period: null,
        jurisdiction: analysisData.structure?.jurisdiction || null,
        coverage_sections: analysisData.structure || {},
        key_variables: {
          claims_basis: analysisData.structure?.claims_basis || {},
          limits: analysisData.structure?.limits || [],
          sublimits: analysisData.structure?.sublimits || [],
          deductibles: analysisData.structure?.deductibles || [],
          territory: analysisData.structure?.territory || null,
          conditions: analysisData.structure?.conditions || [],
          warranties: analysisData.structure?.warranties || []
        },
        emerging_risks: {},
        services: {},
        plain_language_summary: {
          key_terms: analysisData.key_terms || [],
          exclusions: analysisData.exclusions || [],
          endorsements: analysisData.endorsements || [],
          notable_issues: analysisData.notable_issues || {},
          citations: analysisData.citations || []
        },
        status: 'completed'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return json(req, 500, { ok: false, error: `Failed to save analysis: ${insertError.message}` });
    }

    console.log('Policy wording analysis stored:', policyWording.id);
    console.log('=== Process Policy Wording Completed Successfully ===');

    return json(req, 200, {
      ok: true,
      result: analysisData,
      meta: {
        documentId,
        policyWordingId: policyWording.id,
        insurerName: policyWording.insurer_name,
        processedAt: new Date().toISOString(),
        model: responsesData?.model || 'gpt-4o-mini',
        usage: responsesData?.usage
      }
    });

  } catch (error) {
    console.error('=== PROCESS POLICY WORDING ERROR ===');
    console.error('Error:', (error as any).message);
    console.error('Stack:', (error as any).stack);
    
    return json(req, 500, {
      ok: false,
      error: (error as any).message,
      timestamp: new Date().toISOString()
    });
  }
});
