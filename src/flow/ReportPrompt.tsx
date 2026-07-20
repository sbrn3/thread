import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhaseMetric } from '../lab/analysis/reversal';
import { PHASE_DAYS } from '../lab/phases';
import { tokens } from '../ui/tokens';
import { PhaseChart } from './PhaseChart';

interface ReportPromptProps {
  recommendation: string;
  reportText: string;
  phases?: PhaseMetric[];
  onApply: () => void;
  onKeep: () => void;
}

/**
 * §15 report anatomy — a verdict, a confidence level, and one
 * concrete change the app is asking permission to make. Surfaces
 * once, after a seal (§15), never before or during reading. "Keep
 * as is" is a legitimate answer, not a wrong one — the engine advises,
 * it does not govern.
 */
export function ReportPrompt({ recommendation, reportText, phases, onApply, onKeep }: ReportPromptProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>A report is ready</Text>
      {phases && phases.length > 0 && <PhaseChart phases={phases} totalDays={PHASE_DAYS} />}
      <Text style={styles.mono}>{reportText}</Text>
      <Text style={styles.recommendation}>{recommendation}</Text>
      <View style={styles.buttons}>
        <Pressable style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.applyLabel}>Apply</Text>
        </Pressable>
        <Pressable style={styles.keepBtn} onPress={onKeep}>
          <Text style={styles.keepLabel}>Keep as is</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 18,
    gap: 12,
  },
  label: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.color.thread,
  },
  mono: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.color.ink,
  },
  recommendation: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 14,
    color: tokens.color.ink,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  applyBtn: {
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  applyLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
  keepBtn: {
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  keepLabel: {
    fontFamily: tokens.font.display,
    fontSize: 13,
    color: tokens.color.ink60,
  },
});
