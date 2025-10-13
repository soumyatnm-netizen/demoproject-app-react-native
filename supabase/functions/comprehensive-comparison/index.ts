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

    const masterPrompt = `CoverCompass AI — Comparison Presentation Engine

You are CoverCompass AI, presenting insurance comparisons to brokers. 
Make differences between insurers clear, scannable, and visually structured.

TASK:
Take extracted comparison data (quotes, wordings, subjectivities) and format for display.

OUTPUT:
Return JSON with:

{
  "quote_table": {
    "columns": ["Carrier", "Total Premium", "Limits", "Deductibles", "Jurisdiction", "Retro Date", "Validity"],
    "rows": [
      { 
        "Carrier": "CFC", 
        "Total Premium": "£12,000 incl. IPT", 
        "Limits": "£1m any one claim", 
        "Deductibles": "£5,000 each claim", 
        "Jurisdiction": "Worldwide excl. USA/Canada", 
        "Retro Date": "2018-01-01", 
        "Validity": "30 days" 
      }
    ]
  },
  "wording_highlights": [
    {
      "carrier": "CFC",
      "key_highlights": [
        "Defence costs outside the limit",
        "Extended reporting period: 12 months optional",
        "Exclusion: Cyber terrorism"
      ]
    }
  ],
  "subjectivities": [
    {
      "carrier": "CFC",
      "items": [
        "Risk survey within 30 days",
        "Confirmation of turnover figures"
      ]
    }
  ],
  "standout_summary": [
    { 
      "carrier": "CFC", 
      "notes": ["Broader cyber cover", "More onerous subjectivities"] 
    }
  ],
  "overall_flags": [
    { "carrier": "", "type": "Material Difference | Unusual Term | Advantage | Risk", "detail": "" }
  ],
  "client_report_markdown": "### At-a-glance options per carrier...",
  "broker_report_markdown": "### Detailed comparison..."
}

RULES:
- Keep **quote_table** clean and tabular for quick comparison.
- Put **wording_highlights** into short bullets (3-5 max per carrier).
- Show **subjectivities** as clear checklist, separated from conditions.
- Provide **standout_summary** with one-line "what to know" per carrier.
- Use plain, client-friendly English.
- If missing info, use "Unknown" not blank.

EXTRACTION FOCUS:

From QUOTES:
- Total premium (base + taxes/fees)
- Policy period (dates)
- Limits (per section, aggregate vs per claim)
- Deductibles/excess
- Jurisdiction & territory
- Retroactive date
- Quote validity
- Subjectivities (pre-binding conditions)

From POLICY WORDINGS:
- Coverage trigger (claims-made vs occurrence)
- Defence costs position (inside vs outside limit)
- Extended reporting period
- Claims control & consent requirements
- Unusual exclusions
- Material conditions/warranties
- Cancellation rights
- Governing law
- Notable definitions differing from market

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
