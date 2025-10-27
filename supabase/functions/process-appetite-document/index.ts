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
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }
...
    // Call Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{
              text: 'You are an expert insurance underwriter appetite analyzer. Extract structured data from appetite guides, product brochures, and underwriter documentation. Always return valid JSON.\n\n' + prompt
            }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', response.status, errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const extractedText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

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