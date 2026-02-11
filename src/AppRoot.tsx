import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { usePlaidLink } from "react-plaid-link";
import { addOrBoostRule, autoCategorizeWithAI, suggestRules } from "./aiCategorization";
import { OnboardingScreen, UnlockScreen } from "./AuthScreens";
import { Dashboard } from "./Dashboard";
import { decryptAllTransactions, rebuildShardMap, unlockVaultDataKey } from "./cryptoVault";
import { syncVaultMetadata } from "./metadataSync";
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  syncTransactionsForAccount,
} from "./plaidService";
import {
  buildBudgetRows,
  buildCategoryChartData,
  buildGroupedByMerchant,
  buildSixMonthBars,
  currency,
  filterTransactionsForPeriod,
  monthKey,
  normalizeGroup,
  periodLabel,
} from "./appSelectors";
import type {
  AiProviderSettings,
  BankAccount,
  BudgetTarget,
  EncryptedVault,
  TimeGranularity,
  Transaction,
  UserSession,
} from "./types";
import {
  clearVault,
  initializeVault,
  loadSession,
  loadVault,
  persistVault,
} from "./vaultStore";

const PALETTE = ["#A8D8EA", "#AA96DA", "#FCBAD3", "#B5EAD7", "#FBC687"];

export default function AppRoot() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [granularity, setGranularity] = useState<TimeGranularity>("month");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [plaidToken, setPlaidToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = useState("");
  const [onboarding, setOnboarding] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [unlockPassword, setUnlockPassword] = useState("");
  const [aiCategorizingNow, setAiCategorizingNow] = useState(false);
  const [aiLastResult, setAiLastResult] = useState<string | null>(null);

  useEffect(() => {
    const existingVault = loadVault();
    const existingSession = loadSession();
    if (existingVault && existingSession) {
      setVault(existingVault);
      setSession(existingSession);
    }
  }, []);

  useEffect(() => {
    if (!session || !vault) return;
    createPlaidLinkToken(session.userId)
      .then((token) => setPlaidToken(token))
      .catch(() => setPlaidToken(null));
  }, [session, vault]);

  useEffect(() => {
    if (!vault || !dataKey) return;
    decryptAllTransactions(vault, dataKey).then(setTransactions).catch(() => {
      setTransactions([]);
    });
  }, [vault, dataKey]);

  const filteredTransactions = useMemo(
    () => filterTransactionsForPeriod(transactions, granularity, selectedDate),
    [transactions, granularity, selectedDate],
  );
  const categoryChartData = useMemo(
    () => buildCategoryChartData(vault, filteredTransactions),
    [vault, filteredTransactions],
  );
  const groupedByMerchant = useMemo(
    () => buildGroupedByMerchant(filteredTransactions, selectedCategoryId),
    [filteredTransactions, selectedCategoryId],
  );
  const sixMonthBars = useMemo(
    () => buildSixMonthBars(transactions, selectedDate, selectedCategoryId),
    [transactions, selectedDate, selectedCategoryId],
  );
  const budgetRows = useMemo(
    () => buildBudgetRows(vault, selectedDate, filteredTransactions),
    [vault, selectedDate, filteredTransactions],
  );
  const uncategorized = useMemo(
    () => filteredTransactions.filter((tx) => tx.categoryId === "uncategorized").slice(0, 10),
    [filteredTransactions],
  );
  const ruleSuggestions = useMemo(() => {
    if (!vault) return [];
    return suggestRules(transactions, vault.rules, vault.categories);
  }, [vault, transactions]);

  async function onPlaidSuccess(publicToken: string): Promise<void> {
    if (!vault) return;
    const accountFromApi = await exchangePlaidPublicToken(publicToken);
    const linked: BankAccount = accountFromApi
      ? {
          id: accountFromApi.accountId,
          plaidAccountId: accountFromApi.accountId,
          institutionName: accountFromApi.institutionName,
          accountName: accountFromApi.accountName,
          mask: accountFromApi.mask,
          addedAt: new Date().toISOString(),
        }
      : {
          id: crypto.randomUUID(),
          institutionName: "Demo Bank",
          accountName: `Checking ${vault.linkedAccounts.length + 1}`,
          mask: String(1000 + vault.linkedAccounts.length).slice(-4),
          addedAt: new Date().toISOString(),
        };
    const nextVault = { ...vault, linkedAccounts: [...vault.linkedAccounts, linked] };
    setVault(nextVault);
    persistVault(nextVault);
    if (session) await syncVaultMetadata(session, nextVault);
  }

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: plaidToken ?? "",
    onSuccess: async (publicToken) => {
      await onPlaidSuccess(publicToken);
    },
  });

  async function handleCreateVault(event: FormEvent): Promise<void> {
    event.preventDefault();
    const created = await initializeVault(onboarding);
    setSession(created.session);
    setVault(created.vault);
    setDataKey(created.dataKey);
  }

  async function handleUnlock(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!vault) return;
    try {
      setDataKey(await unlockVaultDataKey(vault.envelope, unlockPassword));
      setUnlockError(null);
    } catch (error) {
      setUnlockError("Could not unlock vault. Please verify credentials.");
      console.error(error);
    }
  }

  async function syncNow(): Promise<void> {
    if (!vault || !dataKey) return;
    setSyncing(true);
    try {
      const existingIds = new Set(transactions.map((tx) => tx.id));
      const synced = await Promise.all(
        vault.linkedAccounts.map((account) =>
          syncTransactionsForAccount(account.id, existingIds),
        ),
      );
      // Tier 1 (rules + heuristic) runs first, then Tier 2 (LLM) if configured
      const aiResult = await autoCategorizeWithAI(
        [...transactions, ...synced.flat()],
        vault.rules,
        vault.categories,
        vault.aiSettings,
      );
      const nextTransactions = aiResult.transactions;
      const nextVault: EncryptedVault = {
        ...vault,
        rules: aiResult.rules,
        shards: await rebuildShardMap(dataKey, nextTransactions),
      };
      setTransactions(nextTransactions);
      setVault(nextVault);
      persistVault(nextVault);
      if (aiResult.categorizedCount > 0) {
        setAiLastResult(`AI categorized ${aiResult.categorizedCount} transaction(s)`);
      }
      if (aiResult.error) {
        setAiLastResult(`AI error: ${aiResult.error}`);
      }
      if (session) await syncVaultMetadata(session, nextVault);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!dataKey || !vault) return;
    syncNow().catch((error) => console.error(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  function shiftDate(direction: -1 | 1): void {
    if (granularity === "month") {
      setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
      return;
    }
    setSelectedDate((d) => new Date(d.getFullYear() + direction, d.getMonth(), 1));
  }

  async function saveBudget(categoryId: string): Promise<void> {
    if (!vault) return;
    const amount = Number(editingBudgetValue);
    if (!Number.isFinite(amount) || amount < 0) return;
    const currentMonth = monthKey(selectedDate);
    const remainder = vault.budgets.filter(
      (b) => !(b.categoryId === categoryId && b.monthKey === currentMonth),
    );
    const nextBudgets: BudgetTarget[] = [...remainder, { categoryId, monthKey: currentMonth, amount }];
    const nextVault = { ...vault, budgets: nextBudgets };
    setVault(nextVault);
    persistVault(nextVault);
    setEditingBudgetCategory(null);
    setEditingBudgetValue("");
    if (session) await syncVaultMetadata(session, nextVault);
  }

  async function addFamilyMember(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!vault || !inviteEmail.trim()) return;
    const nextVault: EncryptedVault = {
      ...vault,
      familyMembers: [
        ...vault.familyMembers,
        {
          id: crypto.randomUUID(),
          email: inviteEmail.trim().toLowerCase(),
          displayName: inviteEmail.split("@")[0],
          role: "member",
        },
      ],
    };
    setVault(nextVault);
    persistVault(nextVault);
    setInviteEmail("");
    if (session) await syncVaultMetadata(session, nextVault);
  }

  async function addCategory(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!vault || !newCategoryName.trim()) return;
    const nextVault: EncryptedVault = {
      ...vault,
      categories: [
        ...vault.categories,
        {
          id: normalizeGroup(newCategoryName).replace(/\s+/g, "-"),
          name: newCategoryName.trim(),
          color: PALETTE[vault.categories.length % PALETTE.length],
          isDefault: false,
        },
      ],
    };
    setVault(nextVault);
    persistVault(nextVault);
    setNewCategoryName("");
  }

  async function updateTransactionCategory(txId: string, categoryId: string): Promise<void> {
    if (!vault || !dataKey) return;
    const targetTx = transactions.find((tx) => tx.id === txId);
    const nextTransactions = transactions.map((tx) =>
      tx.id === txId ? { ...tx, categoryId } : tx,
    );
    const nextRules = targetTx
      ? addOrBoostRule(vault.rules, normalizeGroup(targetTx.merchant), categoryId)
      : vault.rules;
    const nextVault: EncryptedVault = {
      ...vault,
      rules: nextRules,
      shards: await rebuildShardMap(dataKey, nextTransactions),
    };
    setTransactions(nextTransactions);
    setVault(nextVault);
    persistVault(nextVault);
  }

  async function aiCategorizeNow(): Promise<void> {
    if (!vault || !dataKey || !vault.aiSettings?.enabled) return;
    setAiCategorizingNow(true);
    setAiLastResult(null);
    try {
      const aiResult = await autoCategorizeWithAI(
        transactions,
        vault.rules,
        vault.categories,
        vault.aiSettings,
      );
      const nextVault: EncryptedVault = {
        ...vault,
        rules: aiResult.rules,
        shards: await rebuildShardMap(dataKey, aiResult.transactions),
      };
      setTransactions(aiResult.transactions);
      setVault(nextVault);
      persistVault(nextVault);
      if (aiResult.error) {
        setAiLastResult(`Error: ${aiResult.error}`);
      } else if (aiResult.categorizedCount > 0) {
        setAiLastResult(
          `Categorized ${aiResult.categorizedCount} transaction(s)`,
        );
      } else {
        setAiLastResult("No new transactions to categorize");
      }
      if (session) await syncVaultMetadata(session, nextVault);
    } catch (err) {
      setAiLastResult(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setAiCategorizingNow(false);
    }
  }

  async function updateAiSettings(
    settings: AiProviderSettings | undefined,
  ): Promise<void> {
    if (!vault) return;
    const nextVault: EncryptedVault = { ...vault, aiSettings: settings };
    setVault(nextVault);
    persistVault(nextVault);
    setAiLastResult(null);
    if (session) await syncVaultMetadata(session, nextVault);
  }

  if (!vault || !session) {
    return <OnboardingScreen onboarding={onboarding} onSubmit={handleCreateVault} onChange={setOnboarding} />;
  }
  if (!dataKey) {
    return (
      <UnlockScreen
        unlockPassword={unlockPassword}
        unlockError={unlockError}
        onSubmit={handleUnlock}
        onPasswordChange={setUnlockPassword}
      />
    );
  }

  return (
    <Dashboard
      firstName={session.displayName.split(" ")[0]}
      syncing={syncing}
      periodLabel={periodLabel(granularity, selectedDate)}
      granularity={granularity}
      categoryChartData={categoryChartData}
      linkedAccounts={vault.linkedAccounts}
      plaidToken={plaidToken}
      plaidReady={plaidReady}
      selectedCategoryId={selectedCategoryId}
      groupedByMerchant={groupedByMerchant}
      sixMonthBars={sixMonthBars}
      budgetRows={budgetRows}
      editingBudgetCategory={editingBudgetCategory}
      editingBudgetValue={editingBudgetValue}
      uncategorized={uncategorized}
      ruleSuggestions={ruleSuggestions}
      categories={vault.categories}
      familyMembers={vault.familyMembers}
      inviteEmail={inviteEmail}
      newCategoryName={newCategoryName}
      onSyncNow={syncNow}
      onReset={() => {
        clearVault();
        window.location.reload();
      }}
      onShiftDate={shiftDate}
      onSetGranularity={setGranularity}
      onSetSelectedCategoryId={(v) => setSelectedCategoryId(v)}
      onOpenAddAccount={() => {
        if (plaidToken) openPlaidLink();
        else void onPlaidSuccess("mock-public-token");
      }}
      onStartEditBudget={(categoryId, currentBudget) => {
        setEditingBudgetCategory(categoryId);
        setEditingBudgetValue(String(currentBudget || 0));
      }}
      onSetEditingBudgetValue={setEditingBudgetValue}
      onSaveBudget={saveBudget}
      onUpdateTransactionCategory={updateTransactionCategory}
      onAddCategory={addCategory}
      onSetNewCategoryName={setNewCategoryName}
      onAddFamilyMember={addFamilyMember}
      onSetInviteEmail={setInviteEmail}
      currency={currency}
      aiSettings={vault.aiSettings}
      aiCategorizingNow={aiCategorizingNow}
      aiLastResult={aiLastResult}
      onUpdateAiSettings={updateAiSettings}
      onAiCategorizeNow={aiCategorizeNow}
    />
  );
}
