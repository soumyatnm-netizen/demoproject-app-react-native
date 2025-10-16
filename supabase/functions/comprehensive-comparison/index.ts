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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
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

    const masterPrompt = `CoverCompass Cover Comparison Engine

You are the CoverCompass Cover Comparison Engine. Your job is to perform detailed, line-by-line comparisons of insurance products across multiple insurers and highlight meaningful differences for the broker.

TASK:
Take the extracted quote + wording data and compare each insurance product separately (e.g. Professional Indemnity, Cyber, Property, Liability). 
Always align like-for-like coverage sections, and if a section is not offered, mark it as "Not Covered".

RULES:
1. Compare each product line individually:
   - Professional Indemnity (PI)
   - Cyber & Data
   - Property
   - Liability (note: for statutory covers like Employers' Liability, minimal differentiation will exist, so highlight only unusual terms)

2. Weight comparisons appropriately:
   - For technology or professional service clients, PI and Cyber carry greater importance
   - For statutory covers, note that comparisons may be less meaningful

3. For each product line, extract and compare the following:

### Professional Indemnity
- Limit of indemnity and basis (aggregate vs any one claim)
- Costs inclusive vs costs exclusive
- Excess and basis (per claim, costs-inclusive, etc.)
- Geographical and jurisdictional limits (highlight if USA excluded when client has US exposure)
- Exclusions or amendments that limit or broaden cover
- Subsidiary cover (are all subsidiaries included?)

### Cyber & Data
- Limit and basis
- Excess
- Geographical and jurisdictional limits
- Business Interruption: indemnity period (e.g. 90 days vs 365 days)
- Time excess for BI
- Inner limits, including:
  - Additional increased costs of working
  - Operational error
  - Dependent business interruption
- Cyber crime cover (excess, limit, basis)
- Additional covers in the core wording not offered elsewhere (e.g. lost or missed bids under BI)
- Minimum security conditions (highlight as potential claim declinature risk)
- IMPORTANT: Weight the Business Interruption coverage higher in the comparison, as volatile claims are most likely to fall here

### Property
- General scope of cover — note any major discrepancies between wordings
- Restrictive conditions or warranties the client must comply with for cover to remain valid

### Liability (if present)
- Note that Employers' Liability is statutory and usually non-differentiated
- Only highlight unusual exclusions, conditions, or jurisdictional limitations

OUTPUT FORMAT:
{
  "product_comparisons": [
    {
      "product": "Professional Indemnity",
      "carrier_results": [
        {
          "carrier": "CFC",
          "key_terms": [
            "Limit: £1m any one claim, £2m aggregate",
            "Costs: Inclusive of defence costs",
            "Excess: £5,000 per claim (costs exclusive)",
            "Territory: Worldwide excluding USA/Canada",
            "Subsidiaries: All owned subsidiaries automatically included"
          ],
          "standout_points": [
            "✅ Defence costs outside limit provides greater protection",
            "⚠️ USA/Canada excluded - confirm client has no US exposure",
            "📋 Retroactive date: 2018-01-01"
          ]
        },
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Limit: £1m aggregate (includes costs)",
            "Costs: Inside the limit",
            "Excess: £10,000 per claim (costs inclusive)",
            "Territory: UK only",
            "Subsidiaries: Named subsidiaries only"
          ],
          "standout_points": [
            "❌ Defence costs inside limit reduces available coverage",
            "⚠️ Geographic restriction to UK only",
            "❌ Only named subsidiaries covered - list must be maintained"
          ]
        }
      ],
      "broker_notes": "CFC offers broader territorial coverage and defence costs outside the limit, providing better protection. Hiscox is more restrictive with UK-only territory and costs inside the limit. If client has international operations, CFC is stronger. Confirm subsidiary list with Hiscox."
    },
    {
      "product": "Cyber & Data",
      "carrier_results": [
        {
          "carrier": "CFC",
          "key_terms": [
            "Limit: £500,000 any one claim",
            "Excess: £2,500",
            "BI Indemnity Period: 365 days",
            "BI Time Excess: 8 hours",
            "Inner Limits: AICOW £100k, Operational Error £50k, Dependent BI £50k",
            "Cyber Crime: £100,000 limit, £5,000 excess"
          ],
          "standout_points": [
            "✅ 365-day BI period vs competitor's 90 days - critical for extended recovery",
            "✅ 8-hour time excess vs 24 hours - quicker BI trigger",
            "⚠️ Minimum security: MFA, EDR, Patching within 30 days",
            "📋 Lost/missed bids covered under BI"
          ]
        },
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Limit: £500,000 aggregate",
            "Excess: £5,000",
            "BI Indemnity Period: 90 days",
            "BI Time Excess: 24 hours",
            "Inner Limits: AICOW £50k, Operational Error not covered, Dependent BI £25k",
            "Cyber Crime: £50,000 limit, £10,000 excess"
          ],
          "standout_points": [
            "❌ Only 90-day BI period - may be insufficient for major incident",
            "⚠️ 24-hour time excess means minor outages not covered",
            "❌ Operational error not covered separately",
            "⚠️ Minimum security: MFA mandatory (condition precedent)"
          ]
        }
      ],
      "broker_notes": "CFC provides significantly better BI coverage (365 days vs 90 days and 8h vs 24h time excess) which is critical as most volatile cyber claims fall under BI. CFC also covers operational error and lost bids. Hiscox has stricter security requirements as condition precedent. For tech clients with potential for extended downtime, CFC is materially superior."
    },
    {
      "product": "Property",
      "carrier_results": [
        {
          "carrier": "CFC",
          "key_terms": [
            "All Risks basis",
            "Reinstatement value",
            "No security warranties"
          ],
          "standout_points": [
            "✅ Broad all-risks cover",
            "📋 Standard terms"
          ]
        },
        {
          "carrier": "Hiscox",
          "key_terms": [
            "All Risks basis",
            "Reinstatement value",
            "Security warranty: Intruder alarm maintained and set"
          ],
          "standout_points": [
            "⚠️ Security warranty is condition precedent - breach voids cover",
            "❌ Unoccupied property exclusion after 30 days"
          ]
        }
      ],
      "broker_notes": "Hiscox imposes security warranty that could void cover if alarm not set. Check client's alarm maintenance procedures. Unoccupied property exclusion may be restrictive."
    }
  ],
  "overall_findings": [
    "Subjectivities across all quotes: Risk survey required within 30 days (both carriers)",
    "Key Advantage - CFC: Superior Cyber BI coverage (365d vs 90d), defence costs outside limit on PI",
    "Key Advantage - Hiscox: Lower PI excess (£10k vs £5k) but costs are inside limit",
    "Key Risk - Hiscox: Condition precedent on security requirements (both Cyber MFA and Property alarm)",
    "Key Risk - CFC: USA/Canada exclusion on PI - confirm no US operations",
    "Broker Summary: For tech clients, CFC provides materially better Cyber coverage. Hiscox requires careful management of security conditions to avoid coverage gaps."
  ]
}

STYLE:
- Be concise and clear
- Use bullet points for key terms and highlights
- Flag unusual exclusions, restrictive conditions, or subjectivities clearly
- Use plain English suitable for broker reports
- Icons: ✅ (advantage), ⚠️ (caution), ❌ (risk/negative), 📋 (neutral info)

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

    console.log('Calling Lovable AI (Gemini 2.5 Flash) with comprehensive analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: masterPrompt },
          { role: 'user', content: `Analyze these documents and return your response as a JSON object:\n\n${JSON.stringify(payload, null, 2)}` }
        ],
        temperature: 0,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI error: ${response.status}`);
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
