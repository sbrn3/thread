// §16.9 layer 2 — weekly export/restore, opt-in passphrase encryption.
// Layer 1 (SQLCipher on-device encryption at rest) is a separate,
// deferred decision — this only ever touches a file the user
// explicitly exports or imports; nothing leaves the phone unless the
// user shares it themselves.
import type { SqlDb } from '../log/db';
import { meta } from '../log/log';
import { decryptPayload, encryptPayload, type CryptoLike, type EncryptedBackup } from './crypto';
import { buildDump, restoreDump, type BackupDump } from './dump';
import type { BackupIO } from './io';

const PASSPHRASE_KEY = 'thread_backup_passphrase';
const META_ENCRYPTED = 'backup_encrypted';
const META_LAST_EXPORT = 'backup_last_export';

interface StoredFile {
  formatVersion: 1;
  encrypted: boolean;
  payload: BackupDump | EncryptedBackup;
}

export interface PickedRestoreFile {
  uri: string;
  name: string;
  requiresPassphrase: boolean;
}

export class Backup {
  constructor(
    private readonly db: SqlDb,
    private readonly crypto: CryptoLike,
    private readonly io: BackupIO,
  ) {}

  isEncryptionEnabled(): boolean {
    return meta.get(this.db, META_ENCRYPTED) === '1';
  }

  async enableEncryption(passphrase: string): Promise<void> {
    if (!passphrase) throw new Error('Passphrase required');
    await this.io.setSecret(PASSPHRASE_KEY, passphrase);
    meta.set(this.db, META_ENCRYPTED, '1');
  }

  async disableEncryption(): Promise<void> {
    await this.io.deleteSecret(PASSPHRASE_KEY);
    meta.set(this.db, META_ENCRYPTED, '0');
  }

  lastExportAt(): number | null {
    const raw = meta.get(this.db, META_LAST_EXPORT);
    return raw ? Number(raw) : null;
  }

  /** Builds the dump, encrypts it if enabled, writes a shareable file, and opens the share sheet. Returns the file uri. */
  async exportNow(now: () => number = Date.now): Promise<string> {
    const dump = buildDump(this.db, now);

    let stored: StoredFile;
    if (this.isEncryptionEnabled()) {
      const passphrase = await this.io.getSecret(PASSPHRASE_KEY);
      if (!passphrase) throw new Error('Encryption is enabled but no passphrase is stored');
      const encrypted = await encryptPayload(this.crypto, passphrase, JSON.stringify(dump));
      stored = { formatVersion: 1, encrypted: true, payload: encrypted };
    } else {
      stored = { formatVersion: 1, encrypted: false, payload: dump };
    }

    const filename = `thread-backup-${new Date(now()).toISOString().slice(0, 10)}.json`;
    const uri = await this.io.writeExportFile(filename, JSON.stringify(stored));
    await this.io.shareFile(uri);
    meta.set(this.db, META_LAST_EXPORT, String(now()));
    return uri;
  }

  /** Opens the system file picker. Returns null if the user cancelled. */
  async pickRestoreFile(): Promise<PickedRestoreFile | null> {
    const picked = await this.io.pickImportFile();
    if (!picked) return null;
    const stored = JSON.parse(await this.io.readFile(picked.uri)) as StoredFile;
    return { uri: picked.uri, name: picked.name, requiresPassphrase: stored.encrypted };
  }

  /**
   * Decrypts (if needed) and restores, wiping and repopulating every
   * included table in one transaction (see dump.ts). `passphrase` is
   * required only when pickRestoreFile() reported requiresPassphrase
   * — a wrong passphrase throws (GCM auth-tag mismatch) rather than
   * silently corrupting the restore.
   */
  async restoreFrom(uri: string, passphrase?: string): Promise<void> {
    const stored = JSON.parse(await this.io.readFile(uri)) as StoredFile;

    const dump = stored.encrypted
      ? (JSON.parse(
          await decryptPayload(
            this.crypto,
            requirePassphrase(passphrase),
            stored.payload as EncryptedBackup,
          ),
        ) as BackupDump)
      : (stored.payload as BackupDump);

    restoreDump(this.db, dump);
  }
}

function requirePassphrase(p: string | undefined): string {
  if (!p) throw new Error('This backup is encrypted — a passphrase is required to restore it');
  return p;
}
