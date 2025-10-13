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

    const masterPrompt = `CoverCompass AI — Comparison & Highlight Engine

You are CoverCompass AI, the comparison engine for insurance brokers. 
Your task is to merge extracted data from insurer Quotes and Policy Wordings and generate a clear comparison.

GOALS:
- Highlight the KEY EXTRACTABLES from each Quote (premium, taxes, commission, policy period, limits, deductibles, jurisdiction, retro date, validity).
- Highlight IMPORTANT DIFFERENCES or UNUSUAL ITEMS from each Policy Wording (coverage trigger, exclusions, conditions, warranties, defence costs, extended reporting, claims control, cancellation, governing law).
- Clearly list all SUBJECTIVITIES from the Quotes (underwriter conditions before binding).
- Point out what "stands out" (unusual, onerous, or differentiating) per insurer.

OUTPUT:
Return JSON with:

{
  "comparison_summary": [
    {
      "carrier": "",
      "quote_key_points": [
        "Total premium £X including IPT",
        "Policy period: YYYY-MM-DD to YYYY-MM-DD",
        "Limit of indemnity: £X any one claim",
        "Deductible: £X each claim",
        "Jurisdiction: UK only"
      ],
      "wording_highlights": [
        "Defence costs inside the limit",
        "Unusual exclusion: Cyber operations excluded",
        "Extended reporting period: 12 months optional"
      ],
      "subjectivities": [
        "Risk survey within 30 days",
        "Confirmation of turnover figures"
      ],
      "standout_notes": [
        "Premium higher but broader cyber extension",
        "Subjectivities more onerous than competitors"
      ]
    }
  ],
  "overall_flags": [
    { "carrier": "", "type": "Material Difference | Unusual Term | Advantage | Risk", "detail": "" }
  ],
  "client_report_markdown": "### At-a-glance options per carrier... (simple comparison with bullets for client)",
  "broker_report_markdown": "### Detailed comparison including subjectivities, key wording differences, and risk notes..."
}

RULES:
- Quotes = headline numbers and commercial terms only.
- Wordings = anything important or unusual that could change how cover works.
- Subjectivities = always listed separately; do not mix with policy conditions.
- Use plain, concise English.
- If data is missing, say "Unknown".

EXTRACTION FOCUS:

From QUOTES, extract:
1. Total premium (base + taxes/fees)
2. Policy period (inception to expiry dates)
3. Limit of indemnity (per section, aggregate vs per claim)
4. Deductible/excess (per section)
5. Jurisdiction and territorial limits
6. Retroactive date (if applicable)
7. Quote validity date
8. Broker commission
9. Payment terms
10. **Subjectivities** (pre-binding conditions like surveys, financial confirmations)

From POLICY WORDINGS, extract:
1. Coverage trigger (claims-made vs occurrence)
2. Defence costs position (inside vs outside limit)
3. Extended reporting period (availability, duration)
4. Claims control (who controls settlements, consent requirements)
5. Unusual or restrictive exclusions
6. Material conditions or warranties
7. Cancellation rights (notice periods, refund terms)
8. Governing law and jurisdiction
9. Notable definitions that differ from market norms
10. Any unusual, onerous, or differentiating terms

COMPARISON OUTPUT:
- Group by carrier
- List 4-6 key bullet points per quote
- List 3-5 standout wording features
- Separate subjectivities list (never mix with policy conditions)
- Flag what makes each option distinctive
- Generate broker report (detailed) and client report (simplified)

DISCLAIMERS:
"This comparison is based on provided documents only. Carrier revisions may change results."
"Subjectivities are underwriter conditions, not policy terms; failure to satisfy may void or alter terms."`;
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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: masterPrompt },
          { role: 'user', content: `Analyze these documents:\n\n${JSON.stringify(payload, null, 2)}` }
        ],
        temperature: 0,
        max_tokens: 2500,
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
