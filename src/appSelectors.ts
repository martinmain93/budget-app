import { MONTH_NAMES } from "./defaults";
import type { EncryptedVault, TimeGranularity, Transaction } from "./types";

const PIE_COLORS = ["#A8D8EA", "#AA96DA", "#FCBAD3", "#B5EAD7", "#FBC687"];

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeGroup(value: string): string {
  return value.toLowerCase().trim().split(" ").slice(0, 2).join(" ");
}

export function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function periodLabel(granularity: TimeGranularity, selectedDate: Date): string {
  if (granularity === "month") {
    return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }
  if (granularity === "year") {
    return `${selectedDate.getFullYear()}`;
  }
  return `${selectedDate.getFullYear() - 1}`;
}

export function filterTransactionsForPeriod(
  transactions: Transaction[],
  granularity: TimeGranularity,
  selectedDate: Date,
): Transaction[] {
  return transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    if (granularity === "month") {
      return (
        txDate.getFullYear() === selectedDate.getFullYear() &&
        txDate.getMonth() === selectedDate.getMonth()
      );
    }
    if (granularity === "year") {
      return txDate.getFullYear() === selectedDate.getFullYear();
    }
    return txDate.getFullYear() === selectedDate.getFullYear() - 1;
  });
}

export function buildCategoryChartData(
  vault: EncryptedVault | null,
  filteredTransactions: Transaction[],
) {
  if (!vault) return [];
  const categories = vault.categories ?? [];
  const spend = new Map<string, number>();
  for (const tx of filteredTransactions) {
    spend.set(tx.categoryId, (spend.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      value: Number((spend.get(category.id) ?? 0).toFixed(2)),
    }))
    .filter((item) => item.value > 0);
}

export function buildGroupedByMerchant(
  filteredTransactions: Transaction[],
  selectedCategoryId: string | null,
) {
  if (!selectedCategoryId) return [];
  const map = new Map<string, number>();
  for (const tx of filteredTransactions.filter((item) => item.categoryId === selectedCategoryId)) {
    const key = normalizeGroup(tx.merchant);
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }
  return [...map.entries()].map(([name, value], i) => ({
    name,
    value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
}

export function buildSixMonthBars(
  transactions: Transaction[],
  selectedDate: Date,
  selectedCategoryId: string | null,
) {
  if (!selectedCategoryId) return [];
  const rows: Array<{ label: string; total: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
    const total = transactions
      .filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          tx.categoryId === selectedCategoryId &&
          txDate.getFullYear() === d.getFullYear() &&
          txDate.getMonth() === d.getMonth()
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    rows.push({
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      total: Number(total.toFixed(2)),
    });
  }
  return rows;
}

export function buildBudgetRows(
  vault: EncryptedVault | null,
  selectedDate: Date,
  filteredTransactions: Transaction[],
) {
  if (!vault) return [];
  const categories = vault.categories ?? [];
  const budgets = vault.budgets ?? [];
  const currentMonth = monthKey(selectedDate);
  const spendByCategory = new Map<string, number>();
  for (const tx of filteredTransactions) {
    spendByCategory.set(tx.categoryId, (spendByCategory.get(tx.categoryId) ?? 0) + tx.amount);
  }
  const budgetsForMonth = budgets.filter((b) => b.monthKey === currentMonth);
  return categories
    .filter((c) => c.id !== "uncategorized")
    .map((category) => {
      const budget = budgetsForMonth.find((b) => b.categoryId === category.id)?.amount ?? 0;
      const spent = spendByCategory.get(category.id) ?? 0;
      return {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        budget,
        spent,
        pct: budget ? Math.min((spent / budget) * 100, 100) : 0,
      };
    });
}
