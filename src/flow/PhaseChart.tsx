import { StyleSheet, Text, View } from 'react-native';
import type { PhaseMetric } from '../lab/analysis/reversal';
import { tokens } from '../ui/tokens';

interface PhaseChartProps {
  phases: PhaseMetric[];
  totalDays: number;
}

/**
 * §10 W10 "phase charts" — a plain bar per phase, days sealed out of
 * the phase length, colored by arm. Deliberately minimal: this is a
 * visual companion to the text report (report.ts), not a
 * replacement — the report's numbers are the actual analysis.
 */
export function PhaseChart({ phases, totalDays }: PhaseChartProps) {
  return (
    <View style={styles.row}>
      {phases.map((p) => (
        <View key={p.phase} style={styles.col}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { height: `${Math.min(100, Math.round((p.daysSealed / totalDays) * 100))}%` },
                p.arm === 'A' ? styles.armA : styles.armB,
                p.disturbed && styles.disturbed,
              ]}
            />
          </View>
          <Text style={styles.armLabel}>{p.arm}</Text>
          <Text style={styles.count}>
            {p.daysSealed}/{totalDays}
          </Text>
        </View>
      ))}
    </View>
  );
}

const TRACK_HEIGHT = 64;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  col: {
    alignItems: 'center',
    gap: 4,
  },
  track: {
    width: 20,
    height: TRACK_HEIGHT,
    justifyContent: 'flex-end',
    backgroundColor: tokens.color.ink15,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
  },
  armA: {
    backgroundColor: tokens.color.thread,
  },
  armB: {
    backgroundColor: tokens.color.ink60,
  },
  disturbed: {
    opacity: 0.4,
  },
  armLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    color: tokens.color.ink40,
  },
  count: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    color: tokens.color.ink40,
  },
});
