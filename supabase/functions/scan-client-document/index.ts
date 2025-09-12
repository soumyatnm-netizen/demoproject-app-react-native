import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientExtractedData {
  client_name?: string;
  contact_email?: string;
  contact_phone?: string;
  coverage_requirements?: string[];
  risk_profile?: string;
  industry?: string;
  employee_count?: number;
  revenue_band?: string;
  main_address?: string;
  postcode?: string;
  date_established?: string;
  organisation_type?: string;
  website?: string;
  years_experience?: number;
  total_employees?: number;
  wage_roll?: number;
  income_breakdown?: {
    last_year?: number;
    current_year_expectation?: number;
    next_12_months_estimate?: number;
  };
  customer_locations?: {
    uk_percentage?: number;
    eu_percentage?: number;
    usa_canada_percentage?: number;
    rest_of_world_percentage?: number;
  };
  usa_canada_details?: {
    subsidiaries?: string[];
    income?: number;
    largest_contracts?: Array<{
      customer_name?: string;
      work_description?: string;
      length?: string;
      value?: number;
    }>;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Fetch the document from Supabase
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download the file content from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Convert the file to base64 for OpenAI (handle large files properly)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid call stack overflow
    let binaryString = '';
    const chunkSize = 8192; // Process in 8KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Data = btoa(binaryString);
    
    // Create the OpenAI prompt for client data extraction
    const prompt = `
    You are a document analysis AI. Extract client/business information from this insurance policy or quote document.

    Extract the following information if available in the document:

    REQUIRED FIELDS:
    - Business/Client name
    - Contact Email 
    - Contact Phone 
    - Coverage Requirements (as array)
    - Risk Profile (low/medium/high)
    - Industry
    - Employee Count (number)
    - Revenue Band
    - Main address
    - Postcode

    OPTIONAL FIELDS:
    - Date business established
    - Type of organisation (Ltd, PLC, etc.)
    - Website
    - Relevant years of experience
    - Total number of employees
    - Total wage roll
    - Income breakdown (last year, current year expectation, next 12 months estimate)
    - Customer location & jurisdiction breakdown (UK, EU, USA/Canada, Rest of world percentages)
    - USA/Canada specific: subsidiaries, income, largest contracts (customer name, work, length, value)

    Return ONLY a valid JSON object with the extracted data. Use null for fields that cannot be found. 
    For arrays, return empty arrays if no data found.
    For revenue_band, use format like "1-5m" for £1M - £5M.
    For risk_profile, return one of: "low", "medium", "high".
    For coverage_requirements, return as array of strings.

    Example format:
    {
      "client_name": "ABC Ltd",
      "contact_email": "info@abc.com",
      "contact_phone": "+44 123 456 7890",
      "coverage_requirements": ["Public Liability", "Professional Indemnity"],
      "risk_profile": "medium",
      "industry": "technology",
      "employee_count": 50,
      "revenue_band": "5-10m",
      "main_address": "123 Business Street, London",
      "postcode": "SW1A 1AA"
    }
    `;

    // Call OpenAI API with document image
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${document.file_type};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIResult = await openAIResponse.json();
    const extractedText = openAIResult.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error('No content extracted from document');
    }

    console.log('Raw OpenAI response:', extractedText);

    // Parse the JSON response
    let extractedData: ClientExtractedData;
    try {
      // Clean the response to extract JSON
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw text:', extractedText);
      throw new Error('Failed to parse extracted data as JSON');
    }

    // Update document status
    await supabase
      .from('documents')
      .update({ 
        status: 'processed',
        processing_error: null 
      })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedData,
        documentId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in scan-client-document function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});