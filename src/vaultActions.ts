import type { FormEvent } from "react";
import { addOrBoostRule, autoCategorizeWithAI } from "./aiCategorization";
import { rebuildShardMap } from "./cryptoVault";
import { pushVaultToSupabase } from "./metadataSync";
import { exchangePlaidPublicToken, syncTransactionsForAccount } from "./plaidService";
import { monthKey, normalizeGroup } from "./appSelectors";
import type { AiProviderSettings, BankAccount, BudgetTarget, EncryptedVault, Transaction } from "./types";
import { supabase } from "./supabaseClient";
import { clearVault, persistVaultSecure } from "./vaultStore";

const PALETTE = ["#A8D8EA", "#AA96DA", "#FCBAD3", "#B5EAD7", "#FBC687"];

type VaultSetter = (v: EncryptedVault) => void;
type TxSetter = (t: Transaction[]) => void;

interface VaultCtx { vault: EncryptedVault; dataKey: CryptoKey; setVault: VaultSetter; setTransactions: TxSetter; transactions: Transaction[] }

async function saveAndPush(next: EncryptedVault, dataKey: CryptoKey, setVault: VaultSetter) {
  setVault(next);
  await persistVaultSecure(next, dataKey);
  await pushVaultToSupabase(next);
}

export async function handlePlaidSuccess(ctx: VaultCtx, publicToken: string) {
  const api = await exchangePlaidPublicToken(publicToken);
  const linked: BankAccount = api
    ? { id: api.accountId, plaidAccountId: api.accountId, institutionName: api.institutionName, accountName: api.accountName, mask: api.mask, addedAt: new Date().toISOString() }
    : { id: crypto.randomUUID(), institutionName: "Demo Bank", accountName: `Checking ${ctx.vault.linkedAccounts.length + 1}`, mask: String(1000 + ctx.vault.linkedAccounts.length).slice(-4), addedAt: new Date().toISOString() };
  await saveAndPush({ ...ctx.vault, linkedAccounts: [...ctx.vault.linkedAccounts, linked] }, ctx.dataKey, ctx.setVault);
}

export async function handleSyncNow(ctx: VaultCtx, setSyncing: (v: boolean) => void, setAiResult: (v: string | null) => void) {
  setSyncing(true);
  try {
    const ids = new Set(ctx.transactions.map((t) => t.id));
    const synced = await Promise.all(ctx.vault.linkedAccounts.map((a) => syncTransactionsForAccount(a.id, ids)));
    const ai = await autoCategorizeWithAI([...ctx.transactions, ...synced.flat()], ctx.vault.rules, ctx.vault.categories, ctx.vault.aiSettings);
    const next: EncryptedVault = { ...ctx.vault, rules: ai.rules, shards: await rebuildShardMap(ctx.dataKey, ai.transactions) };
    ctx.setTransactions(ai.transactions);
    await saveAndPush(next, ctx.dataKey, ctx.setVault);
    if (ai.categorizedCount > 0) setAiResult(`AI categorized ${ai.categorizedCount} transaction(s)`);
    if (ai.error) setAiResult(`AI error: ${ai.error}`);
  } finally { setSyncing(false); }
}

export async function handleSaveBudget(ctx: VaultCtx, categoryId: string, value: string, selectedDate: Date, clearEdit: () => void) {
  const amt = Number(value);
  if (!Number.isFinite(amt) || amt < 0) return;
  const mk = monthKey(selectedDate);
  const rest = ctx.vault.budgets.filter((b) => !(b.categoryId === categoryId && b.monthKey === mk));
  await saveAndPush({ ...ctx.vault, budgets: [...rest, { categoryId, monthKey: mk, amount: amt } as BudgetTarget] }, ctx.dataKey, ctx.setVault);
  clearEdit();
}

export async function handleAddFamily(ctx: VaultCtx, e: FormEvent, email: string, clearEmail: () => void) {
  e.preventDefault();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
  if (ctx.vault.familyMembers.some((m) => m.email === trimmed)) return;
  await saveAndPush({ ...ctx.vault, familyMembers: [...ctx.vault.familyMembers, { id: crypto.randomUUID(), email: trimmed, displayName: email.split("@")[0], role: "member" }] }, ctx.dataKey, ctx.setVault);
  clearEmail();
}

export async function handleAddCategory(ctx: VaultCtx, e: FormEvent, name: string, clearName: () => void) {
  e.preventDefault();
  if (!name.trim()) return;
  await saveAndPush({ ...ctx.vault, categories: [...ctx.vault.categories, { id: normalizeGroup(name).replace(/\s+/g, "-"), name: name.trim(), color: PALETTE[ctx.vault.categories.length % PALETTE.length], isDefault: false }] }, ctx.dataKey, ctx.setVault);
  clearName();
}

export async function handleUpdateTxCategory(ctx: VaultCtx, txId: string, catId: string) {
  const target = ctx.transactions.find((t) => t.id === txId);
  const nextTx = ctx.transactions.map((t) => t.id === txId ? { ...t, categoryId: catId } : t);
  const nextRules = target ? addOrBoostRule(ctx.vault.rules, normalizeGroup(target.merchant), catId) : ctx.vault.rules;
  const next: EncryptedVault = { ...ctx.vault, rules: nextRules, shards: await rebuildShardMap(ctx.dataKey, nextTx) };
  ctx.setTransactions(nextTx);
  ctx.setVault(next);
  await persistVaultSecure(next, ctx.dataKey);
}

export async function handleAiCategorize(ctx: VaultCtx, setWorking: (v: boolean) => void, setResult: (v: string | null) => void) {
  if (!ctx.vault.aiSettings?.enabled) return;
  setWorking(true);
  setResult(null);
  try {
    const ai = await autoCategorizeWithAI(ctx.transactions, ctx.vault.rules, ctx.vault.categories, ctx.vault.aiSettings);
    const next: EncryptedVault = { ...ctx.vault, rules: ai.rules, shards: await rebuildShardMap(ctx.dataKey, ai.transactions) };
    ctx.setTransactions(ai.transactions);
    await saveAndPush(next, ctx.dataKey, ctx.setVault);
    setResult(ai.error ? `Error: ${ai.error}` : ai.categorizedCount > 0 ? `Categorized ${ai.categorizedCount} transaction(s)` : "No new transactions to categorize");
  } catch (err) { setResult(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  finally { setWorking(false); }
}

export async function handleRemoveFamilyMember(ctx: VaultCtx, memberId: string) {
  const next: EncryptedVault = { ...ctx.vault, familyMembers: ctx.vault.familyMembers.filter((m) => m.id !== memberId) };
  await saveAndPush(next, ctx.dataKey, ctx.setVault);
}

export async function handleDeleteAccount(): Promise<void> {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("vault_data").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
  }
  clearVault();
}

export async function handleUpdateAiSettings(ctx: VaultCtx, settings: AiProviderSettings | undefined, clearResult: () => void) {
  const next: EncryptedVault = { ...ctx.vault, aiSettings: settings };
  await saveAndPush(next, ctx.dataKey, ctx.setVault);
  clearResult();
}
