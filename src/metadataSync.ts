import type { EncryptedVault, VaultEnvelope, VaultShard } from "./types";
import { supabase } from "./supabaseClient";

/** Push the encrypted vault (envelope + shards + encrypted metadata) to Supabase. */
export async function pushVaultToSupabase(vault: EncryptedVault): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload = {
    user_id: user.id,
    encrypted_envelope: vault.envelope,
    encrypted_shards: vault.shards,
    encrypted_metadata: vault.encryptedMetadata ?? null,
    shard_count: vault.shards.length,
    last_sync_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("vault_data")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to push vault to Supabase:", error.message);
  }
}

/** Stored vault shape as it comes from Supabase. */
interface RemoteVaultRow {
  encrypted_envelope: VaultEnvelope;
  encrypted_shards: VaultShard[];
  encrypted_metadata: { encrypted: string; iv: string } | null;
}

/**
 * Pull the encrypted vault for the current user from Supabase.
 * Returns null if no vault exists or Supabase is not configured.
 */
export async function pullVaultFromSupabase(): Promise<EncryptedVault | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("vault_data")
    .select("encrypted_envelope, encrypted_shards, encrypted_metadata")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as RemoteVaultRow;
  return {
    envelope: row.encrypted_envelope,
    shards: row.encrypted_shards,
    encryptedMetadata: row.encrypted_metadata ?? undefined,
    // These will be populated after decryption:
    categories: [],
    budgets: [],
    rules: [],
    linkedAccounts: [],
    familyMembers: [],
  };
}

/** Check whether a vault exists for the current user in Supabase. */
export async function vaultExistsInSupabase(): Promise<boolean> {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from("vault_data")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return !error && (count ?? 0) > 0;
}

/**
 * Legacy sync function kept for backward compatibility.
 * Delegates to pushVaultToSupabase.
 */
export async function syncVaultMetadata(
  _session: unknown,
  vault: EncryptedVault,
): Promise<void> {
  await pushVaultToSupabase(vault);
}
