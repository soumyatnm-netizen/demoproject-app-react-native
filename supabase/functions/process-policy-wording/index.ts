import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import {
  getDocument,
  GlobalWorkerOptions,
} from "npm:pdfjs-dist@3.4.120/legacy/build/pdf.mjs";

// Optional worker; if it fails, we'll fall back to no worker later.
try {
  GlobalWorkerOptions.workerSrc = "npm:pdfjs-dist@3.4.120/legacy/build/pdf.worker.mjs";
} catch {}

console.log("pdfjs legacy build loaded with npm specifier");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Missing documentId');
    }

    console.log('Processing policy wording document:', documentId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;
    if (!document) throw new Error('Document not found');

    console.log('Document found:', document.storage_path);

    // Download the PDF file for text extraction
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    // Extract text from PDF using pdfjs-dist
    console.log('Extracting text from PDF...');
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    let loadingTask = getDocument({ data: pdfBytes, isEvalSupported: false, disableFontFace: true });
    try {
      await (await loadingTask).promise; // triggers worker errors early
    } catch {
      GlobalWorkerOptions.workerSrc = null as unknown as string; // run without worker
      loadingTask = getDocument({ data: pdfBytes, isEvalSupported: false, disableFontFace: true });
    }
    const pdf = await loadingTask.promise;
    
    const pdfMetadata = {
      pages: pdf.numPages,
      size: pdfBytes.byteLength
    };
    console.log("PDF size:", pdfMetadata.size, "pages:", pdfMetadata.pages);

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      extractedText += `\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    console.log('Text extracted, length:', extractedText.length, 'chars');

    // Create comprehensive prompt for AI analysis
    const systemPrompt = `You are an expert insurance policy analyst specializing in comparing and extracting structured data from insurance policy wording documents.

Your task is to analyze the policy wording document and extract all relevant information in a structured format.

Return your analysis as valid JSON with the following structure:

{
  "insurer_name": "string",
  "policy_version": "string",
  "policy_date": "YYYY-MM-DD",
  "insured_name": "string",
  "policy_period": "string",
  "jurisdiction": "string",
  "coverage_sections": {
    "professional_indemnity": {
      "covered": boolean,
      "scope": "string",
      "exclusions": ["string"],
      "limit": "string"
    },
    "cyber_data_liability": {
      "covered": boolean,
      "data_breaches": boolean,
      "privacy_liability": boolean,
      "regulatory_fines": boolean,
      "pci_penalties": boolean,
      "limit": "string"
    },
    "technology_media_ip": {
      "covered": boolean,
      "infringement": boolean,
      "defamation": boolean,
      "confidentiality_breaches": boolean,
      "limit": "string"
    },
    "crime_fraud": {
      "covered": boolean,
      "employee_dishonesty": boolean,
      "cyber_crime": boolean,
      "social_engineering": boolean,
      "funds_transfer_fraud": boolean,
      "limit": "string"
    },
    "property_cover": {
      "covered": boolean,
      "buildings": boolean,
      "contents": boolean,
      "business_interruption": boolean,
      "limit": "string"
    },
    "employers_liability": {
      "covered": boolean,
      "limit": "string"
    },
    "public_liability": {
      "covered": boolean,
      "limit": "string"
    },
    "first_party_cover": {
      "covered": boolean,
      "extortion": boolean,
      "incident_response_costs": boolean,
      "rectification_costs": boolean,
      "reputational_harm": boolean,
      "limit": "string"
    }
  },
  "key_variables": {
    "coverage_trigger": "string (claims made / occurrence)",
    "notification_requirements": "string",
    "limit_of_indemnity_overall": "string",
    "limit_type": "string (aggregate / any one claim)",
    "sublimits": {
      "ransomware": "string",
      "social_engineering": "string",
      "regulatory_fines": "string",
      "pci_penalties": "string"
    },
    "excess_deductible": {
      "professional_indemnity": "string",
      "cyber": "string",
      "crime": "string"
    },
    "extensions": {
      "crisis_communications": boolean,
      "reputational_harm": boolean,
      "ai_liability": boolean,
      "gdpr_compliance": boolean
    },
    "exclusions": {
      "war_terrorism": boolean,
      "infrastructure": boolean,
      "criminal_acts": boolean,
      "dishonesty": boolean,
      "contractual_liability": boolean
    },
    "conditions_precedent": ["string"],
    "retroactive_date": "string"
  },
  "emerging_risks": {
    "ai_ml_liability": {
      "covered": boolean,
      "details": "string"
    },
    "cloud_services_failures": {
      "covered": boolean,
      "details": "string"
    },
    "cryptocurrency_blockchain": {
      "covered": boolean,
      "details": "string"
    },
    "system_failure_vs_cyber": {
      "human_error_covered": boolean,
      "malicious_event_only": boolean,
      "details": "string"
    }
  },
  "services": {
    "incident_response_hotline": {
      "available": boolean,
      "details": "string"
    },
    "proactive_services": {
      "available": boolean,
      "details": "string"
    },
    "crisis_management": {
      "available": boolean,
      "details": "string"
    }
  },
  "plain_language_summary": {
    "gdpr_fines_covered": {
      "answer": "Yes/No/Partial",
      "citation": "string",
      "details": "string"
    },
    "ransomware_payments": {
      "answer": "Yes/No/Partial",
      "sublimit": "string",
      "citation": "string"
    },
    "ai_claims": {
      "answer": "Yes/No/Partial",
      "details": "string",
      "citation": "string"
    },
    "key_strengths": ["string"],
    "key_weaknesses": ["string"],
    "notable_exclusions": ["string"]
  }
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown formatting or code blocks
- If information is not found, use null for strings, false for booleans
- Extract exact wording and page/section references where possible
- Normalize monetary amounts to consistent format (e.g., £1M, £500K)`;

    const userPrompt = `Please analyze this insurance policy wording document and extract all the structured information as specified.

DOCUMENT TEXT:
${extractedText}`;

    // Use OpenAI directly for text analysis (GPT-5-mini excels at structured extraction)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`OPENAI key present: ${openAIApiKey ? "yes" : "no"}`);
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI GPT-5-mini for policy analysis...');
    
    let aiResponse;
    try {
      aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 8192
        }),
      });
    } catch (fetchError) {
      console.error('OpenAI fetch failed:', fetchError);
      throw new Error(`Failed to connect to OpenAI: ${fetchError.message}`);
    }

    if (!aiResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await aiResponse.json();
        console.error('OpenAI API error (JSON):', aiResponse.status, JSON.stringify(errorDetails));
      } catch {
        errorDetails = await aiResponse.text();
        console.error('OpenAI API error (text):', aiResponse.status, errorDetails);
      }
      throw new Error(`OpenAI API failed (${aiResponse.status}): ${JSON.stringify(errorDetails)}`);
    }

    const aiResult = await aiResponse.json();
    const tokenUsage = aiResult.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    console.log('OpenAI token usage:', JSON.stringify(tokenUsage));
    console.log('AI analysis complete');

    const content = aiResult.choices[0].message.content;
    
    // Parse the JSON response
    let analysisData;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysisData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI analysis result');
    }

    console.log('Parsed analysis data:', analysisData.insurer_name);

    // Store the analysis in the database
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: analysisData.insurer_name || 'Unknown',
        policy_version: analysisData.policy_version,
        policy_date: analysisData.policy_date,
        insured_name: analysisData.insured_name,
        policy_period: analysisData.policy_period,
        jurisdiction: analysisData.jurisdiction,
        coverage_sections: analysisData.coverage_sections || {},
        key_variables: analysisData.key_variables || {},
        emerging_risks: analysisData.emerging_risks || {},
        services: analysisData.services || {},
        plain_language_summary: analysisData.plain_language_summary || {},
        status: 'completed'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('Policy wording analysis stored:', policyWording.id);

    return new Response(
      JSON.stringify({
        ok: true,
        result: analysisData,
        tokens: tokenUsage,
        metadata: {
          ...pdfMetadata,
          documentId,
          policyWordingId: policyWording.id,
          insurerName: policyWording.insurer_name,
          processedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing policy wording:', error);
    return new Response(
      JSON.stringify({
        ok: false,
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