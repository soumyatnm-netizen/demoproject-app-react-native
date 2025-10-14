console.log("[process-document] boot NO_PDFJS");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { validateRequest, processDocumentSchema, sanitizeOutput, createErrorResponse } from '../_shared/validation.ts';

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

  let requestDocumentId: string | null = null;
  try {
    console.log('=== Process Document Function Started ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('[openai] keyPresent:', openAIApiKey ? 'yes' : 'no');

    if (!supabaseUrl || !supabaseKey) {
      return json(req, 500, { ok: false, error: 'Missing Supabase environment variables' });
    }

    if (!openAIApiKey) {
      return json(req, 500, { ok: false, error: 'OPENAI_API_KEY not configured' });
    }

    // Validate request input with strict schema
    let documentId: string;
    let clientName: string;
    try {
      const validated = await validateRequest(req, processDocumentSchema);
      documentId = validated.documentId;
      clientName = validated.clientName;
      requestDocumentId = documentId;
    } catch (validationError: any) {
      console.error('Validation error:', validationError.message);
      return createErrorResponse(req, 400, validationError.message, corsHeaders(req));
    }

    console.log('Processing document ID:', documentId, 'for client:', sanitizeOutput(clientName));

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return json(req, 404, { ok: false, error: `Document not found: ${docError?.message}` });
    }

    console.log('Document found:', document.filename);

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

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

    if (pdfBytes.byteLength > 30 * 1024 * 1024) {
      return json(req, 413, { ok: false, error: 'PDF too large (max 30MB)' });
    }

    // Upload PDF to OpenAI Files API
    const pdfFile = new File([pdfBytes], document.filename || 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('purpose', 'assistants');

    console.log('Uploading PDF to OpenAI Files API...');
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: formData
    });

    const uploadText = await uploadResponse.text();
    if (!uploadResponse.ok) {
      console.error('[OpenAI] Upload error:', uploadText.slice(0, 400));
      return json(req, 500, { ok: false, error: `OpenAI upload failed: ${uploadText.slice(0, 400)}` });
    }

    const uploadData = JSON.parse(uploadText);
    const fileId = uploadData.id;
    console.log('[openai] uploaded fileId:', fileId);

    // Import schemas and normalizer
    const { QUOTE_COMPARISON_SCHEMA } = await import("../_shared/openai-schemas.ts");
    const { normalizeStrictJsonSchema, findFirstRequiredMismatch, assertObjectSchema } = await import("../_shared/schema-utils.ts");
    
    console.log('[schema QC] root.type:', QUOTE_COMPARISON_SCHEMA.schema?.type);
    
    // Normalize schema for strict mode
    const QC_STRICT = normalizeStrictJsonSchema(
      structuredClone(QUOTE_COMPARISON_SCHEMA.schema)
    );
    assertObjectSchema("QUOTE_COMPARISON_SCHEMA", QC_STRICT);
    
    console.log('[schema QC] first keys:', Object.keys(QC_STRICT.properties || {}).slice(0,5));
    const mismatchQC = findFirstRequiredMismatch(QC_STRICT);
    if (mismatchQC) {
      console.error('[schema QC] required mismatch at:', mismatchQC);
      return json(req, 500, { ok: false, error: `Schema 'QuoteComparison' not strict: ${mismatchQC}` });
    }

    // Call OpenAI Responses API with native PDF
    console.log('Calling OpenAI Responses API...');
    const body = {
      model: "gpt-4o-mini",
      input: [
        { 
          role: "system", 
          content: [{ 
            type: "input_text", 
            text: "You are an expert insurance analyst for commercial lines. Extract and normalise quote details (limits, sublimits, deductibles/excess, exclusions, endorsements, conditions, premiums, taxes/fees, dates, jurisdiction/territory). Compare carriers conservatively and include citations. Only output valid JSON per the schema."
          }] 
        },
        { 
          role: "user", 
          content: [
            { type: "input_text", text: `Client: ${clientName}\n\nAnalyze the attached insurance quote PDF and return structured JSON per schema.` },
            { type: "input_file", file_id: fileId }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "QuoteComparison",
          schema: QC_STRICT
        }
      },
      temperature: 0,
      max_output_tokens: 2000
    };

    const responsesResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responsesText = await responsesResponse.text();
    if (!responsesResponse.ok) {
      console.error('[OpenAI] Responses error:', responsesText.slice(0, 400));
      return json(req, 500, { ok: false, error: `OpenAI Responses failed: ${responsesText.slice(0, 400)}` });
    }

    const responsesData = JSON.parse(responsesText);
    let outputText = responsesData?.output?.[0]?.content?.[0]?.text 
      ?? responsesData?.content?.[0]?.text 
      ?? responsesData?.output_text
      ?? responsesData?.choices?.[0]?.message?.content;
    
    console.log('[openai] output preview:', String(outputText).slice(0, 400));
    
    let structuredData: any;
    try {
      structuredData = typeof outputText === 'string' ? JSON.parse(outputText) : outputText;
    } catch (e) {
      console.error('[openai] JSON.parse failed. First 400 chars:', String(outputText).slice(0, 400));
      return json(req, 502, { ok: false, error: 'Model returned non-JSON. See logs for details.' });
    }
    
    console.log('[openai] model:', responsesData?.model, 'usage:', JSON.stringify(responsesData?.usage ?? null));

    // Extract first quote from structured comparison data
    const firstQuote = structuredData.quotes?.[0];
    if (!firstQuote || !firstQuote.carrier) {
      return json(req, 422, { ok: false, error: 'No valid quote data found in extracted comparison' });
    }

    // Map to database format
    const dbQuoteData = {
      insurer_name: firstQuote.carrier,
      product_type: firstQuote.product || 'Unknown',
      industry: null,
      revenue_band: null,
      premium_amount: Math.round(firstQuote.premium?.base || firstQuote.premium?.total || 0),
      premium_currency: 'GBP',
      quote_date: firstQuote.effective_date || null,
      expiry_date: firstQuote.expiry_date || null,
      deductible_amount: firstQuote.deductibles?.[0]?.amount ? parseFloat(firstQuote.deductibles[0].amount.replace(/[^0-9.]/g, '')) : null,
      coverage_limits: firstQuote.limits?.reduce((acc: any, limit: any) => {
        acc[limit.name] = limit.amount;
        return acc;
      }, {}) || {},
      inner_limits: firstQuote.sublimits?.reduce((acc: any, sublimit: any) => {
        acc[sublimit.name] = sublimit.amount;
        return acc;
      }, {}) || {},
      inclusions: firstQuote.endorsements || [],
      exclusions: firstQuote.exclusions || [],
      policy_terms: {
        warranties: firstQuote.warranties || [],
        conditions: firstQuote.conditions || [],
        notable_terms: firstQuote.notable_terms || [],
        territory: firstQuote.territory,
        jurisdiction: firstQuote.jurisdiction,
        retro_date: firstQuote.retro_date
      }
    };

    // Save to database
    console.log('Saving to database...');
    const { data: insertData, error: insertError } = await supabase
      .from('structured_quotes')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: dbQuoteData.insurer_name,
        product_type: dbQuoteData.product_type,
        industry: dbQuoteData.industry,
        revenue_band: dbQuoteData.revenue_band,
        premium_amount: dbQuoteData.premium_amount,
        premium_currency: dbQuoteData.premium_currency,
        quote_date: dbQuoteData.quote_date,
        expiry_date: dbQuoteData.expiry_date,
        deductible_amount: dbQuoteData.deductible_amount,
        coverage_limits: dbQuoteData.coverage_limits,
        inner_limits: dbQuoteData.inner_limits,
        inclusions: dbQuoteData.inclusions,
        exclusions: dbQuoteData.exclusions,
        policy_terms: dbQuoteData.policy_terms,
        quote_status: 'quoted',
        client_name: clientName
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return json(req, 500, { ok: false, error: `Failed to save quote data: ${insertError.message}` });
    }

    console.log('Quote saved with ID:', insertData.id);

    // Update document status
    await supabase
      .from('documents')
      .update({ status: 'processed' })
      .eq('id', documentId);

    console.log('=== Process Document Completed Successfully ===');

    return json(req, 200, {
      ok: true,
      result: structuredData,
      meta: {
        documentId,
        quoteId: insertData.id,
        clientName,
        insurerName: dbQuoteData.insurer_name,
        processedAt: new Date().toISOString(),
        model: responsesData?.model || 'gpt-4o-mini',
        usage: responsesData?.usage
      }
    });

  } catch (error) {
    console.error('=== PROCESS DOCUMENT ERROR ===');
    console.error('Error:', (error as any).message);
    console.error('Stack:', (error as any).stack);

    // Update document status to error
    try {
      if (requestDocumentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('documents')
            .update({
              status: 'error',
              processing_error: (error as any).message
            })
            .eq('id', requestDocumentId);
        }
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }

    return json(req, 500, {
      ok: false,
      error: (error as any).message,
      timestamp: new Date().toISOString()
    });
  }
});
