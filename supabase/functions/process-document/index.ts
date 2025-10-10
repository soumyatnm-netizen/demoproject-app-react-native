import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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

    // Convert to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      for (let j = 0; j < sub.length; j++) {
        binaryString += String.fromCharCode(sub[j]);
      }
    }
    const base64Data = btoa(binaryString);

    console.log('File converted to base64, size:', base64Data.length, 'chars, calling AI for extraction...');

    // Prepare AI prompt for insurance quote extraction
    const extractionPrompt = `Extract structured insurance quote data from this document. You MUST return ONLY valid JSON with these exact fields (no markdown, no explanations):

{
  "insurer_name": "Full insurer company name (e.g., Hiscox, CFC, Allianz, Aviva, RSA, etc.)",
  "product_type": "Type of insurance product (e.g., Professional Indemnity, Public Liability, Combined Commercial)",
  "industry": "Industry/sector of the insured business",
  "revenue_band": "Revenue range (e.g., 1M-5M, 5M-10M)",
  "premium_amount": <number - annual premium in GBP>,
  "premium_currency": "GBP",
  "quote_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "deductible_amount": <number - excess/deductible amount>,
  "coverage_limits": {
    "professional_indemnity": <number or null - coverage limit>,
    "public_liability": <number or null - coverage limit>,
    "employers_liability": <number or null - coverage limit>
  },
  "inner_limits": {
    "any_one_claim": <number or null>,
    "aggregate": <number or null>
  },
  "inclusions": ["Array of covered items/benefits"],
  "exclusions": ["Array of exclusions/limitations"],
  "policy_terms": {
    "territory": "Coverage territory (e.g., United Kingdom, Worldwide)",
    "period": "Policy duration (e.g., 12 months)",
    "renewal_date": "YYYY-MM-DD"
  }
}

CRITICAL INSTRUCTIONS:
1. Extract the ACTUAL insurer name from the document - do not make it up
2. Extract the REAL premium amount - look for "Premium", "Total Premium", "Annual Premium"
3. Look for policy numbers, quote references, and coverage details
4. If a field cannot be found, use null for numbers or empty arrays for lists
5. Return ONLY the JSON object, no additional text`;

    // Call Lovable AI using proper document processing format
    // Gemini natively supports PDF documents through data URI
    const dataUri = `data:application/pdf;base64,${base64Data}`;
    
    // Build robust payload variants to handle provider quirks with PDFs
    const payloadVariants = [
      {
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              { type: 'image_url', image_url: { url: dataUri } }
            ]
          }
        ]
      },
      {
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              { type: 'image_url', image_url: { url: dataUri, detail: 'high' } }
            ]
          }
        ]
      },
      {
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: extractionPrompt },
              { type: 'image_url', image_url: { url: dataUri } }
            ]
          }
        ]
      }
    ];

    let aiResponse: Response | null = null;
    let lastErrorText = '';

    for (let i = 0; i < payloadVariants.length; i++) {
      console.log(`Calling AI for extraction attempt ${i + 1}/${payloadVariants.length}...`);
      const rsp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadVariants[i]),
      });

      if (rsp.ok) { aiResponse = rsp; break; }
      lastErrorText = await rsp.text();
      console.error('AI attempt failed:', rsp.status, lastErrorText);
    }

    if (!aiResponse) {
      throw new Error(`AI extraction failed: ${lastErrorText || 'Unknown error'}`);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const extractedText = aiResult.choices?.[0]?.message?.content || null;

    if (!extractedText) {
      throw new Error('No content extracted from AI response');
    }

    console.log('AI extraction successful, parsing JSON...');
    console.log('Extracted text preview:', extractedText.substring(0, 200));

    // Parse JSON from AI response (handle markdown code blocks if present)
    let structuredData;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = extractedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                       extractedText.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      structuredData = JSON.parse(jsonMatch[1]);
      console.log('Successfully parsed structured data:', structuredData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw AI response:', extractedText);
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
