import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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

    // Generate a signed URL for AI to fetch the PDF directly (avoids large base64 payloads)
    const { data: signed, error: signedErr } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 600);
    if (signedErr || !signed?.signedUrl) throw signedErr || new Error('Failed to create signed URL');
    const fileUrl = signed.signedUrl;
    console.log('Signed URL generated for document');

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

    const userPrompt = `Please analyze this insurance policy wording document and extract all the structured information as specified. The document is a PDF.`;

    // Call Lovable AI Gateway with Gemini Flash
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling AI for policy analysis...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: fileUrl,
                  mime_type: 'application/pdf'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiResult = await aiResponse.json();
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
        success: true,
        policyWordingId: policyWording.id,
        insurerName: policyWording.insurer_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing policy wording:', error);
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