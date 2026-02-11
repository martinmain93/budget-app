import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVault,
  decryptVaultMetadata,
  initializeVault,
  loadSession,
  loadVault,
  persistSession,
  persistVaultSecure,
} from "./vaultStore";
import type { EncryptedVault, UserSession } from "./types";

describe("vaultStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes and persists session + encrypted vault", async () => {
    const created = await initializeVault({
      displayName: "Test User",
      email: "test@example.com",
      password: "secret",
    });
    expect(created.session.email).toBe("test@example.com");
    expect(created.vault.envelope.encryptedDataKey.length).toBeGreaterThan(0);

    const loadedVault = loadVault();
    const loadedSession = loadSession();
    expect(loadedVault?.envelope.userId).toBe(created.session.userId);
    expect(loadedSession?.email).toBe("test@example.com");

    // Verify metadata is encrypted on disk (not stored as plaintext)
    const raw = JSON.parse(
      localStorage.getItem("budget-app-encrypted-vault")!,
    );
    expect(raw.encryptedMetadata).toBeDefined();
    expect(raw.categories).toBeUndefined();
    expect(raw.budgets).toBeUndefined();
    expect(raw.rules).toBeUndefined();
    expect(raw.linkedAccounts).toBeUndefined();
    expect(raw.familyMembers).toBeUndefined();
  });

  it("can persist securely, decrypt, and clear storage", async () => {
    const session: UserSession = {
      userId: "u1",
      email: "a@b.com",
      displayName: "A",
    };
    const dataKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const vault: EncryptedVault = {
      envelope: {
        userId: "u1",
        salt: "s",
        encryptedDataKey: "e",
        iv: "i",
        algorithm: "AES-GCM",
        iterations: 10,
      },
      shards: [],
      categories: [],
      budgets: [],
      rules: [],
      linkedAccounts: [],
      familyMembers: [],
    };

    persistSession(session);
    await persistVaultSecure(vault, dataKey);

    expect(loadSession()).toEqual(session);

    // Raw localStorage should have encrypted metadata, not plaintext fields
    const raw = JSON.parse(
      localStorage.getItem("budget-app-encrypted-vault")!,
    );
    expect(raw.encryptedMetadata).toBeDefined();
    expect(raw.encryptedMetadata.encrypted).toEqual(expect.any(String));
    expect(raw.encryptedMetadata.iv).toEqual(expect.any(String));
    expect(raw.categories).toBeUndefined();

    // Decrypt metadata and verify round-trip
    const stored = loadVault()!;
    const hydrated = await decryptVaultMetadata(stored, dataKey);
    expect(hydrated.categories).toEqual([]);
    expect(hydrated.budgets).toEqual([]);
    expect(hydrated.rules).toEqual([]);
    expect(hydrated.linkedAccounts).toEqual([]);
    expect(hydrated.familyMembers).toEqual([]);

    clearVault();
    expect(loadSession()).toBeNull();
    expect(loadVault()).toBeNull();
  });
});
