// §13.3 contract. Implementation lands in W10.
// Export → wipe → restore round-trip must verify byte-for-byte:
// a backup you have never restored is not a backup.
// expo-file-system + expo-crypto (passphrase KDF) — nothing leaves
// the phone unless the user shares the file themselves.

export interface Backup {
  export(passphrase: string): Promise<string>; // returns file URI
  restore(uri: string, passphrase: string): Promise<void>;
  lastExport(): Promise<string | null>;
}
