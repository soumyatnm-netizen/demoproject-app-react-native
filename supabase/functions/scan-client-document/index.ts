import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientExtractedData {
  client_name?: string;
  contact_email?: string;
  contact_phone?: string;
  coverage_requirements?: string[];
  risk_profile?: string;
  industry?: string;
  employee_count?: number;
  revenue_band?: string;
  main_address?: string;
  postcode?: string;
  date_established?: string;
  organisation_type?: string;
  website?: string;
  years_experience?: number;
  total_employees?: number;
  wage_roll?: number;
  income_breakdown?: {
    last_year?: number;
    current_year_expectation?: number;
    next_12_months_estimate?: number;
  };
  customer_locations?: {
    uk_percentage?: number;
    eu_percentage?: number;
    usa_canada_percentage?: number;
    rest_of_world_percentage?: number;
  };
  usa_canada_details?: {
    subsidiaries?: string[];
    income?: number;
    largest_contracts?: Array<{
      customer_name?: string;
      work_description?: string;
      length?: string;
      value?: number;
    }>;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Fetch the document from Supabase
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download the file content from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Helpers
    const buildPrompt = () => `
    You are a document analysis AI. Extract client/business information from this insurance policy or quote document.

    Extract the following information if available in the document:

    REQUIRED FIELDS:
    - Business/Client name
    - Contact Email 
    - Contact Phone 
    - Coverage Requirements (as array)
    - Risk Profile (low/medium/high)
    - Industry
    - Employee Count (number)
    - Revenue Band
    - Main address
    - Postcode

    OPTIONAL FIELDS:
    - Date business established
    - Type of organisation (Ltd, PLC, etc.)
    - Website
    - Relevant years of experience
    - Total number of employees
    - Total wage roll
    - Income breakdown (last year, current year expectation, next 12 months estimate)
    - Customer location & jurisdiction breakdown (UK, EU, USA/Canada, Rest of world percentages)
    - USA/Canada specific: subsidiaries, income, largest contracts (customer name, work, length, value)

    Return ONLY a valid JSON object with the extracted data. Use null for fields that cannot be found. 
    For arrays, return empty arrays if no data found.
    For revenue_band, use format like "1-5m" for £1M - £5M.
    For risk_profile, return one of: "low", "medium", "high".
    For coverage_requirements, return as array of strings.
    `;

    const mime = (document.file_type || '').toLowerCase();
    const filename = (document.filename || '').toLowerCase();

    let extractedText: string | null = null;

    if (mime.startsWith('image/')) {
      // IMAGE FLOW: convert to base64 in safe chunks and call GPT-4o vision
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        // Avoid apply on very large arrays
        for (let j = 0; j < sub.length; j++) binaryString += String.fromCharCode(sub[j]);
      }
      const base64Data = btoa(binaryString);

      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildPrompt() },
                { type: 'image_url', image_url: { url: `data:${document.file_type};base64,${base64Data}` } }
              ]
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        }),
      });

      if (!openAIResponse.ok) {
        const err = await openAIResponse.text();
        console.error('OpenAI (image) error:', err);
        await supabase.from('documents').update({ status: 'error', processing_error: 'AI vision failed to analyze image' }).eq('id', documentId);
        return new Response(JSON.stringify({ success: false, error: 'AI failed to analyze image document.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      const openAIResult = await openAIResponse.json();
      extractedText = openAIResult.choices?.[0]?.message?.content || null;

    } else if (filename.endsWith('.docx') || mime.includes('wordprocessingml')) {
      // DOCX FLOW: extract text from word/document.xml using JSZip
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        
        // Load the DOCX file as a ZIP using JSZip
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Find and read the document.xml file
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
          throw new Error('No document.xml found in DOCX file');
        }
        
        const xmlContent = await documentXmlFile.async('text');
        
        // Extract text from XML (remove tags and decode entities)
        let plainText = xmlContent
          .replace(/<w:p[^>]*>/g, '\n')  // Paragraph breaks
          .replace(/<w:br[^>]*>/g, '\n') // Line breaks
          .replace(/<[^>]+>/g, ' ')      // Remove all XML tags
          .replace(/&amp;/g, '&')       // Decode HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, ' ')         // Normalize whitespace
          .trim();

        if (!plainText || plainText.length < 10) {
          throw new Error('No meaningful text content found in DOCX');
        }

        // Call OpenAI with extracted text
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Extract structured client details from provided document text. Always return JSON only.' },
              { role: 'user', content: `${buildPrompt()}\n\nDocument Text:\n${plainText.slice(0, 15000)}` }
            ],
            max_tokens: 2000,
            temperature: 0.1
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('OpenAI (docx) error:', err);
          throw new Error('AI failed to analyze DOCX content');
        }

        const ai = await response.json();
        extractedText = ai.choices?.[0]?.message?.content || null;

      } catch (docxError) {
        console.error('DOCX processing error:', docxError);
        await supabase
          .from('documents')
          .update({ status: 'error', processing_error: `DOCX parsing failed: ${docxError.message}` })
          .eq('id', documentId);

        return new Response(
          JSON.stringify({ success: false, error: `DOCX processing failed: ${docxError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

    } else if (filename.endsWith('.pdf') || mime === 'application/pdf') {
      // PDF FLOW: Not yet supported – respond gracefully
      await supabase
        .from('documents')
        .update({ status: 'error', processing_error: 'PDF parsing not supported yet' })
        .eq('id', documentId);

      return new Response(
        JSON.stringify({ success: false, error: 'PDF scanning is not yet supported. Please upload a DOCX or a clear image (PNG/JPG).'}),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } else {
      await supabase.from('documents').update({ status: 'error', processing_error: 'Unsupported file type' }).eq('id', documentId);
      return new Response(JSON.stringify({ success: false, error: 'Unsupported file type. Please upload a DOCX, PNG or JPG.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (!extractedText) {
      await supabase.from('documents').update({ status: 'error', processing_error: 'No content extracted' }).eq('id', documentId);
      return new Response(JSON.stringify({ success: false, error: 'No content extracted from document.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Parse the JSON response
    let extractedData: ClientExtractedData;
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw text:', extractedText);
      await supabase.from('documents').update({ status: 'error', processing_error: 'AI returned unparseable content' }).eq('id', documentId);
      return new Response(JSON.stringify({ success: false, error: 'AI returned unparseable content.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Mark as processed on success
    await supabase
      .from('documents')
      .update({ status: 'processed', processing_error: null })
      .eq('id', documentId);

    return new Response(
      JSON.stringify({ success: true, extractedData, documentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in scan-client-document function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});