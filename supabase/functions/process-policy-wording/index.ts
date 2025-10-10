import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// ✅ Force server-safe legacy pdf.js via URL import (bypasses bundler/import-map):
const { getDocument, GlobalWorkerOptions } = await import(
  "https://esm.sh/pdfjs-dist@3.4.120/legacy/build/pdf.mjs"
);

// ✅ Run without a worker in Edge (safest, no DOM or cross-thread needed):
GlobalWorkerOptions.workerSrc = null as unknown as string;

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

    console.log("[pdfjs] entry=legacy; workerSrc=", String(GlobalWorkerOptions.workerSrc));
    console.log("[openai] keyPresent=", Deno.env.get("OPENAI_API_KEY") ? "yes" : "no");

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
    console.log("PDF loaded successfully - Pages:", pdfMetadata.pages, "| Size:", pdfMetadata.size, "bytes | Worker:", String(GlobalWorkerOptions.workerSrc));

    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      extractedText += `\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    console.log('Text extracted, length:', extractedText.length, 'chars');

    // Import schemas and helper
    const { POLICY_WORDING_SCHEMA, callOpenAIResponses } = await import("../_shared/openai-schemas.ts");

    // Use OpenAI Responses API for structured policy analysis
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`[openai] keyPresent: ${openAIApiKey ? "yes" : "no"}`);
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Calling OpenAI Responses API with strict JSON schema...');
    
    const requestBody = {
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You analyse insurance policy wordings for brokers. Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements. Flag ambiguities and broker actions. Include citations. Only output valid JSON per the schema.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Raw extracted policy text follows. Return JSON per schema.' },
            { type: 'input_text', text: extractedText }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: POLICY_WORDING_SCHEMA
      },
      temperature: 0,
      max_output_tokens: 3000
    };
    
    let aiResult;
    try {
      aiResult = await callOpenAIResponses(openAIApiKey, requestBody);
    } catch (error) {
      console.error('OpenAI Responses API error:', error);
      // Retry once
      console.log('Retrying OpenAI call...');
      try {
        aiResult = await callOpenAIResponses(openAIApiKey, requestBody);
      } catch (retryError) {
        throw new Error(`OpenAI failed after retry: ${retryError.message}`);
      }
    }

    const analysisData = aiResult.result;
    const tokenUsage = aiResult.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    console.log('OpenAI token usage:', JSON.stringify(tokenUsage));
    console.log('AI analysis complete');

    // Store the analysis in the database
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: 'Extracted', // Will need to be extracted separately or from filename
        policy_version: null,
        policy_date: null,
        insured_name: null,
        policy_period: null,
        jurisdiction: analysisData.structure?.jurisdiction || null,
        coverage_sections: analysisData.structure || {},
        key_variables: {
          claims_basis: analysisData.structure?.claims_basis || {},
          limits: analysisData.structure?.limits || [],
          sublimits: analysisData.structure?.sublimits || [],
          deductibles: analysisData.structure?.deductibles || [],
          territory: analysisData.structure?.territory || null,
          conditions: analysisData.structure?.conditions || [],
          warranties: analysisData.structure?.warranties || []
        },
        emerging_risks: {}, // Not in new schema
        services: {}, // Not in new schema
        plain_language_summary: {
          key_terms: analysisData.key_terms || [],
          exclusions: analysisData.exclusions || [],
          endorsements: analysisData.endorsements || [],
          notable_issues: analysisData.notable_issues || {},
          citations: analysisData.citations || []
        },
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