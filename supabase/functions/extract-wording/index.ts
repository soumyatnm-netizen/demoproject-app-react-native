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

    // Upload to OpenAI
    stage = "upload_openai";
    const t_upload_start = performance.now();
    const pdfFile = new File([pdfBytes], document.filename || 'wording.pdf', { type: 'application/pdf' });
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
      console.error('[extract-wording] Upload error:', upText.slice(0, 400));
      return json(req, upRes.status, { ok: false, stage: 'upload', error: upText.slice(0, 400) });
    }
    
    const uploadData = JSON.parse(upText);
    const fileId = uploadData.id;
    console.log('[extract-wording] Uploaded to OpenAI:', fileId, 'in', (performance.now() - t_upload_start).toFixed(0), 'ms');

    // Extract wording with focused schema
    stage = "extract";
    const t_extract_start = performance.now();
    
    const systemPrompt = "Extract wording fields. JSON only.";
    const userPrompt = `NEEDED:
form_name_or_code, version_date, coverage_trigger,
insuring_clauses[{title,summary,page_ref}],
definitions_notable[{term,delta_from_market,verbatim_excerpt,page_ref}],
exclusions[], conditions[], warranties[], endorsements[],
limits[], sublimits[], inner_limits_and_sub_limits[],
deductibles_excesses[], defence_costs_position,
extended_reporting_period{availability,duration,conditions,page_ref},
claims_control{control_rights,consent_required,settlement_clause_summary,page_ref},
claims_notification{timing,method,strictness,page_ref},
cancellation{insurer_rights,insured_rights,notice,refunds,page_ref},
governing_law_and_jurisdiction{law,jurisdiction,page_ref},
dispute_resolution{process,page_ref},
TLDR{3_bullet_summary,what_is_different_or_unusual,client_attention_items,overall_complexity},
evidence[{field,snippet,page_ref}]`;

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
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      }),
    });

    const extractText = await extractRes.text();
    if (!extractRes.ok) {
      console.error('[extract-wording] Extract error:', extractText.slice(0, 400));
      return json(req, extractRes.status, { ok: false, stage: 'extract', error: extractText.slice(0, 400) });
    }

    const extractData = JSON.parse(extractText);
    const content = extractData.choices[0].message.content;
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
        }
      }
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
