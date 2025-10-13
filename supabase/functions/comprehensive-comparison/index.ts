import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { 
      client_name,
      client_ref,
      industry,
      jurisdiction,
      broker_name,
      priority_metrics,
      documents 
    } = await req.json();

    console.log('Processing comprehensive comparison for:', client_name);
    console.log('Documents received:', documents.length);

    // Fetch document content for each document
    const documentsWithContent = await Promise.all(
      documents.map(async (doc: any) => {
        if (doc.document_type === 'Quote') {
          // Fetch from structured_quotes
          const { data: quote } = await supabase
            .from('structured_quotes')
            .select('*')
            .eq('id', doc.document_id)
            .single();

          return {
            carrier_name: doc.carrier_name,
            document_type: 'Quote',
            filename: doc.filename,
            content_text: JSON.stringify(quote),
            pages: []
          };
        } else {
          // Fetch from policy_wordings
          const { data: wording } = await supabase
            .from('policy_wordings')
            .select('*')
            .eq('id', doc.document_id)
            .single();

          return {
            carrier_name: doc.carrier_name,
            document_type: 'PolicyWording',
            filename: doc.filename,
            content_text: JSON.stringify(wording),
            pages: []
          };
        }
      })
    );

    const masterPrompt = `MASTER PROMPT — CoverCompass (Quotes + Policy Wordings)

Role: You are the CoverCompass Comparison Engine. Your job is to:
- Extract structured data from documents (pairs of Quote + Policy Wording for carriers)
- Summarize each carrier's wording (TL;DR)
- Detect and normalize Subjectivities
- Produce a side-by-side comparison
- Flag differences, unusual items, and missing info
- Generate a broker report and a client-ready report

Never invent information. If a value is absent or unclear, return "Unknown" and include the evidence snippet and page reference (if available).

Output Contract: Return a single JSON object with these top-level keys (exactly these keys; no extra keys):
{
  "extractions": [],
  "per_carrier_summaries": [],
  "comparison_table": {},
  "differences_and_flags": [],
  "recommendation_framework": {},
  "subjectivities_rollup": [],
  "report_markdown_broker": "",
  "report_markdown_client": ""
}

[Full schema details as provided in the prompt...]

Extraction Guidance:
- Commercials: Base premium, taxes/fees, total premium, commission %, payment terms, quote validity date
- Dates: Policy period (inception/expiry), retro date
- Limits & Sublimits: for every coverage section; note aggregate vs any-one-claim
- Deductibles/Excesses: per section; note if costs-inclusive vs costs-exclusive
- Trigger & Scope: claims-made vs occurrence; territorial limits; governing law/jurisdiction
- Core Wordings: insuring clause summaries, major exclusions, endorsements, conditions, warranties, inner limits
- Claims: notification requirements (timing & strictness), dispute resolution, cancellation rights
- Special/Unusual Items: anything non-market-standard or onerous
- Subjectivities: underwriter conditions needed for terms to remain valid

For every critical field, attach a short snippet and page_ref when possible.

Style & Tone:
- Clear, neutral, precise. No legal advice. No exaggerated claims.
- Use plain English and short sentences for client copy.
- Use headings and tables. Avoid jargon; if unavoidable, define it.

Disclaimers (append to both reports):
"This comparison is based on the provided documents only. If carriers revise terms or endorsements, results may change."
"Subjectivities are underwriter conditions and not part of the policy wording; failure to satisfy may void or alter terms."`;

    const payload = {
      client_name,
      client_ref,
      industry: industry || "Unknown",
      jurisdiction: jurisdiction || "Unknown",
      broker_name: broker_name || "Unknown",
      priority_metrics: priority_metrics || ["Premium(Total)", "CoverageTrigger", "Limits", "Deductible"],
      documents: documentsWithContent
    };

    console.log('Calling OpenAI with comprehensive analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: masterPrompt },
          { role: 'user', content: `Analyze these documents:\n\n${JSON.stringify(payload, null, 2)}` }
        ],
        temperature: 0.3,
        max_tokens: 16000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const analysisResult = JSON.parse(aiResponse.choices[0].message.content);

    console.log('Comprehensive analysis complete');

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in comprehensive-comparison:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
