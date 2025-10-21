import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Compare Insurance Documents Function Started ===');
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const { documentIds } = await req.json();
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return new Response(
        JSON.stringify({ ok: false, error: 'At least 2 document IDs required for comparison' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${documentIds.length} documents for comparison`);

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch all documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .in('id', documentIds);

    if (docError || !documents || documents.length === 0) {
      throw new Error('Failed to fetch documents');
    }

    console.log(`Retrieved ${documents.length} documents from database`);

    // Build the comparison prompt
    const comparisonPrompt = `Role: You are a hyper-efficient Insurance Policy Analyst specializing in comparative data extraction.

Input: You will be provided with ${documents.length} insurance documents (quotes or policy wordings).

Instruction:
Analyze all documents simultaneously.
Extract the exact value for the following key fields from each document:
- Insurer Name
- Policy Type (e.g., Home Insurance, Motor Trade, Professional Indemnity)
- Total Annual Premium (or Quote Price)
- Voluntary Excess / Deductible
- Public Liability Limit (or equivalent main limit for the policy type)
- Policy Term Start and End Dates

Output Format: Structure the entire response as a single, clearly labeled JSON object. The top-level key should be comparison_report, which contains an array of objects named documents. Each object in the documents array must contain the extracted fields for that specific file.

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, just pure JSON.

Example JSON Structure:
{
  "comparison_report": {
    "summary": "The comparison identifies the lowest premium and highest Public Liability limit. Document 1 offers the most competitive premium at £X, while Document 2 provides the highest coverage at £Y.",
    "documents": [
      {
        "file_name": "[Insert Document 1 Name]",
        "insurer_name": "[Value]",
        "policy_type": "[Value]",
        "total_annual_premium": "[Value]",
        "voluntary_excess": "[Value]",
        "public_liability_limit": "[Value]",
        "policy_term_start": "[Value]",
        "policy_term_end": "[Value]"
      }
    ]
  }
}`;

    // Process all documents and create content array for AI
    const contentArray: any[] = [{ type: 'text', text: comparisonPrompt }];

    for (const doc of documents) {
      console.log(`Processing document: ${doc.filename}`);
      
      // Get signed URL for the document
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 300);

      if (urlError || !urlData?.signedUrl) {
        console.error(`Failed to get signed URL for ${doc.filename}`);
        continue;
      }

      // Download document content
      const docResponse = await fetch(urlData.signedUrl);
      if (!docResponse.ok) {
        console.error(`Failed to fetch document ${doc.filename}`);
        continue;
      }

      const arrayBuffer = await docResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        for (let j = 0; j < sub.length; j++) {
          binaryString += String.fromCharCode(sub[j]);
        }
      }
      const base64Data = btoa(binaryString);

      // Determine MIME type
      const mimeType = doc.file_type || 'application/pdf';
      
      contentArray.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`
        }
      });

      console.log(`Added ${doc.filename} to comparison (${(base64Data.length / 1024).toFixed(2)} KB)`);
    }

    console.log('Calling Lovable AI (Gemini 2.5 Flash) for comparison...');

    // Call Lovable AI with Gemini 2.5 Flash
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: contentArray
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Payment required. Please add credits to your Lovable AI workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI request failed: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    let comparisonText = aiResult.choices?.[0]?.message?.content;

    if (!comparisonText) {
      throw new Error('No comparison result from AI');
    }

    console.log('AI response preview:', comparisonText.substring(0, 200));

    // Clean up the response - remove markdown code blocks if present
    comparisonText = comparisonText.trim();
    if (comparisonText.startsWith('```json')) {
      comparisonText = comparisonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (comparisonText.startsWith('```')) {
      comparisonText = comparisonText.replace(/```\n?/g, '');
    }

    // Parse the JSON response
    let comparisonData: any;
    try {
      comparisonData = JSON.parse(comparisonText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', comparisonText);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate the structure
    if (!comparisonData.comparison_report || !comparisonData.comparison_report.documents) {
      throw new Error('Invalid comparison report structure');
    }

    console.log('=== Comparison Completed Successfully ===');
    console.log(`Processed ${comparisonData.comparison_report.documents.length} documents`);

    return new Response(
      JSON.stringify({
        ok: true,
        result: comparisonData,
        meta: {
          documentsProcessed: documents.length,
          model: 'google/gemini-2.5-flash',
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('=== COMPARISON ERROR ===');
    console.error('Error:', (error as any).message);
    console.error('Stack:', (error as any).stack);

    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as any).message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
