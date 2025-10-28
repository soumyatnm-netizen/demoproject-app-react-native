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
  // Guard against platform hard timeout: abort Gemini requests after 55s so we can retry/fallback
  const fetchWithTimeout = async (input: Request | string, init: RequestInit = {}, timeoutMs = 55_000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // @ts-ignore Deno's fetch accepts AbortSignal
      const res = await fetch(input as any, { ...init, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

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
    
    const userPrompt = `You are analyzing ${fetchedDocs.length} insurance PDFs for ${client_name}. Return ONLY compact JSON and keep responses short to fit token limits.

Output JSON schema (no extra keys, no markdown):
{
  "insurers": [
    {
      "insurer_name": string,                  // Prefer provided metadata; else extract
      "document_type": "Quote" | "PolicyWording",
      "premiums": { "total_payable": number | null, "currency": string | null },
      "limits":   { "headline_limit": string | null },
      "deductibles": { "standard": string | null }
    }
  ],
  "overall_findings": string[],
  "failed_documents": []
}

Rules:
- If a value is absent, set it to null. NEVER invent values.
- Strings must be under 120 characters.
- Focus only on sections: ${selectedSectionNames.length > 0 ? selectedSectionNames.join(', ') : 'All sections'}.
- Use the following documents (with helper metadata) and analyze each independently:
${fetchedDocs.map((doc, idx) => `${idx + 1}. ${doc.filename} | carrier_hint=${doc.carrier_name} | type=${doc.document_type}`).join('\n')}
- Return JSON only.`;

    // STEP 3: Call Gemini with all documents in one batch
    console.log('[batch-analyze] Calling Gemini with batch...');
    const t_ai_start = performance.now();
    
    // Use supported Gemini 2.5 models first; skip unsupported 1.5 variants
    const modelFallbackOrder = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
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

          const geminiRes = await fetchWithTimeout(
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
                  maxOutputTokens: 900,
                  responseMimeType: 'application/json'
                }
              }),
            },
            55_000
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

            // If model is not available in this API version or project, try next model
            if (geminiRes.status === 404) {
              console.warn(`[batch-analyze] Model ${modelName} not available (404). Moving to next model...`);
              break; // break attempts loop, continue outer loop to next model
            }

            // If retriable but we've exhausted retries, try next model in the list
            if (retriable) {
              console.warn(`[batch-analyze] Exhausted retries for ${modelName}, moving to next model if available...`);
              break; // break attempts loop, continue outer loop to next model
            }

            // Non-retriable error -> move to next model rather than failing the whole request
            console.error('[batch-analyze] Non-retriable Gemini error (continuing to next model):', String(geminiText).slice(0, 400));
            lastError = parsedErr || geminiText;
            break; // break attempts loop; try next model
          }

          // Parse response (robust JSON handling)
          const geminiData = JSON.parse(geminiText);

          const candidate = geminiData.candidates?.[0];
          const partsOut = candidate?.content?.parts ?? [];
          const combinedText = partsOut
            .map((p: any) => typeof p?.text === 'string' ? p.text : '')
            .filter(Boolean)
            .join('\n')
            .trim();

          if (!combinedText) {
            const finishReason = candidate?.finishReason || geminiData.finishReason;
            console.error('[batch-analyze] Empty content from Gemini.', { finishReason });
            throw new Error('No content in Gemini response');
          }

          let analysis: any;
          try {
            analysis = tryParseJsonLoose(combinedText);
          } catch (parseErr) {
            console.error('[batch-analyze] JSON parse failed, content head:', String(combinedText).slice(0, 200));
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

    // All retries and model fallbacks failed – return a compact heuristic result so the UI can proceed
    const fallbackInsurers = fetchedDocs.map((d: any) => ({
      insurer_name: d.carrier_name || (d.filename?.split('_')[0] || 'Unknown'),
      document_type: d.document_type || 'Unknown',
      premiums: { total_payable: null, currency: null },
      limits: { headline_limit: null },
      deductibles: { standard: null }
    }));

    return json(req, 200, { 
      ok: true,
      analysis: {
        insurers: fallbackInsurers,
        overall_findings: ["AI extraction unavailable; showing document placeholders"],
        failed_documents: []
      },
      meta: { fallback: true, last_error: typeof lastError === 'string' ? lastError.slice(0, 200) : (lastError?.message || JSON.stringify(lastError)?.slice(0, 200)) }
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
