import { describe, expect, it } from "vitest";
import { createVaultEnvelope, unlockVaultDataKey } from "./cryptoVault";
import { deriveGooglePassword } from "./vaultStore";

describe("Google + PIN vault key derivation", () => {
  const GOOGLE_SUB = "109876543210987654321";
  const PIN = "482917";

  it("deriveGooglePassword creates a deterministic compound password", () => {
    const pw1 = deriveGooglePassword(GOOGLE_SUB, PIN);
    const pw2 = deriveGooglePassword(GOOGLE_SUB, PIN);
    expect(pw1).toBe(pw2);
    expect(pw1).toBe(`google:${GOOGLE_SUB}:${PIN}`);
  });

  it("different PINs produce different passwords", () => {
    const pw1 = deriveGooglePassword(GOOGLE_SUB, "111111");
    const pw2 = deriveGooglePassword(GOOGLE_SUB, "222222");
    expect(pw1).not.toBe(pw2);
  });

  it("can create and unlock a vault with Google+PIN derived password", async () => {
    const password = deriveGooglePassword(GOOGLE_SUB, PIN);
    const { envelope, dataKey } = await createVaultEnvelope("user-123", password);

    expect(envelope.userId).toBe("user-123");
    expect(envelope.algorithm).toBe("AES-GCM");

    // Unlock with same password
    const recovered = await unlockVaultDataKey(envelope, password);
    expect(recovered).toBeDefined();

    // Verify we can use the recovered key (same as original)
    const testData = new TextEncoder().encode("test");
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dataKey, testData);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, recovered, encrypted);
    expect(new TextDecoder().decode(decrypted)).toBe("test");
  });

  it("fails to unlock with wrong PIN", async () => {
    const password = deriveGooglePassword(GOOGLE_SUB, PIN);
    const { envelope } = await createVaultEnvelope("user-456", password);

    const wrongPassword = deriveGooglePassword(GOOGLE_SUB, "000000");
    await expect(unlockVaultDataKey(envelope, wrongPassword)).rejects.toThrow();
  });

  it("fails to unlock with wrong Google sub", async () => {
    const password = deriveGooglePassword(GOOGLE_SUB, PIN);
    const { envelope } = await createVaultEnvelope("user-789", password);

    const wrongPassword = deriveGooglePassword("different-sub", PIN);
    await expect(unlockVaultDataKey(envelope, wrongPassword)).rejects.toThrow();
  });
});
