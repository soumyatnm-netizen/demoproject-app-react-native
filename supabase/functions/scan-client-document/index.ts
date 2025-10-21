import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from "https://esm.sh/jszip@3.10.1";
import { validateRequest, scanClientDocumentSchema, createErrorResponse } from '../_shared/validation.ts';

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
  policy_renewal_date?: string;
  current_broker?: string;
  current_carrier?: string;
  current_premium_total?: number;
  claims_free?: boolean;
  recent_claims_details?: string;
  revenue_split_geography?: Record<string, number>;
  activity_split?: Record<string, number>;
  sells_in_us?: boolean;
  notes?: string;
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
    const openAIApiKey =
      Deno.env.get('OPEN_AI_DOCUMENT_SCANNER') ||
      Deno.env.get('OPENAI_DOCUMENT_SCANNER') ||
      Deno.env.get('DOCUMENT_SCANNER_OPENAI_KEY') ||
      Deno.env.get('DOCUMENT_SCANNER_OPEN_AI') ||
      Deno.env.get('COVERCOMPASS_OPENAI') ||
      Deno.env.get('COVERCOMPASS_OPEN_AI') ||
      Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Starting scan-client-document function');
    console.log('OpenAI key source:', ['OPEN_AI_DOCUMENT_SCANNER','OPENAI_DOCUMENT_SCANNER','DOCUMENT_SCANNER_OPENAI_KEY','DOCUMENT_SCANNER_OPEN_AI','COVERCOMPASS_OPENAI','COVERCOMPASS_OPEN_AI','OPENAI_API_KEY'].find(k => !!Deno.env.get(k)) || 'not found');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }

    console.log('All API keys configured successfully');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate request input with strict schema
    let documentId: string;
    try {
      const validated = await validateRequest(req, scanClientDocumentSchema);
      documentId = validated.documentId;
    } catch (validationError: any) {
      console.error('Validation error:', validationError.message);
      return createErrorResponse(req, 400, validationError.message, corsHeaders);
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
    You are an advanced document analysis AI with OCR and handwriting recognition capabilities. Extract client/business information from this document.

    **CRITICAL**: Return field names in snake_case format. Use these exact field names:

    REQUIRED FIELDS (use snake_case):
    - client_name: Business/Client name
    - contact_email: Email address
    - contact_phone: Phone number
    - coverage_requirements: Array of coverage types needed
    - industry: Industry/sector
    - employee_count: Number of employees (as number)
    - revenue_band: Revenue range (format: "1-5m" for £1M-£5M)
    - main_address: Full street address
    - postcode: Postal/ZIP code

    OPTIONAL FIELDS (use snake_case):
    - date_established: When business was established (YYYY-MM-DD format)
    - organisation_type: Type of org (Ltd, PLC, Partnership, etc.)
    - website: Company website URL
    - wage_roll: Total annual wage roll in £
    - policy_renewal_date: When policy renews (YYYY-MM-DD) - look for "Renewal Date", "Policy Expires", "Expiry Date"
    - current_broker: Name of current insurance broker
    - current_carrier: Current insurance company/underwriter
    - current_premium_total: Total annual premium (number only, no currency symbols)
    - claims_free: true if no recent claims, false if has claims, null if unknown
    - recent_claims_details: Description of any recent claims
    - revenue_split_geography: Object with percentages by region {"UK": 50, "EU": 30, "US": 20}
    - activity_split: Object with percentages by channel {"retail": 40, "online": 60}
    - sells_in_us: true/false - whether they sell in US market
    - notes: Any additional relevant information
    - risk_profile: "low", "medium", or "high"

    **EXTRACTION RULES**:
    1. Use exact snake_case field names as shown above
    2. For dates, always use YYYY-MM-DD format
    3. For numbers, extract digits only (no currency symbols or commas)
    4. For booleans, use true/false/null
    5. For arrays, return [] if empty
    6. Use null for missing fields
    7. For percentages objects, ensure they add up to 100 or leave as null
    8. Look carefully for policy renewal dates - they may be in headers, footers, or summary sections

    Return ONLY a valid JSON object with snake_case field names. No explanation, just the JSON.
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
        console.log('Starting DOCX processing for file:', document.filename);
        const arrayBuffer = await fileData.arrayBuffer();
        console.log('File size (bytes):', arrayBuffer.byteLength);
        
        // Load the DOCX file as a ZIP using JSZip
        console.log('Loading DOCX as ZIP...');
        const zip = await JSZip.loadAsync(arrayBuffer);
        console.log('ZIP loaded successfully, looking for document.xml...');
        
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
          console.error('No meaningful text content found. Text length:', plainText?.length);
          console.error('Extracted text preview:', plainText?.substring(0, 200));
          throw new Error('No meaningful text content found in DOCX');
        }
        
        console.log('Successfully extracted text. Length:', plainText.length);
        console.log('Text preview:', plainText.substring(0, 200));

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
          console.error('OpenAI Response status:', response.status);
          console.error('OpenAI Response headers:', Object.fromEntries(response.headers.entries()));
          throw new Error('AI failed to analyze DOCX content');
        }

        const ai = await response.json();
        extractedText = ai.choices?.[0]?.message?.content || null;
        
        console.log('OpenAI API call successful. Response length:', extractedText?.length);

      } catch (docxError) {
        console.error('DOCX processing error:', docxError);
        console.error('Error stack:', (docxError as any).stack);
        
        // Update document status with specific error
        await supabase
          .from('documents')
          .update({ 
            status: 'error', 
            processing_error: `DOCX parsing failed: ${(docxError as any).message}` 
          })
          .eq('id', documentId);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `DOCX processing failed: ${(docxError as any).message}`,
            details: (docxError as any).stack
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

    } else if (filename.endsWith('.pdf') || mime === 'application/pdf') {
      // PDF FLOW: Use OpenAI with specialized PDF parsing instructions
      console.log('Starting PDF processing for file:', document.filename);
      
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Try text extraction first
      console.log('Attempting PDF text extraction...');
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      
      // Extract readable text (filter out binary junk)
      const lines = text.split('\n').filter(line => {
        // Keep lines that have at least some readable ASCII characters
        const readableChars = line.match(/[a-zA-Z0-9]/g);
        return readableChars && readableChars.length > 3;
      });
      
      const cleanText = lines.join('\n').slice(0, 20000);
      
      console.log('Extracted text length:', cleanText.length);
      console.log('Text preview:', cleanText.substring(0, 500));
      
      if (cleanText.length < 50) {
        // If text extraction failed, try image-based approach with base64
        console.log('Text extraction insufficient, trying image-based approach...');
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const sub = bytes.subarray(i, i + chunkSize);
          for (let j = 0; j < sub.length; j++) binaryString += String.fromCharCode(sub[j]);
        }
        const base64Data = btoa(binaryString);
        
        // Use GPT-4o (supports PDF as base64 image)
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: buildPrompt() },
                  { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Data}` } }
                ]
              }
            ],
            max_tokens: 2000,
            temperature: 0.1
          }),
        });
        
        if (!openAIResponse.ok) {
          const err = await openAIResponse.text();
          console.error('OpenAI (PDF image) error:', err);
          await supabase.from('documents').update({ status: 'error', processing_error: 'Failed to parse PDF' }).eq('id', documentId);
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse PDF document.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
        
        const openAIResult = await openAIResponse.json();
        extractedText = openAIResult.choices?.[0]?.message?.content || null;
      } else {
        // Use extracted text with GPT-4o-mini (cheaper, faster)
        console.log('Using extracted text with GPT-4o-mini...');
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a precise data extraction AI. Extract structured client information from the document text. Return ONLY valid JSON with snake_case field names.' },
              { role: 'user', content: `${buildPrompt()}\n\n=== DOCUMENT TEXT ===\n${cleanText}` }
            ],
            max_tokens: 2000,
            temperature: 0.1
          }),
        });

        if (!openAIResponse.ok) {
          const err = await openAIResponse.text();
          console.error('OpenAI (PDF text) error:', err);
          await supabase.from('documents').update({ status: 'error', processing_error: 'AI failed to analyze PDF text' }).eq('id', documentId);
          return new Response(JSON.stringify({ success: false, error: 'AI failed to analyze PDF document.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        const openAIResult = await openAIResponse.json();
        extractedText = openAIResult.choices?.[0]?.message?.content || null;
      }

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

    // Trigger appetite matching after successful extraction
    console.log('[appetite-matching] Starting appetite matching for client document...');
    
    // Prepare client profile for matching
    const clientProfile = {
      document_id: documentId,
      insurance_product: extractedData["Coverage Requirements"]?.[0] || extractedData["Industry"] || "Unknown",
      industry: extractedData["Industry"] || "Unknown",
      revenue: parseFloat(String(extractedData["Revenue Band"] || "0").replace(/[^0-9.]/g, '')) || 0,
      jurisdiction: extractedData["jurisdiction"] || "UK",
      security_requirements: extractedData["security_requirements"] || [],
      requested_coverage_amount: parseFloat(String(extractedData["requested_coverage"] || "0").replace(/[^0-9.]/g, '')) || 0
    };

    console.log('[appetite-matching] Client profile prepared:', JSON.stringify(clientProfile, null, 2));

    // Call appetite matching function asynchronously (don't block response)
    supabase.functions.invoke('appetite-matching', { 
      body: { client_profile: clientProfile } 
    }).then(({ data: matchingResult, error: matchingError }) => {
      if (matchingError) {
        console.error('[appetite-matching] Error:', matchingError);
      } else {
        console.log('[appetite-matching] Success:', matchingResult?.top_matches?.length || 0, 'matches found');
      }
    }).catch(matchError => {
      console.error('[appetite-matching] Exception:', matchError);
    });

    return new Response(
      JSON.stringify({ success: true, extractedData, documentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in scan-client-document function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as any).message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});