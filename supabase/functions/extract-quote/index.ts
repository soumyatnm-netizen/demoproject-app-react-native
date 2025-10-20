console.log("[extract-quote] boot");
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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      return json(req, 500, { ok: false, error: 'OPENAI_API_KEY not configured' });
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

    // Upload to OpenAI
    stage = "upload_openai";
    const t_upload_start = performance.now();
    const pdfFile = new File([pdfBytes], document.filename || 'quote.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('purpose', 'assistants');

    const upRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: formData
    });
    
    const upText = await upRes.text();
    if (!upRes.ok) {
      console.error('[extract-quote] Upload error:', upText.slice(0, 400));
      return json(req, upRes.status, { ok: false, stage: 'upload', error: upText.slice(0, 400) });
    }
    
    const uploadData = JSON.parse(upText);
    const fileId = uploadData.id;
    console.log('[extract-quote] Uploaded to OpenAI:', fileId, 'in', (performance.now() - t_upload_start).toFixed(0), 'ms');

    // Extract quote with focused schema
    stage = "extract";
    const t_extract_start = performance.now();
    
    const systemPrompt = "You are a specialist insurance document analyzer. Extract all fields accurately from this insurance quote. Return only valid JSON.";
    const userPrompt = `Extract the following fields from this insurance quote document. Pay special attention to coverage limits and inner limits - extract ALL monetary values with their currencies.

REQUIRED FIELDS:

1. insurer_name: The insurance company providing this quote
2. product_name: The specific insurance product/policy type
3. client_name: The client/insured party name

4. policy_period:
   - inception: Start date (ISO format YYYY-MM-DD)
   - expiry: End date (ISO format YYYY-MM-DD)

5. retro_date: Retroactive date if applicable (ISO format)

6. territorial_limits: Geographic coverage area

7. jurisdiction: Governing law jurisdiction

8. premium:
   - base: Base premium amount (numeric)
   - taxes_fees: Taxes and fees (numeric)
   - total: Total premium (numeric)
   - currency: Currency code (e.g., "GBP", "USD")

9. coverage_limits: Main policy limits as object with structure:
   {
     "aggregate_limit": { "amount": number, "currency": "GBP", "description": "text" },
     "per_claim_limit": { "amount": number, "currency": "GBP", "description": "text" },
     "any_other_limits": { "amount": number, "currency": "GBP", "description": "text" }
   }

10. inner_limits: Sub-limits and specific coverage limits as array:
   [
     { "coverage_name": "Legal Expenses", "limit": 100000, "currency": "GBP", "applies_to": "per claim" },
     { "coverage_name": "Crisis Management", "limit": 50000, "currency": "GBP", "applies_to": "aggregate" }
   ]

11. deductible_amount: Deductible/excess amount (numeric)

12. broker_commission: Commission percentage or amount

13. premium_adjustability: Whether premium can be adjusted

14. payment_terms: Payment schedule and terms

15. quote_valid_until: Quote expiration date (ISO format)

16. endorsements_noted: Array of endorsements mentioned

17. exclusions_noted: Array of exclusions mentioned

18. conditions_warranties_noted: Array of conditions and warranties

19. subjectivities: Array of items requiring action before binding:
   [
     {
       "title": "Brief description",
       "normalized_category": "documentation|risk_improvement|financial|other",
       "is_mandatory": true/false,
       "verbatim_excerpt": "Exact quote from document",
       "page_ref": "page number"
     }
   ]

20. other_key_terms: Array of other important terms

21. evidence: Array documenting where key information was found:
   [
     {
       "field": "coverage_limits",
       "snippet": "exact text from document",
       "page_ref": "page X"
     }
   ]

CRITICAL: Extract ALL monetary amounts accurately with correct currency. For coverage_limits and inner_limits, capture every limit mentioned in the document.

Return as valid JSON object with all fields.

    const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'file', file: { file_id: fileId } }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
    });

    const extractText = await extractRes.text();
    if (!extractRes.ok) {
      console.error('[extract-quote] Extract error:', extractText.slice(0, 400));
      return json(req, extractRes.status, { ok: false, stage: 'extract', error: extractText.slice(0, 400) });
    }

    const extractData = JSON.parse(extractText);
    const content = extractData.choices[0].message.content;
    const structured = typeof content === 'string' ? JSON.parse(content) : content;
    
    console.log('[extract-quote] Extracted in', (performance.now() - t_extract_start).toFixed(0), 'ms');
    console.log('[extract-quote] Usage:', JSON.stringify(extractData.usage));

    const totalTime = (performance.now() - t0).toFixed(0);
    console.log('[extract-quote] Total time:', totalTime, 'ms');

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
        }
      }
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
