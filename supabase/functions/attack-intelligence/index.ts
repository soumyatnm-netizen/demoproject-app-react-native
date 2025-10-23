import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Attack Intelligence function loaded")

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let success = true;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { documentId, documentType } = await req.json()
    console.log('Analyzing document:', documentId, 'Type:', documentType)

    if (!documentId || !documentType) {
      return new Response(
        JSON.stringify({ error: 'documentId and documentType are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch document content based on type
    let documentContent: any = null;
    let documentText = '';
    
    if (documentType === 'structured_quote') {
      const { data, error } = await supabase
        .from('structured_quotes')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (error || !data) throw new Error('Quote not found');
      documentContent = data;
      documentText = JSON.stringify(data, null, 2);
    } else if (documentType === 'policy_wording') {
      const { data, error } = await supabase
        .from('policy_wordings')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (error || !data) throw new Error('Policy wording not found');
      documentContent = data;
      documentText = JSON.stringify(data, null, 2);
    } else {
      throw new Error('Invalid document type');
    }

    console.log('Document content retrieved, analyzing...');

    // Call Lovable AI to analyze the document
    const systemPrompt = `You are an expert insurance analyst specialized in identifying policy weaknesses and gaps that brokers can use to win business from incumbent providers.

Your task is to analyze insurance quotes and policy wordings to identify potential client risks, disadvantages, and opportunities for improvement.

Focus on:
1. Higher-than-market deductibles/excesses
2. Narrow or missing coverage (e.g., no AI liability, no regulatory fines, no crisis response)
3. Retroactive dates that create gaps
4. Aggregate limits shared across sections vs separate towers
5. Broad exclusions that limit value
6. Business Interruption indemnity periods that are too short
7. Missing or capped covers (bricking, crime sub-limits, regulatory fines)
8. Territorial or jurisdictional limitations
9. Conditions precedent that could void coverage
10. Sub-limits that are below market standards

Provide evidence with specific excerpts from the document where possible.

Return your analysis as a JSON object with this exact structure:
{
  "attack_intelligence": [
    {
      "issue": "Description of the weakness in plain English",
      "section": "Which part of the policy (e.g., 'Cyber & Data', 'Professional Indemnity')",
      "impact": "Why this could hurt the client",
      "evidence": "Specific excerpt from document with reference",
      "broker_talking_point": "How the broker can position this to win business"
    }
  ],
  "client_summary": "A short, plain-English report highlighting 3-5 key gaps vs market standards that a broker could show to a prospect"
}

Keep attack_intelligence to 3-8 items - the most significant weaknesses.
Use plain English in 'issue', 'impact', and 'client_summary'.
Use technical accuracy in 'evidence' and 'broker_talking_point'.`;

    const userPrompt = `Analyze this insurance document and identify weaknesses, gaps, and attack points:

Document Type: ${documentType === 'structured_quote' ? 'Insurance Quote' : 'Policy Wording'}
Insurer: ${documentContent.insurer_name || 'Unknown'}
Product: ${documentContent.product_type || documentContent.policy_type || 'Unknown'}
Industry: ${documentContent.industry || 'Unknown'}

Document Content:
${documentText}

Provide a detailed analysis identifying weaknesses and opportunities.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const analysisText = aiResult.choices[0].message.content;
    
    console.log('AI analysis complete');
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', analysisText);
      throw new Error('Failed to parse AI analysis');
    }

    // Validate the structure
    if (!analysis.attack_intelligence || !Array.isArray(analysis.attack_intelligence)) {
      console.error('Invalid analysis structure:', analysis);
      throw new Error('Invalid analysis structure returned from AI');
    }

    // Record processing time
    const duration = Date.now() - startTime;
    await supabase.from('processing_metrics').insert({
      operation_type: 'attack_intelligence',
      duration_ms: duration,
      success: true,
      metadata: { 
        document_type: documentType,
        attack_points: analysis.attack_intelligence.length 
      }
    });

    console.log(`Attack intelligence analysis completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        metadata: {
          document_id: documentId,
          document_type: documentType,
          insurer: documentContent.insurer_name,
          attack_points_found: analysis.attack_intelligence.length,
          processing_time_ms: duration
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    success = false;
    console.error('Error in attack-intelligence function:', error)
    
    const duration = Date.now() - startTime;
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      await supabase.from('processing_metrics').insert({
        operation_type: 'attack_intelligence',
        duration_ms: duration,
        success: false,
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log metrics:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during attack intelligence analysis',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
