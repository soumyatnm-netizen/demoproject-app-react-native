import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
    console.log('=== Reprocess Quote Function Started ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
      throw new Error('Missing required environment variables');
    }

    const { quoteId } = await req.json();

    if (!quoteId) {
      throw new Error('Quote ID is required');
    }

    console.log('Reprocessing quote ID:', quoteId);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get quote and document details
    const { data: quote, error: quoteError } = await supabase
      .from('structured_quotes')
      .select('*, documents(*)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote not found: ${quoteError?.message}`);
    }

    const document = quote.documents;
    if (!document) {
      throw new Error('No document associated with this quote');
    }

    console.log('Found quote for document:', document.filename);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      for (let j = 0; j < sub.length; j++) {
        binaryString += String.fromCharCode(sub[j]);
      }
    }
    const base64Data = btoa(binaryString);

    console.log('File converted to base64, calling AI...');

    const extractionPrompt = `Extract structured insurance quote data from this document. Return ONLY valid JSON (no markdown, no explanations):

{
  "insurer_name": "Full insurer company name (e.g., Hiscox, CFC, Allianz, Aviva, RSA)",
  "product_type": "Type of insurance (e.g., Professional Indemnity, Combined Commercial)",
  "industry": "Industry/sector",
  "revenue_band": "Revenue range (e.g., 1M-5M)",
  "premium_amount": <number - annual premium>,
  "premium_currency": "GBP",
  "quote_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "renewal_date": "YYYY-MM-DD - policy renewal date (look for renewal date, policy expiry, or expiration date)",
  "deductible_amount": <number - excess>,
  "coverage_limits": {
    "professional_indemnity": <number or null>,
    "public_liability": <number or null>,
    "employers_liability": <number or null>
  },
  "inner_limits": {
    "any_one_claim": <number or null>,
    "aggregate": <number or null>
  },
  "inclusions": ["covered items"],
  "exclusions": ["exclusions"],
  "policy_terms": {
    "territory": "Coverage territory",
    "period": "Duration",
    "renewal_date": "YYYY-MM-DD"
  },
  "current_broker": "Current broker name or null",
  "current_carrier": "Current carrier/underwriter or null",
  "current_premium_total": <number or null - total current premium>,
  "claims_free": <true/false/null - whether claims-free>,
  "recent_claims_details": "Details of recent claims or null",
  "revenue_split_geography": {"UK": <number>, "EU": <number>, "US": <number>, "APAC": <number>, "Other": <number>} or null,
  "activity_split": {"e-commerce": <number>, "retail": <number>, "wholesale": <number>, "B2B": <number>, "other": <number>} or null,
  "sells_in_us": <true/false/null - whether they sell in US>
}

CRITICAL: Extract the ACTUAL insurer name from the document. Look for company logos, letterheads, policy issuer details.
IMPORTANT: Look for policy renewal date, expiry date, or renewal date - these might be labeled as "Renewal Date", "Policy Expires", "Expiry Date", or "Valid Until".
IMPORTANT: For geography and activity splits, extract percentages (must add up to 100). For claims free, look for "no claims", "claims free", etc.`;

    const mimeType = document.file_type || 'application/pdf';
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    console.log('Calling Gemini with file size:', base64Data.length, 'mime type:', mimeType);

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: extractionPrompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      }),
    });

    console.log('AI Response status:', aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const extractedText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!extractedText) {
      throw new Error('No content extracted from AI');
    }

    console.log('AI extraction successful');

    // Parse JSON
    let structuredData;
    try {
      const jsonMatch = extractedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                       extractedText.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      structuredData = JSON.parse(jsonMatch[1]);
      console.log('Extracted insurer:', structuredData.insurer_name);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    if (!structuredData.insurer_name) {
      throw new Error('Insurer name not found in extracted data');
    }

    // Update the existing quote
    console.log('Updating quote with corrected data...');
    const { error: updateError } = await supabase
      .from('structured_quotes')
      .update({
        insurer_name: structuredData.insurer_name,
        product_type: structuredData.product_type || quote.product_type,
        industry: structuredData.industry || quote.industry,
        revenue_band: structuredData.revenue_band || quote.revenue_band,
        premium_amount: structuredData.premium_amount || quote.premium_amount,
        premium_currency: structuredData.premium_currency || quote.premium_currency,
        quote_date: structuredData.quote_date || quote.quote_date,
        expiry_date: structuredData.expiry_date || quote.expiry_date,
        deductible_amount: structuredData.deductible_amount || quote.deductible_amount,
        coverage_limits: structuredData.coverage_limits || quote.coverage_limits,
        inner_limits: structuredData.inner_limits || quote.inner_limits,
        inclusions: structuredData.inclusions || quote.inclusions,
        exclusions: structuredData.exclusions || quote.exclusions,
        policy_terms: structuredData.policy_terms || quote.policy_terms,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    if (updateError) {
      throw new Error(`Failed to update quote: ${updateError.message}`);
    }

    console.log('=== Reprocess Complete ===');

    return new Response(JSON.stringify({ 
      success: true,
      quoteId,
      oldInsurer: quote.insurer_name,
      newInsurer: structuredData.insurer_name,
      message: 'Quote updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== REPROCESS ERROR ===');
    console.error('Error:', (error as any).message);
    
    return new Response(JSON.stringify({ 
      error: (error as any).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});