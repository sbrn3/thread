import { describe, expect, it } from 'vitest';
import { Backup } from '../src/backup';
import type { CryptoLike } from '../src/backup/crypto';
import { decryptPayload, deriveKey, encryptPayload } from '../src/backup/crypto';
import { BACKUP_TABLES, buildDump, restoreDump } from '../src/backup/dump';
import type { BackupIO } from '../src/backup/io';
import { migrate } from '../src/log/schema';
import { openTestDb } from './util/testDb';

// A deterministic stand-in for expo-crypto's AES-GCM: "encrypts" by
// tagging the plaintext with the key that produced it, so a decrypt
// with a different key can be told apart from the right one — same
// observable contract (wrong key/tampered data throws) without
// needing a real cipher in the test suite.
function fakeCrypto(): CryptoLike {
  return {
    async digestSha256Hex(data) {
      // Not a real hash — just needs to be deterministic and mix the input.
      let h = 0;
      for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) >>> 0;
      return h.toString(16).padStart(64, '0');
    },
    async randomHex(byteCount) {
      return Array.from({ length: byteCount * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    },
    async importAesKey(hex64) {
      return hex64;
    },
    async encryptUtf8(plaintext, key) {
      return Buffer.from(JSON.stringify({ key, plaintext })).toString('base64');
    },
    async decryptUtf8(combinedBase64, key) {
      const { key: usedKey, plaintext } = JSON.parse(Buffer.from(combinedBase64, 'base64').toString('utf8'));
      if (usedKey !== key) throw new Error('auth tag mismatch');
      return plaintext;
    },
  };
}

function fakeIo(): BackupIO & {
  files: Map<string, string>;
  secrets: Map<string, string>;
  nextPick: { uri: string; name: string } | null;
  shared: string[];
} {
  const files = new Map<string, string>();
  const secrets = new Map<string, string>();
  const shared: string[] = [];
  return {
    files,
    secrets,
    shared,
    nextPick: null,
    async writeExportFile(name, content) {
      const uri = `file:///cache/${name}`;
      files.set(uri, content);
      return uri;
    },
    async shareFile(uri) {
      shared.push(uri);
    },
    async pickImportFile() {
      return this.nextPick;
    },
    async readFile(uri) {
      const content = files.get(uri);
      if (content === undefined) throw new Error(`no such file: ${uri}`);
      return content;
    },
    async getSecret(key) {
      return secrets.get(key) ?? null;
    },
    async setSecret(key, value) {
      secrets.set(key, value);
    },
    async deleteSecret(key) {
      secrets.delete(key);
    },
  };
}

describe('dump/restore (§16.9)', () => {
  it('round-trips every included table', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO events (ts, tz_offset, local_date, type, build_sha) VALUES (1, 0, '2026-01-01', 'app_open', 'abc')`);
    db.run(`INSERT INTO days (local_date, sealed, dose) VALUES ('2026-01-01', 1, 'full_chapter')`);
    db.run(`INSERT INTO meta (key, value) VALUES ('trial_seed', '42')`);

    const dump = buildDump(db);
    expect(Object.keys(dump.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(dump.tables.events).toHaveLength(1);

    const restoreDb = openTestDb();
    migrate(restoreDb);
    restoreDump(restoreDb, dump);

    expect(restoreDb.all('SELECT * FROM events')).toHaveLength(1);
    expect(restoreDb.get<{ value: string }>("SELECT value FROM meta WHERE key = 'trial_seed'")?.value).toBe('42');
  });

  it('wipes existing rows before restoring, not appending to them', () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO meta (key, value) VALUES ('a', '1')`);
    const dump = buildDump(db); // captures just 'a'

    db.run(`INSERT INTO meta (key, value) VALUES ('b', '2')`); // added after the dump was taken
    restoreDump(db, dump);

    expect(db.all('SELECT key FROM meta')).toEqual([{ key: 'a' }]);
  });

  it('drops columns the current schema no longer has, without failing the restore', () => {
    const db = openTestDb();
    migrate(db);
    const dump = buildDump(db);
    dump.tables.meta.push({ key: 'x', value: '1', a_column_removed_since: 'ghost' });

    expect(() => restoreDump(db, dump)).not.toThrow();
    expect(db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'x'")?.value).toBe('1');
  });

  it('never touches chapter_cache — a cache, not evidence', () => {
    expect(BACKUP_TABLES).not.toContain('chapter_cache');
  });
});

describe('crypto (§16.9 passphrase encryption)', () => {
  it('round-trips a payload with the right passphrase', async () => {
    const crypto = fakeCrypto();
    const encrypted = await encryptPayload(crypto, 'correct horse', '{"hello":"world"}');
    const decrypted = await decryptPayload(crypto, 'correct horse', encrypted);
    expect(decrypted).toBe('{"hello":"world"}');
  });

  it('throws on the wrong passphrase rather than returning garbage', async () => {
    const crypto = fakeCrypto();
    const encrypted = await encryptPayload(crypto, 'correct horse', '{"hello":"world"}');
    await expect(decryptPayload(crypto, 'wrong passphrase', encrypted)).rejects.toThrow();
  });

  it('derives the same key for the same passphrase+salt, deterministically', async () => {
    const crypto = fakeCrypto();
    const a = await deriveKey(crypto, 'p', 'deadbeef');
    const b = await deriveKey(crypto, 'p', 'deadbeef');
    expect(a).toBe(b);
  });
});

describe('Backup (§16.9 export/restore orchestration)', () => {
  it('exports unencrypted by default, sharing the written file', async () => {
    const db = openTestDb();
    migrate(db);
    const io = fakeIo();
    const backup = new Backup(db, fakeCrypto(), io);

    expect(backup.isEncryptionEnabled()).toBe(false);
    expect(backup.lastExportAt()).toBeNull();

    const uri = await backup.exportNow(() => 1_700_000_000_000);

    expect(io.shared).toEqual([uri]);
    const stored = JSON.parse(io.files.get(uri)!);
    expect(stored.encrypted).toBe(false);
    expect(backup.lastExportAt()).toBe(1_700_000_000_000);
  });

  it('encrypts once enabled, and a plain restore of it fails without the passphrase', async () => {
    const db = openTestDb();
    migrate(db);
    db.run(`INSERT INTO meta (key, value) VALUES ('trial_seed', '99')`);
    const io = fakeIo();
    const backup = new Backup(db, fakeCrypto(), io);

    await backup.enableEncryption('correct horse battery staple');
    expect(backup.isEncryptionEnabled()).toBe(true);

    const uri = await backup.exportNow();
    const stored = JSON.parse(io.files.get(uri)!);
    expect(stored.encrypted).toBe(true);

    io.nextPick = { uri, name: 'thread-backup.json' };
    const picked = await backup.pickRestoreFile();
    expect(picked?.requiresPassphrase).toBe(true);

    await expect(backup.restoreFrom(uri)).rejects.toThrow(/passphrase/i);
    await expect(backup.restoreFrom(uri, 'wrong')).rejects.toThrow();
  });

  it('restores an encrypted export into a fresh db given the right passphrase', async () => {
    const source = openTestDb();
    migrate(source);
    db_seed(source, 'restored-value');
    const io = fakeIo();
    const sourceBackup = new Backup(source, fakeCrypto(), io);
    await sourceBackup.enableEncryption('the passphrase');
    const uri = await sourceBackup.exportNow();

    const target = openTestDb();
    migrate(target);
    const targetBackup = new Backup(target, fakeCrypto(), io);
    await targetBackup.restoreFrom(uri, 'the passphrase');

    expect(target.get<{ value: string }>("SELECT value FROM meta WHERE key = 'mark'")?.value).toBe('restored-value');
  });

  it('pickRestoreFile returns null when the user cancels the picker', async () => {
    const db = openTestDb();
    migrate(db);
    const io = fakeIo();
    io.nextPick = null;
    const backup = new Backup(db, fakeCrypto(), io);
    expect(await backup.pickRestoreFile()).toBeNull();
  });

  it('disableEncryption clears the stored passphrase', async () => {
    const db = openTestDb();
    migrate(db);
    const io = fakeIo();
    const backup = new Backup(db, fakeCrypto(), io);
    await backup.enableEncryption('temp');
    await backup.disableEncryption();

    expect(backup.isEncryptionEnabled()).toBe(false);
    expect(await io.getSecret('thread_backup_passphrase')).toBeNull();
  });

  function db_seed(db: ReturnType<typeof openTestDb>, value: string) {
    db.run(`INSERT INTO meta (key, value) VALUES ('mark', ?)`, [value]);
  }
});
