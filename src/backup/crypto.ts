// Injectable surface over expo-crypto's AES-GCM API — mirrors the
// NotificationsLike pattern (see src/notify/notifier.ts) so this
// stays unit-testable under vitest without loading a native module.
// The real adapter lives in expoAdapter.ts and is wired in at
// construction time (see services/index.ts).
export interface CryptoLike {
  /** Hex-encoded SHA-256 digest of a UTF-8 string. */
  digestSha256Hex(data: string): Promise<string>;
  /** A cryptographically random hex string of the given byte length. */
  randomHex(byteCount: number): Promise<string>;
  /** Imports a 64-hex-char (32-byte) string as an AES-256 key handle. */
  importAesKey(hex64: string): Promise<unknown>;
  /** Encrypts a UTF-8 string, returning the IV+ciphertext+tag as one base64 blob. */
  encryptUtf8(plaintext: string, key: unknown): Promise<string>;
  /** Reverses encryptUtf8. Throws (auth-tag mismatch) on wrong key or corrupted/tampered data. */
  decryptUtf8(combinedBase64: string, key: unknown): Promise<string>;
}

const SALT_BYTES = 16;

/**
 * expo-crypto has no PBKDF2/Argon2 — only single-shot digestStringAsync,
 * which is an async bridged call with no sync loop variant. This
 * chains SHA-256 as a stand-in key-stretch. It is NOT a substitute for
 * real PBKDF2/Argon2 (no memory-hardness, and far fewer rounds than
 * the plan's illustrative 200,000 — each round here is a sequential
 * round-trip, not a tight native loop), but it is materially better
 * than a single unstretched hash of the passphrase.
 */
const KDF_ITERATIONS = 10_000;

export async function deriveKey(crypto: CryptoLike, passphrase: string, saltHex: string): Promise<unknown> {
  let material = `${saltHex}:${passphrase}`;
  for (let i = 0; i < KDF_ITERATIONS; i++) {
    material = await crypto.digestSha256Hex(material);
  }
  return crypto.importAesKey(material); // 64 hex chars = 32 bytes = AES-256
}

export interface EncryptedBackup {
  salt: string; // hex
  ciphertext: string; // base64, combined IV+ciphertext+tag
}

export async function encryptPayload(crypto: CryptoLike, passphrase: string, json: string): Promise<EncryptedBackup> {
  const salt = await crypto.randomHex(SALT_BYTES);
  const key = await deriveKey(crypto, passphrase, salt);
  const ciphertext = await crypto.encryptUtf8(json, key);
  return { salt, ciphertext };
}

/** Throws if the passphrase is wrong or the data was tampered with (GCM auth-tag check). */
export async function decryptPayload(crypto: CryptoLike, passphrase: string, backup: EncryptedBackup): Promise<string> {
  const key = await deriveKey(crypto, passphrase, backup.salt);
  return crypto.decryptUtf8(backup.ciphertext, key);
}
