import type {
  AiProvider,
  AiProviderSettings,
  Category,
  CategorizationRule,
  Transaction,
} from "./types";

/* ── Public types ────────────────────────────────────────────────────────── */

export interface AiClassification {
  categoryId: string;
  confidence: number;
}

export interface AiCategorizationResult {
  classifications: Map<string, AiClassification>;
  error?: string;
}

/* ── Default models per provider ─────────────────────────────────────────── */

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.0-flash",
};

/* ── Confidence thresholds ───────────────────────────────────────────────── */

const ACCEPT_THRESHOLD = 0.7;
const AUTO_RULE_THRESHOLD = 0.9;

export { ACCEPT_THRESHOLD, AUTO_RULE_THRESHOLD };

/* ── Prompt construction ─────────────────────────────────────────────────── */

const MAX_BATCH = 50;

export function buildPrompt(
  txs: Transaction[],
  categories: Category[],
  rules: CategorizationRule[],
): string {
  const categoryList = categories
    .filter((c) => c.id !== "uncategorized")
    .map((c) => `- ${c.id}: ${c.name}`)
    .join("\n");

  const ruleList =
    rules.length > 0
      ? rules
          .slice(0, 30)
          .map((r) => `- "${r.pattern}" -> ${r.categoryId}`)
          .join("\n")
      : "(none yet)";

  const txList = txs
    .slice(0, MAX_BATCH)
    .map(
      (tx, i) =>
        `${i + 1}. id:"${tx.id}" description:"${tx.merchant}" amount:${tx.amount}`,
    )
    .join("\n");

  return `You are a financial transaction categorizer. Classify each transaction into exactly one of the available categories. Consider the merchant/description text, amount, and any known patterns.

Available categories:
${categoryList}

Known patterns from user rules:
${ruleList}

Transactions to classify:
${txList}

Respond with ONLY a JSON array, no other text. Each element must have exactly these fields:
[{"id":"<transaction id>","categoryId":"<category id>","confidence":<0.0-1.0>}]

Rules:
- categoryId MUST be one of the available category ids listed above.
- confidence should reflect how certain you are (1.0 = certain, 0.5 = guessing).
- For e-transfers to individuals, use the most likely category based on context, or assign low confidence if unclear.
- For payroll/salary deposits, use "uncategorized" with low confidence (the user may want a custom category).
- Return one entry per transaction, in the same order.`;
}

/* ── Response parsing ────────────────────────────────────────────────────── */

export function parseAiResponse(
  raw: string,
  validCategoryIds: Set<string>,
): Map<string, AiClassification> {
  const result = new Map<string, AiClassification>();

  // Extract JSON array from the response (handles markdown code blocks)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return result;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return result;
  }

  if (!Array.isArray(parsed)) {
    return result;
  }

  for (const item of parsed) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).id === "string" &&
      typeof (item as Record<string, unknown>).categoryId === "string" &&
      typeof (item as Record<string, unknown>).confidence === "number"
    ) {
      const entry = item as { id: string; categoryId: string; confidence: number };
      // Only accept valid category IDs
      if (validCategoryIds.has(entry.categoryId)) {
        result.set(entry.id, {
          categoryId: entry.categoryId,
          confidence: Math.max(0, Math.min(1, entry.confidence)),
        });
      }
    }
  }

  return result;
}

/* ── Provider adapters ───────────────────────────────────────────────────── */

async function callOpenAI(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? "";
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  // Anthropic blocks browser CORS, so we proxy through a Supabase Edge Function
  const proxyUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!proxyUrl) {
    throw new Error(
      "VITE_API_BASE_URL is required for Anthropic (CORS proxy). " +
        "Set it in your .env file to point at your Supabase Edge Functions.",
    );
  }

  const response = await fetch(`${proxyUrl}/ai/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "anthropic",
      apiKey,
      body: {
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic proxy error (${response.status}): ${err}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return json.content?.find((c) => c.type === "text")?.text ?? "";
}

async function callGoogle(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google Gemini API error (${response.status}): ${err}`);
  }

  const json = (await response.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const PROVIDER_CALLERS: Record<
  AiProvider,
  (prompt: string, apiKey: string, model: string) => Promise<string>
> = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  google: callGoogle,
};

/* ── Main entry point ────────────────────────────────────────────────────── */

export async function classifyTransactions(
  txs: Transaction[],
  categories: Category[],
  rules: CategorizationRule[],
  settings: AiProviderSettings,
): Promise<AiCategorizationResult> {
  if (!settings.enabled || !settings.apiKey || txs.length === 0) {
    return { classifications: new Map() };
  }

  const batch = txs.slice(0, MAX_BATCH);
  const prompt = buildPrompt(batch, categories, rules);
  const caller = PROVIDER_CALLERS[settings.provider];

  if (!caller) {
    return {
      classifications: new Map(),
      error: `Unsupported provider: ${settings.provider}`,
    };
  }

  try {
    const rawResponse = await caller(prompt, settings.apiKey, settings.model);
    const validIds = new Set(categories.map((c) => c.id));
    const classifications = parseAiResponse(rawResponse, validIds);
    return { classifications };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { classifications: new Map(), error: message };
  }
}
