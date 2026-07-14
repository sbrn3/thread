import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { Backup } from '../backup';
import { tokens } from '../ui/tokens';

interface BackupSectionProps {
  backup: Backup;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * §16.9 layer 2 — export/restore, always available, never automatic.
 * Encryption is opt-in: the passphrase lives in the OS keychain
 * (expo-secure-store), never in the app's own database.
 */
export function BackupSection({ backup }: BackupSectionProps) {
  const [encryptionEnabled, setEncryptionEnabled] = useState(backup.isEncryptionEnabled());
  const [lastExportAt, setLastExportAt] = useState(backup.lastExportAt());
  const [busy, setBusy] = useState(false);

  // Non-null while the "choose a passphrase" form is open (enabling encryption).
  const [newPassphrase, setNewPassphrase] = useState<string | null>(null);
  // Non-null while awaiting a passphrase to restore a picked encrypted file.
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');

  const handleToggleEncryption = (next: boolean) => {
    if (next) {
      setNewPassphrase('');
      return;
    }
    setBusy(true);
    backup
      .disableEncryption()
      .then(() => setEncryptionEnabled(false))
      .finally(() => setBusy(false));
  };

  const handleSavePassphrase = async () => {
    if (!newPassphrase) return;
    setBusy(true);
    try {
      await backup.enableEncryption(newPassphrase);
      setEncryptionEnabled(true);
      setNewPassphrase(null);
    } catch (e) {
      Alert.alert('Could not enable encryption', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      await backup.exportNow();
      setLastExportAt(backup.lastExportAt());
    } catch (e) {
      Alert.alert('Export failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmAndRestore = (uri: string, passphrase?: string) => {
    Alert.alert(
      'Replace all data on this phone?',
      'Restoring overwrites everything currently here with the contents of the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await backup.restoreFrom(uri, passphrase);
              setRestoreTarget(null);
              Alert.alert('Restore complete', 'Close and reopen Thread to see the restored data.');
            } catch (e) {
              Alert.alert('Restore failed', errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const picked = await backup.pickRestoreFile();
      setBusy(false);
      if (!picked) return;
      if (picked.requiresPassphrase) {
        setRestorePassphrase('');
        setRestoreTarget(picked.uri);
        return;
      }
      confirmAndRestore(picked.uri);
    } catch (e) {
      setBusy(false);
      Alert.alert('Restore failed', errorMessage(e));
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Encrypt backups</Text>
        <Switch value={encryptionEnabled} onValueChange={handleToggleEncryption} disabled={busy} />
      </View>

      {newPassphrase !== null && (
        <View style={styles.form}>
          <Text style={styles.hint}>
            Choose a passphrase. You&apos;ll need it to restore an encrypted backup — Thread cannot recover it if you
            lose it.
          </Text>
          <TextInput
            style={styles.input}
            value={newPassphrase}
            onChangeText={setNewPassphrase}
            placeholder="Passphrase"
            placeholderTextColor={tokens.color.ink40}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
          />
          <View style={styles.formRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setNewPassphrase(null)}>
              <Text style={styles.secondaryBtnLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, !newPassphrase && styles.btnDisabled]}
              onPress={handleSavePassphrase}
              disabled={!newPassphrase || busy}
            >
              <Text style={styles.primaryBtnLabel}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      {restoreTarget !== null && (
        <View style={styles.form}>
          <Text style={styles.hint}>This backup is encrypted. Enter its passphrase to restore.</Text>
          <TextInput
            style={styles.input}
            value={restorePassphrase}
            onChangeText={setRestorePassphrase}
            placeholder="Passphrase"
            placeholderTextColor={tokens.color.ink40}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
          />
          <View style={styles.formRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setRestoreTarget(null)}>
              <Text style={styles.secondaryBtnLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, !restorePassphrase && styles.btnDisabled]}
              onPress={() => confirmAndRestore(restoreTarget, restorePassphrase)}
              disabled={!restorePassphrase || busy}
            >
              <Text style={styles.primaryBtnLabel}>Restore</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.hint}>
        {lastExportAt ? `Last export: ${new Date(lastExportAt).toLocaleString()}` : 'No export yet.'}
      </Text>

      <View style={styles.formRow}>
        <Pressable style={styles.primaryBtn} onPress={handleExport} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={tokens.color.paper} />
          ) : (
            <Text style={styles.primaryBtnLabel}>Export now</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleRestore} disabled={busy}>
          <Text style={styles.secondaryBtnLabel}>Restore from file</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: tokens.font.display,
    fontSize: 15,
    color: tokens.color.ink,
  },
  hint: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.color.ink40,
  },
  form: {
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.color.ink15,
  },
  input: {
    fontFamily: tokens.font.mono,
    fontSize: 15,
    color: tokens.color.ink,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.thread,
    paddingVertical: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  primaryBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.ink,
  },
});
