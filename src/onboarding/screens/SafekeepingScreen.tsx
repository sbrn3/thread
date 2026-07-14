import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../../ui/tokens';
import { OnboardingScreen } from '../OnboardingScreen';

interface SafekeepingScreenProps {
  onNext: (partnerName: string, requestNotifications: boolean) => void;
}

/**
 * §05 screen 7. No passphrase asked here — encryption is an opt-in
 * toggle in the knot later, not an onboarding question (most exports
 * need only the cloud account's own security). Notification
 * permission is asked LAST, after the cue sentence is already
 * written — cold, it's reflexively denied.
 */
export function SafekeepingScreen({ onNext }: SafekeepingScreenProps) {
  const [partnerName, setPartnerName] = useState('');

  return (
    <OnboardingScreen
      step="6 of 6 · Safekeeping"
      title="One last thing."
      primaryLabel="Allow notifications & finish"
      onPrimary={() => onNext(partnerName.trim(), true)}
      onSkip={() => onNext(partnerName.trim(), false)}
      skipLabel="Skip notifications"
    >
      <Text style={styles.note}>
        <Text style={styles.noteBold}>Backups.</Text> Your reading stays on this phone and is copied weekly to your
        own cloud folder, so losing the phone doesn&apos;t lose the year. It isn&apos;t encrypted by default — the
        data isn&apos;t sensitive, and your cloud account&apos;s own security is the same bar that already protects
        your photos. Encryption is an opt-in toggle in the knot, any time.
      </Text>

      <View style={styles.divider} />

      <Text style={styles.note}>
        <Text style={styles.noteBold}>Someone to read alongside.</Text> Optional, and the app never contacts them —
        it only ever offers to open your messages. Same book, not the same pace.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="A name (optional)"
        placeholderTextColor={tokens.color.ink40}
        value={partnerName}
        onChangeText={setPartnerName}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: tokens.font.display,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.color.ink40,
    marginBottom: 8,
  },
  noteBold: { color: tokens.color.ink, fontWeight: '700' },
  divider: { height: 1, backgroundColor: tokens.color.ink15, marginVertical: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: tokens.font.scripture,
    fontSize: 17,
    color: tokens.color.ink,
    marginTop: 6,
  },
});
