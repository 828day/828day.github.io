/* =====================================================================
   DAYBREAK OPENAI PROXY — Cloudflare Worker
   Holds your OpenAI key as a server-side secret so it never appears
   in the page source on GitHub Pages.

   DEPLOY (dashboard method, ~3 minutes):
   1. dash.cloudflare.com → Workers & Pages → Create → Worker
      Name it something like: daybreak-openai
   2. Replace the starter code with this file. Deploy.
   3. Worker → Settings → Variables & Secrets → Add:
        Type: Secret
        Name: OPENAI_API_KEY
        Value: sk-...   (your NEW rotated key)
      Save & Deploy.
   4. Copy the worker URL (https://daybreak-openai.<your-subdomain>.workers.dev)
      and paste it into OPENAI_PROXY_URL in daybreak.html.
   ===================================================================== */

// Origins allowed to use this proxy. Add/remove as needed.
const ALLOWED_ORIGINS = [
  "https://828day.github.io",   // GitHub Pages
  "http://localhost:5500",      // VS Code Live Server (adjust port if different)
  "http://127.0.0.1:5500",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Block any site not on the allowlist from spending your money
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed: " + origin }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY secret not set on the Worker" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Forward the request body untouched to OpenAI, adding the key server-side
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.OPENAI_API_KEY,
      },
      body: request.body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
