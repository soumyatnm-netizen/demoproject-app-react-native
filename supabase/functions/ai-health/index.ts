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

  const KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing OPENAI_API_KEY" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: "say ok" }], 
        temperature: 0 
      })
    });
    
    const t = await r.text();
    
    return new Response(
      JSON.stringify({ 
        ok: r.ok, 
        status: r.status, 
        body: t.slice(0, 200),
        fullResponse: r.ok ? JSON.parse(t) : null
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message 
      }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
