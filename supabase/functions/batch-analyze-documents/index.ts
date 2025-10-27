console.log("[batch-analyze-documents] boot");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers")
    ?? "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(req) },
  });
}

// Helper to convert PDF bytes to base64 (safely chunked to avoid stack overflow)
function pdfToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// JSON extraction/repair helpers
function extractJsonFromText(raw: string): string | null {
  if (!raw) return null;
  // Prefer fenced code block ```json ... ```
  const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  // Fallback: grab the largest {...} slice
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return null;
}

function stripControlChars(s: string): string {
  // Remove non-printable control chars except tab/newline/carriage return
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

function tryParseJsonLoose(raw: string): any {
  // 1) direct parse
  try { return JSON.parse(raw); } catch {}
  // 2) extract JSON from text or fences
  const extracted = extractJsonFromText(raw);
  if (extracted) {
    const cleaned = removeTrailingCommas(stripControlChars(extracted));
    try { return JSON.parse(cleaned); } catch (e) {
      // try once more removing stray backticks
      const noTicks = cleaned.replace(/```/g, '');
      return JSON.parse(noTicks);
    }
  }
  // 3) last resort: remove backticks and attempt parse
  const noTicks = raw.replace(/```/g, '');
  const cleaned = removeTrailingCommas(stripControlChars(noTicks));
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders(req) });
  }

  const t0 = performance.now();
  
  try {
    console.log('=== Batch Analyze Documents Function Started ===');
    
    const bodyIn = await req.json();
    const { documents, client_name, client_ref, industry, jurisdiction, selectedSections } = bodyIn;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return json(req, 400, { ok: false, error: 'No documents provided' });
    }

    console.log(`[batch-analyze] Processing ${documents.length} documents`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!geminiApiKey) {
      return json(req, 500, { ok: false, error: 'GOOGLE_GEMINI_API_KEY not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // STEP 1: Fetch all documents and convert to base64
    console.log('[batch-analyze] Fetching documents...');
    const t_fetch_start = performance.now();
    
    const documentPromises = documents.map(async (doc: any) => {
      try {
        // Get document from DB
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', doc.document_id)
          .single();

        if (docError || !document) {
          console.error(`[batch-analyze] Document not found: ${doc.document_id}`);
          return null;
        }

        // Get signed URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(document.storage_path, 300);

        if (urlError || !urlData?.signedUrl) {
          console.error(`[batch-analyze] Failed to get signed URL for ${document.filename}`);
          return null;
        }

        // Fetch PDF
        const pdfResponse = await fetch(urlData.signedUrl);
        if (!pdfResponse.ok) {
          console.error(`[batch-analyze] Failed to fetch PDF for ${document.filename}`);
          return null;
        }

        const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
        const sizeMB = (pdfBytes.byteLength / (1024 * 1024)).toFixed(2);
        console.log(`[batch-analyze] Fetched ${document.filename}: ${sizeMB} MB`);

        if (pdfBytes.byteLength > 20 * 1024 * 1024) {
          console.error(`[batch-analyze] PDF too large: ${document.filename}`);
          return null;
        }

        const base64Pdf = pdfToBase64(pdfBytes);

        return {
          filename: document.filename,
          document_id: doc.document_id,
          carrier_name: doc.carrier_name,
          document_type: doc.document_type,
          base64: base64Pdf,
          size_mb: sizeMB
        };
      } catch (error) {
        console.error(`[batch-analyze] Error processing ${doc.filename}:`, error);
        return null;
      }
    });

    const fetchedDocs = (await Promise.all(documentPromises)).filter(Boolean);
    const t_fetch = performance.now() - t_fetch_start;
    console.log(`[batch-analyze] Fetched ${fetchedDocs.length}/${documents.length} documents in ${Math.round(t_fetch)}ms`);

    if (fetchedDocs.length === 0) {
      return json(req, 500, { ok: false, error: 'No documents could be fetched' });
    }

    // STEP 2: Build comprehensive prompt with all documents
    console.log('[batch-analyze] Building batch analysis prompt...');
    
    const systemPrompt = `You are CoverCompass AI, a specialist insurance document analyzer. Extract ONLY actual values as stated in documents. Never infer missing cover - only flag what's explicitly absent. You must return structured JSON with exact verbatim values and page references.`;

    const sectionMapping: Record<string, string> = {
      'professional_indemnity': 'Professional Indemnity',
      'cyber': 'Cyber & Data',
      'property': 'Property',
      'employers_liability': 'Employers\' Liability',
      'public_liability': 'Public & Products Liability',
      'directors_officers': 'Directors & Officers (D&O)',
    };

    const selectedSectionNames = selectedSections?.map((s: string) => sectionMapping[s] || s) || [];
    
    const userPrompt = `Analyze these ${fetchedDocs.length} insurance documents for ${client_name}.

**Selected Coverage Sections:** ${selectedSectionNames.length > 0 ? selectedSectionNames.join(', ') : 'All sections'}

**Documents:**
${fetchedDocs.map((doc, idx) => `${idx + 1}. ${doc.filename} (${doc.carrier_name}, ${doc.document_type})`).join('\n')}

**EXTRACTION RULES (CRITICAL - FOLLOW EXACTLY):**

1. EXACT DATA CAPTURE
   - Always extract stated figures verbatim (e.g. "GBP 25,000 deductible each and every claim")
   - Include the basis (e.g. "each and every claim", "aggregate", "costs inclusive")
   - Include section title (e.g. "Insuring Clause 5.D: Crisis Communication Costs")
   - Provide page reference + verbatim snippet for evidence

2. DO NOT INFER "MISSING COVER"
   - If a limit isn't separately itemised (e.g. AI liability inside PI), record as part of main section
   - Use "No cover given" ONLY if document explicitly states it or section is entirely absent
   - Never assume something is excluded just because standalone sub-limit is not shown

3. SUB-LIMIT RECOGNITION (CRITICAL)
   - Differentiate between headline limits (e.g. Cyber £5m e&e) and small sub-limits (e.g. Post-Breach Remediation £50k)
   - Do NOT replace a £5m limit with a £50k sub-limit
   - Show both: headline_limit AND sub_limits array
   - Extract ALL sub-limits mentioned in the document

4. SPECIAL CONDITIONS & SUBJECTIVITIES
   - Capture ALL mandatory requirements (e.g. incident response app registration) with deadlines
   - Store verbatim wording in subjectivities array

5. RETROACTIVE DATE
   - Always capture retroactive dates as written
   - If unlimited or "none stated", record "unlimited"

6. INDEMNITY PERIODS & TIME FRANCHISE
   - Extract exact months/hours
   - Do not assume industry norms; only capture what is printed

7. PROPERTY/BI/EXTENSIONS
   - Capture each extension separately (e.g. denial of access, suppliers failure, utilities outage)
   - Record their sub-limits exactly

8. ERP / RUN-OFF TERMS
   - Record availability, duration, and cost basis (e.g. "12 months at 100% of annual premium")

**FOR EACH DOCUMENT, EXTRACT:**

**1. FINANCIAL SUMMARY**
- Insurer_Name, Client_Name, Product_Type, Industry
- Policy_Number, Quote_Reference, Quote_Date
- Policy_Start_Date, Policy_End_Date
- Premium_Total_Annual, Premium_Currency
  **IMPORTANT:** Extract the TOTAL ANNUAL PREMIUM which may be labeled as:
  • "Total Annual Premium" / "Total Payable" / "Total Premium" / "Annual Total" / "Total Cost" / "Premium (including taxes/IPT)"
  Always extract the FINAL total amount the client pays (including all taxes, IPT, levies).
  Store as: total_payable, annual_premium, and annual_total (all three with same value for consistency)
- Base premium split by section: {professional_indemnity, cyber, property, crime, EL, PL, other}
- Policy admin fees / broker charges
- IPT / insurance premium tax
- Payment terms: {annual_vs_instalments, minimum_premium, refund_threshold}
- **NEW**: Rate guarantees (multi-year lock-ins)
- **NEW**: Premium adjustment clauses (revenue-based, claims-free discounts)
- **NEW**: Broker commission disclosure (if stated)
- **NEW**: Renewal incentives / loyalty discounts

**2. LIMITS OF LIABILITY**
- Overall policy limit (per claim and/or aggregate)
- Per claim / each and every claim limit
- Aggregate limit (where applicable)
- **NEW**: Reinstatement of limits (automatic, on payment, or none)
- **NEW**: Defence costs position (inside limits vs outside limits)
- **NEW**: Shared limits between sections (e.g. Cyber + PI aggregate)
- **NEW**: Separate indemnity towers per section
- Sub-limits / inner limits for:
  * Cybercrime / social engineering fraud
  * Court attendance costs
  * Pollution defence costs
  * Employee dishonesty
  * Reputational harm / crisis management
  * Bricking / IoT device compromise
  * Data restoration / forensics
  * Regulatory fines & penalties
  * **NEW**: AI liability / algorithmic errors
  * **NEW**: ESG-related claims
  * **NEW**: Climate litigation defence
  * **NEW**: Supply chain failure
  * **NEW**: Cloud provider contingent BI

**3. DEDUCTIBLES / EXCESS**
- Standard excess per section (PI, Cyber, Property, Crime, etc.)
- Special excesses for:
  * Data breaches
  * Social engineering
  * Property theft
  * Ransomware / extortion
  * **NEW**: AI-related claims
- Whether defence costs / expenses erode deductibles
- **NEW**: Aggregate deductibles (cumulative across multiple claims)
- **NEW**: Waiting periods (e.g. BI time franchise)
- **NEW**: Erosion of aggregate by defence costs
- **NEW**: Reinstatement fee after claim payment

**4. SCOPE OF COVER (BY SECTION)**

**A. Professional Indemnity / Tech E&O**
- Breach of contract / negligence / civil liability
- Intellectual property infringement (copyright, trademark, patents, trade secrets)
- AI liability (explicit wording or silent/implied)
- Regulatory fines & investigations
- Dishonesty of employees
- Withheld fees recovery
- **NEW**: Contractual liability extensions
- **NEW**: Project-specific cover
- **NEW**: Joint venture liability
- **NEW**: Subcontractor / supply chain liability
- **NEW**: Data processing liability (GDPR Art 82)
- **NEW**: Software recall / remediation costs

**B. Cyber & Data**
- Own losses:
  * System damage / restoration
  * Business interruption (own network)
  * Reputational harm / brand repair
  * **NEW**: Voluntary shutdown cover
  * **NEW**: Contingent BI (cloud provider failure)
- Third-party liability:
  * Network security breach
  * Privacy breach / data leak
  * Transmission of malicious code
  * **NEW**: Regulatory penalties (GDPR, DPA fines)
- Crime coverage:
  * Funds transfer fraud
  * Invoice manipulation
  * Phishing / social engineering
  * Ransomware / extortion
  * **NEW**: Crypto theft / NFT fraud
  * **NEW**: Deepfake fraud
- Crisis containment:
  * PR / crisis communications
  * Forensics & incident response
  * Legal / regulatory representation
  * **NEW**: Data restoration from backups
  * **NEW**: Extortion negotiation costs
  * **NEW**: Dark web monitoring post-breach

**C. Property & Business Interruption**
- Buildings, contents, equipment
- BI indemnity period & time franchise
- **NEW**: Inflation protection / index-linking
- **NEW**: Debris removal / demolition
- **NEW**: Denial of access / utilities failure
- **NEW**: Terrorism extension
- **NEW**: Cyber-triggered property loss (exclusion or carve-back)
- **NEW**: Supply chain / supplier failure BI
- **NEW**: Climate event BI (flood, storm, wildfire)

**D. Employers' Liability / Public & Products Liability**
- Standard EL / PL cover
- **NEW**: Product recall costs
- **NEW**: Efficacy cover (failure to perform as intended)
- **NEW**: Contractually assumed liability
- **NEW**: Environmental impairment / pollution
- **NEW**: USA / Canada exports exposure
- **NEW**: Social media / reputational PL

**5. CONDITIONS & EXCLUSIONS**
- Claims-made vs occurrence basis
- Retroactive date (and unlimited retroactive cover if applicable)
- Definition of "insured" / "subsidiary"
- **NEW**: Continuous cover clauses
- **NEW**: Cyber war exclusions (clarity and carve-backs)
- **NEW**: State-sponsored attack exclusions
- **NEW**: Regulatory compliance obligations (FCA, GDPR, PCI-DSS)
- **NEW**: Material change in risk notification requirements
- **NEW**: ESG / climate change exclusions or inclusions
- **NEW**: Sanctions & embargo compliance
- **NEW**: Known circumstances / prior knowledge

**6. SERVICES / ADDED BENEFITS**
- Pre-breach services:
  * Risk management portals
  * Employee training modules
  * **NEW**: Dark web monitoring
  * **NEW**: Phishing simulations
  * **NEW**: Vulnerability scanning
  * **NEW**: ESG / sustainability resources
- Post-breach services:
  * Incident response hotline
  * Legal / forensics panel
  * Credit monitoring for affected individuals
  * **NEW**: Reputation management / PR support
  * **NEW**: Regulatory liaison services

**7. ENDORSEMENTS & SUBJECTIVITIES**
- Mandatory requirements (pre-binding conditions):
  * MFA / 2FA implementation
  * Backup frequency & testing
  * Patch management
  * Incident response plan
  * **NEW**: Security training completion
  * **NEW**: Third-party security audits
- **NEW**: Contractual requirements (client-driven changes)
- **NEW**: Warranty or condition precedent endorsements
- **NEW**: Retroactive date confirmation
- **NEW**: Optional buy-backs or coverage uplifts
- **NEW**: Claims cooperation obligations

**8. ADMINISTRATION**
- Insurer contact details / claims notification
- Broker servicing arrangements
- **NEW**: Digital policy access / API integration
- **NEW**: Renewal notice period (30/60/90 days)
- **NEW**: Cancellation provisions (by insured vs insurer)
- **NEW**: Dispute resolution mechanisms (arbitration, mediation, courts)
- **NEW**: Cyber wording version control / update frequency
- **NEW**: Mid-term adjustment rights
- **NEW**: Assignment & change of control provisions

**FOR POLICY WORDINGS (ADDITIONAL DETAIL):**
- insurer_name, form_name_or_code, version_date, coverage_trigger
- insuring_clauses: [{title, summary, page_ref}]
- definitions_notable: [{term, delta_from_market, verbatim_excerpt, page_ref}]
- exclusions, conditions, warranties, endorsements
- limits: [{limit_type, amount, currency, description, page_ref}]
- sublimits: [{coverage_name, limit, currency, applies_to, description, page_ref}]
- inner_limits_and_sub_limits: [{coverage_section, limit_amount, currency, limit_type, applies_to, verbatim_text, page_ref}]
- deductibles_excesses
- defence_costs_position (inside/outside limits, exhaustion)
- extended_reporting_period: {duration, cost, automatic_vs_optional}
- claims_control, claims_notification, cancellation
- governing_law_and_jurisdiction, dispute_resolution
- **NEW**: cyber_war_definitions (state-sponsored, systemic event thresholds)
- **NEW**: ai_liability_treatment (explicit inclusion/exclusion)
- **NEW**: esg_climate_position (exclusions or affirmative cover)
- TLDR: {3_bullet_summary, what_is_different_or_unusual, client_attention_items, overall_complexity}

**COMPARISON OUTPUT FORMAT:**
{
  "insurers": [
    {
      "insurer_name": "Hiscox",
      "document_type": "Quote",
      "premiums": {
        "total_payable": 15234.50,
        "annual_premium": 15234.50,
        "annual_total": 15234.50,
        "ipt": 1234.50,
        "policy_admin_fees": 50.00,
        "currency": "GBP",
        "base_premium_by_section": {
          "professional_indemnity": 8000,
          "cyber": 3000,
          "property": 2000,
          "crime": 1000,
          "EL": 200,
          "PL": 134.50
        },
        "payment_terms": "Annual payment | Instalments available at 5% APR",
        "rate_guarantee": "2 year lock-in available",
        "premium_adjustments": "Claims-free discount: 10% after 3 years",
        "NOTE": "total_payable, annual_premium, and annual_total should ALL contain the same value - the FINAL total cost to client including all taxes/IPT/levies. Extract from fields labeled: Total Annual Premium, Total Payable, Total Premium, Annual Total, Total Cost, or Premium (including taxes)"
      },
      "limits": {
        "overall_policy_limit": "£5,000,000 each and every claim",
        "aggregate_limit": "£10,000,000 annual aggregate",
        "reinstatement_terms": "Automatic reinstatement after claim payment",
        "defence_costs_position": "Within limit of liability",
        "shared_limits": "PI and Cyber share £10m aggregate",
        "sub_limits": {
          "cyber_crime": "£250,000 any one loss",
          "social_engineering": "£100,000 annual aggregate",
          "ai_liability": "Included within main PI limit",
          "regulatory_fines": "£500,000 annual aggregate",
          "reputational_harm": "£50,000 any one event",
          "data_restoration": "£100,000 annual aggregate",
          "supply_chain_failure": "£250,000 BI extension",
          "cloud_provider_contingent_bi": "£100,000 with 8 hour waiting period"
        }
      },
      "deductibles": {
        "pi_standard": "£25,000 each and every claim including costs",
        "cyber_standard": "£10,000 each and every loss",
        "cyber_social_engineering": "£25,000 each and every loss",
        "property_standard": "£1,000 each and every loss",
        "aggregate_deductible": "None",
        "defence_costs_erode": "Yes, deductible applies to all costs",
        "waiting_periods": "8 hours for BI, 12 hours for contingent BI"
      },
      "scope_of_cover": {
        "pi_tech_eo": {
          "breach_of_contract": "Included",
          "ip_infringement": "Copyright, trademark, patents - all included",
          "ai_liability": "Explicit: Algorithmic errors and AI decision-making covered",
          "regulatory_investigations": "Included up to £500k aggregate",
          "contractual_liability": "Included where liability would exist in tort",
          "subcontractor_liability": "Included",
          "software_recall": "£50,000 sub-limit"
        },
        "cyber_data": {
          "system_damage": "Included",
          "own_bi": "Up to 12 months indemnity",
          "voluntary_shutdown": "Included - up to 48 hours",
          "contingent_bi": "Cloud provider failure covered - 12 hour waiting period",
          "regulatory_penalties": "GDPR fines up to £500k",
          "ransomware": "Included - £100k sub-limit",
          "crypto_theft": "Excluded",
          "deepfake_fraud": "Silent / not mentioned",
          "data_restoration": "£100k sub-limit",
          "extortion_negotiation": "Included in crisis costs",
          "dark_web_monitoring": "Post-breach only, 12 months"
        },
        "property_bi": {
          "inflation_protection": "Day one reinstatement",
          "terrorism": "Pooled through Pool Re",
          "cyber_triggered_property": "Excluded",
          "supply_chain_bi": "£250k sub-limit, 90 day indemnity",
          "climate_events": "Flood: included | Storm: included | Wildfire: excluded"
        },
        "el_pl": {
          "product_recall": "£50,000",
          "efficacy_cover": "Excluded",
          "usa_canada_exports": "Excluded",
          "environmental_impairment": "£100,000"
        }
      },
      "conditions_exclusions": {
        "basis": "Claims-made",
        "retroactive_date": "01/08/2023",
        "continuous_cover": "Yes - provided renewal maintained",
        "cyber_war": "Excluded unless directly targeting insured",
        "state_sponsored_attack": "Excluded if part of widespread campaign",
        "regulatory_compliance": "Must comply with FCA, GDPR, PCI-DSS",
        "material_change": "30 days notice required",
        "esg_climate": "No specific exclusions",
        "known_circumstances": "Must notify prior to inception"
      },
      "services_benefits": {
        "pre_breach": {
          "risk_portal": "Yes - Hiscox Cyber Academy",
          "employee_training": "Annual modules",
          "dark_web_monitoring": "No",
          "phishing_simulations": "Quarterly",
          "vulnerability_scanning": "No",
          "esg_resources": "No"
        },
        "post_breach": {
          "incident_hotline": "24/7 UK-based",
          "legal_panel": "Pre-approved firms",
          "credit_monitoring": "12 months for affected individuals",
          "pr_support": "Up to £50k"
        }
      },
      "subjectivities": [
        {
          "requirement": "Implement MFA on all admin accounts",
          "deadline": "Within 30 days of inception",
          "condition_precedent": true
        },
        {
          "requirement": "Daily backups stored offline",
          "deadline": "Ongoing",
          "condition_precedent": false
        },
        {
          "requirement": "Annual penetration testing",
          "deadline": "Within 90 days, then annually",
          "condition_precedent": false
        }
      ],
      "administration": {
        "claims_notification": "claims@hiscox.com | 0800 123 4567",
        "renewal_notice": "60 days",
        "cancellation": "30 days by insured | 60 days by insurer",
        "dispute_resolution": "London arbitration",
        "digital_policy": "Yes - via Hiscox portal",
        "wording_version": "HIS-TECH-2024-v3.2",
        "mid_term_adjustments": "Permitted with 30 days notice"
      },
      "extracted_data": { /* Full detailed extraction per enhanced structure above */ }
    }
  ],
  "product_comparisons": [
    {
      "product": "Professional Indemnity & Tech E&O",
      "carrier_results": [
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Limit: £5,000,000 each and every claim | £10m aggregate (shared with Cyber)",
            "Deductible: £25,000 each and every claim including costs",
            "Retroactive date: 01/08/2023",
            "Defence costs: Within limit of liability",
            "AI Liability: Explicitly covered within main limit",
            "IP Infringement: Full coverage for copyright, trademark, patents",
            "Regulatory Investigations: £500k sub-limit",
            "Contractual Liability: Covered where tort liability exists",
            "Software Recall: £50k sub-limit"
          ],
          "subjectivities": [
            "Implement MFA on all admin accounts within 30 days (CONDITION PRECEDENT)",
            "Daily backups stored offline (ongoing)",
            "Annual penetration testing within 90 days"
          ],
          "standout_points": [
            "✅ Explicit AI liability coverage",
            "⚠️ Higher deductible than CFC (£25k vs £10k)",
            "✅ Software recall costs covered",
            "❌ Retroactive date more restrictive than CFC (CFC: unlimited)",
            "✅ Strong IP infringement protection"
          ],
          "standout_summary": "Hiscox provides comprehensive PI coverage with explicit AI liability - excellent for tech firms. Higher excess but broader scope on emerging risks."
        },
        {
          "carrier": "CFC",
          "key_terms": [
            "Limit: £5,000,000 each and every claim | No aggregate",
            "Deductible: £10,000 each and every claim",
            "Retroactive date: Unlimited",
            "Defence costs: Outside limit of liability",
            "AI Liability: Silent / not explicitly mentioned",
            "Contractual Liability: Excluded unless specifically endorsed",
            "Software Recall: Not covered"
          ],
          "subjectivities": [],
          "standout_points": [
            "✅ Lower deductible (£10k vs Hiscox £25k)",
            "✅ Defence costs sit outside limit",
            "✅ Unlimited retroactive coverage",
            "❌ AI liability not explicitly addressed",
            "❌ No software recall coverage",
            "⚠️ Quote is firm - no conditions precedent"
          ],
          "standout_summary": "CFC offers cleaner terms with lower excess and unlimited retroactive. Best for established firms with mature security. AI coverage unclear."
        }
      ],
      "broker_notes": "Hiscox is the better choice for tech/AI firms due to explicit algorithmic liability coverage. CFC suits firms prioritising lower excess and defence costs protection. For AI-heavy businesses, Hiscox's wording provides certainty."
    },
    {
      "product": "Cyber & Data Protection",
      "carrier_results": [
        {
          "carrier": "Hiscox",
          "key_terms": [
            "Cyber Limit: £5,000,000 (shares aggregate with PI)",
            "Crime Sub-limits: Social Engineering £100k | Funds Transfer £250k",
            "BI Indemnity: 12 months",
            "Voluntary Shutdown: Covered up to 48 hours",
            "Contingent BI: Cloud provider failure - £100k, 12hr wait",
            "Regulatory Penalties: GDPR fines up to £500k",
            "Ransomware: £100k sub-limit",
            "Data Restoration: £100k",
            "Dark Web Monitoring: Post-breach only, 12 months"
          ],
          "subjectivities": [
            "MFA implementation (30 days)",
            "Offline backups (ongoing)"
          ],
          "standout_points": [
            "✅ Voluntary shutdown covered",
            "✅ Contingent BI for cloud failures",
            "✅ GDPR fine coverage (£500k)",
            "⚠️ Crypto theft excluded",
            "❌ Deepfake fraud not mentioned",
            "✅ Strong ransomware sub-limit"
          ],
          "standout_summary": "Hiscox cyber wording is modern and comprehensive. Strong on regulatory penalties and emerging BI risks. Crypto exclusion notable."
        },
        {
          "carrier": "CFC",
          "key_terms": [
            "Cyber Limit: £5,000,000 standalone",
            "Crime Sub-limits: Social Engineering £250k | Funds Transfer £500k",
            "BI Indemnity: 18 months",
            "Contingent BI: Not covered",
            "Regulatory Penalties: Up to full limit",
            "Ransomware: £250k sub-limit",
            "Crypto theft: £100k sub-limit",
            "Deepfake fraud: £50k sub-limit"
          ],
          "subjectivities": [],
          "standout_points": [
            "✅ Higher crime sub-limits (£500k FTF vs Hiscox £250k)",
            "✅ Longer BI period (18m vs 12m)",
            "✅ Crypto theft covered",
            "✅ Deepfake fraud explicitly covered",
            "❌ No contingent BI coverage",
            "✅ No conditions precedent",
            "✅ Regulatory penalties to full limit"
          ],
          "standout_summary": "CFC leads on crime coverage and emerging fraud types. Excellent for crypto-exposed businesses. Longer BI period. No contingent BI a gap for cloud-dependent firms."
        }
      ],
      "broker_notes": "CFC stronger on crime limits and newer fraud types (crypto, deepfake). Hiscox better for firms dependent on cloud providers (contingent BI). For fintech/crypto: CFC. For SaaS/cloud: Hiscox."
    }
  ],
  "overall_findings": [
    "CFC offers lower deductibles across all sections (£10k PI vs £25k)",
    "Hiscox provides explicit AI liability coverage - CFC is silent",
    "CFC has stronger crime coverage (£500k FTF vs £250k) and covers crypto theft",
    "Hiscox includes contingent BI for cloud failures - CFC does not",
    "Defence costs: CFC outside limit, Hiscox within limit",
    "CFC has no subjectivities (quote is firm), Hiscox requires MFA within 30 days",
    "Regulatory penalties: CFC up to full limit, Hiscox capped at £500k",
    "CFC provides 18 month BI vs Hiscox 12 months",
    "Retroactive coverage: CFC unlimited, Hiscox 01/08/2023"
  ],
  "failed_documents": []
}

**QUALITY CHECKS:**
- Cross-check that every headline £5m limit is recorded, even if sub-limits exist
- Highlight "No cover given" explicitly where stated
- Flag unusually high deductibles (>£25k), short BI periods (<24m), or low crime limits (<£250k)
- Base only on extracted values, not assumptions
- Extract EVERY monetary amount mentioned in documents
- **NEW**: Flag missing or silent AI liability coverage
- **NEW**: Note cyber war exclusion clarity (clear vs ambiguous)
- **NEW**: Identify defence costs position (inside vs outside limits)
- **NEW**: Check for ESG/climate-related exclusions or inclusions
- **NEW**: Flag crypto/digital asset exclusions
- **NEW**: Note contingent BI coverage presence/absence
- **NEW**: Identify state-sponsored attack exclusions
- **NEW**: Check for reinstatement provisions on limits
- **NEW**: Flag condition precedent subjectivities vs ordinary conditions
- **NEW**: Note regulatory penalty sub-limits (GDPR, FCA, etc.)
- **NEW**: Identify emerging fraud coverage (deepfake, social engineering variations)
- **NEW**: Check retroactive date (unlimited vs date-specific)
- **NEW**: Note voluntary shutdown coverage for cyber

**CRITICAL:** Only analyze these sections: ${selectedSectionNames.join(', ')}. Do not analyze or include other sections in the output.`;

    // STEP 3: Call Gemini with all documents in one batch
    console.log('[batch-analyze] Calling Gemini with batch...');
    const t_ai_start = performance.now();
    
    // Use the latest Gemini 2.5 models with fallback options
    const modelFallbackOrder = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash'
    ];

    const maxRetries = 3;
    let lastError: any;

    // Build parts array with text + all PDFs (computed once)
    const parts: any[] = [
      { text: systemPrompt + '\n\n' + userPrompt }
    ];
    for (const doc of fetchedDocs) {
      parts.push({
        inline_data: {
          mime_type: 'application/pdf',
          data: doc.base64
        }
      });
    }

    for (const modelName of modelFallbackOrder) {
      console.log(`[batch-analyze] Trying model ${modelName}`);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[batch-analyze] Attempt ${attempt}/${maxRetries} with ${modelName}`);

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts
                }],
                generationConfig: {
                  temperature: 0,
                  responseMimeType: 'application/json'
                }
              }),
            }
          );

          const geminiText = await geminiRes.text();

          if (!geminiRes.ok) {
            let parsedErr: any = undefined;
            try { parsedErr = JSON.parse(geminiText); } catch {}
            lastError = parsedErr || geminiText;

            const retriable = geminiRes.status === 429 || (geminiRes.status >= 500 && geminiRes.status < 600);
            console.error(`[batch-analyze] ${modelName} error (status ${geminiRes.status}) on attempt ${attempt}:`, String(geminiText).slice(0, 400));

            if (retriable && attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 400);
              console.log(`[batch-analyze] Retrying ${modelName} in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }

            // If retriable but we've exhausted retries, try next model in the list
            if (retriable) {
              console.warn(`[batch-analyze] Exhausted retries for ${modelName}, moving to next model if available...`);
              break; // break attempts loop, continue outer loop to next model
            }

            // Non-retriable error -> return immediately
            console.error('[batch-analyze] Non-retriable Gemini error:', String(geminiText).slice(0, 400));
            return json(req, geminiRes.status, { 
              ok: false, 
              error: String(geminiText).slice(0, 400),
              retriable: false
            });
          }

          // Parse response (robust JSON handling)
          const geminiData = JSON.parse(geminiText);
          const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!content) {
            throw new Error('No content in Gemini response');
          }

          let analysis: any;
          try {
            analysis = typeof content === 'string' ? tryParseJsonLoose(content) : content;
          } catch (parseErr) {
            console.error('[batch-analyze] JSON parse failed, content head:', String(content).slice(0, 200));
            throw new Error('Invalid JSON from model: ' + (parseErr instanceof Error ? parseErr.message : String(parseErr)));
          }

          const t_ai = performance.now() - t_ai_start;
          const t_total = performance.now() - t0;
          
          console.log(`[batch-analyze] Success with ${modelName} in ${Math.round(t_ai)}ms`);
          console.log(`[batch-analyze] Total time: ${Math.round(t_total)}ms`);

          return json(req, 200, {
            ok: true,
            analysis,
            meta: {
              client_name,
              documents_processed: fetchedDocs.length,
              documents_failed: documents.length - fetchedDocs.length,
              model: modelName,
              timing: {
                total_ms: Math.round(t_total),
                fetch_ms: Math.round(t_fetch),
                ai_ms: Math.round(t_ai)
              },
              attempts: attempt
            }
          });
        } catch (error) {
          lastError = error;
          console.error(`[batch-analyze] Attempt ${attempt} with ${modelName} failed:`, String(error));

          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 400);
            console.log(`[batch-analyze] Retrying ${modelName} in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      // try next model
    }

    // All retries and model fallbacks failed
    return json(req, 503, { 
      ok: false, 
      error: `Batch analysis failed across all models. Last error: ${typeof lastError === 'string' ? lastError.slice(0, 200) : JSON.stringify(lastError).slice(0, 200)}`,
      retriable: true
    });

    // All retries failed
    return json(req, 500, { 
      ok: false, 
      error: `Batch analysis failed after ${maxRetries} attempts. Last error: ${JSON.stringify(lastError).slice(0, 200)}`,
      retriable: true
    });

  } catch (error) {
    console.error('[batch-analyze] Error:', String(error));
    
    return json(req, 500, {
      ok: false,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
});
