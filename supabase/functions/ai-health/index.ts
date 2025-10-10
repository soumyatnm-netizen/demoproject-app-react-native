import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  console.log("[ai-health] invoked", new Date().toISOString(), "method=", req.method);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  return new Response(JSON.stringify({ ok: !!KEY, keyPresent: !!KEY }), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
});
