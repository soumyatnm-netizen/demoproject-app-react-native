export async function fetchPdfAsFile(url: string, filename = "document.pdf"): Promise<File> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch PDF failed: ${r.status} ${r.statusText}`);
  const bytes = new Uint8Array(await r.arrayBuffer());

  // Guardrails: size & type checks
  const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(2);
  console.log("[pdf] fetched bytes:", bytes.byteLength, "(", sizeMB, "MB )", "url host:", new URL(url).host);
  
  if (bytes.byteLength === 0) {
    throw new Error("Fetched zero-byte PDF");
  }
  
  // Force application/pdf type (in case storage serves wrong Content-Type)
  return new File([bytes], filename, { type: "application/pdf" });
}

export async function uploadFileToOpenAI(file: File, key: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", "assistants"); // valid for Responses API attachments
  
  const r = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });
  
  const txt = await r.text();
  if (!r.ok) {
    throw new Error(`OpenAI upload ${r.status}: ${txt.slice(0, 400)}`);
  }
  
  const j = JSON.parse(txt);
  return j.id as string;
}

export async function callResponsesJSON(key: string, body: unknown): Promise<{ result: any; raw: any }> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${key}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify(body),
  });
  
  const txt = await r.text();
  if (!r.ok) {
    console.error('[OpenAI] Error response:', txt.slice(0, 400));
    throw new Error(`OpenAI ${r.status}: ${txt.slice(0, 400)}`);
  }
  
  const j = JSON.parse(txt);
  const jsonText = j?.choices?.[0]?.message?.content;
  const result = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  return { result, raw: j };
}
