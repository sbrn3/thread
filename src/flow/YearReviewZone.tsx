import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { YearReviewReport } from '../lab/analysis/yearReview';
import { tokens } from '../ui/tokens';

interface YearReviewZoneProps {
  report: YearReviewReport;
  onDismiss: () => void;
}

/**
 * §12 R6 "the year" (day 365) — did a habit form? Everything at
 * once, including that the app may no longer be needed. Shown
 * exactly once; the plain-language verdict is the point, the numbers
 * beneath it are how to check it against your own memory.
 */
export function YearReviewZone({ report, onDismiss }: YearReviewZoneProps) {
  return (
    <View style={styles.zone}>
      <Text style={styles.label}>One year</Text>
      <Text style={styles.verdict}>{report.verdict}</Text>

      <View style={styles.stats}>
        <Text style={styles.statLine}>
          Sealed {report.daysSealed} of {report.totalDays} days ({Math.round((report.daysSealed / Math.max(1, report.totalDays)) * 100)}%)
        </Text>
        <Text style={styles.statLine}>
          {report.hollowness.promoted} passage{report.hollowness.promoted === 1 ? '' : 's'} promoted ·{' '}
          {report.hollowness.held60} held 60+ days
        </Text>
        <Text style={styles.statLine}>
          Cue strength: {report.cueStrengthEarly !== null ? `${Math.round(report.cueStrengthEarly * 100)}%` : '—'} early
          {' → '}
          {report.cueStrengthRecent !== null ? `${Math.round(report.cueStrengthRecent * 100)}%` : '—'} recent
        </Text>
        <Text style={styles.statLine}>
          Recovered from {report.recovery.recoveredWithin7} of {report.recovery.episodes} lapse
          {report.recovery.episodes === 1 ? '' : 's'} within a week
        </Text>
      </View>

      {report.srbaiTrend.length > 0 && (
        <View style={styles.trend}>
          {report.srbaiTrend.map((p) => (
            <Text key={p.month} style={styles.trendLine}>
              {p.month}: {p.average.toFixed(1)}/5
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.dismissBtn} onPress={onDismiss}>
        <Text style={styles.dismissLabel}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 14,
    backgroundColor: '#EEF0FF',
  },
  label: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.color.thread,
  },
  verdict: {
    fontFamily: tokens.font.scripture,
    fontSize: 18,
    lineHeight: 27,
    color: tokens.color.ink,
  },
  stats: { gap: 4 },
  statLine: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.color.ink60,
  },
  trend: { gap: 2 },
  trendLine: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    color: tokens.color.ink40,
  },
  dismissBtn: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  dismissLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
});
