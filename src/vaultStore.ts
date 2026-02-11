import { DEFAULT_CATEGORIES } from "./defaults";
import {
  createVaultEnvelope,
  decryptPayload,
  encryptPayload,
  rebuildShardMap,
  unlockVaultDataKey,
} from "./cryptoVault";
import { pullVaultFromSupabase, pushVaultToSupabase } from "./metadataSync";
import type {
  BankAccount,
  BudgetTarget,
  CategorizationRule,
  EncryptedVault,
  FamilyMember,
  Transaction,
  UserSession,
  VaultMetadata,
} from "./types";

const STORAGE_KEY = "budget-app-encrypted-vault";
const SESSION_KEY = "budget-app-user";

/* ── Password-based vault creation ──────────────────────── */

export interface InitializeVaultInput {
  displayName: string;
  email: string;
  password: string;
}

export async function initializeVault(input: InitializeVaultInput): Promise<{
  session: UserSession;
  vault: EncryptedVault;
  dataKey: CryptoKey;
}> {
  const userId = crypto.randomUUID();
  const { envelope, dataKey } = await createVaultEnvelope(userId, input.password);
  const vault = await buildFreshVault(envelope, dataKey);
  const session: UserSession = {
    userId,
    email: input.email,
    displayName: input.displayName,
  };
  persistSession(session);
  await persistVaultSecure(vault, dataKey);
  return { session, vault, dataKey };
}

/* ── Google + PIN vault creation ────────────────────────── */

export interface GoogleVaultInput {
  userId: string;       // Supabase auth uid
  email: string;
  displayName: string;
  googleSub: string;    // Google's stable subject id
  pin: string;          // 6-digit user PIN
}

/** Derive the PBKDF2 password from Google sub + PIN. */
export function deriveGooglePassword(googleSub: string, pin: string): string {
  return `google:${googleSub}:${pin}`;
}

export async function initializeGoogleVault(input: GoogleVaultInput): Promise<{
  session: UserSession;
  vault: EncryptedVault;
  dataKey: CryptoKey;
}> {
  const password = deriveGooglePassword(input.googleSub, input.pin);
  const { envelope, dataKey } = await createVaultEnvelope(input.userId, password);
  const vault = await buildFreshVault(envelope, dataKey);
  const session: UserSession = {
    userId: input.userId,
    email: input.email,
    displayName: input.displayName,
    authMethod: "google",
  };
  persistSession(session);
  await persistVaultSecure(vault, dataKey);
  await pushVaultToSupabase(vault);
  return { session, vault, dataKey };
}

/** Unlock vault using Google sub + PIN (tries Supabase first, then localStorage). */
export async function unlockGoogleVault(
  googleSub: string,
  pin: string,
): Promise<{ vault: EncryptedVault; dataKey: CryptoKey }> {
  const password = deriveGooglePassword(googleSub, pin);
  // Try pulling from Supabase first (multi-device), fall back to localStorage
  let vault = await pullVaultFromSupabase();
  if (!vault) {
    vault = loadVault();
  }
  if (!vault) {
    throw new Error("No vault found. Please create one first.");
  }
  const dataKey = await unlockVaultDataKey(vault.envelope, password);
  const hydrated = await decryptVaultMetadata(vault, dataKey);
  // Cache locally for offline access
  await persistVaultSecure(hydrated, dataKey);
  return { vault: hydrated, dataKey };
}

/* ── Shared helpers ─────────────────────────────────────── */

async function buildFreshVault(
  envelope: EncryptedVault["envelope"],
  dataKey: CryptoKey,
): Promise<EncryptedVault> {
  const now = new Date();
  const mk = now.toISOString().slice(0, 7);
  const budgets: BudgetTarget[] = DEFAULT_CATEGORIES
    .filter((c) => c.id !== "uncategorized")
    .map((c) => ({ categoryId: c.id, monthKey: mk, amount: 400 }));
  const rules: CategorizationRule[] = [];
  const familyMembers: FamilyMember[] = [];
  const linkedAccounts: BankAccount[] = [];
  const seedTransactions: Transaction[] = [];
  const shards = await rebuildShardMap(dataKey, seedTransactions);

  return {
    envelope,
    shards,
    categories: DEFAULT_CATEGORIES,
    budgets,
    rules,
    linkedAccounts,
    familyMembers,
  };
}

/**
 * Persist the vault with metadata encrypted under the data key.
 * Only the envelope, shards, and the encrypted metadata blob are
 * written to localStorage -- no plaintext categories, budgets, etc.
 */
export async function persistVaultSecure(
  vault: EncryptedVault,
  dataKey: CryptoKey,
): Promise<void> {
  const metadata: VaultMetadata = {
    categories: vault.categories,
    budgets: vault.budgets,
    rules: vault.rules,
    linkedAccounts: vault.linkedAccounts,
    familyMembers: vault.familyMembers,
    aiSettings: vault.aiSettings,
  };
  const { encrypted, iv } = await encryptPayload(dataKey, metadata);
  const secureVault = {
    envelope: vault.envelope,
    shards: vault.shards,
    encryptedMetadata: { encrypted, iv },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(secureVault));
}

/**
 * After unlocking the vault, decrypt the metadata blob and return a
 * fully hydrated EncryptedVault with all plaintext fields populated.
 */
export async function decryptVaultMetadata(
  vault: EncryptedVault,
  dataKey: CryptoKey,
): Promise<EncryptedVault> {
  if (vault.encryptedMetadata) {
    const metadata = await decryptPayload<VaultMetadata>(
      dataKey,
      vault.encryptedMetadata.encrypted,
      vault.encryptedMetadata.iv,
    );
    return { ...vault, ...metadata };
  }
  return vault;
}

export function loadVault(): EncryptedVault | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EncryptedVault;
  } catch {
    return null;
  }
}

export function clearVault(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function persistSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): UserSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}
