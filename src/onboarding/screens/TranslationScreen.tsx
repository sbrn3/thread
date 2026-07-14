import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../../ui/tokens';
import { OnboardingScreen } from '../OnboardingScreen';

interface TranslationScreenProps {
  onNext: (provider: 'niv' | 'esv' | null, apiKey: string) => void;
}

export function TranslationScreen({ onNext }: TranslationScreenProps) {
  const [provider, setProvider] = useState<'niv' | 'esv' | null>(null);
  const [apiKey, setApiKey] = useState('');

  return (
    <OnboardingScreen
      step="4 of 6 · The translation"
      title="Which translation?"
      sub="Both need a free key from the publisher. If you'd rather not set one up now, skip — you'll still read, just from the public-domain text until you add one."
      primaryLabel="Next"
      primaryDisabled={provider !== null && apiKey.trim().length === 0}
      onPrimary={() => onNext(provider, apiKey.trim())}
      onSkip={() => onNext(null, '')}
      skipLabel="Skip for now — use the offline text"
    >
      <View style={styles.options}>
        <Pressable
          style={[styles.option, provider === 'niv' && styles.optionSelected]}
          onPress={() => setProvider('niv')}
        >
          <Text style={styles.optionTitle}>NIV</Text>
          <Text style={styles.optionSub}>via API.Bible — no doctrinal statement required</Text>
        </Pressable>
        <Pressable
          style={[styles.option, provider === 'esv' && styles.optionSelected]}
          onPress={() => setProvider('esv')}
        >
          <Text style={styles.optionTitle}>ESV</Text>
          <Text style={styles.optionSub}>via api.esv.org — requires accepting Crossway&apos;s statement of faith</Text>
        </Pressable>
      </View>

      {provider && (
        <View style={styles.keyBlock}>
          <Text style={styles.keyNote}>
            {provider === 'niv'
              ? 'Get a free key at api.bible — no statement of faith required.'
              : "Get a free key at api.esv.org — you'll be asked to accept Crossway's statement of faith."}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your API key"
            placeholderTextColor={tokens.color.ink40}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: 10, marginBottom: 8 },
  option: {
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    borderRadius: 12,
    padding: 14,
  },
  optionSelected: { borderColor: tokens.color.thread, backgroundColor: '#EEF0FF' },
  optionTitle: { fontFamily: tokens.font.display, fontWeight: '700', fontSize: 14, color: tokens.color.ink },
  optionSub: { fontFamily: tokens.font.display, fontSize: 11.5, color: tokens.color.ink40, marginTop: 2 },
  keyBlock: { marginTop: 18 },
  keyNote: { fontFamily: tokens.font.display, fontSize: 12, color: tokens.color.ink40, lineHeight: 18, marginBottom: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: tokens.font.scripture,
    fontSize: 17,
    color: tokens.color.ink,
  },
});
