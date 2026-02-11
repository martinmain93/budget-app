import { describe, expect, it } from "vitest";
import {
  ACCEPT_THRESHOLD,
  AUTO_RULE_THRESHOLD,
  buildPrompt,
  parseAiResponse,
} from "./aiService";
import type { Category, CategorizationRule, Transaction } from "./types";

/* ── Test fixtures ───────────────────────────────────────────────────────── */

const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", color: "#A8D8EA", isDefault: true },
  { id: "dining", name: "Dining", color: "#B5EAD7", isDefault: true },
  { id: "transport", name: "Transport", color: "#FBC687", isDefault: true },
  { id: "shopping", name: "Shopping", color: "#FFDAC1", isDefault: true },
  { id: "housing", name: "Housing", color: "#AA96DA", isDefault: true },
  { id: "uncategorized", name: "Uncategorized", color: "#E6E6EA", isDefault: true },
];

const VALID_IDS = new Set(CATEGORIES.map((c) => c.id));

function makeTx(id: string, merchant: string, amount = 50): Transaction {
  return {
    id,
    bankAccountId: "acc-1",
    date: new Date().toISOString(),
    merchant,
    amount,
    categoryId: "uncategorized",
    source: "plaid",
  };
}

/* ── buildPrompt ─────────────────────────────────────────────────────────── */

describe("buildPrompt", () => {
  it("includes category names and ids", () => {
    const txs = [makeTx("tx-1", "CANADIAN TIRE #0930")];
    const prompt = buildPrompt(txs, CATEGORIES, []);

    expect(prompt).toContain("groceries: Groceries");
    expect(prompt).toContain("dining: Dining");
    expect(prompt).toContain("shopping: Shopping");
  });

  it("excludes the uncategorized category from available options", () => {
    const prompt = buildPrompt([makeTx("tx-1", "TEST")], CATEGORIES, []);
    expect(prompt).not.toContain("uncategorized: Uncategorized");
  });

  it("includes transaction details", () => {
    const txs = [
      makeTx("tx-1", "CONTACTLESS INTERAC PURCHASE - 0930 CANADIAN TIRE", 87.45),
      makeTx("tx-2", "E-TRANSFER SENT HOPE STIRLING FLKZG9", 200),
    ];
    const prompt = buildPrompt(txs, CATEGORIES, []);

    expect(prompt).toContain('id:"tx-1"');
    expect(prompt).toContain("CANADIAN TIRE");
    expect(prompt).toContain("87.45");
    expect(prompt).toContain('id:"tx-2"');
    expect(prompt).toContain("HOPE STIRLING");
  });

  it("includes existing user rules as context", () => {
    const rules: CategorizationRule[] = [
      {
        id: "r1",
        categoryId: "groceries",
        pattern: "footes farm",
        createdAt: new Date().toISOString(),
        hitCount: 5,
      },
    ];
    const prompt = buildPrompt([makeTx("tx-1", "TEST")], CATEGORIES, rules);

    expect(prompt).toContain('"footes farm" -> groceries');
  });

  it("shows (none yet) when there are no rules", () => {
    const prompt = buildPrompt([makeTx("tx-1", "TEST")], CATEGORIES, []);
    expect(prompt).toContain("(none yet)");
  });

  it("limits batch to 50 transactions", () => {
    const txs = Array.from({ length: 60 }, (_, i) =>
      makeTx(`tx-${i}`, `MERCHANT ${i}`),
    );
    const prompt = buildPrompt(txs, CATEGORIES, []);
    // Should contain tx-49 but not tx-50
    expect(prompt).toContain('id:"tx-49"');
    expect(prompt).not.toContain('id:"tx-50"');
  });
});

/* ── parseAiResponse ─────────────────────────────────────────────────────── */

describe("parseAiResponse", () => {
  it("parses a valid JSON array response", () => {
    const raw = JSON.stringify([
      { id: "tx-1", categoryId: "groceries", confidence: 0.95 },
      { id: "tx-2", categoryId: "dining", confidence: 0.8 },
    ]);

    const result = parseAiResponse(raw, VALID_IDS);

    expect(result.size).toBe(2);
    expect(result.get("tx-1")).toEqual({ categoryId: "groceries", confidence: 0.95 });
    expect(result.get("tx-2")).toEqual({ categoryId: "dining", confidence: 0.8 });
  });

  it("extracts JSON from markdown code blocks", () => {
    const raw = `Here are the classifications:
\`\`\`json
[{"id":"tx-1","categoryId":"shopping","confidence":0.9}]
\`\`\``;

    const result = parseAiResponse(raw, VALID_IDS);
    expect(result.size).toBe(1);
    expect(result.get("tx-1")?.categoryId).toBe("shopping");
  });

  it("rejects items with invalid category IDs", () => {
    const raw = JSON.stringify([
      { id: "tx-1", categoryId: "groceries", confidence: 0.9 },
      { id: "tx-2", categoryId: "nonexistent", confidence: 0.85 },
    ]);

    const result = parseAiResponse(raw, VALID_IDS);
    expect(result.size).toBe(1);
    expect(result.has("tx-1")).toBe(true);
    expect(result.has("tx-2")).toBe(false);
  });

  it("clamps confidence to [0, 1]", () => {
    const raw = JSON.stringify([
      { id: "tx-1", categoryId: "groceries", confidence: 1.5 },
      { id: "tx-2", categoryId: "dining", confidence: -0.3 },
    ]);

    const result = parseAiResponse(raw, VALID_IDS);
    expect(result.get("tx-1")?.confidence).toBe(1);
    expect(result.get("tx-2")?.confidence).toBe(0);
  });

  it("returns empty map for non-JSON response", () => {
    const result = parseAiResponse("I cannot categorize these transactions.", VALID_IDS);
    expect(result.size).toBe(0);
  });

  it("returns empty map for invalid JSON", () => {
    const result = parseAiResponse("[{invalid json}]", VALID_IDS);
    expect(result.size).toBe(0);
  });

  it("skips malformed entries with missing fields", () => {
    const raw = JSON.stringify([
      { id: "tx-1", categoryId: "groceries", confidence: 0.9 },
      { id: "tx-2", confidence: 0.8 }, // missing categoryId
      { categoryId: "dining", confidence: 0.7 }, // missing id
      { id: "tx-4", categoryId: "shopping" }, // missing confidence
    ]);

    const result = parseAiResponse(raw, VALID_IDS);
    expect(result.size).toBe(1);
    expect(result.has("tx-1")).toBe(true);
  });
});

/* ── Threshold constants ─────────────────────────────────────────────────── */

describe("thresholds", () => {
  it("accept threshold is 0.7", () => {
    expect(ACCEPT_THRESHOLD).toBe(0.7);
  });

  it("auto-rule threshold is 0.9", () => {
    expect(AUTO_RULE_THRESHOLD).toBe(0.9);
  });

  it("auto-rule threshold is higher than accept threshold", () => {
    expect(AUTO_RULE_THRESHOLD).toBeGreaterThan(ACCEPT_THRESHOLD);
  });
});
