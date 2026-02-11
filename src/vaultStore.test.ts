import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVault,
  initializeVault,
  loadSession,
  loadVault,
  persistSession,
  persistVault,
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
  });

  it("can manually persist and clear storage", () => {
    const session: UserSession = {
      userId: "u1",
      email: "a@b.com",
      displayName: "A",
    };
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
    persistVault(vault);
    expect(loadSession()).toEqual(session);
    expect(loadVault()).toEqual(vault);
    clearVault();
    expect(loadSession()).toBeNull();
    expect(loadVault()).toBeNull();
  });
});
