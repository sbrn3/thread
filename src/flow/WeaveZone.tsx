import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';

interface WeaveZoneProps {
  monthLabel: string; // "July 2026"
  daysInMonth: number;
  sealedDays: Set<number>; // day-of-month, 1-based
  todayDay: number;
}

/**
 * §04 zone 4 — the month as woven cloth. Missed days are gaps, not
 * damage: no fire icons, no loss-aversion copy (§01, §02). This is a
 * plain grid for W3; the streak-count question is Experiment 3 and
 * is deliberately not decided here — the mirror shows no numbers by
 * default. Revealed on seal; the knot (W5) will make it reachable
 * any time.
 */
export function WeaveZone({ monthLabel, daysInMonth, sealedDays, todayDay }: WeaveZoneProps) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View style={styles.zone}>
      <Text style={styles.month}>{monthLabel}</Text>
      <View style={styles.grid}>
        {days.map((d) => (
          <View
            key={d}
            style={[
              styles.cell,
              sealedDays.has(d) ? styles.cellSealed : styles.cellGap,
              d === todayDay && styles.cellToday,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const CELL = 14;
const GAP = 6;

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 20,
  },
  month: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  cellGap: {
    backgroundColor: tokens.color.ink15,
  },
  cellSealed: {
    backgroundColor: tokens.color.thread,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: tokens.color.ink,
  },
});
