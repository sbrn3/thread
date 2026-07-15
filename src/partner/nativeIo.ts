// Real wiring for PartnerIO (see index.ts): react-native's own
// Linking (to open the OS messages app) and Share (the OS share
// sheet) — both local OS intents, no native module beyond
// react-native itself, and neither is forbidden by the import-
// boundary test (it bans expo-notifications, node-fetch, axios,
// /src/lab, and /src/notify — not react-native).
import { Linking, Share } from 'react-native';
import type { PartnerIO } from './index';

export const nativePartnerIo: PartnerIO = {
  async openURL(url) {
    await Linking.openURL(url);
  },

  async share(message) {
    await Share.share({ message });
  },
};
