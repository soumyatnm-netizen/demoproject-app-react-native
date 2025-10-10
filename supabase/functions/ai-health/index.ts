import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async () => {
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return resp(500, { ok: false, error: "missing OPENAI_API_KEY" });
  
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${KEY}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({ 
      model: "gpt-4o-mini", 
      input: [{ 
        role: "user", 
        content: [{ type: "input_text", text: "say ok" }] 
      }] 
    })
  });
  
  const t = await r.text();
  return resp(r.ok ? 200 : r.status, { 
    ok: r.ok, 
    status: r.status, 
    body: t.slice(0, 400) 
  });
});

function resp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
