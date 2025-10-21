import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('=== Deep Comparison Function Started ===');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { insurers } = await req.json();
    
    console.log('Processing deep comparison for insurers:', insurers.map((i: any) => i.name));

    // Fetch all quote and wording data
    const insurerData = await Promise.all(
      insurers.map(async (insurer: any) => {
        const quoteData = insurer.quote_id ? 
          await supabase.from('structured_quotes').select('*').eq('id', insurer.quote_id).single() : 
          null;
        
        const wordingData = insurer.wording_id ? 
          await supabase.from('policy_wordings').select('*').eq('id', insurer.wording_id).single() : 
          null;

        return {
          name: insurer.name,
          quote: quoteData?.data || null,
          wording: wordingData?.data || null
        };
      })
    );

    const systemPrompt = `You are an insurance coverage analysis expert performing forensic-level comparisons of insurance quotes and policy wordings.

Your task is to extract, normalize, and compare EVERY material coverage term across multiple insurers at section and sub-section level.

CRITICAL RULES:

1. **Source of Truth Hierarchy**:
   - Quote = source of truth for: limits, deductibles/excesses, dates, territory, courts, premiums, endorsements, section activations
   - Wording = source of truth for: coverage scope, triggers, inclusions/exclusions, conditions/warranties, definitions, special mechanisms

2. **Normalization**:
   - Currency: Always convert to GBP, output as decimal numbers (e.g., 5000000 not "£5m")
   - Basis of Limit: {each_and_every_claim, in_the_aggregate, each_occurrence, per_period, other}
   - Basis of Excess: {each_and_every_claim, each_and_every_loss, property_damage_only, costs_inclusive, costs_exclusive, other}

3. **Traceability**: Every data point must include source.type {quote|wording}, source.file, source.page, source.snippet (≤35 words)

4. **Section Harmonization** (map different labels to same concept):
   - Professional Indemnity / Technology E&O → professional_indemnity
   - Network Security & Privacy / Cyber & Data → cyber
   - Crime / Employee Crime / Social Engineering / Fraud → crime
   - Public & Products Liability → public_products_liability
   - Employers' Liability → employers_liability
   - Property (contents, BI, away/transit, money, bricking) → property
   - Crisis Containment → crisis_containment
   - AI liability / Generative AI → ai_liability
   - Regulatory costs & fines → regulatory_costs_and_fines

5. **Gaps**: If field absent in quote but in wording, set from_wording=true. If truly not stated, set null and add to gaps[]

EXTRACTION REQUIREMENTS PER INSURER:

**Policy Meta**
- insurer_name, product_name, wording_version
- policy_period: {start, end}, retroactive_date
- territorial_limits, applicable_courts, legal_action_jurisdiction
- time_franchise (BI/system damage), indemnity_periods
- separate_indemnity_towers: boolean + exact wording quote
- subjectivities[]: {text, deadline, section, source}
- endorsements[]: {id, title, description, effect, section, source}
- optional_extended_reporting_period: {duration, cost_basis, source}
- claims_made_or_occurrence per section

**Premiums**
- base_premium_by_section (if itemized)
- fees[], ipt, total_payable
- currency: "GBP"

**Professional Indemnity**
- limit: {amount, basis_of_limit, currency, source}
- excess: {amount, basis_of_excess, currency, source}
- coverage_triggers, notification_deadlines
- Included heads (true/false + details): breach_of_contract, products_and_services_liability, subcontractor_vicarious_liability, ip_and_media, employee_dishonesty_in_PI, withheld_fees, regulatory_costs_and_fines, ai_liability
- special_limits[], special_excesses[] (e.g., personal data)
- key_exclusions[] (materially narrowing)
- definitions[] (changing scope)

**Cyber**
- overall: {limit, excess, triggers[], proactive_services}
- own_losses: {limit, excess}
- claims_and_investigations: {limit, excess}
- incident_response, forensics, notification, pr, data_restoration
- business_interruption: {limit, waiting_period_hours, indemnity_period}
- bricking: {present, placement: "property|cyber", limit, excess}
- special_excesses[] (personal data claims)
- regulatory_investigations_fines: {covered, insurability_wording}
- contingent_bi, voluntary_shutdown

**Crime** (separate node per sub-section with limit/excess/definition):
- funds_transfer_fraud
- invoice_manipulation
- new_vendor_fraud
- physical_goods_fraud
- theft_of_personal_funds
- corporate_identity_theft
- theft_of_funds_in_escrow
- theft_of_client_funds
- customer_payment_fraud
- telephone_hacking
- unauthorised_use_of_computer_resources (cryptojacking/botnetting)
Include: aggregates_with, shared_or_separate_limits

**Public & Products Liability**
- limit, basis_of_limit, excess (note if property-damage-only)
- extensions[]: representation_costs, pollution_defence_costs, abuse_or_molestation, inefficacy, telephony_misuse
- special_limits[]
- material_exclusions[]

**Employers' Liability**
- limit, basis, war_terrorism_nuclear_sublimit
- representation_costs
- territorial_courts_restrictions

**Property & Business Interruption**
- contents: {general_contents, computers_and_ancillary, fixtures_and_fittings}
- additional_covers[]: newly_acquired, data_reconstitution, metered_water, unauthorised_utilities, continuing_hire, employee_dishonesty, contents_elsewhere, glass_sanitary, refrigerated_stock
- away_in_transit: {limit, excess}
- money: {limit, excess}
- business_interruption: {limit, indemnity_period_months, waiting_period_hours, special_conditions}
- bricking: {present, limit, excess} (cross-ref if in cyber)

**Crisis Containment**
- present: boolean
- limit, scope, inside_or_additional_to_other_limits

**AI Liability**
- present: boolean
- sections[] (where covered: PI, cyber, etc.)
- scope_bullets[], exclusions[]

**Regulatory Costs & Fines**
- present: boolean
- caps, conditions, applicable_sections

**Conditions/Warranties/Obligations**
- notification: {timeframes, who, where}
- risk_management_duties
- app_registration_requirements (CFC Response)
- fair_presentation_obligations
- payment_terms_impacting_cover

**Material Exclusions**
- List only if affecting relevant sections: patents, deliberate_acts, prior_known, war_terrorism, infrastructure_outage, communicable_disease, solar_weather, asbestos, nuclear

**Quality Checks**:
- Confirm separate towers language if present
- Flag special excess on personal data claims
- Crime sub-sections individually captured
- Distinguish bricking location (property vs cyber)
- Record BI waiting period and indemnity period
- Subjectivities with deadlines
- If value is implied/derived, set derived=true with explanation
- Add unresolvable ambiguities to gaps[]

OUTPUT FORMAT: Return a JSON object with two keys:
1. "insurers": array of complete insurer objects following the structure above
2. "deltas": array of comparison objects showing better/worse/equal per field with rationale and client impact

Be conservative where ambiguous. Never infer from marketing copy - only from quote schedules and wording text.`;

    const userPrompt = `Perform a forensic deep comparison of these insurance quotes and wordings. Extract ALL material terms with full traceability.

Insurer Data:
${JSON.stringify(insurerData, null, 2)}

Return complete normalized JSON with insurers array and deltas array showing all differences.`;

    console.log('Calling OpenAI for deep comparison analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_completion_tokens: 16000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const comparisonResult = JSON.parse(aiResponse.choices[0].message.content);

    console.log('Deep comparison complete');

    // Record processing metrics
    const duration = Date.now() - startTime;
    await supabase.from('processing_metrics').insert({
      operation_type: 'deep_comparison',
      duration_ms: duration,
      success: true,
      metadata: { insurer_count: insurers.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        comparison: comparisonResult,
        meta: {
          processed_at: new Date().toISOString(),
          duration_ms: duration,
          model: aiResponse.model,
          usage: aiResponse.usage
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in deep-comparison:', error);
    
    const duration = Date.now() - startTime;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      await supabase.from('processing_metrics').insert({
        operation_type: 'deep_comparison',
        duration_ms: duration,
        success: false,
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log error metric:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
