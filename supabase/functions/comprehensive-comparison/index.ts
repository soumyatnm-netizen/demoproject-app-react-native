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

Output Contract: Return a single JSON object with these top-level keys:
{
  "extractions": [{
    "carrier": "Carrier Name",
    "documents_present": {"quote": true, "policy_wording": true},
    "quote": {
      "product_name": "",
      "policy_period": {"inception": "", "expiry": ""},
      "retro_date": "",
      "territorial_limits": "",
      "jurisdiction": "",
      "premium": {
        "base": "",
        "taxes_fees": "",
        "total": "",
        "adjustability": "Flat (Min&Dep) | Adjustable | Unknown"
      },
      "broker_commission": "",
      "payment_terms": "",
      "quote_valid_until": "",
      "limits": [{"section":"", "limit_value":"", "aggregate_or_any_one":"", "units":""}],
      "sublimits": [{"description":"", "value":"", "units":""}],
      "deductibles_excesses": [{"section":"", "amount":"", "units":""}],
      "endorsements_noted": [],
      "exclusions_noted": [],
      "conditions_warranties_noted": [],
      "subjectivities": [{
        "title": "",
        "normalized_category": "Financials | Risk Controls | Compliance | Survey | Documentation | Other",
        "is_mandatory": true,
        "verbatim_excerpt": "",
        "page_ref": ""
      }],
      "other_key_terms": [{"label":"", "value":""}],
      "evidence": [{"field":"", "snippet":"", "page_ref": ""}]
    },
    "policy_wording": {
      "form_name_or_code": "",
      "version_date": "",
      "coverage_trigger": "Claims-made | Occurrence | Unknown",
      "insuring_clauses": [{"title":"", "summary": "", "page_ref": ""}],
      "definitions_notable": [{"term":"", "delta_from_market":"", "verbatim_excerpt":"", "page_ref":""}],
      "exclusions": [{"title":"", "summary":"", "page_ref": ""}],
      "conditions": [{"title":"", "summary":"", "page_ref": ""}],
      "warranties": [{"title":"", "summary":"", "page_ref": ""}],
      "endorsements": [{"title":"", "summary":"", "page_ref": ""}],
      "limits_sublimits": [{"section":"", "limit_value":"", "aggregate_or_any_one":"", "page_ref":""}],
      "deductibles_excesses": [{"section":"", "amount":"", "costs_basis":"Inclusive | Exclusive | Unknown", "page_ref":""}],
      "defence_costs_position": "Inside Limit | Outside Limit | Unknown",
      "extended_reporting_period": {
        "availability": "Included | Optional | Not Stated",
        "duration": "",
        "conditions": "",
        "page_ref": ""
      },
      "claims_control": {
        "who_controls": "Insurer | Insured | Joint | Unknown",
        "consent_required": "Yes | No | Unknown",
        "settlement_clause_summary": "",
        "page_ref": ""
      },
      "claims_notification": {
        "timing":"",
        "method":"",
        "strictness":"",
        "page_ref":""
      },
      "cancellation": {
        "insurer_rights":"",
        "insured_rights":"",
        "notice":"",
        "refunds":"",
        "page_ref":""
      },
      "governing_law_and_jurisdiction": {"law":"", "jurisdiction":"", "page_ref":""},
      "dispute_resolution": {"process":"", "page_ref":""},
      "TLDR": {
        "3_bullet_summary": ["", "", ""],
        "what_is_different_or_unusual": [],
        "client_attention_items": [],
        "overall_complexity": "Low | Medium | High"
      },
      "evidence": [{"field":"", "snippet":"", "page_ref": ""}]
    }
  }],
  "per_carrier_summaries": [],
  "comparison_table": {"rows": [], "order_hint": []},
  "differences_and_flags": [{
    "type": "MaterialDifference | UnusualTerm | MissingInfo | Advantage | Risk",
    "carrier": "",
    "metric": "",
    "detail": "",
    "impact": "High | Medium | Low",
    "client_visibility": "Show | BrokerOnly",
    "evidence": {"page_ref": "", "snippet": ""}
  }],
  "recommendation_framework": {
    "selection_drivers": [],
    "best_by_driver": {},
    "tradeoffs": [],
    "confidence": 0.0
  },
  "subjectivities_rollup": [{
    "carrier": "",
    "subjectivities": [{
      "title": "",
      "normalized_category": "",
      "deadline_or_validity": "",
      "is_mandatory": true,
      "verbatim_excerpt": "",
      "page_ref": ""
    }]
  }],
  "report_markdown_broker": "",
  "report_markdown_client": ""
}

📄 QUOTE EXTRACTION RULES:

1. Product name, policy period (inception/expiry), retro date
2. Territorial limits and jurisdiction (if stated at quote)
3. Premiums: base, taxes/fees, total
4. **Premium adjustability**: "Flat (Min&Dep)" | "Adjustable" | "Unknown"
5. Broker commission, payment terms, quote validity date
6. Limits & sublimits (per section, aggregate vs any-one-claim)
7. Deductibles/excesses (per section)
8. Endorsements, exclusions, conditions/warranties noted at quote
9. **Subjectivities** (distinct from policy conditions): risk survey deadlines, financial confirmations, risk control requirements, etc.
10. Other material terms not captured above
11. Evidence references for critical fields

📑 POLICY WORDING EXTRACTION RULES:

1. Form name/code, version date
2. Coverage trigger: Claims-made | Occurrence | Unknown
3. Insuring clauses (title + plain summary + page ref)
4. Notable definitions (unusual vs market norms)
5. Exclusions (list + summaries, flag unusual)
6. Conditions (ongoing insured duties)
7. Warranties (strict obligations)
8. Endorsements (contractual amendments)
9. Limits & sublimits (per section, aggregate vs per-claim, inner limits)
10. Deductibles/excesses (per section, costs-inclusive vs costs-exclusive)
11. **Defence costs position**: "Inside Limit" | "Outside Limit" | "Unknown"
12. **Extended reporting period (run-off)**:
    - Availability: Included | Optional | Not Stated
    - Duration (e.g., 6/12 months)
    - Conditions (additional premium, notifications)
13. **Claims control**:
    - Who controls: Insurer | Insured | Joint | Unknown
    - Consent required: Yes | No | Unknown
    - Settlement clause summary
14. Claims notification (timing, method, strictness)
15. Cancellation rights (insurer/insured, notice, refunds)
16. Governing law & jurisdiction
17. Dispute resolution
18. TL;DR: 3 bullets, unusual items, client attention points, complexity rating

📌 GENERAL RULES:

- **Unknowns**: Return "Unknown" if absent, ambiguous, or conflicting
- **Evidence**: Attach snippet + page_ref for every critical field
- **Alignment**: Fuzzy match coverage sections across carriers (PI ≈ Professional Indemnity)
- **Subjectivities vs Conditions**: Keep distinct. Subjectivities = quote stage underwriter conditions. Conditions = contractual wording obligations
- **Units & Dates**: Preserve exactly; use YYYY-MM-DD for dates

COMPARISON TABLE METRICS (minimum):
- Premium (Base/Total), Adjustability, Commission, Payment Terms
- Policy Period, Coverage Trigger, Territorial Limits, Jurisdiction, Retro Date
- Limits (align by section), Sublimits, Inner Limits
- Deductibles (align by section), Defence Costs Position
- Extended Reporting Period (availability/duration)
- Claims Control (who controls/consent)
- Claims Notification, Dispute Resolution, Cancellation
- Key Endorsements, Exclusions, Conditions, Warranties
- Subjectivities summary

REPORTS:
- **Broker version**: Full table, evidence refs, confidence notes, "BrokerOnly" flags visible
- **Client version**: Executive summary, simple table (key rows), plain English, subjectivities clearly explained, neutral framework, redact evidence snippets

DISCLAIMERS (both reports):
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
