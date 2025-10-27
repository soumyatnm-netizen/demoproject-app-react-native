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

  const startTime = Date.now();

  try {
    console.log('=== Deep Comparison Function Started ===');
    
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);
...
    console.log('Calling Google Gemini for deep comparison analysis...');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: systemPrompt + '\n\n' + userPrompt
          }]
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', errorText);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const comparisonText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    const comparisonResult = JSON.parse(comparisonText);

    console.log('Deep comparison complete');

    // Record processing metrics
    const duration = Date.now() - startTime;
    await supabase.from('processing_metrics').insert({
      operation_type: 'deep_comparison',
      duration_ms: duration,
      success: true,
      metadata: { insurer_count: insurers.length }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        comparison: comparisonResult,
        meta: {
          processed_at: new Date().toISOString(),
          duration_ms: duration,
          model: aiResponse.model,
          usage: aiResponse.usage
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in deep-comparison:', error);
    
    const duration = Date.now() - startTime;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl!, supabaseKey!);
      await supabase.from('processing_metrics').insert({
        operation_type: 'deep_comparison',
        duration_ms: duration,
        success: false,
        metadata: { error: error.message }
      });
    } catch (logError) {
      console.error('Failed to log error metric:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
