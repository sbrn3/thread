import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../ui/tokens';
import { OnboardingScreen } from '../OnboardingScreen';

interface NetScreenProps {
  anchor: string;
  place: string;
  onNext: (nudgeHour: number | null) => void;
}

const HOURS: Array<{ label: string; value: number | null }> = [
  { label: '8:00 PM', value: 20 },
  { label: '9:00 PM', value: 21 },
  { label: '10:00 PM', value: 22 },
  { label: 'No nudge at all', value: null },
];

export function NetScreen({ anchor, place, onNext }: NetScreenProps) {
  const [selected, setSelected] = useState<number | null | undefined>(undefined);

  return (
    <OnboardingScreen
      step="3 of 6 · The safety net"
      title="If the day slips by, when should I nudge?"
      sub="If your anchor works, you'll never see this. It's a net, not a trigger — and it fires at most once a day, ever."
      primaryLabel="Next"
      primaryDisabled={selected === undefined}
      onPrimary={() => onNext(selected ?? null)}
    >
      <View style={styles.chips}>
        {HOURS.map((h) => (
          <Pressable
            key={h.label}
            style={[styles.chip, selected === h.value && styles.chipSelected]}
            onPress={() => setSelected(h.value)}
          >
            <Text style={[styles.chipLabel, selected === h.value && styles.chipLabelSelected]}>{h.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sentence}>
        <Text style={styles.sentenceText}>
          After <Text style={styles.blank}>{anchor || '…'}</Text>,{'\n'}
          I read in <Text style={styles.blank}>{place || '…'}</Text>.{'\n'}
          {selected !== undefined && selected !== null ? (
            <>
              If I haven&apos;t by <Text style={styles.blank}>{HOURS.find((h) => h.value === selected)?.label}</Text>,
              remind me.
            </>
          ) : (
            <Text style={styles.noReminder}>No reminder — the anchor does the work.</Text>
          )}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  chipSelected: { borderColor: tokens.color.thread },
  chipLabel: { fontFamily: tokens.font.display, fontSize: 12.5, color: tokens.color.ink40 },
  chipLabelSelected: { color: tokens.color.thread },
  sentence: {
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 20,
  },
  sentenceText: {
    fontFamily: tokens.font.scripture,
    fontSize: 18,
    lineHeight: 29,
    color: tokens.color.ink,
  },
  blank: { color: tokens.color.thread, fontWeight: '500' },
  noReminder: { color: tokens.color.ink40 },
});
