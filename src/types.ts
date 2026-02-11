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

/** The sensitive metadata fields that are encrypted under the vault data key. */
export interface VaultMetadata {
  categories: Category[];
  budgets: BudgetTarget[];
  rules: CategorizationRule[];
  linkedAccounts: BankAccount[];
  familyMembers: FamilyMember[];
  aiSettings?: AiProviderSettings;
}

/**
 * The in-memory vault representation. After unlock, all metadata fields are
 * populated in plaintext for convenient access. When persisted to localStorage,
 * the metadata fields are encrypted into `encryptedMetadata` and the plaintext
 * fields are stripped — only `envelope`, `shards`, and `encryptedMetadata` are
 * written to disk.
 *
 * Legacy vaults (created before encrypted-metadata support) store metadata as
 * plaintext; they are transparently migrated on next save.
 */
export interface EncryptedVault {
  envelope: VaultEnvelope;
  shards: VaultShard[];
  /** Encrypted blob containing VaultMetadata (categories, budgets, rules, etc.). */
  encryptedMetadata?: { encrypted: string; iv: string };
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
  authMethod?: "password" | "google";
}

/* ── Chart row types ─────────────────── */

export interface CategoryPieRow { categoryId: string; name: string; color: string; value: number }
export interface MerchantPieRow { name: string; value: number; color: string }
export interface SixMonthRow { label: string; total: number }
export interface BudgetRow { categoryId: string; categoryName: string; color: string; budget: number; spent: number; pct: number }
export interface RuleSuggestion { pattern: string; categoryName: string; categoryId: string; count: number }
