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
    
    const systemPrompt = `You are CoverCompass AI, a specialist insurance document analyzer. You will receive multiple insurance documents (quotes and policy wordings) and must perform a comprehensive comparison analysis.

Your task:
1. Classify each document (carrier, type, version)
2. Extract key data from each document
3. Compare all documents across selected coverage sections
4. Identify gaps, advantages, and recommendations

Return structured JSON with complete analysis.`;

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

**Selected Coverage Sections to Analyze:**
${selectedSectionNames.length > 0 ? selectedSectionNames.join(', ') : 'All sections'}

**Documents:**
${fetchedDocs.map((doc, idx) => `${idx + 1}. ${doc.filename} (${doc.carrier_name}, ${doc.document_type})`).join('\n')}

**Instructions:**
1. For each document, extract:
   - Insurer name, policy details, premium
   - Coverage limits, deductibles, sub-limits
   - Key terms, exclusions, subjectivities
   - ONLY for the selected sections above

2. Compare all documents:
   - Premium comparison
   - Coverage breadth per section
   - Key differences and gaps
   - Broker recommendations

3. Output format:
{
  "insurers": [
    {
      "insurer_name": "string",
      "premiums": {
        "total_payable": number,
        "annual_premium": number,
        "currency": "GBP"
      }
    }
  ],
  "product_comparisons": [
    {
      "product": "Professional Indemnity|Cyber & Data|etc",
      "carrier_results": [
        {
          "carrier": "string",
          "key_terms": ["limit: X", "deductible: Y"],
          "subjectivities": [],
          "standout_points": []
        }
      ],
      "broker_notes": "Coverage assessment"
    }
  ],
  "overall_findings": ["key insight 1", "key insight 2"],
  "failed_documents": []
}

**CRITICAL:** Only analyze sections in the selected list: ${selectedSectionNames.join(', ')}. Do not analyze other sections.`;

    // STEP 3: Call Gemini with all documents in one batch
    console.log('[batch-analyze] Calling Gemini with batch...');
    const t_ai_start = performance.now();
    
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[batch-analyze] Attempt ${attempt}/${maxRetries}`);

        // Build parts array with text + all PDFs
        const parts: any[] = [
          { text: systemPrompt + '\n\n' + userPrompt }
        ];

        // Add all documents as inline data
        for (const doc of fetchedDocs) {
          parts.push({
            inline_data: {
              mime_type: 'application/pdf',
              data: doc.base64
            }
          });
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
          const errorData = JSON.parse(geminiText);
          lastError = errorData;
          
          // Retry on server errors
          if (geminiRes.status >= 500 && geminiRes.status < 600) {
            console.error(`[batch-analyze] Server error on attempt ${attempt}:`, geminiText.slice(0, 400));
            
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`[batch-analyze] Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          console.error('[batch-analyze] Gemini error:', geminiText.slice(0, 400));
          return json(req, geminiRes.status, { 
            ok: false, 
            error: geminiText.slice(0, 400),
            retriable: geminiRes.status >= 500
          });
        }

        // Parse response
        const geminiData = JSON.parse(geminiText);
        const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!content) {
          throw new Error('No content in Gemini response');
        }

        const analysis = typeof content === 'string' ? JSON.parse(content) : content;
        
        const t_ai = performance.now() - t_ai_start;
        const t_total = performance.now() - t0;
        
        console.log(`[batch-analyze] Success in ${Math.round(t_ai)}ms`);
        console.log(`[batch-analyze] Total time: ${Math.round(t_total)}ms`);

        return json(req, 200, {
          ok: true,
          analysis,
          meta: {
            client_name,
            documents_processed: fetchedDocs.length,
            documents_failed: documents.length - fetchedDocs.length,
            model: geminiData.model,
            usage: geminiData.usage,
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
        console.error(`[batch-analyze] Attempt ${attempt} failed:`, String(error));
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[batch-analyze] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

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
