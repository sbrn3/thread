import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';

interface WeaveZoneProps {
  monthLabel: string; // "July 2026"
  daysInMonth: number;
  sealedDays: Set<number>; // day-of-month, 1-based
  todayDay: number;
  /** §14 E3, applied — 'visible' shows the count; omitted/null (the default) shows none, same as before this experiment concluded. */
  streak?: number | null;
}

/**
 * §04 zone 4 — the month as woven cloth. Missed days are gaps, not
 * damage: no fire icons, no loss-aversion copy (§01, §02). The mirror
 * shows no numbers by default — E3 governs whether a streak count
 * appears at all; `streak` is only ever passed once that experiment
 * has concluded and been Applied with the 'visible' arm.
 */
export function WeaveZone({ monthLabel, daysInMonth, sealedDays, todayDay, streak }: WeaveZoneProps) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View style={styles.zone}>
      <View style={styles.headerRow}>
        <Text style={styles.month}>{monthLabel}</Text>
        {streak != null && (
          <Text style={styles.streak}>
            {streak} day{streak === 1 ? '' : 's'}
          </Text>
        )}
      </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  month: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
  },
  streak: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    letterSpacing: 0.5,
    color: tokens.color.thread,
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
