console.log("[extract-quote] boot");
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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return json(req, 500, { ok: false, error: 'LOVABLE_API_KEY not configured' });
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

    // Convert PDF to base64 for Lovable AI
    stage = "encode_pdf";
    const t_encode_start = performance.now();
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    console.log('[extract-quote] PDF encoded in', (performance.now() - t_encode_start).toFixed(0), 'ms');

    // Extract quote with Gemini 2.5 Pro
    stage = "extract";
    const t_extract_start = performance.now();
    
    const systemPrompt = "You are a CoverCompass specialist insurance document analyzer. Extract all fields with maximum precision from insurance quotes. Target >95% confidence for all extractions. You must use the extract_quote_data tool to return structured data.";
    
    const userPrompt = `Extract the following fields from this insurance quote document (Quote Schedule). Be thorough and precise.

**PHASE 1: STRUCTURED DATA EXTRACTION (QUOTES)**

Extract with HIGH CONFIDENCE (Target >95%):

**PRICING (High Priority)**
- Premium_Net: Net premium amount (Currency format: "GBP 65,952.65")
- Premium_IPT: Insurance Premium Tax (Currency)
- Premium_Total_Annual: Total annual premium payable - **CRITICAL: Look for "TOTAL PAYABLE" or "ANNUAL TOTAL" labels** (Currency)
- Policy_Admin_Fee: Policy admin fee if separate (Currency) [Medium Priority]

**LIMITS (High Priority)**
- Limit_Indemnity_PI_E&O: Professional Indemnity/Errors & Omissions limit (Currency, e.g., "GBP 5,000,000")
- Limit_Indemnity_Cyber_Overall: Overall Cyber Insurance limit (Currency)
- Limit_Indemnity_PL_Products: Public/Products Liability limit (Currency)
- Limit_Indemnity_Crime_Theft: Crime/Employee Theft limit (Currency)
- Limit_Basis: Is limit "aggregate" or "any one claim"? Specify for each coverage type

**DEDUCTIBLES (High Priority)**
- Deductible_PI_Standard: PI deductible per claim/loss (Currency)
- Deductible_Cyber_FirstParty: Cyber first-party losses/BI deductible (Currency)
- Deductible_Crime_Standard: Crime/theft deductible (Currency)
- Deductible_Basis: Per claim, per loss, costs-inclusive/exclusive? Specify

**DATES (High Priority)**
- Policy_Period_Start: Policy inception date (YYYY-MM-DD)
- Policy_Period_Expiry: Policy expiry date (YYYY-MM-DD)
- Quote_Expiry_Date: Quote validity expiry date (YYYY-MM-DD) [Medium Priority]

**COVERAGE DETAILS**
- Coverage_Type: List of all coverage types included (e.g., ["Professional Indemnity", "Cyber & Data", "Crime"])
- Costs_Inclusive: Are defence costs inside or outside the limit? Specify per coverage
- Territorial_Limits: Geographic coverage (e.g., "Worldwide excluding USA/Canada")
- Jurisdiction: Governing law (e.g., "England and Wales")

**INNER LIMITS & SUB-LIMITS**
Extract ALL sublimits mentioned:
- inner_limits: Array of objects:
  [
    { 
      "coverage_name": "Legal Expenses", 
      "limit": 100000, 
      "currency": "GBP", 
      "applies_to": "per claim",
      "description": "Legal defence costs"
    },
    { 
      "coverage_name": "Crisis Management", 
      "limit": 50000, 
      "currency": "GBP", 
      "applies_to": "aggregate",
      "description": "PR and crisis response"
    }
  ]

**CYBER-SPECIFIC DETAILS (If Applicable)**
- Cyber_BI_Indemnity_Period: Business Interruption coverage period (e.g., "90 days", "365 days")
- Cyber_BI_Time_Excess: BI time excess (e.g., "8 hours", "24 hours")
- Cyber_AICOW_Limit: Additional Increased Cost of Working limit
- Cyber_Operational_Error_Limit: Operational error coverage limit
- Cyber_Dependent_BI_Limit: Dependent business interruption limit
- Cyber_Crime_Limit: Cyber crime limit
- Cyber_Crime_Excess: Cyber crime excess/deductible
- Cyber_Security_Requirements: Minimum security conditions (MFA, EDR, patching, etc.)

**PROPERTY-SPECIFIC DETAILS (If Applicable)**
- Property_Sum_Insured_Buildings: Buildings sum insured
- Property_Sum_Insured_Contents: Contents sum insured
- Property_Sum_Insured_Stock: Stock sum insured
- Property_Excess: Standard excess amount
- Property_Excess_Subsidence: Subsidence-specific excess
- Property_Cover_Type: "All Risks", "Named Perils", "Specified Cover"
- Property_Valuation_Basis: "Reinstatement", "Indemnity", "First Loss"
- Property_BI_Period: Business Interruption indemnity period
- Property_Security_Requirements: Security warranties (alarm type, locks, etc.)
- Property_Unoccupied_Exclusion: Days before unoccupied property exclusion applies

**SUBJECTIVITIES (Critical)**
Extract ALL pre-binding conditions that must be satisfied:
- subjectivities: Array of objects:
  [
    {
      "title": "Brief description",
      "category": "documentation|risk_improvement|financial|security|survey|other",
      "is_mandatory": true,
      "verbatim_excerpt": "Exact text from document",
      "deadline_days": Number of days if specified,
      "page_ref": "Page X"
    }
  ]

**EXCLUSIONS & CONDITIONS**
- exclusions_noted: Array of key exclusions
- conditions_warranties_noted: Array of conditions precedent and warranties
- endorsements_noted: Array of endorsements/modifications

**KEY TERMS**
- broker_commission: Commission % or amount
- payment_terms: Payment schedule
- premium_adjustability: Can premium be adjusted?
- retro_date: Retroactive date if applicable

**EVIDENCE TRAIL**
- evidence: Document where ALL key data points were found:
  [
    {
      "field": "Premium_Total_Annual",
      "value": "GBP 65,952.65",
      "snippet": "exact text from document",
      "page_ref": "Page 2"
    }
  ]

**OUTPUT FORMAT:**
Return a comprehensive JSON object with ALL fields above. Use null for fields not found. Include confidence scores where data is ambiguous.

CRITICAL INSTRUCTIONS:
1. Extract EVERY monetary value with exact currency
2. Distinguish between aggregate vs any-one-claim limits
3. Distinguish between costs-inclusive vs costs-exclusive
4. Flag ALL subjectivities as these are binding conditions
5. Note all security requirements as these are potential claim declinature risks
6. For Cyber: BI period and time excess are CRITICAL - extract precisely
7. For Property: Security warranties and unoccupied exclusions are CRITICAL
8. Provide evidence trail for all key extractions


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
        
        extractRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { 
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`
                    }
                  }
                ]
              }
            ],
            tools: [extractTool],
            tool_choice: { type: "function", function: { name: "extract_quote_data" } }
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
        
        // Extract tool call result
        const toolCall = extractData.choices[0].message.tool_calls?.[0];
        if (!toolCall || toolCall.function.name !== 'extract_quote_data') {
          throw new Error('No valid tool call in response');
        }
        
        const structured = JSON.parse(toolCall.function.arguments);
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
              encode_ms: parseInt((t_encode_start - t_fetch_start).toFixed(0)),
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
