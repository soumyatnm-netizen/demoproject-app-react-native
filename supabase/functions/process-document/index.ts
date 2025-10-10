import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// ✅ 100% server-safe import (no esm.sh rewriting, no es2022 path)
const { getDocument, GlobalWorkerOptions } = await import(
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/legacy/build/pdf.min.mjs"
);

// ✅ Run pdf.js without a worker (Edge-friendly, no DOM/canvas)
GlobalWorkerOptions.workerSrc = null as unknown as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestDocumentId: string | null = null;
  try {
    console.log('=== Process Document Function Started ===');
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    console.log('Environment variables check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasLovableApiKey: !!lovableApiKey,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing'
    });

    console.log("[pdfjs] entry=legacy; workerSrc=", String(GlobalWorkerOptions.workerSrc));
    console.log("[openai] keyPresent=", Deno.env.get("OPENAI_API_KEY") ? "yes" : "no");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Parse request body
    console.log('Parsing request body...');
    const { documentId, clientName } = await req.json();
    requestDocumentId = documentId;

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    if (!clientName) {
      throw new Error('Client name is required - all quotes must be associated with a client');
    }

    console.log('Processing document ID:', documentId, 'for client:', clientName);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document details
    console.log('Fetching document from database...');
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log('Document found:', {
      id: document.id,
      filename: document.filename,
      type: document.file_type,
      size: document.file_size,
      status: document.status
    });

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Download file from storage
    console.log('Downloading file from storage:', document.storage_path);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    console.log('File downloaded, size:', fileData.size);

    // Extract text from PDF using pdfjs-dist
    console.log('Extracting text from PDF...');
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    let loadingTask = getDocument({ data: pdfBytes, isEvalSupported: false, disableFontFace: true });
    try {
      await (await loadingTask).promise; // triggers worker errors early
    } catch {
      GlobalWorkerOptions.workerSrc = null as unknown as string; // run without worker
      loadingTask = getDocument({ data: pdfBytes, isEvalSupported: false, disableFontFace: true });
    }
    const pdf = await loadingTask.promise;
    
    const pdfMetadata = {
      pages: pdf.numPages,
      size: pdfBytes.byteLength
    };
    console.log("PDF loaded successfully - Pages:", pdfMetadata.pages, "| Size:", pdfMetadata.size, "bytes | Worker:", String(GlobalWorkerOptions.workerSrc));

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      extractedText += `\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    console.log('Text extracted, length:', extractedText.length, 'chars');

    // Import schemas and helper
    const { QUOTE_COMPARISON_SCHEMA, callOpenAIResponses } = await import("../_shared/openai-schemas.ts");

    // Use OpenAI Responses API for structured extraction
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`[openai] keyPresent: ${openAIApiKey ? "yes" : "no"}`);
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI Responses API with strict JSON schema...');
    
    const requestBody = {
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You are an expert insurance analyst for commercial lines. Extract and normalise quote details (limits, sublimits, deductibles/excess, exclusions, endorsements, conditions, premiums, taxes/fees, dates, jurisdiction/territory). Compare carriers conservatively and include citations. Only output valid JSON per the schema.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Raw extracted policy text follows. Return JSON per schema.' },
            { type: 'input_text', text: extractedText }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: QUOTE_COMPARISON_SCHEMA
      },
      temperature: 0,
      max_output_tokens: 2000
    };
    
    let aiResult;
    try {
      aiResult = await callOpenAIResponses(openAIApiKey, requestBody);
    } catch (error) {
      console.error('OpenAI Responses API error:', error);
      // Retry once
      console.log('Retrying OpenAI call...');
      try {
        aiResult = await callOpenAIResponses(openAIApiKey, requestBody);
      } catch (retryError) {
        throw new Error(`OpenAI failed after retry: ${retryError.message}`);
      }
    }

    const structuredData = aiResult.result;
    console.log('OpenAI token usage:', JSON.stringify(tokenUsage));
    console.log('AI extraction successful');

    // Extract first quote from structured comparison data
    const firstQuote = structuredData.quotes?.[0];
    if (!firstQuote || !firstQuote.carrier) {
      throw new Error('No valid quote data found in extracted comparison');
    }

    // Map the structured schema to database format
    const dbQuoteData = {
      insurer_name: firstQuote.carrier,
      product_type: firstQuote.product || 'Unknown',
      industry: null, // Not in new schema
      revenue_band: null, // Not in new schema
      premium_amount: firstQuote.premium?.base || firstQuote.premium?.total || null,
      premium_currency: 'GBP', // Could be inferred from amounts if needed
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
    console.log('Saving extracted quote to database...');
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
      throw new Error(`Failed to save quote data: ${insertError.message}`);
    }

    console.log('Quote saved with ID:', insertData.id);

    // Update document status to processed
    await supabase
      .from('documents')
      .update({ status: 'processed' })
      .eq('id', documentId);

    console.log('=== Process Document Function Completed Successfully ===');

    return new Response(JSON.stringify({ 
      ok: true,
      result: structuredData,
      tokens: tokenUsage,
      metadata: {
        ...pdfMetadata,
        documentId,
        quoteId: insertData.id,
        clientName,
        insurerName: dbQuoteData.insurer_name,
        processedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== PROCESS DOCUMENT ERROR ===');
    console.error('Error message:', (error as any).message);
    console.error('Error stack:', (error as any).stack);
    
    // Try to update document status to error
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
      console.error('Failed to update document status in error handler:', updateError);
    }

    return new Response(JSON.stringify({ 
      ok: false,
      error: (error as any).message,
      details: (error as any).stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
