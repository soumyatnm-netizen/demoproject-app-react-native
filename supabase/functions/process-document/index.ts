import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Process Document Function Started ===');
    
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Environment variables check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasOpenAIKey: !!openAIApiKey,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing'
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Parse request body
    console.log('Parsing request body...');
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { documentId, clientName } = requestBody;

    if (!documentId) {
      console.error('No document ID provided in request');
      throw new Error('Document ID is required');
    }

    console.log('Processing document ID:', documentId);

    // Initialize Supabase client
    console.log('Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document details
    console.log('Fetching document from database...');
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error('Document fetch error:', docError);
      throw new Error(`Document not found: ${docError.message}`);
    }

    if (!document) {
      console.error('Document not found in database');
      throw new Error('Document not found');
    }

    console.log('Document found:', {
      id: document.id,
      filename: document.filename,
      type: document.file_type,
      size: document.file_size,
      status: document.status
    });

    // Update status to processing
    console.log('Updating document status to processing...');
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document status:', updateError);
      // Don't throw here, just log the error
    }

    // Generate sample quote data based on filename
    console.log('Generating sample quote data...');
    
    // Create deterministic but varied data based on filename
    const filename = document.filename.toLowerCase();
    const isBasic = filename.includes('basic');
    const isComprehensive = filename.includes('comprehensive') || filename.includes('premium');
    const isPI = filename.includes('pi') || filename.includes('professional') || filename.includes('indemnity');
    const isPL = filename.includes('pl') || filename.includes('public') || filename.includes('liability');
    
    // Generate realistic sample data
    const baseAmount = isBasic ? 1500 : isComprehensive ? 8000 : 3500;
    const variance = Math.floor(Math.random() * 1000);
    const premiumAmount = baseAmount + variance;
    
    const sampleInsurerNames = [
      'AXA Insurance UK',
      'Zurich Insurance',
      'Allianz Commercial',
      'Aviva Business',
      'RSA Insurance Group',
      'Hiscox Insurance',
      'QBE European Operations',
      'Liberty Specialty Markets'
    ];
    
    const randomInsurer = sampleInsurerNames[Math.floor(Math.random() * sampleInsurerNames.length)];

    const structuredData = {
      insurer_name: randomInsurer,
      product_type: isPI ? 'Professional Indemnity' : isPL ? 'Public Liability' : 'Combined Commercial',
      industry: 'Professional Services',
      revenue_band: premiumAmount > 5000 ? '5M-10M' : '1M-5M',
      premium_amount: premiumAmount,
      premium_currency: 'GBP',
      quote_date: '2024-12-15',
      expiry_date: '2025-12-15',
      deductible_amount: isBasic ? 1000 : 2500,
      coverage_limits: {
        professional_indemnity: isPI ? (isBasic ? 1000000 : 2000000) : null,
        public_liability: isPL ? 2000000 : 1000000,
        employers_liability: 10000000
      },
      inner_limits: {
        any_one_claim: isBasic ? 1000000 : 2000000,
        aggregate: isBasic ? 2000000 : 4000000
      },
      inclusions: [
        'Professional services cover',
        'Data protection liability',
        'Court attendance costs',
        'Emergency legal costs',
        isComprehensive ? 'Extended territorial coverage' : null
      ].filter(Boolean),
      exclusions: [
        'War and terrorism',
        'Nuclear risks',
        'Pollution (unless specifically covered)',
        'Cyber attacks (basic cover only)'
      ],
      policy_terms: {
        territory: 'United Kingdom',
        period: '12 months',
        renewal_date: '2025-12-15'
      },
      quote_status: 'quoted'
    };

    console.log('Generated structured data:', structuredData);

    // Save to database
    console.log('Saving structured quote to database...');
    const { data: insertData, error: insertError } = await supabase
      .from('structured_quotes')
      .insert({
        document_id: documentId,
        user_id: document.user_id,
        insurer_name: structuredData.insurer_name,
        product_type: structuredData.product_type,
        industry: structuredData.industry,
        revenue_band: structuredData.revenue_band,
        premium_amount: structuredData.premium_amount,
        premium_currency: structuredData.premium_currency,
        quote_date: structuredData.quote_date,
        expiry_date: structuredData.expiry_date,
        deductible_amount: structuredData.deductible_amount,
        coverage_limits: structuredData.coverage_limits,
        inner_limits: structuredData.inner_limits,
        inclusions: structuredData.inclusions,
        exclusions: structuredData.exclusions,
        policy_terms: structuredData.policy_terms,
        quote_status: structuredData.quote_status,
        client_name: clientName || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to save quote data: ${insertError.message}`);
    }

    console.log('Quote saved with ID:', insertData.id);

    // Update document status to processed
    console.log('Updating document status to processed...');
    const { error: finalUpdateError } = await supabase
      .from('documents')
      .update({ status: 'processed' })
      .eq('id', documentId);

    if (finalUpdateError) {
      console.error('Failed to update final status:', finalUpdateError);
      // Don't throw, just log
    }

    console.log('=== Process Document Function Completed Successfully ===');

    return new Response(JSON.stringify({ 
      success: true,
      documentId,
      quoteId: insertData.id,
      extractedData: structuredData,
      message: 'Document processed successfully with sample data'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== PROCESS DOCUMENT ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    
    // Try to update document status to error
    try {
      console.log('Attempting to update document status to error...');
      const body = await req.clone().json();
      const documentId = body?.documentId;
      
      if (documentId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error: updateError } = await supabase
            .from('documents')
            .update({ 
              status: 'error',
              processing_error: error.message 
            })
            .eq('id', documentId);
          
          if (updateError) {
            console.error('Failed to update document error status:', updateError);
          } else {
            console.log('Document status updated to error');
          }
        }
      }
    } catch (updateError) {
      console.error('Failed to update document status in error handler:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});