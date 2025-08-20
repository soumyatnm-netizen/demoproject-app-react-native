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

    const { appetiteDocumentId } = await req.json();

    if (!appetiteDocumentId) {
      throw new Error('Appetite Document ID is required');
    }

    console.log('Processing appetite document:', appetiteDocumentId);

    // Get appetite document details
    const { data: appetiteDoc, error: docError } = await supabase
      .from('underwriter_appetites')
      .select('*')
      .eq('id', appetiteDocumentId)
      .single();

    if (docError || !appetiteDoc) {
      throw new Error('Appetite document not found');
    }

    // Update status to processing
    await supabase
      .from('underwriter_appetites')
      .update({ status: 'processing' })
      .eq('id', appetiteDocumentId);

    let documentContent = '';

    // Handle different document sources
    if (appetiteDoc.source_url && appetiteDoc.file_type === 'web/url') {
      // For web URLs, fetch the content
      try {
        const webResponse = await fetch(appetiteDoc.source_url);
        if (appetiteDoc.source_url.toLowerCase().includes('.pdf')) {
          // For PDF URLs, we'll use the URL in the prompt
          documentContent = `Document URL: ${appetiteDoc.source_url}`;
        } else {
          // For web pages, get the HTML content
          documentContent = await webResponse.text();
        }
      } catch (fetchError) {
        console.error('Failed to fetch URL content:', fetchError);
        documentContent = `Document URL: ${appetiteDoc.source_url}`;
      }
    } else if (appetiteDoc.storage_path) {
      // For uploaded files, download from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(appetiteDoc.storage_path);

      if (downloadError || !fileData) {
        throw new Error('Failed to download appetite document');
      }

      // Convert file to text (simplified for now)
      const arrayBuffer = await fileData.arrayBuffer();
      documentContent = `Document: ${appetiteDoc.filename}`;
    }

    // Prepare OpenAI prompt for appetite document processing
    const prompt = `You are an expert insurance underwriter appetite analyzer. Extract structured data from this underwriter appetite document.

Please extract and return a JSON object with the following structure:
{
  "underwriter_name": "string (e.g., 'Tokio Marine HCC', 'Lloyd's of London')",
  "financial_ratings": {
    "sp": "string (S&P rating like 'A+', 'AA-')",
    "am_best": "string (A.M. Best rating like 'A++', 'A+')",
    "fitch": "string (Fitch rating like 'AA-', 'A+')",
    "moodys": "string (Moody's rating if available)"
  },
  "coverage_limits": {
    "professional_indemnity_min": number,
    "professional_indemnity_max": number,
    "public_liability_max": number,
    "employers_liability_max": number,
    "management_liability_max": number,
    "cyber_liability_max": number
  },
  "target_sectors": ["array of target industries/sectors like 'IT', 'Media', 'Consultants', 'Estate Agents'"],
  "geographic_coverage": ["array like 'UK', 'Europe', 'Worldwide', 'North America'"],
  "policy_features": {
    "nil_excess_available": boolean,
    "worldwide_coverage": boolean,
    "annual_policies": boolean,
    "interest_free_payment": boolean,
    "online_portal": boolean,
    "quick_quotes": boolean,
    "bespoke_products": boolean
  },
  "exclusions": ["array of common exclusions or restrictions"],
  "minimum_premium": number,
  "maximum_premium": number,
  "specialty_focus": ["array like 'SME', 'Large Corporate', 'Specialty Risks'"],
  "broker_features": {
    "portal_name": "string (if they have an online portal)",
    "quote_turnaround": "string (e.g., 'within minutes', '24 hours')",
    "mta_support": boolean,
    "renewal_support": boolean
  },
  "risk_appetite": "conservative | moderate | aggressive",
  "additional_products": ["array of other products they offer like 'Cyber', 'D&O', 'Construction'"]
}

Key information to look for:
- Company name and financial strength ratings
- Coverage limits and product offerings
- Target professional sectors and industries
- Geographic coverage areas
- Special features like nil excess, worldwide coverage
- Broker-friendly features like online portals
- Risk appetite indicators
- Minimum/maximum premiums or revenue bands

Document Content:
${documentContent}

Underwriter Name: ${appetiteDoc.underwriter_name}
Document Type: ${appetiteDoc.document_type}

Extract as much relevant information as possible. If a field cannot be determined, use null or an empty array as appropriate.`;

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
            content: 'You are an expert insurance underwriter appetite analyzer. Extract structured data from appetite guides, product brochures, and underwriter documentation. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 3000,
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
        underwriter_name: appetiteDoc.underwriter_name,
        financial_ratings: {},
        coverage_limits: {},
        target_sectors: [],
        geographic_coverage: [],
        policy_features: {},
        exclusions: [],
        minimum_premium: null,
        maximum_premium: null,
        specialty_focus: [],
        broker_features: {},
        risk_appetite: 'moderate',
        additional_products: []
      };
    }

    // Save structured appetite data to database
    const { error: insertError } = await supabase
      .from('underwriter_appetite_data')
      .insert({
        appetite_document_id: appetiteDocumentId,
        underwriter_name: structuredData.underwriter_name || appetiteDoc.underwriter_name,
        financial_ratings: structuredData.financial_ratings || {},
        coverage_limits: structuredData.coverage_limits || {},
        target_sectors: structuredData.target_sectors || [],
        geographic_coverage: structuredData.geographic_coverage || [],
        policy_features: structuredData.policy_features || {},
        exclusions: structuredData.exclusions || [],
        minimum_premium: structuredData.minimum_premium,
        maximum_premium: structuredData.maximum_premium,
        specialty_focus: structuredData.specialty_focus || [],
        broker_features: structuredData.broker_features || {},
        risk_appetite: structuredData.risk_appetite || 'moderate',
        additional_products: structuredData.additional_products || [],
        logo_url: appetiteDoc.logo_url // Include logo URL from the appetite document
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save structured appetite data');
    }

    // Update appetite document status to processed
    await supabase
      .from('underwriter_appetites')
      .update({ status: 'processed' })
      .eq('id', appetiteDocumentId);

    console.log('Appetite document processed successfully:', appetiteDocumentId);

    return new Response(JSON.stringify({ 
      success: true,
      appetiteDocumentId,
      extractedData: structuredData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-appetite-document function:', error);
    
    // Update appetite document status to error if we have appetiteDocumentId
    try {
      const requestData = await req.json();
      const { appetiteDocumentId } = requestData;
      if (appetiteDocumentId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('underwriter_appetites')
          .update({ 
            status: 'error',
            processing_error: error.message 
          })
          .eq('id', appetiteDocumentId);
      }
    } catch (updateError) {
      console.error('Failed to update appetite document status:', updateError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});