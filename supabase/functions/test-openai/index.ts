import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
    const openAIApiKey = Deno.env.get('OPEN_AI_DOCUMENT_SCANNER') || Deno.env.get('OPENAI_DOCUMENT_SCANNER') || Deno.env.get('DOCUMENT_SCANNER_OPENAI_KEY') || Deno.env.get('DOCUMENT_SCANNER_OPEN_AI') || Deno.env.get('COVERCOMPASS_OPENAI') || Deno.env.get('COVERCOMPASS_OPEN_AI') || Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Testing OpenAI API with key:', openAIApiKey.substring(0, 10) + '...');

    // Simple test call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "Hello, OpenAI API is working!" in JSON format with a status field.' }
        ],
        max_tokens: 50,
        temperature: 0.1
      }),
    });

    console.log('OpenAI Response status:', response.status);
    console.log('OpenAI Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `OpenAI API Error: ${response.status}`,
          details: errorText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const result = await response.json();
    console.log('OpenAI API Success:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OpenAI API is working correctly',
        response: result.choices[0]?.message?.content 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Test function error:', error);
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