import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

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
    
    console.log(`[Preflight] Starting classification for document: ${documentId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
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

    const pdfBytes = await pdfResponse.arrayBuffer();
    console.log(`[Preflight] PDF fetched: ${pdfBytes.byteLength} bytes`);

    // Upload to OpenAI
    const formData = new FormData();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, doc.filename);
    formData.append('purpose', 'assistants');

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`OpenAI upload failed: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;
    console.log(`[Preflight] Uploaded to OpenAI: ${fileId}`);

    // Lightweight classification prompt (150-250 tokens)
    const classificationPrompt = `CoverCompass Preflight. Return JSON only.

INPUTS: filename="${doc.filename}"

OUTPUT:
{ "carrier": "", "doc_type": "Quote|PolicyWording|Unknown",
  "wording_version": "", "purchased_sections": [], "warnings": [] }

RULES:
- Detect by content, not filename.
- Normalize carriers: "Hiscox Insurance"→"Hiscox", "CFC Underwriting"→"CFC".
- If mismatch filename↔content, push warning.
- For Quotes: list purchased sections.
- For Wordings: extract wording/form code.
- Use "Unknown" when absent.`;

    // Call OpenAI with file
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: classificationPrompt },
              {
                type: 'file',
                file: { file_id: fileId }
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      throw new Error(`OpenAI completion failed: ${errorText}`);
    }

    const completionData = await completionResponse.json();
    const resultText = completionData.choices[0].message.content;
    
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
