// Real wiring for BackupIO (see io.ts): expo-file-system for writing
// the export file and reading a picked one, expo-sharing for the
// share sheet, expo-document-picker for the restore-side file picker,
// expo-secure-store (OS keychain) for the passphrase — a deliberate
// improvement over the plan's literal pseudocode of storing the raw
// passphrase in the app's own `meta` table.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import type { BackupIO } from './io';

export const nativeBackupIo: BackupIO = {
  async writeExportFile(name, content) {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(content);
    return file.uri;
  },

  async shareFile(uri) {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Thread backup' });
  },

  async pickImportFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.name };
  },

  async readFile(uri) {
    return new File(uri).text();
  },

  async getSecret(key) {
    return SecureStore.getItemAsync(key);
  },

  async setSecret(key, value) {
    await SecureStore.setItemAsync(key, value);
  },

  async deleteSecret(key) {
    await SecureStore.deleteItemAsync(key);
  },
};
