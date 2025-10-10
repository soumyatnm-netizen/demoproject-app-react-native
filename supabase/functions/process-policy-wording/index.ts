console.log("[policy-wording] boot NO_PDFJS");
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
    return new Response('ok', { status: 200, headers: corsHeaders(req) });
  }

  try {
    console.log('=== Process Policy Wording Function Started ===');
    
    let bodyIn: any;
    try {
      bodyIn = await req.json();
    } catch {
      return json(req, 400, { ok: false, error: 'Invalid JSON body' });
    }
    const { documentId } = bodyIn;
    
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

    const ct = pdfResponse.headers.get('content-type') || '';
    if (ct && !ct.includes('pdf')) {
      return json(req, 415, { ok: false, error: `Unsupported content-type: ${ct}` });
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const sizeMB = (pdfBytes.byteLength / (1024 * 1024)).toFixed(2);
    console.log('[pdf] fetched bytes:', pdfBytes.byteLength, '(', sizeMB, 'MB)', 'host:', new URL(urlData.signedUrl).host);

    // Check PDF size - be more conservative to avoid timeout issues
    if (pdfBytes.byteLength > 10 * 1024 * 1024) {
      console.warn('[pdf] Large document detected:', sizeMB, 'MB - may take longer to process');
    }
    
    if (pdfBytes.byteLength > 30 * 1024 * 1024) {
      return json(req, 413, { ok: false, error: 'PDF too large (max 30MB). Please use a smaller document or split it into sections.' });
    }

    // --- Upload to OpenAI Files API (with granular error handling) ---
    let fileId: string | null = null;
    try {
      const pdfFile = new File([pdfBytes], document.filename || 'policy.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('purpose', 'assistants');

      console.log('[PW] Uploading PDF to OpenAI Files API…');
      const upRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIApiKey}` },
        body: formData
      });
      
      const upText = await upRes.text();
      console.log('[PW] upload status:', upRes.status, 'len:', upText.length);
      
      if (!upRes.ok) {
        console.error('[PW][OpenAI Upload] error (first 400):', upText.slice(0, 400));
        return json(req, upRes.status, { ok: false, stage: 'upload', error: upText.slice(0, 400) });
      }
      
      const uploadData = JSON.parse(upText);
      fileId = uploadData.id;
      console.log('[PW] uploaded fileId:', fileId);
    } catch (e) {
      console.error('[PW] upload threw:', String(e), (e as any)?.stack);
      return json(req, 500, { ok: false, stage: 'upload', error: String(e) });
    }

    // --- Build schema & prevalidate ---
    const schemaModule = await import("../_shared/openai-schemas.ts");
    const { normalizeStrictJsonSchema, findFirstRequiredMismatch, assertObjectSchema } = await import("../_shared/schema-utils.ts");
    
    const POLICY_WORDING_SCHEMA = schemaModule.POLICY_WORDING_SCHEMA ?? schemaModule.default;
    console.log('[schema PW] typeof:', typeof POLICY_WORDING_SCHEMA, 'root.type:', POLICY_WORDING_SCHEMA?.type);
    
    const PW_STRICT = normalizeStrictJsonSchema(structuredClone(POLICY_WORDING_SCHEMA));
    assertObjectSchema("POLICY_WORDING_SCHEMA", PW_STRICT);
    
    console.log('[schema PW] first keys:', Object.keys(PW_STRICT.properties || {}).slice(0, 5));
    const mismatch = findFirstRequiredMismatch(PW_STRICT);
    if (mismatch) {
      console.error('[schema PW] required mismatch at:', mismatch);
      return json(req, 500, { ok: false, stage: 'schema_precheck', error: `required mismatch at ${mismatch}` });
    }

    // --- Prepare API call parameters ---
    const systemText = "You analyse insurance policy wordings for brokers. Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements. Flag ambiguities and broker actions. Include citations. Be concise but complete. Only output valid JSON per the schema.";
    const userText = "Analyze the attached policy wording PDF and return structured JSON per schema. Be thorough but concise.";
    
    console.log('[PW] systemText defined:', systemText ? 'yes' : 'no');
    console.log('[PW] userText defined:', userText ? 'yes' : 'no');
    
    // --- Call Responses API (with granular error handling) ---
    let respStatus = 0;
    let respText = "";
    try {
      console.log('[PW] Calling OpenAI Responses API…');
      const body = {
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: [{ type: "input_text", text: systemText }] },
          { 
            role: "user", 
            content: [
              { type: "input_text", text: userText },
              { type: "input_file", file_id: fileId }
            ]
          }
        ],
        text: { 
          format: { 
            type: "json_schema", 
            strict: true, 
            name: "PolicyWording", 
            schema: PW_STRICT 
          } 
        },
        temperature: 0,
        max_output_tokens: 3000
      };

      console.log('[PW] Request payload size:', JSON.stringify(body).length);

      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${openAIApiKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(body)
      });
      
      respStatus = r.status;
      respText = await r.text();
      console.log('[PW] responses status:', respStatus, 'len:', respText.length);
      
      if (!r.ok) {
        console.error('[PW][OpenAI Responses] error (first 400):', respText.slice(0, 400));
        return json(req, r.status, { ok: false, stage: 'responses', error: respText.slice(0, 400) });
      }
    } catch (e) {
      console.error('[PW] responses threw:', String(e), (e as any)?.stack);
      return json(req, 500, { ok: false, stage: 'responses_throw', error: String(e) });
    }

    // --- Parse output safely ---
    let responsesData: any;
    let outputText: any;
    let structured: any;
    try {
      responsesData = JSON.parse(respText);
      outputText =
        responsesData?.output?.[0]?.content?.[0]?.text ??
        responsesData?.content?.[0]?.text ??
        responsesData?.output_text ??
        responsesData?.choices?.[0]?.message?.content;
      
      console.log('[PW] output preview:', String(outputText).slice(0, 200));
      structured = typeof outputText === "string" ? JSON.parse(outputText) : outputText;
      
      console.log('[PW] model:', responsesData?.model, 'usage:', JSON.stringify(responsesData?.usage ?? null));
    } catch (e) {
      console.error('[PW] parse fail. responses status:', respStatus, 'first 400:', respText.slice(0, 400));
      console.error('[PW] JSON.parse threw:', String(e));
      return json(req, 502, { ok: false, stage: 'parse', error: 'Model returned non-JSON or unexpected shape' });
    }
    
    const analysisData = structured;

    // Store the analysis in the database
    console.log('[db] Mapping analysis data to database structure...');
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: analysisData.policy?.carrier || 'Extracted',
        policy_version: analysisData.policy?.version || null,
        policy_date: analysisData.policy?.edition_date || null,
        insured_name: null,
        policy_period: analysisData.policy?.effective_date && analysisData.policy?.expiry_date 
          ? `${analysisData.policy.effective_date} to ${analysisData.policy.expiry_date}`
          : null,
        jurisdiction: analysisData.policy?.jurisdiction || analysisData.structure?.jurisdiction || null,
        coverage_sections: {
          policy: analysisData.policy || {},
          structure: analysisData.structure || {}
        },
        key_variables: {
          claims_basis: analysisData.structure?.claims_basis || {},
          limits: analysisData.structure?.limits || [],
          sublimits: analysisData.structure?.sublimits || [],
          deductibles: analysisData.structure?.deductibles || [],
          territory: analysisData.policy?.territory || null,
          conditions: analysisData.terms?.conditions || [],
          warranties: analysisData.terms?.warranties || []
        },
        emerging_risks: {},
        services: {},
        plain_language_summary: {
          policy_info: analysisData.policy || {},
          terms: {
            exclusions: analysisData.terms?.exclusions || [],
            endorsements: analysisData.terms?.endorsements || [],
            conditions: analysisData.terms?.conditions || [],
            warranties: analysisData.terms?.warranties || [],
            notable_terms: analysisData.terms?.notable_terms || []
          },
          definitions: analysisData.definitions || [],
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
    console.log('[db] Stored data summary:', {
      insurer: policyWording.insurer_name,
      policy_version: policyWording.policy_version,
      jurisdiction: policyWording.jurisdiction,
      limits_count: analysisData.structure?.limits?.length || 0,
      exclusions_count: analysisData.terms?.exclusions?.length || 0
    });
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
    console.error('[PW] error:', String(error));
    console.error('[PW] stack:', (error as any)?.stack);
    
    return json(req, 500, {
      ok: false,
      stage: 'top_catch',
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
});
