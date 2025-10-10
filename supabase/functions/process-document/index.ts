import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Import schema from shared
const { QUOTE_COMPARISON_SCHEMA } = await import("../_shared/openai-schemas.ts");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestDocumentId: string | null = null;
  try {
    console.log('=== Process Document Function Started (OpenAI Native PDF) ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasOpenAIKey: !!openAIApiKey
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { documentId, clientName } = await req.json();
    requestDocumentId = documentId;

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    if (!clientName) {
      throw new Error('Client name is required');
    }

    console.log('Processing document ID:', documentId, 'for client:', clientName);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log('Document found:', document.filename);

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Get signed URL for the document
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 3600);

    if (urlError || !signedUrlData) {
      throw new Error('Failed to create signed URL');
    }

    console.log('Uploading PDF to OpenAI...');

    // Fetch PDF and upload to OpenAI
    const pdfRes = await fetch(signedUrlData.signedUrl);
    if (!pdfRes.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
    }

    const blob = new Blob([await pdfRes.arrayBuffer()], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', blob, document.filename);
    form.append('purpose', 'assistants');

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIApiKey}` },
      body: form
    });

    const uploaded = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error('OpenAI upload failed:', JSON.stringify(uploaded).slice(0, 300));
      throw new Error(`OpenAI upload failed: ${uploadRes.status}`);
    }

    const fileId = uploaded.id;
    console.log('PDF uploaded to OpenAI, file ID:', fileId);

    // Call OpenAI Responses API
    const systemText =
      'You are an expert insurance analyst for commercial lines. ' +
      'Extract and normalise quote details (limits, sublimits, deductibles/excess, exclusions, endorsements, conditions, premiums, taxes/fees, dates, jurisdiction/territory). ' +
      'Compare carriers conservatively and include citations. Only output valid JSON per the schema.';

    const userText = `Client: ${clientName}\n\nAnalyse the attached PDF and produce JSON that strictly matches the schema.`;

    const requestBody = {
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemText }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userText },
            { type: 'input_file', mime_type: 'application/pdf', transfer_method: 'auto', file_id: fileId }
          ]
        }
      ],
      response_format: { type: 'json_schema', json_schema: QUOTE_COMPARISON_SCHEMA },
      temperature: 0,
      max_output_tokens: 2000
    };

    console.log('Calling OpenAI Responses API...');
    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const rawResponse = await aiRes.text();
    if (!aiRes.ok) {
      console.error('OpenAI API error:', aiRes.status, rawResponse.slice(0, 400));
      throw new Error(`OpenAI API failed: ${aiRes.status}`);
    }

    const parsed = JSON.parse(rawResponse);
    const jsonText =
      parsed?.output?.[0]?.content?.[0]?.text ??
      parsed?.content?.[0]?.text ??
      parsed?.output_text ??
      parsed?.choices?.[0]?.message?.content;

    const structuredData = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
    const tokenUsage = parsed?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    console.log('OpenAI analysis complete, tokens:', JSON.stringify(tokenUsage));

    // Extract first quote from structured comparison data
    const firstQuote = structuredData.quotes?.[0];
    if (!firstQuote || !firstQuote.carrier) {
      throw new Error('No valid quote data found in extracted comparison');
    }

    // Map to database format
    const dbQuoteData = {
      insurer_name: firstQuote.carrier,
      product_type: firstQuote.product || 'Unknown',
      industry: null,
      revenue_band: null,
      premium_amount: firstQuote.premium?.base || firstQuote.premium?.total || null,
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
      throw new Error(`Failed to save quote data: ${insertError.message}`);
    }

    console.log('Quote saved with ID:', insertData.id);

    // Update document status
    await supabase
      .from('documents')
      .update({ status: 'processed' })
      .eq('id', documentId);

    console.log('=== Process Document Completed Successfully ===');

    return new Response(JSON.stringify({
      ok: true,
      result: structuredData,
      tokens: tokenUsage,
      metadata: {
        documentId,
        quoteId: insertData.id,
        clientName,
        insurerName: dbQuoteData.insurer_name,
        processedAt: new Date().toISOString(),
        model: parsed?.model || 'gpt-4o-mini'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    return new Response(JSON.stringify({
      ok: false,
      error: (error as any).message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
