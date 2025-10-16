import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting batch appetite guide processing...');

    // Get all appetite guides that need processing
    const { data: appetiteGuides, error: fetchError } = await supabase
      .from('underwriter_appetites')
      .select('*')
      .or('status.eq.uploaded,status.eq.error')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch appetite guides: ${fetchError.message}`);
    }

    if (!appetiteGuides || appetiteGuides.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No appetite guides need processing',
          processed: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${appetiteGuides.length} appetite guides to process`);

    let processed = 0;
    let failed = 0;
    const results = [];

    // Process each appetite guide
    for (const guide of appetiteGuides) {
      try {
        console.log(`Processing appetite guide: ${guide.underwriter_name} (${guide.id})`);

        // Update status to processing
        await supabase
          .from('underwriter_appetites')
          .update({ status: 'processing' })
          .eq('id', guide.id);

        // Retry with exponential backoff to handle OpenAI 429s
        let success = false;
        let lastErrMsg = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data: processResult, error: processError } = await supabase.functions.invoke(
            'process-appetite-document',
            { body: { appetiteDocumentId: guide.id } }
          );

          if (!processError) {
            success = true;
            break;
          }

          lastErrMsg = processError.message || 'Unknown error';
          console.warn(`Attempt ${attempt} failed for ${guide.underwriter_name}: ${lastErrMsg}`);
          if (attempt < 3) {
            const waitMs = attempt * 10000; // 10s, 20s
            console.log(`Backing off for ${waitMs}ms before retry...`);
            await new Promise((r) => setTimeout(r, waitMs));
          }
        }

        if (!success) {
          await supabase
            .from('underwriter_appetites')
            .update({ status: 'error', processing_error: lastErrMsg })
            .eq('id', guide.id);

          failed++;
          results.push({ id: guide.id, underwriter_name: guide.underwriter_name, status: 'failed', error: lastErrMsg });
        } else {
          console.log(`Successfully processed ${guide.underwriter_name}`);
          processed++;
          results.push({ id: guide.id, underwriter_name: guide.underwriter_name, status: 'success' });
        }

        // Spread calls to respect TPM limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing guide ${guide.id}:`, error);
        failed++;
        results.push({ id: guide.id, underwriter_name: guide.underwriter_name, status: 'failed', error: (error as Error).message });
      }
    }

    console.log(`Batch processing complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Batch processing complete`,
        total: appetiteGuides.length,
        processed,
        failed,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch processing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
