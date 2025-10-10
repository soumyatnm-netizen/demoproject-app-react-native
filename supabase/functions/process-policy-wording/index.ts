import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Import schema from shared
const { POLICY_WORDING_SCHEMA } = await import("../_shared/openai-schemas.ts");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Process Policy Wording Function Started (OpenAI Native PDF) ===');
    
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Missing documentId');
    }

    console.log('Processing policy wording document:', documentId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasOpenAIKey: !!openAIApiKey
    });

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;
    if (!document) throw new Error('Document not found');

    console.log('Document found:', document.storage_path);

    // Get signed URL for the document
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 3600);

    if (urlError || !signedUrlData) {
      throw new Error('Failed to create signed URL');
    }

    console.log('Uploading PDF to OpenAI...');

    // Fetch PDF and upload to OpenAI
    const pdfRes = await fetch(signedUrlData.signedUrl);
    if (!pdfRes.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
    }

    const blob = new Blob([await pdfRes.arrayBuffer()], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', blob, document.filename);
    form.append('purpose', 'assistants');

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIApiKey}` },
      body: form
    });

    const uploaded = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error('OpenAI upload failed:', JSON.stringify(uploaded).slice(0, 300));
      throw new Error(`OpenAI upload failed: ${uploadRes.status}`);
    }

    const fileId = uploaded.id;
    console.log('PDF uploaded to OpenAI, file ID:', fileId);

    // Call OpenAI Responses API
    const systemText =
      'You analyse insurance policy wordings for brokers. Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements. ' +
      'Flag ambiguities and broker actions. Include citations (page + snippet). Only output valid JSON per schema.';

    const userText = 'Analyse the attached PDF and return JSON per schema.';

    const requestBody = {
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemText }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userText },
            { type: 'input_file', mime_type: 'application/pdf', transfer_method: 'auto', file_id: fileId }
          ]
        }
      ],
      response_format: { type: 'json_schema', json_schema: POLICY_WORDING_SCHEMA },
      temperature: 0,
      max_output_tokens: 3000
    };

    console.log('Calling OpenAI Responses API...');
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const rawResponse = await aiRes.text();
    if (!aiRes.ok) {
      console.error('OpenAI API error:', aiRes.status, rawResponse.slice(0, 400));
      throw new Error(`OpenAI API failed: ${aiRes.status}`);
    }

    const parsed = JSON.parse(rawResponse);
    const jsonText =
      parsed?.output?.[0]?.content?.[0]?.text ??
      parsed?.content?.[0]?.text ??
      parsed?.output_text ??
      parsed?.choices?.[0]?.message?.content;

    const analysisData = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    const tokenUsage = parsed?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    console.log('OpenAI analysis complete, tokens:', JSON.stringify(tokenUsage));

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
      throw insertError;
    }

    console.log('Policy wording analysis stored:', policyWording.id);
    console.log('=== Process Policy Wording Completed Successfully ===');

    return new Response(
      JSON.stringify({
        ok: true,
        result: analysisData,
        tokens: tokenUsage,
        metadata: {
          documentId,
          policyWordingId: policyWording.id,
          insurerName: policyWording.insurer_name,
          processedAt: new Date().toISOString(),
          model: parsed?.model || 'gpt-4o-mini'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== PROCESS POLICY WORDING ERROR ===');
    console.error('Error:', (error as any).message);
    console.error('Stack:', (error as any).stack);
    
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        error: (error as any).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
