import { DEFAULT_CATEGORIES } from "./defaults";
import { createVaultEnvelope, rebuildShardMap } from "./cryptoVault";
import type {
  BankAccount,
  BudgetTarget,
  CategorizationRule,
  EncryptedVault,
  FamilyMember,
  Transaction,
  UserSession,
} from "./types";

const STORAGE_KEY = "budget-app-encrypted-vault";
const SESSION_KEY = "budget-app-user";

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
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const budgets: BudgetTarget[] = DEFAULT_CATEGORIES.filter(
    (c) => c.id !== "uncategorized",
  ).map((c) => ({
    categoryId: c.id,
    monthKey,
    amount: 400,
  }));
  const rules: CategorizationRule[] = [];
  const familyMembers: FamilyMember[] = [];
  const linkedAccounts: BankAccount[] = [];
  const seedTransactions: Transaction[] = [];
  const shards = await rebuildShardMap(dataKey, seedTransactions);

  const vault: EncryptedVault = {
    envelope,
    shards,
    categories: DEFAULT_CATEGORIES,
    budgets,
    rules,
    linkedAccounts,
    familyMembers,
  };
  const session: UserSession = {
    userId,
    email: input.email,
    displayName: input.displayName,
  };
  persistSession(session);
  persistVault(vault);
  return { session, vault, dataKey };
}

export function persistVault(vault: EncryptedVault): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
}

export function loadVault(): EncryptedVault | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as EncryptedVault;
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
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as UserSession;
}
