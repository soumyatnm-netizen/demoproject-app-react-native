import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting underwriter matching process');

    const { documentId } = await req.json();
    console.log('Processing document ID:', documentId);

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the structured quote data
    const { data: quoteData, error: quoteError } = await supabase
      .from('structured_quotes')
      .select('*')
      .eq('id', documentId)
      .single();

    if (quoteError) {
      console.error('Error fetching quote data:', quoteError);
      throw new Error('Failed to fetch document data');
    }

    console.log('Retrieved quote data for:', quoteData.insurer_name);

    // Get all underwriter appetite data
    const { data: appetiteData, error: appetiteError } = await supabase
      .from('underwriter_appetite_data')
      .select(`
        *,
        appetite_document:underwriter_appetites(*)
      `);

    if (appetiteError) {
      console.error('Error fetching appetite data:', appetiteError);
      throw new Error('Failed to fetch appetite guides');
    }

    console.log(`Found ${appetiteData?.length || 0} appetite guides to analyze`);

    // Prepare the matching analysis prompt
    const matchingPrompt = `
You are an expert insurance broker AI. Analyze the uploaded document against underwriter appetite guides to find the best matches.

UPLOADED DOCUMENT DATA:
- Insurer: ${quoteData.insurer_name}
- Product Type: ${quoteData.product_type}
- Industry: ${quoteData.industry}
- Revenue Band: ${quoteData.revenue_band}
- Premium Amount: ${quoteData.premium_amount} ${quoteData.premium_currency}
- Coverage Limits: ${JSON.stringify(quoteData.coverage_limits)}
- Deductible: ${quoteData.deductible_amount}
- Inclusions: ${JSON.stringify(quoteData.inclusions)}
- Exclusions: ${JSON.stringify(quoteData.exclusions)}

UNDERWRITER APPETITE GUIDES TO ANALYZE:
${appetiteData?.map((appetite, index) => `
${index + 1}. ${appetite.underwriter_name}
   - Target Sectors: ${JSON.stringify(appetite.target_sectors)}
   - Financial Ratings: ${JSON.stringify(appetite.financial_ratings)}
   - Coverage Limits: ${JSON.stringify(appetite.coverage_limits)}
   - Min Premium: ${appetite.minimum_premium}
   - Max Premium: ${appetite.maximum_premium}
   - Risk Appetite: ${appetite.risk_appetite}
   - Geographic Coverage: ${JSON.stringify(appetite.geographic_coverage)}
   - Specialty Focus: ${JSON.stringify(appetite.specialty_focus)}
   - Policy Features: ${JSON.stringify(appetite.policy_features)}
   - Exclusions: ${JSON.stringify(appetite.exclusions)}
`).join('\n')}

TASK: Analyze each underwriter and provide a JSON response with matching results.

For each underwriter, calculate:
1. Match Score (0-100): How well they match the document requirements
2. Match Rank: Ranking from 1 (best) to N (worst)
3. Detailed reasoning for the match
4. Compatibility factors
5. Risk assessment
6. Recommended premium range
7. Coverage gaps (if any)
8. Competitive advantages

Consider these factors:
- Industry/sector alignment
- Revenue band compatibility
- Coverage limits fit
- Premium range alignment
- Risk appetite match
- Geographic coverage
- Product type compatibility
- Policy features alignment
- Exclusions compatibility

Respond with ONLY a valid JSON array like this:
[
  {
    "underwriter_name": "UnderwriterName",
    "match_score": 95,
    "match_rank": 1,
    "match_reasoning": {
      "summary": "Excellent match based on...",
      "strengths": ["Strong sector focus", "Perfect premium range"],
      "weaknesses": ["Minor geographic limitation"],
      "overall_assessment": "Highly recommended"
    },
    "compatibility_factors": {
      "industry_match": 95,
      "revenue_match": 90,
      "premium_match": 100,
      "coverage_match": 85,
      "risk_appetite_match": 90
    },
    "risk_assessment": "Low risk - excellent alignment with appetite",
    "recommended_premium_range": {
      "min": 50000,
      "max": 75000,
      "currency": "GBP",
      "confidence": "high"
    },
    "coverage_gaps": [],
    "competitive_advantages": ["Fast decision making", "Competitive pricing", "Strong claims handling"]
  }
]

Only include underwriters that have a match score above 30. Rank them from 1 (best) to N (worst).
`;

    console.log('Sending request to OpenAI for matching analysis');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert insurance broker AI specializing in underwriter matching. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: matchingPrompt
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('Received response from OpenAI');

    let matchingResults;
    try {
      const content = aiResponse.choices[0].message.content;
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