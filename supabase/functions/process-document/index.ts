import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getDocument, GlobalWorkerOptions } from "npm:pdfjs-dist@3.4.120/legacy/build/pdf.mjs";

// Optional worker (some regions disallow it; fallback available)
GlobalWorkerOptions.workerSrc = "npm:pdfjs-dist@3.4.120/legacy/build/pdf.worker.mjs";
// If worker fetching fails in your region, comment the line above and use this fallback:
// GlobalWorkerOptions.workerSrc = null as unknown as string;

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

    // pdf.js configured via npm legacy build at top-level (no DOM/polyfills needed)
    console.log('Extracting text from PDF...');
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    const loadingTask = getDocument({
      data: pdfBytes,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    
    console.log("PDF size:", pdfBytes.byteLength, "pages:", pdf.numPages);

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      extractedText += `\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    console.log('Text extracted, length:', extractedText.length, 'chars');

    // Prepare AI prompt for insurance quote extraction
    const extractionPrompt = `You are an expert assistant that extracts structured insurance quote data from PDF text. Return ONLY valid JSON with these fields:
{
  "insurer_name": string,
  "product_type": string | null,
  "industry": string | null,
  "revenue_band": string | null,
  "premium_amount": number | null,
  "premium_currency": string | null,
  "quote_date": string | null,
  "expiry_date": string | null,
  "deductible_amount": number | null,
  "coverage_limits": object,
  "inner_limits": object,
  "inclusions": string[],
  "exclusions": string[],
  "policy_terms": object
}
- Use null when not found.
- Normalize currency to ISO code and amounts to numbers when possible.
- Do not include markdown or commentary.`;

    const fullPrompt = `${extractionPrompt}\n\nDOCUMENT TEXT:\n${extractedText}`;

    // Use OpenAI directly for text analysis (GPT-5-mini excels at structured extraction)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`OPENAI key present: ${openAIApiKey ? "yes" : "no"}`);
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI GPT-5-mini for extraction...');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_completion_tokens: 4096
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || null;

    if (!aiContent) {
      throw new Error('No content extracted from AI response');
    }

    console.log('AI extraction successful, parsing JSON...');
    console.log('Extracted text preview:', aiContent.substring(0, 200));

    // Parse JSON from AI response (handle markdown code blocks if present)
    let structuredData;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                       aiContent.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      structuredData = JSON.parse(jsonMatch[1]);
      console.log('Successfully parsed structured data:', structuredData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw AI response:', aiContent);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Validate required fields
    if (!structuredData.insurer_name) {
      throw new Error('Insurer name not found in extracted data');
    }

    // Save to database
    console.log('Saving extracted quote to database...');
    const { data: insertData, error: insertError } = await supabase
      .from('structured_quotes')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: structuredData.insurer_name,
        product_type: structuredData.product_type || 'Unknown',
        industry: structuredData.industry || 'Not Specified',
        revenue_band: structuredData.revenue_band || null,
        premium_amount: structuredData.premium_amount || null,
        premium_currency: structuredData.premium_currency || 'GBP',
        quote_date: structuredData.quote_date || null,
        expiry_date: structuredData.expiry_date || null,
        deductible_amount: structuredData.deductible_amount || null,
        coverage_limits: structuredData.coverage_limits || {},
        inner_limits: structuredData.inner_limits || {},
        inclusions: structuredData.inclusions || [],
        exclusions: structuredData.exclusions || [],
        policy_terms: structuredData.policy_terms || {},
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
      success: true,
      documentId,
      quoteId: insertData.id,
      extractedData: structuredData,
      message: 'Document processed successfully with AI extraction'
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
      error: (error as any).message,
      details: (error as any).stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
