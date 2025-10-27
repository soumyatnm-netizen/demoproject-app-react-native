import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { validateRequest, preflightClassifySchema, createErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request input with strict schema
    let documentId: string;
    try {
      const validated = await validateRequest(req, preflightClassifySchema);
      documentId = validated.documentId;
    } catch (validationError: any) {
      console.error('Validation error:', validationError.message);
      return createErrorResponse(req, 400, validationError.message, corsHeaders);
    }
    
    console.log(`[Preflight] Starting classification for document: ${documentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log(`[Preflight] Document found: ${doc.filename}`);

    // Get signed URL
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 300);

    if (urlError || !signedUrlData) {
      throw new Error(`Failed to get signed URL: ${urlError?.message}`);
    }

    // Fetch PDF
    const pdfResponse = await fetch(signedUrlData.signedUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    console.log(`[Preflight] PDF fetched: ${pdfBytes.byteLength} bytes`);

    // Convert to base64 for Gemini
    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    console.log(`[Preflight] Converted to base64`);

    // Lightweight classification prompt (150-250 tokens)
    const classificationPrompt = `CoverCompass Preflight. Return JSON only.

INPUTS: filename="${doc.filename}"

OUTPUT:
{ "carrier": "", "doc_type": "Quote|PolicyWording|Unknown",
  "document_type_detected": "Quote|PolicyWording|Unknown",
  "wording_version": "", "purchased_sections": [], "warnings": [] }

RULES:
- Detect by content analysis, not just filename
- Normalize carrier names: "Hiscox Insurance"→"Hiscox", "CFC Underwriting"→"CFC"
- For Quotes: look for premium amounts, client names, quote dates. Set doc_type="Quote"
- For Policy Wordings: look for policy form codes, coverage definitions, insuring clauses. Set doc_type="PolicyWording"
- Only add warnings for CLEAR mismatches (e.g., filename says "quote" but document is clearly a wording form)
- If document contains quote details (premium, client, dates), it's a Quote regardless of exact filename format
- If unsure, set doc_type to most likely type based on content
- For Quotes: list main coverage sections purchased
- For Wordings: extract wording/form code if present
- Use "Unknown" only when content is genuinely unclear`;

    // Call Gemini with inline PDF
    const completionResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: classificationPrompt },
            { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
          ]
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      }),
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      throw new Error(`Gemini completion failed: ${errorText}`);
    }

    const completionData = await completionResponse.json();
    const resultText = completionData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log(`[Preflight] Raw result: ${resultText.substring(0, 500)}`);

    // Parse JSON
    let classification;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      } else {
        classification = JSON.parse(resultText);
      }
    } catch (e) {
      console.error('[Preflight] Failed to parse JSON:', e);
      throw new Error(`Failed to parse classification result: ${e.message}`);
    }

    console.log(`[Preflight] Classification complete:`, classification);

    // Store classification in document metadata
    await supabase
      .from('documents')
      .update({
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({
        success: true,
        classification,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Preflight] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
