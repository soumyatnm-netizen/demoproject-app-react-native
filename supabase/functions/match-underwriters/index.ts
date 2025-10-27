import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, clientProfile } = await req.json();

    if (!documentId) {
      throw new Error('documentId is required');
    }

    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    console.log('Starting underwriter matching for document:', documentId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the processed document data
    const { data: documentData, error: docError } = await supabase
      .from('processed_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !documentData) {
      throw new Error('Document not found or error fetching document');
    }

    console.log('Fetched document data for:', documentData.file_name);

    // Fetch all underwriter appetite data
    const { data: appetiteData, error: appetiteError } = await supabase
      .from('underwriter_appetite_data')
      .select('*');

    if (appetiteError) {
      console.error('Error fetching appetite data:', appetiteError);
      throw new Error('Failed to fetch underwriter appetite data');
    }

    console.log(`Found ${appetiteData?.length || 0} underwriter appetite documents`);

    // Build the matching prompt
    const documentDetails = JSON.stringify(documentData.extracted_data || {}, null, 2);
    const appetiteDetails = appetiteData?.map(a => ({
      underwriter_name: a.underwriter_name,
      target_sectors: a.target_sectors,
      risk_appetite: a.risk_appetite,
      minimum_premium: a.minimum_premium,
      maximum_premium: a.maximum_premium,
      geographic_coverage: a.geographic_coverage,
      additional_products: a.additional_products,
    })) || [];

    const matchingPrompt = `You are an expert insurance broker AI. Match this client's insurance requirement document with appropriate underwriters.

CLIENT DOCUMENT DETAILS:
${documentDetails}

${clientProfile ? `CLIENT PROFILE:
${JSON.stringify(clientProfile, null, 2)}
` : ''}

AVAILABLE UNDERWRITERS:
${JSON.stringify(appetiteDetails, null, 2)}

Analyze the client's requirements and match them with the most suitable underwriters. For each match, provide:
1. underwriter_name: The name of the underwriter
2. match_score: A score from 0-100 indicating suitability
3. match_rank: Ranking (1 being best match)
4. match_reasoning: Detailed explanation of why this is a good match
5. compatibility_factors: Array of specific compatibility points
6. risk_assessment: Assessment of potential risks or concerns
7. recommended_premium_range: Suggested premium range based on appetite
8. coverage_gaps: Any gaps between client needs and underwriter appetite
9. competitive_advantages: Why this underwriter would be competitive

Return an array of matches sorted by match_score (highest first). Include only underwriters with a match_score of 40 or higher.

Respond with valid JSON only in this exact format:
[{
  "underwriter_name": "string",
  "match_score": number,
  "match_rank": number,
  "match_reasoning": "string",
  "compatibility_factors": ["string"],
  "risk_assessment": "string",
  "recommended_premium_range": "string",
  "coverage_gaps": ["string"],
  "competitive_advantages": ["string"]
}]`;

    console.log('Sending request to Google Gemini for matching analysis');

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
              text: 'You are an expert insurance broker AI specializing in underwriter matching. Always respond with valid JSON only.\n\n' + matchingPrompt
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
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('Received response from Google Gemini');

    let matchingResults;
    try {
      const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log('AI Response content:', content);
      
      // Parse the JSON response
      matchingResults = JSON.parse(content);
      
      if (!Array.isArray(matchingResults)) {
        throw new Error('Response is not an array');
      }

    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI matching results');
    }

    console.log(`Processed ${matchingResults.length} underwriter matches`);

    // Clear existing matches for this document
    const { error: deleteError } = await supabase
      .from('underwriter_matches')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      console.error('Error deleting existing matches:', deleteError);
    }

    // Store the matching results in the database
    const matchesToInsert = matchingResults.map((match: any) => {
      // Find the corresponding appetite document
      const appetiteDoc = appetiteData?.find(a => a.underwriter_name === match.underwriter_name);
      
      return {
        document_id: documentId,
        appetite_document_id: appetiteDoc?.appetite_document_id || null,
        underwriter_name: match.underwriter_name,
        match_score: match.match_score,
        match_rank: match.match_rank,
        match_reasoning: match.match_reasoning,
        compatibility_factors: match.compatibility_factors,
        risk_assessment: match.risk_assessment,
        recommended_premium_range: match.recommended_premium_range,
        coverage_gaps: match.coverage_gaps,
        competitive_advantages: match.competitive_advantages,
      };
    });

    const { data: insertedMatches, error: insertError } = await supabase
      .from('underwriter_matches')
      .insert(matchesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting matches:', insertError);
      throw new Error('Failed to save matching results');
    }

    console.log(`Successfully saved ${insertedMatches?.length || 0} matches`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Underwriter matching completed successfully',
        matches_found: insertedMatches?.length || 0,
        matches: insertedMatches
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in match-underwriters function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});