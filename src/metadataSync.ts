import type { EncryptedVault, UserSession } from "./types";
import { supabase } from "./supabaseClient";

export async function syncVaultMetadata(
  session: UserSession,
  vault: EncryptedVault,
): Promise<void> {
  if (!supabase) {
    return;
  }

  const payload = {
    user_id: session.userId,
    linked_accounts_count: vault.linkedAccounts.length,
    categories_count: vault.categories.length,
    family_members_count: vault.familyMembers.length,
    shard_count: vault.shards.length,
    last_sync_at: new Date().toISOString(),
    encrypted_envelope: vault.envelope,
    encrypted_shards: vault.shards,
  };

  await supabase.from("vault_metadata").upsert(payload, { onConflict: "user_id" });
}
