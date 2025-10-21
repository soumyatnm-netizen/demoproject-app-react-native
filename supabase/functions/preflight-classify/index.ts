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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
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

    // Convert PDF to base64 for Lovable AI (chunked to avoid stack overflow)
    let binaryString = '';
    for (let i = 0; i < pdfBytes.length; i++) {
      binaryString += String.fromCharCode(pdfBytes[i]);
    }
    const base64Pdf = btoa(binaryString);
    console.log(`[Preflight] PDF converted to base64`);

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

    // Call Lovable AI with retry logic
    let completionResponse;
    let resultText;
    const maxRetries = 4;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Preflight] Classification attempt ${attempt}/${maxRetries} using Lovable AI (GPT-5 Mini)`);
        
        completionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: classificationPrompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${base64Pdf}`
                    }
                  }
                ]
              }
            ]
          }),
        });

        const responseText = await completionResponse.text();
        
        if (!completionResponse.ok) {
          // Handle rate limiting (429)
          if (completionResponse.status === 429) {
            console.error(`[Preflight] Rate limit hit on attempt ${attempt}`);
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt + 1) * 1000;
              console.log(`[Preflight] Rate limited - retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw new Error('Rate limit exceeded. Please try again in a few moments.');
          }
          
          // Handle payment required (402)
          if (completionResponse.status === 402) {
            throw new Error('Insufficient AI credits. Please add credits to your Lovable workspace.');
          }
          
          // Handle server errors with retry
          if (completionResponse.status >= 500 && completionResponse.status < 600) {
            console.error(`[Preflight] Server error on attempt ${attempt}: ${responseText.slice(0, 200)}`);
            if (attempt < maxRetries) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.log(`[Preflight] Server error - retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          throw new Error(`Lovable AI completion failed: ${responseText}`);
        }

        const completionData = JSON.parse(responseText);
        resultText = completionData.choices[0].message.content;
        console.log(`[Preflight] Classification succeeded on attempt ${attempt}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        console.error(`[Preflight] Attempt ${attempt} failed:`, String(error));
        if (attempt >= maxRetries) {
          throw error; // Max retries reached
        }
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`[Preflight] Exception - retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
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
