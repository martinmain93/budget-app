import {
  ACCEPT_THRESHOLD,
  AUTO_RULE_THRESHOLD,
  classifyTransactions,
} from "./aiService";
import type { AiProviderSettings, CategorizationRule, Category, Transaction } from "./types";

const heuristicDictionary: Record<string, string> = {
  trader: "groceries",
  market: "groceries",
  uber: "transport",
  lyft: "transport",
  shell: "transport",
  rent: "housing",
  electric: "utilities",
  water: "utilities",
  coffee: "dining",
  restaurant: "dining",
  pharmacy: "health",
  doctor: "health",
  cinema: "entertainment",
  store: "shopping",
};

function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().replace(/\s+/g, " ").trim();
}

export function applyRules(
  tx: Transaction,
  rules: CategorizationRule[],
): string | null {
  const merchant = normalizeMerchant(tx.merchant);
  const hit = rules.find((rule) => merchant.includes(rule.pattern));
  return hit?.categoryId ?? null;
}

export function categorizeTransaction(
  tx: Transaction,
  rules: CategorizationRule[],
): string {
  const byRule = applyRules(tx, rules);
  if (byRule) {
    return byRule;
  }
  const merchant = normalizeMerchant(tx.merchant);
  const key = Object.keys(heuristicDictionary).find((word) =>
    merchant.includes(word),
  );
  return key ? heuristicDictionary[key] : "uncategorized";
}

export function autoCategorize(
  txs: Transaction[],
  rules: CategorizationRule[],
): Transaction[] {
  return txs.map((tx) => ({
    ...tx,
    categoryId:
      tx.categoryId === "uncategorized"
        ? categorizeTransaction(tx, rules)
        : tx.categoryId,
  }));
}

export function addOrBoostRule(
  existing: CategorizationRule[],
  pattern: string,
  categoryId: string,
): CategorizationRule[] {
  const normalized = normalizeMerchant(pattern);
  const found = existing.find(
    (rule) => rule.pattern === normalized && rule.categoryId === categoryId,
  );
  if (found) {
    return existing.map((rule) =>
      rule.id === found.id ? { ...rule, hitCount: rule.hitCount + 1 } : rule,
    );
  }
  return [
    ...existing,
    {
      id: crypto.randomUUID(),
      categoryId,
      pattern: normalized,
      createdAt: new Date().toISOString(),
      hitCount: 1,
    },
  ];
}

export function suggestRules(
  txs: Transaction[],
  rules: CategorizationRule[],
  categories: Category[],
): Array<{ pattern: string; categoryName: string; categoryId: string; count: number }> {
  const counts = new Map<string, { categoryId: string; count: number }>();
  for (const tx of txs) {
    if (tx.categoryId === "uncategorized") {
      continue;
    }
    const key = normalizeMerchant(tx.merchant).split(" ").slice(0, 2).join(" ");
    const current = counts.get(key);
    if (!current) {
      counts.set(key, { categoryId: tx.categoryId, count: 1 });
    } else {
      counts.set(key, { categoryId: current.categoryId, count: current.count + 1 });
    }
  }

  return [...counts.entries()]
    .filter(([pattern, value]) => {
      const exists = rules.some(
        (rule) => rule.pattern === pattern && rule.categoryId === value.categoryId,
      );
      return value.count >= 3 && !exists;
    })
    .slice(0, 3)
    .map(([pattern, value]) => ({
      pattern,
      categoryId: value.categoryId,
      categoryName:
        categories.find((c) => c.id === value.categoryId)?.name ?? "Unknown",
      count: value.count,
    }));
}

/* ── AI-enhanced categorization (Tier 2) ─────────────────────────────────── */

export interface AiCategorizeResult {
  transactions: Transaction[];
  rules: CategorizationRule[];
  categorizedCount: number;
  error?: string;
}

/**
 * Full categorization pipeline:
 *   1. User rules + heuristic dictionary (synchronous, existing logic)
 *   2. LLM categorization for remaining uncategorized (async, new)
 *   3. Auto-creates rules from high-confidence AI results
 *
 * Returns updated transactions, possibly-updated rules, and a count of
 * how many the AI categorized.
 */
export async function autoCategorizeWithAI(
  txs: Transaction[],
  rules: CategorizationRule[],
  categories: Category[],
  aiSettings?: AiProviderSettings,
): Promise<AiCategorizeResult> {
  // Tier 1: existing rule-based + heuristic categorization
  let updated = autoCategorize(txs, rules);
  let currentRules = rules;

  // Collect still-uncategorized transactions
  const uncategorized = updated.filter(
    (tx) => tx.categoryId === "uncategorized",
  );

  // Tier 2: LLM categorization (only if AI is configured and there's work to do)
  if (!aiSettings?.enabled || !aiSettings.apiKey || uncategorized.length === 0) {
    return {
      transactions: updated,
      rules: currentRules,
      categorizedCount: 0,
    };
  }

  const result = await classifyTransactions(
    uncategorized,
    categories,
    currentRules,
    aiSettings,
  );

  if (result.error) {
    return {
      transactions: updated,
      rules: currentRules,
      categorizedCount: 0,
      error: result.error,
    };
  }

  let categorizedCount = 0;

  // Apply accepted classifications and auto-create rules for high-confidence ones
  updated = updated.map((tx) => {
    const classification = result.classifications.get(tx.id);
    if (!classification || classification.confidence < ACCEPT_THRESHOLD) {
      return tx;
    }

    categorizedCount++;

    // Auto-create rule for very high confidence matches
    if (classification.confidence >= AUTO_RULE_THRESHOLD) {
      const pattern = normalizeMerchant(tx.merchant)
        .split(" ")
        .filter((w) => w.length > 2)
        .slice(0, 3)
        .join(" ");
      if (pattern) {
        currentRules = addOrBoostRule(
          currentRules,
          pattern,
          classification.categoryId,
        );
      }
    }

    return { ...tx, categoryId: classification.categoryId };
  });

  return {
    transactions: updated,
    rules: currentRules,
    categorizedCount,
    error: result.error,
  };
}
