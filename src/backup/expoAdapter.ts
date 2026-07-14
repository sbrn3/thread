// Real expo-crypto wiring for CryptoLike (see crypto.ts). Imported
// only here and constructed in services/index.ts, so crypto.ts and
// everything built on it stays loadable — and testable — under vitest.
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import type { CryptoLike } from './crypto';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const expoCrypto: CryptoLike = {
  async digestSha256Hex(data) {
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, data);
  },

  async randomHex(byteCount) {
    return toHex(await getRandomBytesAsync(byteCount));
  },

  async importAesKey(hex64) {
    return AESEncryptionKey.import(hex64, 'hex');
  },

  async encryptUtf8(plaintext, key) {
    const bytes = new TextEncoder().encode(plaintext);
    const sealed = await aesEncryptAsync(bytes, key as AESEncryptionKey);
    return sealed.combined('base64');
  },

  async decryptUtf8(combinedBase64, key) {
    const sealed = AESSealedData.fromCombined(combinedBase64);
    const bytes = await aesDecryptAsync(sealed, key as AESEncryptionKey, { output: 'bytes' });
    return new TextDecoder().decode(bytes as Uint8Array);
  },
};
