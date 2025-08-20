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

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    console.log('Processing document:', documentId);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Convert file to base64 for OpenAI (for PDF processing)
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Prepare OpenAI request based on file type
    let prompt: string;
    let content: any[];

    if (document.file_type === 'application/pdf') {
      // For PDFs, we'll use text extraction approach since vision model has limitations with PDFs
      prompt = `You are an expert insurance document processor. Extract structured data from this insurance document.

Please extract and return a JSON object with the following structure:
{
  "insurer_name": "string",
  "product_type": "string (e.g., 'Property', 'Liability', 'Motor', 'Professional Indemnity')",
  "industry": "string (client's industry if mentioned)",
  "revenue_band": "string (e.g., '1M-5M', '5M-10M')",
  "premium_amount": number,
  "premium_currency": "string (default 'GBP')",
  "quote_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "deductible_amount": number,
  "coverage_limits": {
    "public_liability": number,
    "employers_liability": number,
    "property_damage": number,
    "business_interruption": number
  },
  "inner_limits": {
    "any_one_claim": number,
    "aggregate": number
  },
  "inclusions": ["array of covered items"],
  "exclusions": ["array of excluded items"],
  "policy_terms": {
    "territory": "string",
    "period": "string",
    "renewal_date": "YYYY-MM-DD or null"
  },
  "quote_status": "quoted" | "declined" | "bound"
}

Extract as much information as possible. If a field cannot be determined, use null or an empty array as appropriate. Focus on key financial figures, coverage details, and insurer information.`;

      content = [
        {
          type: "text",
          text: prompt
        }
      ];
    } else {
      // For other document types, use simpler text processing
      prompt = `Extract insurance quote information from this document and return structured JSON data with insurer name, premium amount, coverage details, and key terms.`;
      
      content = [
        {
          type: "text",
          text: prompt
        }
      ];
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an expert insurance document analyzer. Extract structured data from insurance quotes, policies, and schedules. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt + '\n\nDocument filename: ' + document.filename
          }
        ],
        max_completion_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const extractedText = aiResponse.choices[0].message.content;

    console.log('AI Response:', extractedText);

    // Parse JSON from AI response
    let structuredData;
    try {
      // Try to find JSON in the response
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', extractedText);
      // Create fallback structured data
      structuredData = {
        insurer_name: 'Unknown',
        product_type: null,
        industry: null,
        revenue_band: null,
        premium_amount: null,
        premium_currency: 'GBP',
        quote_date: null,
        expiry_date: null,
        deductible_amount: null,
        coverage_limits: {},
        inner_limits: {},
        inclusions: [],
        exclusions: [],
        policy_terms: {},
        quote_status: 'quoted'
      };
    }

    // Save structured data to database
    const { error: insertError } = await supabase
      .from('structured_quotes')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: structuredData.insurer_name || 'Unknown Insurer',
        product_type: structuredData.product_type,
        industry: structuredData.industry,
        revenue_band: structuredData.revenue_band,
        premium_amount: structuredData.premium_amount,
        premium_currency: structuredData.premium_currency || 'GBP',
        quote_date: structuredData.quote_date,
        expiry_date: structuredData.expiry_date,
        deductible_amount: structuredData.deductible_amount,
        coverage_limits: structuredData.coverage_limits,
        inner_limits: structuredData.inner_limits,
        inclusions: structuredData.inclusions,
        exclusions: structuredData.exclusions,
        policy_terms: structuredData.policy_terms,
        quote_status: structuredData.quote_status || 'quoted'
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save structured data');
    }

    // Update document status to processed
    await supabase
      .from('documents')
      .update({ status: 'processed' })
      .eq('id', documentId);

    console.log('Document processed successfully:', documentId);

    return new Response(JSON.stringify({ 
      success: true,
      documentId,
      extractedData: structuredData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-document function:', error);
    
    // Update document status to error if we have documentId
    try {
      const { documentId } = await req.json();
      if (documentId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('documents')
          .update({ 
            status: 'error',
            processing_error: error.message 
          })
          .eq('id', documentId);
      }
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});