/**
 * Stateless AI proxy for providers that block browser CORS (e.g. Anthropic).
 *
 * The user's API key is passed in the request body, forwarded to the provider,
 * and never logged or stored. It exists in memory only for the duration of
 * the request.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
};

interface ProxyRequest {
  provider: string;
  apiKey: string;
  body: Record<string, unknown>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let payload: ProxyRequest;
  try {
    payload = (await req.json()) as ProxyRequest;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const { provider, apiKey, body } = payload;

  if (!provider || !apiKey || !body) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: provider, apiKey, body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const endpoint = PROVIDER_ENDPOINTS[provider];
  if (!endpoint) {
    return new Response(
      JSON.stringify({ error: `Unsupported provider: ${provider}` }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Build provider-specific headers
  const providerHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider === "anthropic") {
    providerHeaders["x-api-key"] = apiKey;
    providerHeaders["anthropic-version"] = "2023-06-01";
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: providerHeaders,
      body: JSON.stringify(body),
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Upstream request failed: ${message}` }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
