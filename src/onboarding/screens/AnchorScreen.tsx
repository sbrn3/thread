import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '../../ui/tokens';
import { AnchorValidation } from '../AnchorValidation';
import { OnboardingScreen } from '../OnboardingScreen';

interface AnchorScreenProps {
  anchor: string;
  onNext: (anchor: string, validated: boolean) => void;
}

const SUGGESTIONS = ['my morning coffee', 'I brush my teeth', 'dinner', 'I get into bed'];
const TEACH_YES = ['after my morning coffee', 'after I brush my teeth at night', 'when I sit down at my desk'];
const TEACH_NO = [
  ['in the morning', 'not an event'],
  ['when I have time', 'not an event'],
  ['at 7am', "a clock — clocks don't notice you're asleep"],
];

export function AnchorScreen({ anchor: initialAnchor, onNext }: AnchorScreenProps) {
  const [anchor, setAnchor] = useState(initialAnchor);
  const [validated, setValidated] = useState<boolean | null>(null);

  const showValidation = anchor.trim().length > 2;
  const canProceed = showValidation && validated !== null;

  return (
    <OnboardingScreen
      step="1 of 6 · The anchor"
      title="What already happens every day?"
      sub="Your reading will attach to it. This is the most important answer you'll give."
      primaryLabel={validated === false ? 'Use it anyway' : 'Next'}
      primaryDisabled={!canProceed}
      onPrimary={() => onNext(anchor.trim(), validated === true)}
    >
      <View style={styles.teach}>
        {TEACH_YES.map((t) => (
          <Text key={t} style={styles.teachYes}>
            ✓ &quot;{t}&quot;
          </Text>
        ))}
        <View style={{ height: 6 }} />
        {TEACH_NO.map(([t, why]) => (
          <Text key={t} style={styles.teachNo}>
            ✗ &quot;{t}&quot; <Text style={styles.teachWhy}>— {why}</Text>
          </Text>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="after my…"
        placeholderTextColor={tokens.color.ink40}
        value={anchor}
        onChangeText={(v) => {
          setAnchor(v);
          setValidated(null);
        }}
      />
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            style={styles.chip}
            onPress={() => {
              setAnchor(s);
              setValidated(null);
            }}
          >
            <Text style={styles.chipLabel}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {showValidation && <AnchorValidation key={anchor} onResult={setValidated} />}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  teach: {
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 4,
  },
  teachYes: { fontFamily: tokens.font.display, fontSize: 13, color: tokens.color.ink },
  teachNo: { fontFamily: tokens.font.display, fontSize: 13, color: tokens.color.ink },
  teachWhy: { color: tokens.color.ink40 },
  input: {
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: tokens.font.scripture,
    fontSize: 17,
    color: tokens.color.ink,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipLabel: { fontFamily: tokens.font.display, fontSize: 12.5, color: tokens.color.ink40 },
});
