console.log("[batch-analyze-documents] boot");
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

// Helper to convert PDF bytes to base64 (safely chunked to avoid stack overflow)
function pdfToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// JSON extraction/repair helpers
function extractJsonFromText(raw: string): string | null {
  if (!raw) return null;
  // Prefer fenced code block ```json ... ```
  const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  // Fallback: grab the largest {...} slice
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return null;
}

function stripControlChars(s: string): string {
  // Remove non-printable control chars except tab/newline/carriage return
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

function tryParseJsonLoose(raw: string): any {
  // 1) direct parse
  try { return JSON.parse(raw); } catch {}
  // 2) extract JSON from text or fences
  const extracted = extractJsonFromText(raw);
  if (extracted) {
    const cleaned = removeTrailingCommas(stripControlChars(extracted));
    try { return JSON.parse(cleaned); } catch (e) {
      // try once more removing stray backticks
      const noTicks = cleaned.replace(/```/g, '');
      return JSON.parse(noTicks);
    }
  }
  // 3) last resort: remove backticks and attempt parse
  const noTicks = raw.replace(/```/g, '');
  const cleaned = removeTrailingCommas(stripControlChars(noTicks));
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders(req) });
  }

  const t0 = performance.now();
  
  try {
    console.log('=== Batch Analyze Documents Function Started ===');
    
    const bodyIn = await req.json();
    const { documents, client_name, client_ref, industry, jurisdiction, selectedSections } = bodyIn;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return json(req, 400, { ok: false, error: 'No documents provided' });
    }

    console.log(`[batch-analyze] Processing ${documents.length} documents`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!geminiApiKey) {
      return json(req, 500, { ok: false, error: 'GOOGLE_GEMINI_API_KEY not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // STEP 1: Fetch all documents and convert to base64
    console.log('[batch-analyze] Fetching documents...');
    const t_fetch_start = performance.now();
    
    const documentPromises = documents.map(async (doc: any) => {
      try {
        // Get document from DB
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', doc.document_id)
          .single();

        if (docError || !document) {
          console.error(`[batch-analyze] Document not found: ${doc.document_id}`);
          return null;
        }

        // Get signed URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.storage_path, 300);

        if (urlError || !urlData?.signedUrl) {
          console.error(`[batch-analyze] Failed to get signed URL for ${document.filename}`);
          return null;
        }

        // Fetch PDF
        const pdfResponse = await fetch(urlData.signedUrl);
        if (!pdfResponse.ok) {
          console.error(`[batch-analyze] Failed to fetch PDF for ${document.filename}`);
          return null;
        }

        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const sizeMB = (pdfBytes.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[batch-analyze] Fetched ${document.filename}: ${sizeMB} MB`);

        if (pdfBytes.byteLength > 20 * 1024 * 1024) {
          console.error(`[batch-analyze] PDF too large: ${document.filename}`);
          return null;
        }

        const base64Pdf = pdfToBase64(pdfBytes);

        return {
          filename: document.filename,
          document_id: doc.document_id,
          carrier_name: doc.carrier_name,
          document_type: doc.document_type,
          base64: base64Pdf,
          size_mb: sizeMB
        };
      } catch (error) {
        console.error(`[batch-analyze] Error processing ${doc.filename}:`, error);
        return null;
      }
    });

    const fetchedDocs = (await Promise.all(documentPromises)).filter(Boolean);
    const t_fetch = performance.now() - t_fetch_start;
    console.log(`[batch-analyze] Fetched ${fetchedDocs.length}/${documents.length} documents in ${Math.round(t_fetch)}ms`);

    if (fetchedDocs.length === 0) {
      return json(req, 500, { ok: false, error: 'No documents could be fetched' });
    }

    // STEP 2: Build comprehensive prompt with all documents
    console.log('[batch-analyze] Building batch analysis prompt...');
    
    const systemPrompt = `You are CoverCompass AI, a specialist insurance document analyzer. Extract ONLY actual values as stated in documents. Never infer missing cover - only flag what's explicitly absent. You must return structured JSON with exact verbatim values and page references.`;

    const sectionMapping: Record<string, string> = {
      'professional_indemnity': 'Professional Indemnity',
      'cyber': 'Cyber & Data',
      'property': 'Property',
      'employers_liability': 'Employers\' Liability',
      'public_liability': 'Public & Products Liability',
      'directors_officers': 'Directors & Officers (D&O)',
    };

    const selectedSectionNames = selectedSections?.map((s: string) => sectionMapping[s] || s) || [];
    
    const userPrompt = `Analyze these ${fetchedDocs.length} insurance documents for ${client_name}.

**Selected Coverage Sections:** ${selectedSectionNames.length > 0 ? selectedSectionNames.join(', ') : 'All sections'}

**Documents:**
${fetchedDocs.map((doc, idx) => `${idx + 1}. ${doc.filename} (${doc.carrier_name}, ${doc.document_type})`).join('\n')}

**EXTRACTION RULES (CRITICAL - FOLLOW EXACTLY):**

1. EXACT DATA CAPTURE
   - Always extract stated figures verbatim (e.g. "GBP 25,000 deductible each and every claim")
   - Include the basis (e.g. "each and every claim", "aggregate", "costs inclusive")
   - Include section title (e.g. "Insuring Clause 5.D: Crisis Communication Costs")
   - Provide page reference + verbatim snippet for evidence

2. DO NOT INFER "MISSING COVER"
   - If a limit isn't separately itemised (e.g. AI liability inside PI), record as part of main section
   - Use "No cover given" ONLY if document explicitly states it or section is entirely absent
   - Never assume something is excluded just because standalone sub-limit is not shown

3. SUB-LIMIT RECOGNITION (CRITICAL)
   - Differentiate between headline limits (e.g. Cyber £5m e&e) and small sub-limits (e.g. Post-Breach Remediation £50k)
   - Do NOT replace a £5m limit with a £50k sub-limit
   - Show both: headline_limit AND sub_limits array
   - Extract ALL sub-limits mentioned in the document

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

**FOR EACH DOCUMENT, EXTRACT:**

**FOR QUOTES:**
- Insurer_Name, Client_Name, Product_Type, Industry
- Policy_Number, Quote_Reference, Quote_Date
- Policy_Start_Date, Policy_End_Date
- Premium_Total_Annual, Premium_Currency
- professional_indemnity: {limit, deductible, retroactive_date, source}
- cyber: {headline_limit, deductible, sub_limits: [{coverage, limit, deductible}]}
- crime: {funds_transfer_fraud, customer_payment_fraud}
- business_interruption: {indemnity_period, time_franchise, extensions: []}
- property: {buildings, general_contents, equipment}
- employers_liability: {limit, deductible}
- public_liability: {limit, deductible}
- territorial_limits
- subjectivities: [{requirement, deadline, page_ref, verbatim_excerpt}]
- erp: {duration, cost}
- Inclusions, Exclusions_Summary
- attack_points: [{issue, value, benchmark}]

**FOR POLICY WORDINGS:**
- insurer_name, form_name_or_code, version_date, coverage_trigger
- insuring_clauses: [{title, summary, page_ref}]
- definitions_notable: [{term, delta_from_market, verbatim_excerpt, page_ref}]
- exclusions, conditions, warranties, endorsements
- limits: [{limit_type, amount, currency, description, page_ref}]
- sublimits: [{coverage_name, limit, currency, applies_to, description, page_ref}]
- inner_limits_and_sub_limits: [{coverage_section, limit_amount, currency, limit_type, applies_to, verbatim_text, page_ref}]
- deductibles_excesses
- defence_costs_position
- extended_reporting_period, claims_control, claims_notification, cancellation
- governing_law_and_jurisdiction, dispute_resolution
- TLDR: {3_bullet_summary, what_is_different_or_unusual, client_attention_items, overall_complexity}

**COMPARISON OUTPUT FORMAT:**
{
  "insurers": [
    {
      "insurer_name": "Hiscox",
      "document_type": "Quote",
      "premiums": {
        "total_payable": 15234.50,
        "annual_premium": 15234.50,
        "annual_total": 15234.50,
        "ipt": 1234.50,
        "currency": "GBP",
        "base_premium_by_section": {
          "professional_indemnity": 8000,
          "cyber": 3000,
          "property": 2000
        }
      },
      "extracted_data": { /* full extraction as above */ }
    }
  ],
  "product_comparisons": [
    {
      "product": "Professional Indemnity",
      "carrier_results": [
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Limit: £5,000,000 each and every claim",
            "Deductible: £25,000 each and every claim including costs",
            "Retroactive date: 01/08/2023",
            "Defence costs: Within limit of liability"
          ],
          "subjectivities": [
            "Must register incident response app within 30 days"
          ],
          "standout_points": [
            "Higher deductible than CFC (£25k vs £10k)",
            "More restrictive retroactive date",
            "Includes AI liability within main PI cover"
          ]
        },
        {
          "carrier": "CFC",
          "key_terms": [ /* similar detail */ ],
          "subjectivities": [],
          "standout_points": []
        }
      ],
      "broker_notes": "Hiscox offers broader AI coverage but higher deductible. CFC has better retroactive coverage."
    },
    {
      "product": "Cyber & Data",
      "carrier_results": [ /* similar detail */ ],
      "broker_notes": "..."
    }
  ],
  "overall_findings": [
    "CFC offers £10k lower deductible across all sections",
    "Hiscox has more sub-limits which may restrict certain claims",
    "Both include post-breach services but CFC limit is higher (£100k vs £50k)"
  ],
  "failed_documents": []
}

**QUALITY CHECKS:**
- Cross-check that every headline £5m limit is recorded, even if sub-limits exist
- Highlight "No cover given" explicitly where stated
- Flag unusually high deductibles (>£25k), short BI periods (<24m), or low crime limits (<£250k)
- Base only on extracted values, not assumptions
- Extract EVERY monetary amount mentioned in documents

**CRITICAL:** Only analyze these sections: ${selectedSectionNames.join(', ')}. Do not analyze or include other sections in the output.`;

    // STEP 3: Call Gemini with all documents in one batch
    console.log('[batch-analyze] Calling Gemini with batch...');
    const t_ai_start = performance.now();
    
    // Use the latest Gemini 2.5 models with fallback options
    const modelFallbackOrder = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash'
    ];

    const maxRetries = 3;
    let lastError: any;

    // Build parts array with text + all PDFs (computed once)
    const parts: any[] = [
      { text: systemPrompt + '\n\n' + userPrompt }
    ];
    for (const doc of fetchedDocs) {
      parts.push({
        inline_data: {
          mime_type: 'application/pdf',
          data: doc.base64
        }
      });
    }

    for (const modelName of modelFallbackOrder) {
      console.log(`[batch-analyze] Trying model ${modelName}`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[batch-analyze] Attempt ${attempt}/${maxRetries} with ${modelName}`);

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts
                }],
                generationConfig: {
                  temperature: 0,
                  responseMimeType: 'application/json'
                }
              }),
            }
          );

          const geminiText = await geminiRes.text();

          if (!geminiRes.ok) {
            let parsedErr: any = undefined;
            try { parsedErr = JSON.parse(geminiText); } catch {}
            lastError = parsedErr || geminiText;

            const retriable = geminiRes.status === 429 || (geminiRes.status >= 500 && geminiRes.status < 600);
            console.error(`[batch-analyze] ${modelName} error (status ${geminiRes.status}) on attempt ${attempt}:`, String(geminiText).slice(0, 400));

            if (retriable && attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 400);
              console.log(`[batch-analyze] Retrying ${modelName} in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            // If retriable but we've exhausted retries, try next model in the list
            if (retriable) {
              console.warn(`[batch-analyze] Exhausted retries for ${modelName}, moving to next model if available...`);
              break; // break attempts loop, continue outer loop to next model
            }

            // Non-retriable error -> return immediately
            console.error('[batch-analyze] Non-retriable Gemini error:', String(geminiText).slice(0, 400));
            return json(req, geminiRes.status, { 
              ok: false, 
              error: String(geminiText).slice(0, 400),
              retriable: false
            });
          }

          // Parse response (robust JSON handling)
          const geminiData = JSON.parse(geminiText);
          const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!content) {
            throw new Error('No content in Gemini response');
          }

          let analysis: any;
          try {
            analysis = typeof content === 'string' ? tryParseJsonLoose(content) : content;
          } catch (parseErr) {
            console.error('[batch-analyze] JSON parse failed, content head:', String(content).slice(0, 200));
            throw new Error('Invalid JSON from model: ' + (parseErr instanceof Error ? parseErr.message : String(parseErr)));
          }

          const t_ai = performance.now() - t_ai_start;
          const t_total = performance.now() - t0;
          
          console.log(`[batch-analyze] Success with ${modelName} in ${Math.round(t_ai)}ms`);
          console.log(`[batch-analyze] Total time: ${Math.round(t_total)}ms`);

          return json(req, 200, {
            ok: true,
            analysis,
            meta: {
              client_name,
              documents_processed: fetchedDocs.length,
              documents_failed: documents.length - fetchedDocs.length,
              model: modelName,
              timing: {
                total_ms: Math.round(t_total),
                fetch_ms: Math.round(t_fetch),
                ai_ms: Math.round(t_ai)
              },
              attempts: attempt
            }
          });
        } catch (error) {
          lastError = error;
          console.error(`[batch-analyze] Attempt ${attempt} with ${modelName} failed:`, String(error));

          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 400);
            console.log(`[batch-analyze] Retrying ${modelName} in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      // try next model
    }

    // All retries and model fallbacks failed
    return json(req, 503, { 
      ok: false, 
      error: `Batch analysis failed across all models. Last error: ${typeof lastError === 'string' ? lastError.slice(0, 200) : JSON.stringify(lastError).slice(0, 200)}`,
      retriable: true
    });

    // All retries failed
    return json(req, 500, { 
      ok: false, 
      error: `Batch analysis failed after ${maxRetries} attempts. Last error: ${JSON.stringify(lastError).slice(0, 200)}`,
      retriable: true
    });

  } catch (error) {
    console.error('[batch-analyze] Error:', String(error));
    
    return json(req, 500, {
      ok: false,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
});
