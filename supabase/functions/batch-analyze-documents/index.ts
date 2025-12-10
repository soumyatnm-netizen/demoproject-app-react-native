console.log("[batch-analyze-documents] boot");
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// --- HELPER FUNCTIONS ---
function corsHeaders(req) {
  const origin = req.headers.get("Origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders
  };
}
function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(req)
    }
  });
}
// Helper to convert PDF bytes to base64 safely
function pdfToBase64(bytes) {
  const chunkSize = 8192;
  let binary = '';
  for(let i = 0; i < bytes.length; i += chunkSize){
    const chunk = Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
// JSON extraction/repair helpers
function extractJsonFromText(raw) {
  if (!raw) return null;
  const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return null;
}
function stripControlChars(s) {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
function removeTrailingCommas(s) {
  return s.replace(/,(\s*[}\]])/g, '$1');
}
function tryParseJsonLoose(raw) {
  try {
    return JSON.parse(raw);
  } catch  {}
  const extracted = extractJsonFromText(raw);
  if (extracted) {
    const cleaned = removeTrailingCommas(stripControlChars(extracted));
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const noTicks = cleaned.replace(/```/g, '');
      return JSON.parse(noTicks);
    }
  }
  const noTicks = raw.replace(/```/g, '');
  const cleaned = removeTrailingCommas(stripControlChars(noTicks));
  return JSON.parse(cleaned);
}
// --- MAIN HANDLER ---
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders(req)
    });
  }
  const t0 = performance.now();
  // Robust fetch with timeout
  const fetchWithTimeout = async (input, init = {}, timeoutMs = 120_000)=>{
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal
      });
      return res;
    } finally{
      clearTimeout(id);
    }
  };
  try {
    console.log('=== Batch Analyze Documents Function Started ===');
    const bodyIn = await req.json();
    const { documents, client_name, client_ref, industry, jurisdiction, selectedSections, mode, userName } = bodyIn;
    // Determine output mode: "structured" (JSON), "narrative", or "comparison_report" (Markdown)
    const outputMode = mode || "structured";
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return json(req, 400, {
        ok: false,
        error: 'No documents provided'
      });
    }
    console.log(`[batch-analyze] Processing ${documents.length} documents. Mode: ${outputMode}`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      return json(req, 500, {
        ok: false,
        error: 'GOOGLE_GEMINI_API_KEY not configured'
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    // STEP 1: Fetch all documents
    console.log('[batch-analyze] Fetching documents...');
    const t_fetch_start = performance.now();
    const documentPromises = documents.map(async (doc)=>{
      try {
        const { data: document, error: docError } = await supabase.from('documents').select('*').eq('id', doc.document_id).single();
        if (docError || !document) {
          console.error(`[batch-analyze] Document not found: ${doc.document_id}`);
          return null;
        }
        const { data: urlData, error: urlError } = await supabase.storage.from('documents').createSignedUrl(document.storage_path, 300);
        if (urlError || !urlData?.signedUrl) {
          console.error(`[batch-analyze] Failed to get signed URL for ${document.filename}`);
          return null;
        }
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
      return json(req, 500, {
        ok: false,
        error: 'No documents could be fetched'
      });
    }

    // --- Define Static Variables Here ---
    const REPORT_DATE = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const ANALYST_NAME = userName; // Set the Broker/Analyst Name here
// ------------------------------------
    // STEP 2: Build Prompts based on Output Mode
    let systemPrompt = '';
    let userPrompt = '';
    if (outputMode === "comparison_report") {
      // --- REPORT MODE PROMPTS ---
      systemPrompt = `
You are **CoverCompass AI**, an expert insurance underwriter and analyst.
Your goal is to compare insurance quotes/policies and provide a professional decision-making report for a client.

**Response Guidelines:**
1. **Format:** Use **Markdown** (tables, bolding, headers) exclusively.
2. **Tone:** Professional, insightful, objective, and helpful.
3. **Visuals:** Use tags like [Image of X] strictly where instructive.
4. **Citations:** You MUST cite the source document for every key piece of data. Use: "[Source: filename, page number]".

**Required Structure:**
1. **Title and Header:** Start with a bold title, Client name, Date, and Analyst persona. **(The model must generate the header using Client: Sagacity Holdings Limited, Date: ${REPORT_DATE}, and Analyst: ${ANALYST_NAME})**
2. **Financial Comparison:** Table comparing Total Cost, Net Premium, Admin Fees, and Limits.
3. **Policy Structure Comparison:** Table comparing high-level structural items like Indemnity Structure (Towers vs. Aggregate) and AI/Emerging Tech coverage.
4. **Policy Wording Analysis:** Highlight critical clauses (BCP warranties, Jurisdiction exclusions, Conditions Precedent).
5. **Comparison Insights (Non‑Regulated):** Qualitative analysis of Pros/Cons and a clear, neutral comparative insight (e.g., “Hiscox is stronger on X”, “CFC provides broader cover on Y”). No recommendations or advice.

`;
      userPrompt = `

I understand. You want the prompt that was used to generate the first, highly detailed, and structured comparative report you received. That report required the model to fetch and synthesize specific data points (like deductibles and premiums) from the full file contents and present them in a rigid, comparative table structure.

Here is the full, optimized prompt designed to produce that exact result, updated to provide a short summary after every major section:

You are **CoverCompass AI**, an expert insurance underwriter and analyst.
Your goal is to compare insurance quotes and policies and provide a professional decision-making report for the client, **Sagacity Holdings Limited**.

**Response Guidelines:**
1. **Format:** Use **Markdown** (tables, bolding, headers) exclusively.
2. **Tone:** Professional, insightful, objective, and helpful.
3. **Citations:** You MUST cite the source document for every key piece of data, including limits, premiums, and specific clauses. Use the format: "[Source: filename]".

**Task:**
Analyze the two provided quotes (from CFC and Hiscox) and their corresponding policy wordings for Sagacity Holdings Limited. Generate a comprehensive **Comparative Insurance Report** comparing both options section-by-section. The analysis must extract all available specific figures (including total premiums, deductibles, and sub-limits) and focus on financial differences, structural advantages (like separate limits), and critical policy conditions. A brief summary **must be provided after every section (1, 2, and 3)**, followed by a final comprehensive summary.

**Strictly follow this required structure:**

### 1. Financial Comparison
Create a table comparing the options based on the following available data. **Add details** regarding the type of limit (e.g., each and every claim) for both carriers when citing the source.
* Total Cost (Annual Total Premium)
* Net Premium (excluding IPT/fees)
* Admin Fees/Policy Administration Fee (if separate)
* Primary Limit of Liability (for PI/E&O and Cyber)
* Crisis Containment/PR Sub-Limit (if applicable)
* Deductibles/Excess (for PI/E&O and Cyber, if available)
* **Key Difference:** A column articulating the main financial or capacity difference.

---
### **Cyber — Business Interruption (First‑Party Loss) Comparison**
When analysing the Cyber section, you must specifically compare **Business Interruption (first‑party loss)** items between insurers. Extract and cite all available figures and sub‑limits. Compare the following key elements explicitly:
* **Business Interruption Limit**
* **Indemnity Period** (Hiscox often limited — verify if extended in this quote)
* **Dependent Business Interruption** (coverage and limits)
* **AICOW (Additional Increased Cost of Working)**
* **Operational Error Coverage**
* **System Failure Coverage**
* **Key Difference:** Provide a short statement summarising the most material difference in BI‑related Cyber coverage.

---
#### **Section 1 Summary: Financials**
Provide a **one-sentence summary** of the most critical financial difference between the two quotes (e.g., "Hiscox offers a lower total premium but a significantly higher deductible for Cyber.").

---

### 2. Policy Structure Comparison
Create a table comparing high-level structural items. **Add details** explaining the function or benefit of the feature (e.g., explaining why Separate Indemnity Towers are superior).
* **Indemnity Structure:** (Clearly state and cite if it uses **Separate Indemnity Towers** or a single **Annual Aggregate Limit** across major sections).
* **Affirmative AI Cover:** (Confirm explicit/affirmative coverage for Artificial Intelligence Errors & Omissions).
* **Embedded Proactive Services:** (Note if value-add services like CFC's Proactive Cyber Services are contractually embedded).
* **Products Liability (BIPD):** (Compare coverage for Bodily Injury or Property Damage).
* **Key Difference:** A column clearly articulating the main point of difference for each structural item.

---
#### **Section 2 Summary: Policy Structure**
Provide a **one-sentence summary** of the most critical structural advantage offered by one of the carriers (e.g., "CFC's use of Separate Indemnity Towers provides superior capacity management compared to Hiscox's aggregate limit.").

---

### 3. Policy Wording Analysis (Critical Clauses and Conditions)
Identify and highlight critical clauses that represent a risk or a condition of coverage, citing the document and clause where found. **Add details** explaining the consequence of the clause (e.g., the risk of failing the BCP condition).
* **BCP Condition Precedent:** (Search specifically for mandatory requirements related to **Business Continuity Plan (BCP) testing**).
* **Choice of Law:** (Identify the governing law and jurisdiction).
* **Crime Coverage Scope:** (Compare the explicit coverage for key modern crime risks like Invoice Manipulation/Physical Goods theft).
* **Key Difference:** A column highlighting the critical difference or risk element for each clause analysis.

---
#### **Section 3 Summary: Policy Wording**
Provide a **one-sentence summary** of the most significant risk or condition found in the policy wordings (e.g., "The Hiscox wording contains a mandatory BCP testing condition precedent, failure of which could void cover.").

---

### 4. Comparison Insights (Non‑Regulated)

Provide a qualitative analysis using the following table structure:
| Carrier | Pros (Advantages) | Cons (Disadvantages/Risks) |
| :--- | :--- | :--- |
| **CFC Pros/Cons** | Write each advantage as a full sentence. Do NOT use <br> or HTML. Separate points using period + space only. | Write each disadvantage as a full sentence. Do NOT use <br> or HTML. Separate points using period + space only. |
| **Hiscox Pros/Cons** | Write each advantage as a full sentence. Do NOT use <br> or HTML. Separate points using period + space only. | Write each disadvantage as a full sentence. Do NOT use <br> or HTML. Separate points using period + space only. |

**Formatting Rules (Mandatory):**
- Inside table cells, you MUST NOT use <br>, <br/>, <p>, or any HTML.
- Each point must be written as a standalone sentence.
- Use normal Markdown text only; no bullet points inside table cells.
After the table, provide **Non‑Regulated Comparative Insight**:
- Neutrally state which carrier is stronger on specific factors.
- Allowed phrasing examples: “Hiscox is stronger on XYZ”, “CFC provides broader cover for ABC”.
- Forbidden wording: “recommend”, “we recommend”, “advice”, “should choose”.



---
#### **5. Executive Short Summary**
Provide a final, highly condensed **Executive Short Summary** of the overall report. This summary **must be exactly 3-5 sentences long**, clearly stating:
1. The **Key Financial Difference** (e.g., Premium or Deductible).
2. The **Key Structural Advantage** of the strongest quote (e.g., Separate Limits).
3. The **Key Comparative Insight** (e.g., which carrier performs better on specific items), strictly neutral and without any recommendation or advice wording.
"""
`;
    } else if (outputMode === "structured") {
      // --- STRUCTURED JSON PROMPT ---
      const sectionMapping = {
        'professional_indemnity': 'Professional Indemnity',
        'cyber': 'Cyber & Data',
        'property': 'Property',
        'employers_liability': 'Employers\' Liability',
        'crime': 'Crime',
        'public_products_liability': 'Public Products Liability',
        'public_liability': 'Public & Products Liability',
        'directors_officers': 'Directors & Officers (D&O)'
      };
      const selectedSectionNames = selectedSections?.map((s)=>sectionMapping[s] || s) || [];
      systemPrompt = `
You are **CoverCompass AI**, an expert insurance underwriter and analyst.
Your goal is to compare insurance quotes/policies and provide a professional decision-making report for a client.

**Response Guidelines:**
1. **Format:** Use **Markdown** (tables, bolding, headers) exclusively.
2. **Tone:** Professional, insightful, objective, and helpful.
3. **Visuals:** Use tags like [Image of X] strictly where instructive.
4. **Citations:** You MUST cite the source document for every key piece of data. Use: "[Source: filename, page number]".

**Required Structure:**
1. **Title and Header:** Start with a bold title, Client name, Date, and Analyst persona.
2. **Financial Comparison:** Table comparing Total Cost, Net Premium, Admin Fees, and Limits.
3. **Policy Structure Comparison:** Table comparing high-level structural items like Indemnity Structure (Towers vs. Aggregate) and AI/Emerging Tech coverage.
4. **Policy Wording Analysis:** Highlight critical clauses (BCP warranties, Jurisdiction exclusions, Conditions Precedent).
5. **Comparison Insights (Non‑Regulated):** Qualitative analysis of Pros/Cons and a clear, neutral comparative insight (e.g., “Hiscox is stronger on X”, “CFC provides broader cover on Y”). No recommendations or advice.

`;
      userPrompt = `
You are CoverCompass AI, a specialist insurance comparison engine. Your task is to compare the CFC and Hiscox quotes section-by-section using ALL provided quote documents AND policy wordings. Extract only factual values—no assumptions, no invented data. If a value is missing, return "Not Stated".

---

## Key Term Rules
For every entry in "key_terms":
- Output a **single string**, not an object.
- Each string must be **2–3 sentences** long.
- Describe:
  • what the clause/coverage/exclusion means,  
  • how it works in practice,  
  • how it impacts the insured (claims, obligations, limitations).

DO NOT change the JSON structure.  
DO NOT output objects inside key_terms.  
Only strings are allowed.

---

## Analysis Requirements
- Compare each selected section (e.g., PI, Cyber, Property)
- Identify differences in limits, premiums, exclusions, endorsements, conditions precedent, subjectivities
- Highlight meaningful distinctions between carriers
- Indicate which insurer is stronger for each section
- Provide a final non‑regulated comparative insight (e.g., which insurer is stronger on specific coverage areas). Do NOT give a recommendation.

---

## OUTPUT SCHEMA (MANDATORY)
{ 
  "insurers": [
    {
      "insurer_name": "",
      "document_type": "",
      "premiums": { "total_payable": null, "currency": "" },
      "limits": { "headline_limit": "" }
    }
  ],
  "product_comparisons": [
    {
      "product": "",
      "carrier_results": [
        {
          "carrier": "",
          "key_terms": [],
          "subjectivities": [],
          "standout_points": [],
          "summary": ""
        }
      ]
    }
  ],
  "comparison_summary": [
    { "insurer_name": "", "premium_amount": 0, "coverage_score": 0, "overall_score": 0 }
  ],
  "overall_findings": [],
  "failed_documents": []
}

---

## INPUT METADATA  
Selected Sections: ${selectedSectionNames.join(', ')}

Documents Provided:
${fetchedDocs.map((d, i)=>`
=== DOCUMENT ${i + 1} START ===
Filename: ${d.filename}
Carrier: ${d.carrier_name}
=== DOCUMENT ${i + 1} END ===
`).join('\n')}
`;
    } else {
      // --- DEFAULT / NARRATIVE MODE ---
      systemPrompt = `You are CoverCompass AI. Produce both structured JSON and a "narrative" field with a human-readable summary.`;
      userPrompt = `Analyze these documents. Return JSON with a "narrative" field containing a comparison.`;
    }
    console.log("outputMode", outputMode);
    // STEP 3: Call Gemini
    console.log('[batch-analyze] Calling Gemini...');
    const t_ai_start = performance.now();
    const modelFallbackOrder = [
      'gemini-3-pro-preview'
    ];
    const maxRetries = 3;
    let lastError;
    const parts = [
      {
        text: systemPrompt + "\n\n" + userPrompt
      }
    ];
    // Attach PDFs
    for (const doc of fetchedDocs){
      parts.push({
        inline_data: {
          mime_type: 'application/pdf',
          data: doc.base64
        }
      });
    }
    // Configure generation: Force JSON *unless* report mode
    const generationConfig = {
      temperature: 0.0,
      topP: 0.9,
      maxOutputTokens: 12000
    };
    if (outputMode !== "comparison_report") {
      generationConfig.responseMimeType = "application/json";
    }
    for (const modelName of modelFallbackOrder){
      console.log(`[batch-analyze] Trying model ${modelName}`);
      for(let attempt = 1; attempt <= maxRetries; attempt++){
        try {
          const geminiRes = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts
                }
              ],
              generationConfig
            })
          }, 120_000);
          const geminiText = await geminiRes.text();
          // Handle model overload 503
          if (geminiRes.status === 503) {
            console.warn(`[batch-analyze] Model overloaded, retrying in ${attempt * 2000}ms...`);
            await new Promise((r)=>setTimeout(r, attempt * 2000));
            continue;
          }
          if (!geminiRes.ok) {
            throw new Error(`Gemini Error ${geminiRes.status}: ${geminiText.slice(0, 200)}`);
          }
          const geminiData = JSON.parse(geminiText);
          const candidate = geminiData.candidates?.[0];
          const combinedText = candidate?.content?.parts?.map((p)=>p.text || '').join('\n').trim();
          if (!combinedText) throw new Error('No content in Gemini response');
          const t_ai = performance.now() - t_ai_start;
          const t_total = performance.now() - t0;
          // --- RESPONSE HANDLING ---
          // 1. Markdown Report Mode: Return raw text
          if (outputMode === "comparison_report") {
            console.log(`[batch-analyze] Generated Report in ${Math.round(t_ai)}ms`);
            return json(req, 200, {
              ok: true,
              report_markdown: combinedText,
              meta: {
                client_name,
                model: modelName,
                mode: outputMode,
                timing: {
                  total_ms: Math.round(t_total),
                  ai_ms: Math.round(t_ai)
                }
              }
            });
          }
          // 2. Structured/Narrative Mode: Parse JSON
          let analysis;
          try {
            analysis = tryParseJsonLoose(combinedText);
          } catch (parseErr) {
            console.error('JSON parse failed:', combinedText.slice(0, 100));
            throw new Error('Invalid JSON from model');
          }
          return json(req, 200, {
            ok: true,
            analysis: outputMode === "structured" ? analysis : undefined,
            narrative: outputMode === "narrative" ? analysis.narrative || combinedText : undefined,
            meta: {
              client_name,
              model: modelName,
              mode: outputMode,
              timing: {
                total_ms: Math.round(t_total),
                ai_ms: Math.round(t_ai)
              }
            }
          });
        } catch (error) {
          lastError = error;
          console.error(`[batch-analyze] Attempt ${attempt} failed:`, String(error));
          if (attempt < maxRetries) {
            await new Promise((r)=>setTimeout(r, 2000)); // Simple wait
          }
        }
      }
    }
    return json(req, 200, {
      ok: false,
      error: `Analysis failed. Last error: ${String(lastError)}`,
      retriable: true
    });
  } catch (error) {
    console.error('[batch-analyze] Critical Error:', error);
    return json(req, 500, {
      ok: false,
      error: String(error)
    });
  }
});
