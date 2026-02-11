import type {
  EncryptedVault,
  Transaction,
  VaultEnvelope,
  VaultShard,
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 310000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function monthKeyFromIso(isoDate: string): string {
  return isoDate.slice(0, 7);
}

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function exportDataKeyRaw(dataKey: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", dataKey);
  return new Uint8Array(raw);
}

async function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function createVaultEnvelope(
  userId: string,
  password: string,
): Promise<{ envelope: VaultEnvelope; dataKey: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(password, salt);
  const dataKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawDataKey = await exportDataKeyRaw(dataKey);
  const encryptedDataKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    toArrayBuffer(rawDataKey),
  );

  return {
    envelope: {
      userId,
      salt: toBase64(salt),
      iv: toBase64(iv),
      encryptedDataKey: toBase64(new Uint8Array(encryptedDataKey)),
      algorithm: "AES-GCM",
      iterations: ITERATIONS,
    },
    dataKey,
  };
}

export async function unlockVaultDataKey(
  envelope: VaultEnvelope,
  password: string,
): Promise<CryptoKey> {
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const encryptedDataKey = fromBase64(envelope.encryptedDataKey);
  const wrappingKey = await deriveWrappingKey(password, salt);
  const rawDataKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    wrappingKey,
    toArrayBuffer(encryptedDataKey),
  );
  return importDataKey(new Uint8Array(rawDataKey));
}

export async function encryptPayload(
  dataKey: CryptoKey,
  payload: unknown,
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    dataKey,
    encoder.encode(JSON.stringify(payload)),
  );
  return { encrypted: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function decryptPayload<T>(
  dataKey: CryptoKey,
  encrypted: string,
  iv: string,
): Promise<T> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(iv)) },
    dataKey,
    toArrayBuffer(fromBase64(encrypted)),
  );
  try {
    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch {
    throw new Error("Decrypted payload is not valid JSON — vault data may be corrupted");
  }
}

export async function encryptShard(
  dataKey: CryptoKey,
  monthKey: string,
  transactions: Transaction[],
): Promise<VaultShard> {
  const { encrypted, iv } = await encryptPayload(dataKey, transactions);
  return {
    id: crypto.randomUUID(),
    monthKey,
    encryptedPayload: encrypted,
    iv,
    updatedAt: new Date().toISOString(),
  };
}

export async function rebuildShardMap(
  dataKey: CryptoKey,
  allTransactions: Transaction[],
): Promise<VaultShard[]> {
  const grouped = new Map<string, Transaction[]>();
  for (const tx of allTransactions) {
    const monthKey = monthKeyFromIso(tx.date);
    const list = grouped.get(monthKey) ?? [];
    list.push(tx);
    grouped.set(monthKey, list);
  }

  const shards: VaultShard[] = [];
  for (const [monthKey, txs] of grouped.entries()) {
    shards.push(await encryptShard(dataKey, monthKey, txs));
  }
  return shards;
}

export async function decryptAllTransactions(
  vault: EncryptedVault,
  dataKey: CryptoKey,
): Promise<Transaction[]> {
  const output: Transaction[] = [];
  for (const shard of vault.shards) {
    const txs = await decryptPayload<Transaction[]>(
      dataKey,
      shard.encryptedPayload,
      shard.iv,
    );
    output.push(...txs);
  }
  return output.sort((a, b) => (a.date < b.date ? 1 : -1));
}
