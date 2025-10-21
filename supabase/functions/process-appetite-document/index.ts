import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { validateRequest, processAppetiteDocumentSchema, createErrorResponse } from '../_shared/validation.ts';

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

    // Validate request input with strict schema
    let appetiteDocumentId: string | null = null;
    try {
      const validated = await validateRequest(req, processAppetiteDocumentSchema);
      appetiteDocumentId = validated.appetiteDocumentId;
    } catch (validationError: any) {
      console.error('Validation error:', validationError.message);
      return createErrorResponse(req, 400, validationError.message, corsHeaders);
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
      .update({ status: 'processing', processing_error: null })
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

    // Prepare comprehensive OpenAI prompt for appetite document processing
    const prompt = `You are an expert insurance underwriter appetite analyzer. Extract comprehensive structured data from this underwriter appetite document for carrier matching.

CRITICAL: Extract ALL appetite criteria in detail. Look for:
1. Insurance products offered (Cyber, Tech E&O, D&O, PI, Property, GL, etc.)
2. Coverage amount ranges (min/max per product)
3. Jurisdictions and geographies (normalize to ISO codes where possible)
4. Industry classes and sectors
5. Revenue and employee ranges
6. Security/eligibility requirements
7. Explicit exclusions and declines
8. Distribution/placement notes

Return a JSON object with this structure:
{
  "underwriter_name": "string",
  "product_type": "string (primary product: Cyber, PI, D&O, Property, etc.)",
  "segments": ["array: SME, Mid-Market, Enterprise, etc."],
  "coverage_amount_min": number (in GBP/USD),
  "coverage_amount_max": number,
  "jurisdictions": ["array: GB, US, GB-ENG, US-CA, etc. - normalize to ISO 3166"],
  "geographic_coverage": ["array: UK, Europe, Worldwide, North America"],
  "industry_classes": ["array: Healthcare, Financial Services, Technology, etc."],
  "target_sectors": ["array: more specific sectors"],
  "revenue_range_min": number,
  "revenue_range_max": number,
  "employee_range_min": number,
  "employee_range_max": number,
  "security_requirements": ["array: MFA, EDR, Backups, SIEM, etc."],
  "exclusions": ["array: explicit exclusions like 'Crypto exchanges', 'Adult content'"],
  "placement_notes": "string (wholesale only, minimum premium, broker authority, etc.)",
  "minimum_premium": number,
  "maximum_premium": number,
  "distribution_type": "string (wholesale, retail, both)",
  "financial_ratings": {
    "sp": "string",
    "am_best": "string",
    "fitch": "string",
    "moodys": "string"
  },
  "coverage_limits": {
    "cyber_min": number,
    "cyber_max": number,
    "pi_min": number,
    "pi_max": number,
    "do_max": number,
    "property_max": number
  },
  "policy_features": {
    "nil_excess_available": boolean,
    "worldwide_coverage": boolean,
    "online_portal": boolean,
    "quick_quotes": boolean
  },
  "specialty_focus": ["array"],
  "broker_features": {
    "portal_name": "string",
    "quote_turnaround": "string",
    "mta_support": boolean
  },
  "risk_appetite": "conservative | moderate | aggressive",
  "additional_products": ["array"]
}

IMPORTANT EXTRACTION RULES:
- For coverage amounts, look for patterns like "up to £10m", "£1m-£5m", "minimum £500k"
- Normalize currencies to GBP (store original if different)
- Extract jurisdictions as ISO codes: GB (UK), US (USA), GB-ENG (England), US-CA (California)
- Map region names: DACH → DE/AT/CH, Nordics → DK/NO/SE/FI
- Identify exclusions from phrases like "we do not cover", "excluded", "not accepted"
- Extract security requirements from cyber insurance sections
- Revenue/employee ranges from phrases like "turnover up to £50m", "10-500 employees"

Document Content:
${documentContent}

Underwriter Name: ${appetiteDoc.underwriter_name}
Document Type: ${appetiteDoc.document_type}
Coverage Category: ${appetiteDoc.coverage_category || 'Unknown'}

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
        max_completion_tokens: 3000
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
      .update({ status: 'processed', processing_error: null })
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
      if (appetiteDocumentId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase
          .from('underwriter_appetites')
          .update({ 
            status: 'error',
            processing_error: (error as any).message 
          })
          .eq('id', appetiteDocumentId);
      }
    } catch (updateError) {
      console.error('Failed to update appetite document status:', updateError);
    }

    return new Response(JSON.stringify({ error: (error as any).message }), {
      status: (String((error as any).message).includes('429') ? 429 : 500),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});