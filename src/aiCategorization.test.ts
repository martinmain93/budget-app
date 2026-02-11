import { describe, expect, it } from "vitest";
import {
  addOrBoostRule,
  autoCategorize,
  categorizeTransaction,
  suggestRules,
} from "./aiCategorization";
import type { Category, Transaction } from "./types";

describe("aiCategorization", () => {
  it("categorizes by heuristics when no rules exist", () => {
    const tx: Transaction = {
      id: "1",
      bankAccountId: "a1",
      date: new Date().toISOString(),
      merchant: "Trader Fresh Market",
      amount: 45.2,
      categoryId: "uncategorized",
      source: "plaid",
    };
    expect(categorizeTransaction(tx, [])).toBe("groceries");
  });

  it("applies explicit learned rules before heuristics", () => {
    const tx: Transaction = {
      id: "2",
      bankAccountId: "a1",
      date: new Date().toISOString(),
      merchant: "Cloud Coffee Downtown",
      amount: 7.5,
      categoryId: "uncategorized",
      source: "plaid",
    };
    expect(
      categorizeTransaction(tx, [
        {
          id: "r1",
          categoryId: "shopping",
          pattern: "cloud coffee",
          createdAt: new Date().toISOString(),
          hitCount: 1,
        },
      ]),
    ).toBe("shopping");
  });

  it("boosts existing rules and creates new ones", () => {
    const base = [
      {
        id: "r1",
        categoryId: "dining",
        pattern: "coffee spot",
        createdAt: new Date().toISOString(),
        hitCount: 1,
      },
    ];
    const boosted = addOrBoostRule(base, "coffee spot", "dining");
    expect(boosted).toHaveLength(1);
    expect(boosted[0].hitCount).toBe(2);

    const created = addOrBoostRule(base, "new merchant", "shopping");
    expect(created).toHaveLength(2);
  });

  it("auto-categorizes uncategorized items in a batch", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        bankAccountId: "a1",
        date: new Date().toISOString(),
        merchant: "Ride Uber",
        amount: 11,
        categoryId: "uncategorized",
        source: "plaid",
      },
      {
        id: "2",
        bankAccountId: "a1",
        date: new Date().toISOString(),
        merchant: "Already Custom",
        amount: 20,
        categoryId: "custom",
        source: "manual",
      },
    ];
    const out = autoCategorize(txs, []);
    expect(out[0].categoryId).toBe("transport");
    expect(out[1].categoryId).toBe("custom");
  });

  it("suggests new rules based on repeated categorized merchant patterns", () => {
    const categories: Category[] = [
      { id: "dining", name: "Dining", color: "#fff", isDefault: true },
      { id: "groceries", name: "Groceries", color: "#fff", isDefault: true },
    ];
    const txs: Transaction[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `${i}`,
      bankAccountId: "a1",
      date: new Date().toISOString(),
      merchant: `Cloud Coffee ${i}`,
      amount: 8,
      categoryId: "dining",
      source: "plaid",
    }));
    const suggestions = suggestRules(txs, [], categories);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].categoryId).toBe("dining");
  });
});
