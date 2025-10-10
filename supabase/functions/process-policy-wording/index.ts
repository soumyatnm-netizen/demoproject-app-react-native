import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// ✅ 100% server-safe import (no esm.sh rewriting, no es2022 path)
const { getDocument, GlobalWorkerOptions } = await import(
  "https://esm.sh/pdfjs-dist@3.4.120/legacy/build/pdf.mjs"
);

// ✅ Run pdf.js without a worker (Edge-friendly, no DOM/canvas)
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
    console.log('=== Process Policy Wording Function Started ===');
    
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Missing documentId');
    }

    console.log('Processing policy wording document:', documentId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('[pdfjs] entry=legacy(jsDelivr); workerSrc=', String(GlobalWorkerOptions.workerSrc));
    console.log('[openai] keyPresent:', openAIApiKey ? 'yes' : 'no');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

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

    // Download file for text extraction
    console.log('Downloading file from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBytes = new Uint8Array(arrayBuffer);
    
    console.log('[pdf] fetched bytes:', pdfBytes.byteLength, '(', (pdfBytes.byteLength / (1024 * 1024)).toFixed(2), 'MB)');
    
    const loadingTask = getDocument({ 
      data: pdfBytes, 
      isEvalSupported: false, 
      disableFontFace: true 
    });
    const pdf = await loadingTask.promise;
    
    console.log('PDF loaded - Pages:', pdf.numPages);

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

    console.log('Calling OpenAI Chat Completions API with JSON schema...');
    
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You analyse insurance policy wordings for brokers. Extract structure (insuring clause, definitions, conditions, warranties, limits/sublimits/deductibles, territory, jurisdiction, claims basis) plus exclusions and endorsements. Flag ambiguities and broker actions. Include citations. Only output valid JSON per the schema.'
        },
        { 
          role: 'user', 
          content: `Raw extracted policy text follows. Return JSON per schema.\n\n${extractedText}` 
        }
      ],
      response_format: { 
        type: 'json_schema', 
        json_schema: POLICY_WORDING_SCHEMA 
      },
      temperature: 0,
      max_tokens: 3000
    };
    
    const { result: analysisData, raw, usage } = await callOpenAIResponses(openAIApiKey, requestBody);
    
    console.log('[openai] model:', raw?.model, 'usage:', JSON.stringify(usage ?? null));

    // Store the analysis in the database
    const { data: policyWording, error: insertError } = await supabase
      .from('policy_wordings')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: 'Extracted',
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
        emerging_risks: {},
        services: {},
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
    console.log('=== Process Policy Wording Completed Successfully ===');

    return new Response(
      JSON.stringify({
        ok: true,
        result: analysisData,
        tokens: usage,
        metadata: {
          documentId,
          policyWordingId: policyWording.id,
          insurerName: policyWording.insurer_name,
          processedAt: new Date().toISOString(),
          model: raw?.model || 'gpt-4o-mini'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== PROCESS POLICY WORDING ERROR ===');
    console.error('Error:', (error as any).message);
    console.error('Stack:', (error as any).stack);
    
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        error: (error as any).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
