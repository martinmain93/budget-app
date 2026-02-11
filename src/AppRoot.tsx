import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { usePlaidLink } from "react-plaid-link";
import { suggestRules } from "./aiCategorization";
import { OnboardingScreen, PinSetupScreen, PinUnlockScreen, UnlockScreen } from "./AuthScreens";
import { Dashboard } from "./Dashboard";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { decryptAllTransactions, unlockVaultDataKey } from "./cryptoVault";
import { type GoogleUser, getSupabaseSession, onAuthStateChange, signInWithGoogle, signOutSupabase, toGoogleUser } from "./googleAuth";
import { vaultExistsInSupabase } from "./metadataSync";
import { createPlaidLinkToken } from "./plaidService";
import { buildBudgetRows, buildCategoryChartData, buildGroupedByMerchant, buildSixMonthBars, currency, filterTransactionsForPeriod, periodLabel } from "./appSelectors";
import type { AiProviderSettings, EncryptedVault, TimeGranularity, Transaction, UserSession } from "./types";
import { clearVault, decryptVaultMetadata, initializeGoogleVault, initializeVault, loadSession, loadVault, persistSession, persistVaultSecure, unlockGoogleVault } from "./vaultStore";
import { handleAddCategory, handleAddFamily, handleAiCategorize, handleDeleteAccount, handlePlaidSuccess, handleRemoveFamilyMember, handleSaveBudget, handleSyncNow, handleUpdateAiSettings, handleUpdateTxCategory } from "./vaultActions";

type AuthPhase = "loading" | "onboarding" | "pin-setup" | "pin-unlock" | "password-unlock" | "ready";

export default function AppRoot() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("loading");
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [granularity, setGranularity] = useState<TimeGranularity>("month");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockAttempts, setUnlockAttempts] = useState(0);
  const [unlockCooldownUntil, setUnlockCooldownUntil] = useState(0);
  const [plaidToken, setPlaidToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = useState("");
  const [onboarding, setOnboarding] = useState({ displayName: "", email: "", password: "" });
  const [unlockPassword, setUnlockPassword] = useState("");
  const [aiCategorizingNow, setAiCategorizingNow] = useState(false);
  const [aiLastResult, setAiLastResult] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(() => window.location.hash === "#privacy");
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = await getSupabaseSession();
      if (sb?.user) {
        const gu = toGoogleUser(sb.user);
        setGoogleUser(gu);
        setAuthPhase((await vaultExistsInSupabase()) || loadVault() ? "pin-unlock" : "pin-setup");
        return;
      }
      const v = loadVault(), s = loadSession();
      if (v && s) { setVault(v); setSession(s); setAuthPhase(s.authMethod === "google" ? "onboarding" : "password-unlock"); return; }
      setAuthPhase("onboarding");
    })();
  }, []);

  useEffect(() => { const { unsubscribe } = onAuthStateChange((_e, s) => { if (s?.user) setGoogleUser(toGoogleUser(s.user)); }); return unsubscribe; }, []);
  useEffect(() => { if (vault && dataKey) decryptAllTransactions(vault, dataKey).then(setTransactions).catch(() => setTransactions([])); }, [vault, dataKey]);
  useEffect(() => { if (session && vault) createPlaidLinkToken(session.userId).then(setPlaidToken).catch(() => setPlaidToken(null)); }, [session, vault]);

  const filteredTx = useMemo(() => filterTransactionsForPeriod(transactions, granularity, selectedDate), [transactions, granularity, selectedDate]);
  const categoryChartData = useMemo(() => buildCategoryChartData(vault, filteredTx), [vault, filteredTx]);
  const groupedByMerchant = useMemo(() => buildGroupedByMerchant(filteredTx, selectedCategoryId), [filteredTx, selectedCategoryId]);
  const sixMonthBars = useMemo(() => buildSixMonthBars(transactions, selectedDate, selectedCategoryId), [transactions, selectedDate, selectedCategoryId]);
  const budgetRows = useMemo(() => buildBudgetRows(vault, selectedDate, filteredTx), [vault, selectedDate, filteredTx]);
  const uncategorized = useMemo(() => filteredTx.filter((t) => t.categoryId === "uncategorized").slice(0, 10), [filteredTx]);
  const ruleSuggestions = useMemo(() => vault ? suggestRules(transactions, vault.rules, vault.categories) : [], [vault, transactions]);

  const ctx = vault && dataKey ? { vault, dataKey, setVault, setTransactions, transactions } : null;

  function handleGoogleSignIn() { setGoogleLoading(true); signInWithGoogle().catch(() => setGoogleLoading(false)); }

  async function handlePinSetup(pin: string) {
    if (!googleUser) return;
    try {
      const r = await initializeGoogleVault({ userId: googleUser.id, email: googleUser.email, displayName: googleUser.displayName, googleSub: googleUser.googleSub, pin });
      setSession(r.session); setVault(r.vault); setDataKey(r.dataKey); setAuthPhase("ready");
    } catch (err) { setPinError(err instanceof Error ? err.message : "Failed to create vault"); }
  }

  async function handlePinUnlock(pin: string) {
    if (!googleUser) return;
    try {
      const r = await unlockGoogleVault(googleUser.googleSub, pin);
      const sess: UserSession = { userId: googleUser.id, email: googleUser.email, displayName: googleUser.displayName, authMethod: "google" };
      setSession(sess); persistSession(sess); setVault(r.vault); setDataKey(r.dataKey); setPinError(null); setAuthPhase("ready");
    } catch { setPinError("Incorrect PIN or vault not found."); }
  }

  async function handleCreateVault(e: FormEvent) { e.preventDefault(); const r = await initializeVault(onboarding); setSession(r.session); setVault(r.vault); setDataKey(r.dataKey); setAuthPhase("ready"); }

  async function handlePasswordUnlock(e: FormEvent) {
    e.preventDefault();
    if (!vault) return;
    if (Date.now() < unlockCooldownUntil) { setUnlockError(`Too many attempts. Please wait ${Math.ceil((unlockCooldownUntil - Date.now()) / 1000)}s.`); return; }
    try {
      const k = await unlockVaultDataKey(vault.envelope, unlockPassword);
      const h = await decryptVaultMetadata(vault, k);
      setVault(h); setDataKey(k); setUnlockError(null); setUnlockAttempts(0); setAuthPhase("ready");
    } catch {
      const n = unlockAttempts + 1; setUnlockAttempts(n);
      if (n >= 3) setUnlockCooldownUntil(Date.now() + Math.min(300_000, 1000 * 2 ** (n - 2)));
      setUnlockError("Could not unlock vault. Please verify credentials.");
    }
  }

  async function handleSignOut() { await signOutSupabase(); clearVault(); setGoogleUser(null); setSession(null); setVault(null); setDataKey(null); setAuthPhase("onboarding"); }

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({ token: plaidToken ?? "", onSuccess: async (t) => { if (ctx) await handlePlaidSuccess(ctx, t); } });

  const syncNow = async () => { if (ctx) await handleSyncNow(ctx, setSyncing, setAiLastResult); };
  useEffect(() => { if (dataKey && vault) { syncNow().catch((e) => { if (import.meta.env.DEV) console.error(e); }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dataKey]);

  function shiftDate(d: -1 | 1) { granularity === "month" ? setSelectedDate((v) => new Date(v.getFullYear(), v.getMonth() + d, 1)) : setSelectedDate((v) => new Date(v.getFullYear() + d, v.getMonth(), 1)); }

  /* ── Render ─────────────────────────────────────────── */
  if (showPrivacy) return <PrivacyPolicy onBack={() => { setShowPrivacy(false); window.location.hash = ""; }} />;
  if (authPhase === "loading") return <div className="shell onboarding-shell"><div className="card"><p>Loading...</p></div></div>;
  if (authPhase === "onboarding") return <OnboardingScreen onboarding={onboarding} onSubmit={handleCreateVault} onChange={setOnboarding} onGoogleSignIn={handleGoogleSignIn} googleLoading={googleLoading} />;
  if (authPhase === "pin-setup" && googleUser) return <PinSetupScreen googleEmail={googleUser.email} onSubmit={handlePinSetup} error={pinError} />;
  if (authPhase === "pin-unlock" && googleUser) return <PinUnlockScreen googleEmail={googleUser.email} onSubmit={handlePinUnlock} error={pinError} onSignOut={handleSignOut} />;
  if (authPhase === "password-unlock" && vault) return <UnlockScreen unlockPassword={unlockPassword} unlockError={unlockError} onSubmit={handlePasswordUnlock} onPasswordChange={setUnlockPassword} />;
  if (!session || !ctx) return <OnboardingScreen onboarding={onboarding} onSubmit={handleCreateVault} onChange={setOnboarding} onGoogleSignIn={handleGoogleSignIn} googleLoading={googleLoading} />;

  return (
    <Dashboard firstName={session.displayName.split(" ")[0]} syncing={syncing} periodLabel={periodLabel(granularity, selectedDate)} granularity={granularity}
      categoryChartData={categoryChartData} linkedAccounts={vault!.linkedAccounts} plaidToken={plaidToken} plaidReady={plaidReady}
      selectedCategoryId={selectedCategoryId} groupedByMerchant={groupedByMerchant} sixMonthBars={sixMonthBars} budgetRows={budgetRows}
      editingBudgetCategory={editingBudgetCategory} editingBudgetValue={editingBudgetValue} uncategorized={uncategorized} ruleSuggestions={ruleSuggestions}
      categories={vault!.categories} familyMembers={vault!.familyMembers} inviteEmail={inviteEmail} newCategoryName={newCategoryName}
      onSyncNow={syncNow} onReset={handleSignOut} onDeleteAccount={async () => { await handleDeleteAccount(); setGoogleUser(null); setSession(null); setVault(null); setDataKey(null); setAuthPhase("onboarding"); }}
      onRemoveFamilyMember={(id) => { if (ctx) void handleRemoveFamilyMember(ctx, id); }}
      onShiftDate={shiftDate} onSetGranularity={setGranularity}
      onSetSelectedCategoryId={(v) => setSelectedCategoryId(v)}
      showConsentDialog={showConsentDialog}
      onOpenAddAccount={() => setShowConsentDialog(true)}
      onConsentAccepted={async () => {
        setShowConsentDialog(false);
        // Log consent
        const log = [...(vault!.consentLog ?? []), { action: "bank_connect", timestamp: new Date().toISOString() }];
        const next = { ...vault!, consentLog: log };
        setVault(next);
        await persistVaultSecure(next, dataKey!);
        // Proceed with bank link
        if (plaidToken) openPlaidLink(); else void handlePlaidSuccess(ctx, "mock");
      }}
      onConsentDeclined={() => setShowConsentDialog(false)}
      onStartEditBudget={(id, cur) => { setEditingBudgetCategory(id); setEditingBudgetValue(String(cur || 0)); }}
      onSetEditingBudgetValue={setEditingBudgetValue}
      onSaveBudget={(id) => handleSaveBudget(ctx, id, editingBudgetValue, selectedDate, () => { setEditingBudgetCategory(null); setEditingBudgetValue(""); })}
      onUpdateTransactionCategory={(txId, catId) => handleUpdateTxCategory(ctx, txId, catId)}
      onAddCategory={(e) => handleAddCategory(ctx, e, newCategoryName, () => setNewCategoryName(""))}
      onSetNewCategoryName={setNewCategoryName}
      onAddFamilyMember={(e) => handleAddFamily(ctx, e, inviteEmail, () => setInviteEmail(""))}
      onSetInviteEmail={setInviteEmail} currency={currency}
      aiSettings={vault!.aiSettings} aiCategorizingNow={aiCategorizingNow} aiLastResult={aiLastResult}
      onUpdateAiSettings={(s: AiProviderSettings | undefined) => handleUpdateAiSettings(ctx, s, () => setAiLastResult(null))}
      onAiCategorizeNow={() => handleAiCategorize(ctx, setAiCategorizingNow, setAiLastResult)} />
  );
}
