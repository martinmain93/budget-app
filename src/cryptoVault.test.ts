import { describe, expect, it } from "vitest";
import {
  createVaultEnvelope,
  decryptAllTransactions,
  encryptPayload,
  rebuildShardMap,
  unlockVaultDataKey,
} from "./cryptoVault";
import type { EncryptedVault, Transaction } from "./types";

describe("cryptoVault", () => {
  it("creates and unlocks a vault data key with password", async () => {
    const { envelope } = await createVaultEnvelope("u1", "super-secure-password");
    const key = await unlockVaultDataKey(envelope, "super-secure-password");
    expect(key).toBeTruthy();
  });

  it("fails unlock when password is wrong", async () => {
    const { envelope } = await createVaultEnvelope("u1", "good-password");
    await expect(unlockVaultDataKey(envelope, "bad-password")).rejects.toBeTruthy();
  });

  it("encrypts payload and decrypts monthly shards back into transactions", async () => {
    const { envelope, dataKey } = await createVaultEnvelope("u2", "pw");
    const txs: Transaction[] = [
      {
        id: "t1",
        bankAccountId: "a1",
        date: "2026-01-10T00:00:00.000Z",
        merchant: "Trader Market",
        amount: 20,
        categoryId: "groceries",
        source: "plaid",
      },
      {
        id: "t2",
        bankAccountId: "a1",
        date: "2026-02-11T00:00:00.000Z",
        merchant: "Ride Uber",
        amount: 15,
        categoryId: "transport",
        source: "plaid",
      },
    ];
    const shards = await rebuildShardMap(dataKey, txs);
    expect(shards).toHaveLength(2);

    const vault: EncryptedVault = {
      envelope,
      shards,
      categories: [],
      budgets: [],
      rules: [],
      linkedAccounts: [],
      familyMembers: [],
    };
    const out = await decryptAllTransactions(vault, dataKey);
    expect(out.map((x) => x.id).sort()).toEqual(["t1", "t2"]);

    const encrypted = await encryptPayload(dataKey, { a: 1 });
    expect(encrypted.encrypted.length).toBeGreaterThan(0);
    expect(encrypted.iv.length).toBeGreaterThan(0);
  });
});
