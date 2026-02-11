import type { Transaction } from "./types";

interface PlaidExchangeResult {
  accountId: string;
  institutionName: string;
  accountName: string;
  mask: string;
}

const merchants = [
  "Trader Market",
  "Cloud Coffee",
  "Rent Payment",
  "City Electric",
  "Family Pharmacy",
  "Movie Cinema",
  "Ride Uber",
  "Corner Store",
];

export async function createPlaidLinkToken(
  userId: string,
): Promise<string | null> {
  const endpoint = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!endpoint) {
    return null;
  }
  const response = await fetch(`${endpoint}/plaid/link-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    return null;
  }
  const json = (await response.json()) as { linkToken: string };
  return json.linkToken;
}

export async function exchangePlaidPublicToken(
  publicToken: string,
): Promise<PlaidExchangeResult | null> {
  const endpoint = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!endpoint) {
    return null;
  }
  const response = await fetch(`${endpoint}/plaid/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicToken }),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as PlaidExchangeResult;
}

export async function syncTransactionsForAccount(
  accountId: string,
  existingIds: Set<string>,
): Promise<Transaction[]> {
  const endpoint = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (endpoint) {
    const response = await fetch(`${endpoint}/plaid/sync-transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (response.ok) {
      return (await response.json()) as Transaction[];
    }
  }

  // Offline/dev fallback: mock data only available in development builds.
  if (!import.meta.env.DEV) {
    return [];
  }
  const now = new Date();
  const txs: Transaction[] = [];
  for (let i = 0; i < 24; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - Math.floor(i / 3), 5 + (i % 20));
    const id = `${accountId}-${date.toISOString().slice(0, 10)}-${i}`;
    if (existingIds.has(id)) {
      continue;
    }
    txs.push({
      id,
      bankAccountId: accountId,
      date: date.toISOString(),
      merchant: merchants[i % merchants.length],
      amount: Number((12 + Math.random() * 220).toFixed(2)),
      categoryId: "uncategorized",
      source: "plaid",
    });
  }
  return txs;
}
