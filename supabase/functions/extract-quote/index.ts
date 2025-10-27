console.log("[extract-quote] boot");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// Helper to convert PDF bytes to base64
async function pdfToBase64(bytes: Uint8Array): Promise<string> {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

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
    console.log('=== Extract Quote Function Started ===');
    
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

    console.log('[extract-quote] documentId:', documentId);

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

    console.log('[extract-quote] Document:', document.filename);

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
    console.log('[extract-quote] PDF fetched:', sizeMB, 'MB in', (performance.now() - t_fetch_start).toFixed(0), 'ms');

    if (pdfBytes.byteLength > 20 * 1024 * 1024) {
      return json(req, 413, { ok: false, error: 'PDF too large (max 20MB)' });
    }

    // Convert PDF to base64 for Gemini
    stage = "convert_pdf";
    const t_convert_start = performance.now();
    
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    console.log('[extract-quote] Converted to base64 in', (performance.now() - t_convert_start).toFixed(0), 'ms');

    // Extract quote with OpenAI using the uploaded file
    stage = "extract";
    const t_extract_start = performance.now();
    
    const systemPrompt = "You are a CoverCompass specialist insurance document analyzer. Extract ONLY actual values as stated in the document. Never infer missing cover - only flag what's explicitly absent. You must use the extract_quote_data tool to return structured data with exact verbatim values and page references.";
    
    const userPrompt = `OBJECTIVE: Extract only the actual values of limits, deductibles/excesses, retroactive dates, indemnity periods, territorial/jurisdiction restrictions, subjectivities, sub-limits, and extensions exactly as written in the quote or policy wording.

EXTRACTION RULES:

1. EXACT DATA CAPTURE
   - Always extract stated figures verbatim (e.g. "GBP 25,000 deductible each and every claim")
   - Include the basis (e.g. "each and every claim", "aggregate", "costs inclusive")
   - Include section title (e.g. "Insuring Clause 5.D: Crisis Communication Costs")
   - Provide page reference + verbatim snippet for evidence

2. DO NOT INFER "MISSING COVER"
   - If a limit isn't separately itemised (e.g. AI liability inside PI), record as part of main section
   - Use "No cover given" ONLY if document explicitly states it or section is entirely absent
   - Never assume something is excluded just because standalone sub-limit is not shown

3. SUB-LIMIT RECOGNITION
   - Differentiate between headline limits (e.g. Cyber £5m e&e) and small sub-limits (e.g. Post-Breach Remediation £50k)
   - Do NOT replace a £5m limit with a £50k sub-limit
   - Show both: headline_limit AND sub_limits array

4. SPECIAL CONDITIONS & SUBJECTIVITIES
   - Capture ALL mandatory requirements (e.g. incident response app registration) with deadlines
   - Store verbatim wording in subjectivities array

5. RETROACTIVE DATE
   - Always capture retroactive dates as written
   - If unlimited or "none stated", record "unlimited"

6. INDEMNITY PERIODS & TIME FRANCHISE
   - Extract exact months/hours
   - Do not assume industry norms; only capture what is printed

7. PROPERTY/BI/EXTENSIONS
   - Capture each extension separately (e.g. denial of access, suppliers failure, utilities outage)
   - Record their sub-limits exactly

8. ERP / RUN-OFF TERMS
   - Record availability, duration, and cost basis (e.g. "12 months at 100% of annual premium")

EXPECTED OUTPUT STRUCTURE:
{
  "Insurer_Name": "string",
  "Client_Name": "string",
  "Product_Type": "string",
  "Industry": "string",
  "Policy_Number": "string",
  "Quote_Reference": "string",
  "Quote_Date": "YYYY-MM-DD",
  "Policy_Start_Date": "YYYY-MM-DD",
  "Policy_End_Date": "YYYY-MM-DD",
  "Premium_Total_Annual": number,
  "Premium_Currency": "GBP",
  "professional_indemnity": {
    "limit": "GBP 5,000,000 e&e",
    "deductible": "GBP 25,000 e&e incl costs",
    "retroactive_date": "01 Aug 2023",
    "source": {"page": 12, "snippet": "Deductible: GBP25,000 each and every claim"}
  },
  "cyber": {
    "headline_limit": "GBP 5,000,000 e&e",
    "deductible": "GBP 25,000 e&e incl costs",
    "sub_limits": [
      {"coverage": "Post-Breach Remediation", "limit": "GBP 50,000", "deductible": "GBP 0"}
    ]
  },
  "crime": {
    "funds_transfer_fraud": {"limit": "GBP 100,000", "deductible": "GBP 1,000"},
    "customer_payment_fraud": {"limit": "GBP 50,000", "deductible": "GBP 1,000"}
  },
  "business_interruption": {
    "indemnity_period": "12 months",
    "time_franchise": "8 hours",
    "extensions": [
      {"coverage": "suppliers failure", "limit": "GBP 25,000"},
      {"coverage": "utilities outage >24h", "limit": "GBP 25,000"}
    ]
  },
  "property": {
    "buildings": "No cover given",
    "general_contents": "GBP 1,101,585 aggregate"
  },
  "territorial_limits": "Worldwide excl. USA/Canada",
  "subjectivities": [
    {
      "requirement": "Download & register incident response mobile app",
      "deadline": "30 days post-binding",
      "page_ref": 3,
      "verbatim_excerpt": "exact text from document"
    }
  ],
  "erp": {
    "duration": "12 months",
    "cost": "100% of annual premium"
  },
  "Inclusions": ["coverage1", "coverage2"],
  "Exclusions_Summary": ["exclusion1", "exclusion2"],
  "attack_points": [
    {"issue": "Unusually high deductible", "value": "GBP 50,000", "benchmark": "Typical: GBP 10,000-25,000"}
  ]
}

QUALITY CHECKS:
- Cross-check that every headline £5m limit is still recorded, even if sub-limits exist
- Highlight "No cover given" explicitly where the quote states it
- Flag unusually high deductibles (>£25k), short BI periods (<24m), or low crime/fraud limits (<£250k) in "attack_points" array
- Base only on extracted values, not assumptions

Return as valid JSON object.`;

    // Define tool for structured output
    const extractTool = {
      type: "function" as const,
      function: {
        name: "extract_quote_data",
        description: "Extract structured data from insurance quote document",
        parameters: {
          type: "object",
          properties: {
            Insurer_Name: { type: "string" },
            Client_Name: { type: "string" },
            Product_Type: { type: "string" },
            Industry: { type: "string" },
            Policy_Number: { type: "string" },
            Quote_Reference: { type: "string" },
            Quote_Date: { type: "string" },
            Policy_Start_Date: { type: "string" },
            Policy_End_Date: { type: "string" },
            Premium_Total_Annual: { type: "number" },
            Premium_Currency: { type: "string" },
            Coverage_Summary: { type: "object" },
            Inclusions: { type: "array", items: { type: "string" } },
            Exclusions_Summary: { type: "array", items: { type: "string" } },
          },
          required: ["Insurer_Name", "Client_Name", "Product_Type", "Premium_Total_Annual"]
        }
      }
    };

    // Retry logic for Lovable AI API calls
    let extractRes;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[extract-quote] Extraction attempt ${attempt}/${maxRetries}`);
        
        // Use Google Gemini with inline PDF
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
          
          // Check for rate limit (429) or payment required (402)
          if (extractRes.status === 429) {
            console.error(`[extract-quote] Rate limit on attempt ${attempt}:`, extractText.slice(0, 400));
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`[extract-quote] Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            return json(req, 429, { 
              ok: false, 
              stage: 'extract', 
              error: 'Rate limit exceeded. Please try again later.'
            });
          }
          
          if (extractRes.status === 402) {
            return json(req, 402, { 
              ok: false, 
              stage: 'extract', 
              error: 'AI credits exhausted. Please add credits to continue.'
            });
          }
          
          // Check if it's a server error (5xx) that we should retry
          if (extractRes.status >= 500 && extractRes.status < 600) {
            console.error(`[extract-quote] Server error on attempt ${attempt}:`, extractText.slice(0, 400));
            
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`[extract-quote] Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          // Non-retryable error or max retries reached
          console.error('[extract-quote] Extract error:', extractText.slice(0, 400));
          return json(req, extractRes.status, { 
            ok: false, 
            stage: 'extract', 
            error: extractText.slice(0, 400),
            retriable: extractRes.status >= 500
          });
        }

        // Success - parse and return
        const extractData = JSON.parse(extractText);
        
        // Extract from Gemini response
        const responseText = extractData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          throw new Error('No content in Gemini response');
        }
        
        const structured = JSON.parse(responseText);
        console.log('[extract-quote] Extracted in', (performance.now() - t_extract_start).toFixed(0), 'ms');
        console.log('[extract-quote] Usage:', JSON.stringify(extractData.usage || {}));

        // Save to structured_quotes table
        stage = "save_quote";
        const { data: quoteData, error: quoteError } = await supabase
          .from('structured_quotes')
          .insert({
            document_id: documentId,
            user_id: document.user_id,
            company_id: document.company_id,
            insurer_name: structured.Insurer_Name || 'Unknown',
            client_name: structured.Client_Name || document.filename.split('_')[0] || 'Unknown',
            product_type: structured.Product_Type || 'Unknown',
            industry: structured.Industry || 'Unknown',
            premium_amount: structured.Premium_Total_Annual || 0,
            coverage_limits: structured.Coverage_Summary || {},
            inclusions: structured.Inclusions || [],
            exclusions: structured.Exclusions_Summary || [],
            policy_terms: structured
          })
          .select()
          .single();

        if (quoteError) {
          console.error('[extract-quote] Error saving quote:', quoteError);
          return json(req, 500, { ok: false, stage: 'save_quote', error: quoteError.message });
        }

        const totalTime = (performance.now() - t0).toFixed(0);
        console.log('[extract-quote] Total time:', totalTime, 'ms');

        return json(req, 200, {
          ok: true,
          quoteId: quoteData.id,
          result: structured,
          meta: {
            documentId,
            quoteId: quoteData.id,
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
        console.error(`[extract-quote] Attempt ${attempt} failed:`, String(error));
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[extract-quote] Retrying in ${waitTime}ms...`);
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
    console.error('[extract-quote] Error at stage:', stage);
    console.error('[extract-quote] Error:', String(error));
    
    return json(req, 500, {
      ok: false,
      stage,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
});
