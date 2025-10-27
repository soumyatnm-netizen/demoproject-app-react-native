import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let success = true;

  try {
    const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { 
      client_name,
      client_ref,
      industry,
      jurisdiction,
      broker_name,
      priority_metrics,
      documents,
      selectedSections 
    } = await req.json();

    console.log('Processing comprehensive comparison for:', client_name);
    console.log('Documents received:', documents.length);
    console.log('Selected sections:', selectedSections || 'all');

    // Define which sections to analyze
    const sectionsToAnalyze = selectedSections && selectedSections.length > 0 
      ? selectedSections 
      : ['professional_indemnity', 'cyber', 'crime', 'public_products_liability', 'employers_liability', 'property'];
    
    const sectionLabels: Record<string, string> = {
      professional_indemnity: 'Professional Indemnity (PI)',
      cyber: 'Cyber & Data',
      crime: 'Crime / Employee Crime / Social Engineering / Fraud',
      public_products_liability: 'Public & Products Liability',
      employers_liability: 'Employers\' Liability',
      property: 'Property',
    };

    const focusedSectionsText = sectionsToAnalyze.map((key: string) => 
      sectionLabels[key] || key
    ).join('\n   - ');

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

    const masterPrompt = `CoverCompass Comprehensive Cover Comparison Engine

You are the CoverCompass Cover Comparison Engine designed for deep, competitive comparison of insurance proposals. Your goal is MAXIMUM THOROUGHNESS and DETAIL.

**IMPORTANT: This comparison is FOCUSED on the following coverage sections only:**
   - ${focusedSectionsText}

**You should ONLY analyze and compare these specific sections. Ignore all other sections in the documents.**

OBJECTIVE:
Ingest two or more complete insurance proposals (Quote Schedules + Policy Wordings) and output a standardized, structured analysis enabling quantitative and qualitative comparison of premium, limits, deductibles, and key coverage terms (Gap Analysis) for the SELECTED SECTIONS ONLY.

INPUT DOCUMENTS PER UNDERWRITER:
- Quote Schedule (Q): High-level summary of cover, limits, premium
- Policy Wording (W): Full legal document detailing coverage grants, exclusions, conditions, definitions

ANALYSIS PHILOSOPHY:
- Be forensic in your comparison - brokers need to spot even minor differences
- Weight comparisons based on client risk profile
- Flag potential claim declinature risks (security warranties, conditions precedent)
- Highlight subjectivities clearly - these affect bindability
- Use plain English suitable for client-facing broker reports

COMPARISON RULES:
1. Compare ONLY the selected product lines listed above with MAXIMUM DETAIL
   - Professional Indemnity (PI)
   - Cyber & Data
   - Property
   - Liability (Employers', Public, Products)
   - Crime/Fidelity

2. Always align like-for-like coverage sections
3. If a section is not offered, mark as "Not Covered" or "Not Included"
4. Weight comparisons based on client type:
   - Tech/Professional: PI and Cyber are most critical
   - Manufacturing: Property and Products Liability
   - Retail: Property, Stock, Public Liability
   - For statutory covers (Employers' Liability): note only unusual variations

5. For each product line, extract and compare COMPREHENSIVELY:

### PROFESSIONAL INDEMNITY (Comprehensive Analysis)
**CRITICAL FIELDS:**
- **Limit of indemnity**: Exact amount and basis (aggregate vs any one claim) - specify currency
- **Costs**: Defence costs INSIDE or OUTSIDE the limit? (This materially affects available coverage)
- **Excess/Deductible**: Amount, per claim or aggregate, costs-inclusive or exclusive?
- **Retroactive date**: Any retroactive date limitation? (e.g., "Cover from 2020 onwards only")
- **Territorial limits**: Full geographic scope - flag USA/Canada exclusions if client has exposure
- **Jurisdictional limits**: Which courts/laws apply? (e.g., "England & Wales only" vs "Worldwide")
- **Notification provisions**: Claims-made or claims-made-and-reported? Reporting deadlines?
- **Definition of "Claim"**: Does it include circumstances, pre-claims, investigations?
- **Extended reporting period**: Automatic? How long? What's the cost?
- **Insured entities**: Are subsidiaries automatically included? Do they need to be named?
- **Insured activities**: Are all professional services covered or just specific ones listed?
- **Prior acts coverage**: Full prior acts or limited to specific period?
- **Key exclusions to flag**: 
  - Fines and penalties
  - Contractual liability beyond common law
  - Warranties and guarantees
  - Intellectual property (design rights vs infringement vs both)
  - Cyber/data breach (if separate policy exists)
  - Pollution
  - Asbestos
  - Trading losses vs pure financial loss
  - Known circumstances
  - Related claims provisions
- **Subjectivities**: List ALL pre-binding conditions (e.g., "Subject to review of professional services agreement templates", "Subject to confirmation of turnover split by jurisdiction", "Subject to satisfactory references"). Include deadline if specified.

### CYBER & DATA (Most Volatile - Maximum Detail Required)
**CRITICAL FIELDS (Weight BI Coverage Highest):**
- **Overall limit**: Amount and basis (aggregate vs any one loss)
- **Excess/Deductible**: First-party vs third-party? Separate for cyber crime?
- **Business Interruption Coverage** (HIGHEST WEIGHT - Most Claims Fall Here):
  - **Indemnity period**: 90 days? 180 days? 365 days? (This is CRITICAL)
  - **Time excess**: 8 hours? 12 hours? 24 hours? 48 hours? (Lower is better)
  - **Calculation basis**: Actual loss vs gross profit vs revenue?
  - **Sub-limits**: Additional Increased Cost of Working (AICOW)? Specific amount?
  - **Dependent BI**: Covered? What limit?
  - **Non-damage BI**: System failure BI covered? Operational error?
  - **Lost bids/contracts**: Covered under BI? (Rare but valuable)
- **Cyber Crime/Social Engineering**:
  - Limit (often lower than main cyber limit)
  - Excess (often higher than main cyber excess)
  - Basis: Aggregate or per loss?
  - Coverage: Funds transfer fraud? Invoice manipulation? Impersonation?
- **Incident Response Costs**:
  - Forensic investigation: Limit?
  - Legal expenses: Limit?
  - PR/crisis management: Limit?
  - Notification costs: Limit?
- **Data Breach Response**:
  - Credit monitoring: Limit per affected individual?
  - Call center costs: Included?
  - Identity theft insurance: Provided?
- **Ransomware**:
  - Ransom payments: Covered? What limit?
  - Negotiation costs: Covered?
  - Restoration costs: Limit?
- **Territory**: Worldwide? USA included? (USA drives higher premiums)
- **Minimum Security Controls** (CONDITIONS PRECEDENT - High Declinature Risk):
  - Multi-factor authentication (MFA): Mandatory? For what systems?
  - Endpoint detection and response (EDR): Required?
  - Patch management: Must patch within X days?
  - Backup requirements: Frequency? Air-gapped or offline? Tested?
  - Privileged access management: Required?
  - Encryption: What must be encrypted?
  - Security monitoring: 24/7 SOC required?
  - Incident response plan: Must be documented?
  - **FLAG CLEARLY**: These are conditions precedent - failure voids coverage
- **Key Exclusions**:
  - War/terrorism cyber
  - Nation-state attacks
  - Bodily injury/property damage
  - Betterment (infrastructure improvements post-incident)
  - Unencrypted data
  - Prior/pending incidents
  - Failure to maintain security controls
- **Subjectivities**: All pre-binding conditions (e.g., "Subject to completion of cyber security questionnaire", "Subject to MFA implementation within 30 days", "Subject to penetration test", "Subject to review of IR plan")

### PROPERTY (Comprehensive Analysis - High Compliance Risk)
**CRITICAL FIELDS:**
- **Sum Insured / Limits**: 
  - Buildings: Exact figure and currency
  - Contents: Exact figure and currency
  - Stock: Exact figure and currency
  - Plant & Machinery: If separate
  - Any other property: Tenants improvements, etc.
- **Excess/Deductible**: 
  - Standard excess: Amount per claim
  - Subsidence/heave: Specific excess (often higher)
  - Escape of water: Specific excess?
  - Storm damage: Specific excess?
  - Theft: Specific excess?
  - Glass: Specific excess or nil?
- **Scope of Cover**: 
  - All Risks? (Broadest - covers unless specifically excluded)
  - Named Perils? (Narrower - only covers listed perils like fire, theft, storm)
  - Specified Cover? (Narrowest - only what's explicitly stated)
- **Perils Covered/Excluded**:
  - Fire and explosion: Standard inclusion
  - Theft/burglary: Standard inclusion
  - Storm and flood: Often subject to specific conditions
  - Escape of water: Standard inclusion but check excess
  - Subsidence/heave: Often excluded or high excess
  - Impact: Usually standard
  - Malicious damage: Standard but check for vacant property exclusion
  - Terrorism: Check if included (POOL Re in UK)
  - Accidental damage: Only if All Risks basis
- **Valuation Basis** (CRITICAL for Claims):
  - Reinstatement value (new for old): Best for client
  - Indemnity value: Less favorable - deducts depreciation
  - First loss: Partial cover - risky if underinsured
  - Day one/declaration basis: For fluctuating stock
  - **Betterment clauses**: Deduction for improvements? (Flag as claim payment reducer)
  - **Average clause**: Underinsurance penalty? (Flag - can severely reduce claims)
  - **Index linking**: Automatic sum insured increase?
- **Business Interruption**:
  - Indemnity period: 3, 6, 12, 18, 24 months? (Longer is better)
  - Basis: Gross profit, gross revenue, increased cost of working?
  - Maximum indemnity period: Is there an absolute cap?
  - Denial of access: Covered? For how far from premises?
  - Prevention of access: Covered? (e.g., police cordon)
  - Utilities failure: Covered? On/off premises?
  - Loss of attraction: Covered? (Nearby damage affecting footfall)
  - Suppliers/customers: Dependent business interruption covered?
- **Security Warranties** (CONDITIONS PRECEDENT - High Declinature Risk):
  - Intruder alarm: Grade 1/2/3? Must be set? Monitoring required?
  - Locks: 5-lever mortice required? On all doors?
  - CCTV: Required? Recording? Retention period?
  - Key holding: Must use approved keyholding service?
  - Sprinkler/suppression: Required? Maintenance schedule?
  - Fire alarm: Grade required? Maintenance?
  - Physical security: Roller shutters? Security guards? Fencing?
  - **FLAG CLEARLY**: These are warranties - breach voids ALL property cover
- **Unoccupied Property**:
  - Days before exclusion: 30? 45? 60? 90? (Longer is better)
  - Reduced cover: Some insurers provide limited cover instead of full exclusion
  - Notification requirement: Must notify insurer within X days?
  - Security requirements when vacant: Boarding up? Visits? Alarms?
  - **FLAG**: Short periods (30 days) can cause unexpected coverage gaps
- **Property Away from Premises**:
  - Laptops/IT equipment: Limit? Worldwide or UK only?
  - Portable equipment: Tools, samples, etc. - limit?
  - Goods in transit: Limit? Own vehicles or third-party?
  - Employees' personal effects: Limit per person?
  - Exhibition goods: At trade shows? Limit?
  - Documents/data: Loss or damage? Limit?
- **Inner Limits/Sublimits** (Critical - Often Overlooked):
  - Any one item of office equipment: £5k? £10k? (Affects high-value items)
  - Any one artwork/painting: Limit?
  - Cash on premises: Limit? In safe vs not in safe?
  - Stock at any one location: If multiple sites
  - Computer equipment/data: Specific sublimit?
  - Glass: Sublimit per claim?
  - Tenant's improvements: Sublimit?
  - Contract works: If property under construction/refurbishment
- **Conditions and Warranties** (Compliance Required):
  - Alarm maintenance: Must be serviced annually? By NSI approved company?
  - Sprinkler testing: Quarterly? Annually?
  - Fire extinguisher inspection: Every 6 months?
  - Electrical testing: PAT testing frequency?
  - Gas safety: Annual certificates required?
  - Hot work permit: Required for contractors?
  - Waste disposal: Daily removal? Fire risk management?
  - Housekeeping standards: Must maintain good order and repair?
  - **FLAG**: Non-compliance can void coverage or reduce claim payments
- **Subjectivities** (Pre-Binding Requirements):
  - Site inspection: Within 30 days? 60 days? Before binding?
  - Fire protection review: Sprinkler/alarm certification required?
  - Property valuation: Surveyor report required?
  - Confirmation of sums insured: From client?
  - Security system certification: Grade confirmation?
  - Building construction: Confirmation of materials?
  - Risk improvements: Specific measures to be implemented? Deadline?
  - **Include exact timeframes** - these affect bindability

### LIABILITY (Public, Products, Employers')
**Note**: Employers' Liability is UK statutory requirement - minimal differentiation expected. Focus on Public/Products Liability.

**CRITICAL FIELDS:**
- **Limit of indemnity**: 
  - Employers' Liability: £10m standard (statutory minimum £5m)
  - Public Liability: Amount and basis (aggregate vs any one occurrence)
  - Products Liability: Same as PL or separate limit?
- **Excess**: EL usually nil excess. PL/Products: amount per claim?
- **Territory**: UK only? EU? Worldwide? USA/Canada included?
- **Jurisdiction**: Which courts? (USA inclusion significantly increases premium)
- **Products**: 
  - Worldwide products cover? Or follows goods only?
  - Contractual liability: Included?
  - Product recall: Covered? (Rare and valuable)
  - Product guarantee: Excluded? (Standard exclusion)
- **Pollution**: Standard exclusion? Sudden and accidental only? Gradual included?
- **Professional Liability**: Excluded under PL? (Should be covered under PI)
- **Indemnity to Principals**: Included for contracts?
- **Cross Liability**: Each insured treated separately?
- **Motor Contingent Liability**: Included? (Loading/unloading, driving other vehicles)
- **Overseas Personal Liability**: For employees traveling?
- **Legal Defense Costs**: Inside or outside the limit?
- **Subjectivities**: Any pre-binding conditions

**PREMIUM EXTRACTION - CRITICAL:**
You MUST extract and normalize premium information for each carrier. This is ALWAYS shown at the top of comparisons:
- annual_premium OR total_payable (these are the same thing - the final amount the client pays)
- base_premium_by_section (itemized breakdown by cover section if available)
- ipt (Insurance Premium Tax)
- fees (array of any additional fees like policy admin fees)
- annual_total (total including IPT and fees)
- currency (default GBP)

For Hiscox format: Look for "Annual premium", "Insurance Premium Tax (IPT)", "Annual total"
For CFC format: Look for "TOTAL PAYABLE", "Premium breakdown" with sections, "Insurance Premium Tax", "Policy Administration Fee"

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "insurers": [
    {
      "insurer_name": "CFC",
      "premiums": {
        "total_payable": 75986.00,
        "annual_premium": 75986.00,
        "annual_total": 75986.00,
        "ipt": 7986.00,
        "base_premium_by_section": {
          "professional_indemnity": 58398.00,
          "general_liability": 1800.00,
          "property": 3752.00,
          "employers_liability": 2600.00
        },
        "fees": [
          {"name": "Policy Administration Fee", "amount": 1450.00}
        ],
        "currency": "GBP"
      }
    },
    {
      "insurer_name": "Hiscox", 
      "premiums": {
        "annual_premium": 65952.65,
        "ipt": 7914.34,
        "annual_total": 73866.99,
        "total_payable": 73866.99,
        "base_premium_by_section": {},
        "fees": [],
        "currency": "GBP"
      }
    }
  ],
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
          "subjectivities": [
            "Subject to satisfactory underwriting questionnaire completion",
            "Subject to confirmation of revenue split (UK: 80%, EU: 15%, RoW: 5%)"
          ],
          "standout_points": [
            "✅ Defence costs outside limit provides greater protection",
            "⚠️ USA/Canada excluded - confirm client has no US exposure",
            "⚠️ Two subjectivities must be satisfied within 14 days of inception"
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
          "subjectivities": [],
          "standout_points": [
            "❌ Defence costs inside limit reduces available coverage",
            "⚠️ Geographic restriction to UK only",
            "✅ No subjectivities - quote is firm"
          ]
        }
      ],
      "broker_notes": "CFC offers broader territorial coverage and defence costs outside the limit, providing better protection. Hiscox is more restrictive with UK-only territory and costs inside the limit. If client has international operations, CFC is stronger. **CFC has 2 pre-binding subjectivities vs Hiscox none**. Confirm subsidiary list with Hiscox."
    }
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
            "Sum Insured: Buildings £500,000, Contents £200,000, Stock £100,000",
            "Excess: £1,000 per claim, £5,000 for subsidence",
            "Cover: All Risks basis",
            "Valuation: Reinstatement value (new for old)",
            "BI Indemnity Period: 12 months on gross profit basis",
            "Security: No specific security warranties",
            "Unoccupied Property: Not Covered after 60 days",
            "Property Away: £10,000 limit for portable equipment",
            "Betterment: No deduction for betterment on buildings"
          ],
          "standout_points": [
            "✅ Broad all-risks cover with reinstatement value",
            "✅ No restrictive security warranties",
            "✅ Generous 60-day unoccupied property cover",
            "✅ No betterment deduction provides better protection"
          ]
        },
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Sum Insured: Buildings £500,000, Contents £200,000, Stock £100,000",
            "Excess: £2,500 per claim, £10,000 for subsidence",
            "Cover: All Risks basis",
            "Valuation: Reinstatement value with betterment deduction",
            "BI Indemnity Period: 6 months on gross profit basis",
            "Security: Intruder alarm (Grade 2 or higher) must be maintained and set",
            "Unoccupied Property: Exclusion after 30 consecutive days",
            "Property Away: £5,000 limit for portable equipment",
            "Inner Limit: £5,000 any one item of office equipment"
          ],
          "standout_points": [
            "⚠️ Security warranty is condition precedent - breach voids all property cover",
            "❌ Unoccupied property exclusion after only 30 days vs CFC's 60 days",
            "❌ Higher excesses (£2,500 vs £1,000, £10,000 vs £5,000 for subsidence)",
            "⚠️ Betterment deduction reduces claim payments",
            "❌ Shorter BI period (6 months vs 12 months)",
            "⚠️ Lower portable equipment limit (£5,000 vs £10,000)"
          ]
        }
      ],
      "broker_notes": "Hiscox imposes Grade 2 intruder alarm security warranty that is a condition precedent - any breach voids all property cover. Check client has compliant alarm and maintenance procedures in place. Hiscox also has more restrictive unoccupied property terms (30 days vs 60 days), higher excesses across the board, betterment deductions that reduce claims, and half the BI period. CFC provides materially better property protection with fewer compliance risks."
    }
  ],
  "overall_findings": [
    "**Subjectivities Summary**: CFC has 3 pre-binding subjectivities across products (PI questionnaire, revenue confirmation, cyber security audit). Hiscox has none - all quotes firm.",
    "Key Advantage - CFC: Superior Cyber BI coverage (365d vs 90d), defence costs outside limit on PI",
    "Key Advantage - Hiscox: No subjectivities, lower PI excess but costs inside limit",
    "Key Risk - Hiscox: Condition precedent on security requirements (both Cyber MFA and Property alarm)",
    "Key Risk - CFC: USA/Canada exclusion on PI + 3 subjectivities to satisfy pre-binding",
    "Broker Summary: For tech clients, CFC provides materially better Cyber coverage but requires satisfying subjectivities. Hiscox offers simpler binding process but requires careful management of security conditions to avoid coverage gaps."
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

    console.log('Calling Google Gemini directly with comprehensive analysis...');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: masterPrompt + '\n\nAnalyze these documents and return your response as a JSON object:\n\n' + JSON.stringify(payload, null, 2) }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Parse with better error handling
    let analysisResult;
    try {
      const contentText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) {
        throw new Error('No content in Gemini response');
      }
      analysisResult = JSON.parse(contentText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw content:', aiResponse.candidates?.[0]?.content?.parts?.[0]?.text);
      throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
    }

    console.log('Comprehensive analysis complete');

    // Record processing time
    const duration = Date.now() - startTime;
    await supabase.from('processing_metrics').insert({
      operation_type: 'comprehensive_comparison',
      duration_ms: duration,
      success: true,
      metadata: { document_count: documents.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    success = false;
    console.error('Error in comprehensive-comparison:', error);
    
    // Record failed processing time
    const duration = Date.now() - startTime;
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      await supabase.from('processing_metrics').insert({
        operation_type: 'comprehensive_comparison',
        duration_ms: duration,
        success: false,
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log metrics:', logError);
    }
    
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
