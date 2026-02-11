export type TimeGranularity = "month" | "year" | "previous-year";

export interface BankAccount {
  id: string;
  plaidAccountId?: string;
  institutionName: string;
  accountName: string;
  mask: string;
  addedAt: string;
}

export interface Transaction {
  id: string;
  bankAccountId: string;
  date: string;
  merchant: string;
  amount: number;
  categoryId: string;
  source: "plaid" | "manual";
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface BudgetTarget {
  categoryId: string;
  monthKey: string;
  amount: number;
}

export interface CategorizationRule {
  id: string;
  categoryId: string;
  pattern: string;
  createdAt: string;
  hitCount: number;
}

export interface FamilyMember {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
}

export type AiProvider = "openai" | "anthropic" | "google";

export interface AiProviderSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface VaultShard {
  id: string;
  monthKey: string;
  encryptedPayload: string;
  iv: string;
  updatedAt: string;
}

export interface VaultEnvelope {
  userId: string;
  salt: string;
  encryptedDataKey: string;
  iv: string;
  algorithm: "AES-GCM";
  iterations: number;
}

export interface EncryptedVault {
  envelope: VaultEnvelope;
  shards: VaultShard[];
  categories: Category[];
  budgets: BudgetTarget[];
  rules: CategorizationRule[];
  linkedAccounts: BankAccount[];
  familyMembers: FamilyMember[];
  aiSettings?: AiProviderSettings;
}

export interface UserSession {
  userId: string;
  email: string;
  displayName: string;
}

/* ── Chart row types ─────────────────── */

export interface CategoryPieRow { categoryId: string; name: string; color: string; value: number }
export interface MerchantPieRow { name: string; value: number; color: string }
export interface SixMonthRow { label: string; total: number }
export interface BudgetRow { categoryId: string; categoryName: string; color: string; budget: number; spent: number; pct: number }
export interface RuleSuggestion { pattern: string; categoryName: string; categoryId: string; count: number }
