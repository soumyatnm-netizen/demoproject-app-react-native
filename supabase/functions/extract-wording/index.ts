console.log("[extract-wording] boot");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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

  const t0 = performance.now();
  let stage = "init";

  try {
    console.log('=== Extract Wording Function Started ===');
    
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

    console.log('[extract-wording] documentId:', documentId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!geminiApiKey) {
      return json(req, 500, { ok: false, error: 'GOOGLE_GEMINI_API_KEY not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document
    stage = "fetch_doc";
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return json(req, 404, { ok: false, error: `Document not found: ${docError?.message}` });
    }

    console.log('[extract-wording] Document:', document.filename);

    // Get signed URL
    stage = "signed_url";
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 300);

    if (urlError || !urlData?.signedUrl) {
      return json(req, 500, { ok: false, error: 'Failed to get signed URL' });
    }

    // Fetch PDF
    stage = "fetch_pdf";
    const t_fetch_start = performance.now();
    const pdfResponse = await fetch(urlData.signedUrl);
    if (!pdfResponse.ok) {
      return json(req, 500, { ok: false, error: 'Failed to fetch PDF' });
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const sizeMB = (pdfBytes.byteLength / (1024 * 1024)).toFixed(2);
    console.log('[extract-wording] PDF fetched:', sizeMB, 'MB in', (performance.now() - t_fetch_start).toFixed(0), 'ms');

    if (pdfBytes.byteLength > 20 * 1024 * 1024) {
      return json(req, 413, { ok: false, error: 'PDF too large (max 20MB)' });
    }

    // Convert to base64 for Gemini
    stage = "convert_base64";
    const t_convert_start = performance.now();
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    console.log('[extract-wording] Converted to base64 in', (performance.now() - t_convert_start).toFixed(0), 'ms');

    // Extract wording with focused schema
    stage = "extract";
    const t_extract_start = performance.now();
    
    const systemPrompt = "You are a specialist insurance policy wording analyzer. Extract all fields accurately from this policy wording document with special attention to coverage limits and sub-limits. Return only valid JSON.";
    const userPrompt = `Extract the following fields from this insurance policy wording document. Extract ALL coverage limits, sub-limits, and inner limits with complete monetary values and currencies.

REQUIRED FIELDS:

1. insurer_name: The insurance company issuing this policy

2. form_name_or_code: Policy form name or reference code

3. version_date: Version or effective date (ISO format YYYY-MM-DD)

4. coverage_trigger: What triggers coverage (e.g., "claims made", "occurrence")

5. insuring_clauses: Array of main insuring clauses:
   [
     {
       "title": "Clause name",
       "summary": "What it covers",
       "page_ref": "page X"
     }
   ]

6. definitions_notable: Array of key defined terms:
   [
     {
       "term": "Defined term",
       "delta_from_market": "How this differs from standard market definition",
       "verbatim_excerpt": "Exact definition from document",
       "page_ref": "page X"
     }
   ]

7. exclusions: Array of exclusions (what is NOT covered)

8. conditions: Array of policy conditions

9. warranties: Array of warranties

10. endorsements: Array of endorsements

11. limits: Main policy limits as array:
   [
     {
       "limit_type": "Aggregate Limit|Per Claim Limit|etc",
       "amount": numeric value,
       "currency": "GBP|USD|EUR",
       "description": "Full description",
       "page_ref": "page X"
     }
   ]

12. sublimits: Sub-limits within main coverage:
   [
     {
       "coverage_name": "Specific coverage",
       "limit": numeric value,
       "currency": "GBP|USD|EUR",
       "applies_to": "per claim|aggregate|annual",
       "description": "Full description",
       "page_ref": "page X"
     }
   ]

13. inner_limits_and_sub_limits: ALL specific coverage limits including those within sections:
   [
     {
       "coverage_section": "Section name (e.g., 'Crisis Management', 'Legal Expenses')",
       "limit_amount": numeric value,
       "currency": "GBP|USD|EUR",
       "limit_type": "sub-limit|inner limit|specific coverage",
       "applies_to": "per claim|aggregate|annual",
       "verbatim_text": "Exact wording from policy",
       "page_ref": "page X"
     }
   ]

14. deductibles_excesses: Array of deductibles/excesses with amounts

15. defence_costs_position: How defence costs are treated (e.g., "within limits", "in addition to limits")

16. extended_reporting_period:
   {
     "availability": "Available?",
     "duration": "How long",
     "conditions": "Any conditions",
     "page_ref": "page X"
   }

17. claims_control:
   {
     "control_rights": "Who controls claims",
     "consent_required": "When consent needed",
     "settlement_clause_summary": "Settlement terms",
     "page_ref": "page X"
   }

18. claims_notification:
   {
     "timing": "When to notify",
     "method": "How to notify",
     "strictness": "Strict compliance required?",
     "page_ref": "page X"
   }

19. cancellation:
   {
     "insurer_rights": "Insurer cancellation rights",
     "insured_rights": "Insured cancellation rights",
     "notice": "Notice period required",
     "refunds": "Refund terms",
     "page_ref": "page X"
   }

20. governing_law_and_jurisdiction:
   {
     "law": "Governing law",
     "jurisdiction": "Jurisdiction",
     "page_ref": "page X"
   }

21. dispute_resolution:
   {
     "process": "Dispute resolution process",
     "page_ref": "page X"
   }

22. TLDR:
   {
     "3_bullet_summary": ["Key point 1", "Key point 2", "Key point 3"],
     "what_is_different_or_unusual": "Notable differences from standard market wording",
     "client_attention_items": "Items requiring client attention",
     "overall_complexity": "Low|Medium|High"
   }

23. evidence: Array documenting where key information was found:
   [
     {
       "field": "limits",
       "snippet": "exact text from document",
       "page_ref": "page X"
     }
   ]

CRITICAL INSTRUCTIONS:
- Extract EVERY monetary limit mentioned in the document
- Include currency for all amounts
- Capture both main limits and ALL sub-limits/inner limits
- Look for limits in coverage sections, extensions, and additional coverages
- Extract exact amounts - do not summarize or approximate

Return as valid JSON object with all fields.`;


    // Retry logic for OpenAI API calls
    let extractRes;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[extract-wording] Extraction attempt ${attempt}/${maxRetries}`);
        
        extractRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: systemPrompt + '\n\n' + userPrompt },
                { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
              ]
            }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json'
            }
          }),
        });

        const extractText = await extractRes.text();
        
        if (!extractRes.ok) {
          const errorData = JSON.parse(extractText);
          lastError = errorData;
          
          // Check if it's a server error (5xx) that we should retry
          if (extractRes.status >= 500 && extractRes.status < 600) {
            console.error(`[extract-wording] Server error on attempt ${attempt}:`, extractText.slice(0, 400));
            
            if (attempt < maxRetries) {
              // Exponential backoff: 2s, 4s, 8s
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`[extract-wording] Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          // Non-retryable error or max retries reached
          console.error('[extract-wording] Extract error:', extractText.slice(0, 400));
          return json(req, extractRes.status, { 
            ok: false, 
            stage: 'extract', 
            error: extractText.slice(0, 400),
            retriable: extractRes.status >= 500
          });
        }

        // Success - parse and return
        const extractData = JSON.parse(extractText);
        const content = extractData.candidates?.[0]?.content?.parts?.[0]?.text;
        const structured = typeof content === 'string' ? JSON.parse(content) : content;
        
        console.log('[extract-wording] Extracted in', (performance.now() - t_extract_start).toFixed(0), 'ms');
        console.log('[extract-wording] Usage:', JSON.stringify(extractData.usage));

        const totalTime = (performance.now() - t0).toFixed(0);
        console.log('[extract-wording] Total time:', totalTime, 'ms');

        return json(req, 200, {
          ok: true,
          result: structured,
          meta: {
            documentId,
            filename: document.filename,
            processedAt: new Date().toISOString(),
            model: extractData.model,
            usage: extractData.usage,
            timing: {
              total_ms: parseInt(totalTime),
              fetch_ms: parseInt((t_fetch_start - t0).toFixed(0)),
              upload_ms: parseInt((t_extract_start - t_upload_start).toFixed(0)),
              extract_ms: parseInt((performance.now() - t_extract_start).toFixed(0))
            },
            attempts: attempt
          }
        });
        
      } catch (error) {
        lastError = error;
        console.error(`[extract-wording] Attempt ${attempt} failed:`, String(error));
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[extract-wording] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // All retries failed
    return json(req, 500, { 
      ok: false, 
      stage: 'extract', 
      error: `Extraction failed after ${maxRetries} attempts. Last error: ${JSON.stringify(lastError).slice(0, 200)}`,
      retriable: true
    });

  } catch (error) {
    console.error('[extract-wording] Error at stage:', stage);
    console.error('[extract-wording] Error:', String(error));
    
    return json(req, 500, {
      ok: false,
      stage,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
});
