const ALLOWED = ["api.x.ai", "api.openai.com", "api.groq.com", "openrouter.ai", "api.anakin.ai", "api.deepseek.com"];

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const deny = (msg, code) =>
    new Response(JSON.stringify({ error: msg }), {
      status: code,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return deny("bad json", 400);
  }
  let host = "";
  try {
    host = new URL(body.base || "").host;
  } catch (err) {
    return deny("bad endpoint", 400);
  }
  if (ALLOWED.indexOf(host) === -1) return deny("endpoint not allowlisted", 403);
  if (!body.key || !body.model || !Array.isArray(body.messages)) return deny("missing fields", 400);
  const res = await fetch(body.base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + body.key },
    body: JSON.stringify({ model: body.model, temperature: 0.4, messages: body.messages }),
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
