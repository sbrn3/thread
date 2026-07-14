// Injectable surface over expo-file-system + expo-sharing +
// expo-document-picker + expo-secure-store — same seam pattern as
// CryptoLike/NotificationsLike, so Backup's actual branching logic
// (encryption toggle, restore requiring a passphrase or not, file
// naming) is testable under vitest with a fake instead of the four
// native modules it really takes on-device.
export interface BackupIO {
  /** Writes content to a fresh file the OS share sheet can read, returning its uri. */
  writeExportFile(name: string, content: string): Promise<string>;
  /** Opens the OS share sheet for the given file uri. */
  shareFile(uri: string): Promise<void>;
  /** Opens the system file picker. Returns null if the user cancelled. */
  pickImportFile(): Promise<{ uri: string; name: string } | null>;
  readFile(uri: string): Promise<string>;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}
