console.log("[policy-wording] boot NO_PDFJS");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { generateDocumentHash, getCachedDocument, cacheDocumentResults } from '../_shared/document-cache.ts';

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

    // 🚀 CHECK CACHE: Generate document hash and check if we've analyzed this before
    console.log('🔍 Generating document hash for cache lookup...');
    const documentHash = await generateDocumentHash(pdfBytes.buffer, {
      insurer: document.filename?.toLowerCase(),
      fileSize: pdfBytes.byteLength
    });
    console.log('📋 Document hash:', documentHash.slice(0, 16) + '...');
    
    // Try to get cached results
    const cachedAnalysis = await getCachedDocument(supabase, documentHash);
    
    if (cachedAnalysis) {
      console.log('⚡ CACHE HIT! Using previously analyzed data - saving AI processing time');
      
      // Store a reference using cached data
      const { data: policyWording, error: cacheInsertError } = await supabase
        .from('policy_wordings')
        .insert({
          document_id: documentId,
          user_id: document.user_id,
          insurer_name: cachedAnalysis.insurer_name || 'Cached',
          policy_version: cachedAnalysis.policy_version || null,
          policy_date: cachedAnalysis.policy_date || null,
          insured_name: null,
          policy_period: cachedAnalysis.policy_period || null,
          jurisdiction: cachedAnalysis.jurisdiction || null,
          coverage_sections: cachedAnalysis.coverage_sections || {},
          key_variables: cachedAnalysis.key_variables || {},
          emerging_risks: {},
          services: {},
          plain_language_summary: cachedAnalysis.plain_language_summary || {},
          status: 'completed'
        })
        .select()
        .single();
      
      if (cacheInsertError) {
        console.error('Database insert error (cached):', cacheInsertError);
        return json(req, 500, { ok: false, error: `Failed to save cached analysis: ${cacheInsertError.message}` });
      }
      
      return json(req, 200, {
        ok: true,
        cached: true,
        result: cachedAnalysis,
        meta: {
          documentId,
          policyWordingId: policyWording.id,
          insurerName: policyWording.insurer_name,
          processedAt: new Date().toISOString(),
          source: 'cache',
          documentHash: documentHash.slice(0, 16) + '...'
        }
      });
    }
    
    console.log('❌ Cache miss - proceeding with full AI analysis...');

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
    const systemText = `You analyse insurance policy wordings for brokers. 

PHASE 1: Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements.

PHASE 2: Extract Coverage Feature Flags - search the ENTIRE policy wording document for these specific features:

1. AI/ML Liability (feature_ai_affirmative_covered): 
   - Search for: "artificial intelligence", "machine learning", "algorithm liability", "decision engine", "AI", "ML"
   - TRUE if affirmative coverage found (i.e., explicitly covered)
   - FALSE if explicitly excluded or silent
   - Provide reasoning with page/section reference

2. Contractual Breach (feature_contractual_liability):
   - Search for: "contractual breach", "breach of contract", "express warranty", "contractual liability"
   - TRUE if full contractual liability covered (beyond professional negligence)
   - FALSE if limited or excluded
   - Provide reasoning with reference

3. Efficacy/Inefficacy (feature_inefficacy_covered):
   - Search for: "inability to perform", "failure of product", "inefficacy", "failure to achieve", "non-performance"
   - TRUE if covered
   - FALSE if excluded
   - Provide reasoning with reference

4. Separate Limit Towers (feature_separate_indemnity_towers):
   - Search for: "separate limit", "non-eroding limit", "dedicated limit", "independent limit", "additional limit"
   - TRUE if multiple independent limit towers exist
   - FALSE if single aggregate limit only
   - Provide reasoning

5. Proactive Services (feature_proactive_services):
   - Search for: "proactive", "risk management services", "cyber prevention", "included services", "risk platform", "monitoring"
   - TRUE if value-added proactive services included
   - FALSE if none or reactive only
   - Provide reasoning

6. Geographic Scope (scope_geographic_coverage):
   - Extract: Territory, jurisdiction, geographic limits
   - Return specific scope: "Worldwide", "Worldwide excluding USA/Canada", "EU only", "UK only", etc.
   - Provide reasoning with exact wording

7. Personal Data Special Excess (deductible_data_special):
   - Search for: "data breach excess", "personal data deductible", "regulatory investigation excess", "privacy excess"
   - Return currency amount if higher excess applies to data claims
   - Return "N/A" if no special excess
   - Provide reasoning

8. Crisis Response Limit (limit_crisis_response):
   - Search for: "crisis management", "crisis containment", "crisis communication", "PR costs", "reputation management"
   - Return currency amount if separate sub-limit exists
   - Return "N/A" if not separately limited or not covered
   - Provide reasoning

Flag ambiguities and broker actions. Include citations. Be thorough but concise. Only output valid JSON per the schema.`;
    
    const userText = "Analyze the attached policy wording PDF and return structured JSON per schema. Extract ALL Phase 1 structural data AND Phase 2 coverage features. Be thorough - search the entire document for each feature.";
    
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

    // Helper function to parse potentially incomplete dates
    const parseDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr) return null;
      
      const trimmed = String(dateStr).trim();
      
      // If it's already a valid YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      
      // If it's just a year (e.g., "2025")
      if (/^\d{4}$/.test(trimmed)) {
        return `${trimmed}-01-01`;
      }
      
      // If it's MM/YY format (e.g., "04/17")
      const mmYYMatch = trimmed.match(/^(\d{2})\/(\d{2})$/);
      if (mmYYMatch) {
        const month = mmYYMatch[1];
        const year = `20${mmYYMatch[2]}`; // Assume 20xx century
        return `${year}-${month}-01`;
      }
      
      // If it's MM/YYYY format (e.g., "04/2017")
      const mmYYYYMatch = trimmed.match(/^(\d{2})\/(\d{4})$/);
      if (mmYYYYMatch) {
        const month = mmYYYYMatch[1];
        const year = mmYYYYMatch[2];
        return `${year}-${month}-01`;
      }
      
      // Try to parse other common date formats
      try {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (e) {
        console.warn('[date-parse] Failed to parse date:', dateStr, String(e));
      }
      
      // If all parsing fails, return null
      console.warn('[date-parse] Unable to parse date string:', dateStr);
      return null;
    };

    // Store the analysis in the database
    console.log('[db] Mapping analysis data to database structure...');
    const parsedPolicyDate = parseDate(analysisData.policy?.edition_date);
    console.log('[db] Parsed policy date:', analysisData.policy?.edition_date, '->', parsedPolicyDate);
    
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: analysisData.policy?.carrier || 'Extracted',
        policy_version: analysisData.policy?.version || null,
        policy_date: parsedPolicyDate,
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
          citations: analysisData.citations || [],
          coverage_features: {
            feature_ai_affirmative_covered: analysisData.coverage_features?.feature_ai_affirmative_covered ?? null,
            feature_contractual_liability: analysisData.coverage_features?.feature_contractual_liability ?? null,
            feature_inefficacy_covered: analysisData.coverage_features?.feature_inefficacy_covered ?? null,
            feature_separate_indemnity_towers: analysisData.coverage_features?.feature_separate_indemnity_towers ?? null,
            feature_proactive_services: analysisData.coverage_features?.feature_proactive_services ?? null,
            scope_geographic_coverage: analysisData.coverage_features?.scope_geographic_coverage ?? null,
            deductible_data_special: analysisData.coverage_features?.deductible_data_special ?? null,
            limit_crisis_response: analysisData.coverage_features?.limit_crisis_response ?? null,
            feature_reasoning: analysisData.coverage_features?.feature_reasoning || {}
          }
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

    // 💾 CACHE THE RESULTS for future use
    console.log('💾 Caching analysis results for future reuse...');
    await cacheDocumentResults(
      supabase,
      documentHash,
      policyWording.insurer_name,
      {
        insurer_name: policyWording.insurer_name,
        policy_version: policyWording.policy_version,
        policy_date: policyWording.policy_date,
        policy_period: policyWording.policy_period,
        jurisdiction: policyWording.jurisdiction,
        coverage_sections: policyWording.coverage_sections,
        key_variables: policyWording.key_variables,
        plain_language_summary: policyWording.plain_language_summary
      },
      {
        policyType: analysisData.policy?.policy_type,
        fileSize: pdfBytes.byteLength,
        additionalMetadata: {
          model: responsesData?.model || 'gpt-4o-mini',
          usage: responsesData?.usage
        }
      }
    );
    
    console.log('=== Process Policy Wording Completed Successfully ===');

    return json(req, 200, {
      ok: true,
      cached: false,
      result: analysisData,
      meta: {
        documentId,
        policyWordingId: policyWording.id,
        insurerName: policyWording.insurer_name,
        processedAt: new Date().toISOString(),
        model: responsesData?.model || 'gpt-4o-mini',
        usage: responsesData?.usage,
        documentHash: documentHash.slice(0, 16) + '...'
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
