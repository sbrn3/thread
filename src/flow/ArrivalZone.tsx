import { StyleSheet, Text, View } from 'react-native';
import type { Cue } from '../cue';
import { bookName } from '../text/canon';
import { tokens } from '../ui/tokens';

interface ArrivalZoneProps {
  today: string; // 'YYYY-MM-DD'
  cue: Cue | null;
  book: string;
  chapter: number;
  sittingIndex: number;
  sittingsTotal: number;
  daysInBook: number;
}

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function ArrivalZone({
  today,
  cue,
  book,
  chapter,
  sittingIndex,
  sittingsTotal,
  daysInBook,
}: ArrivalZoneProps) {
  const chapterLabel =
    sittingsTotal > 1
      ? `${bookName(book)} ${chapter} · sitting ${sittingIndex + 1} of ${sittingsTotal}`
      : `${bookName(book)} ${chapter}`;

  return (
    <View style={styles.zone}>
      <Text style={styles.day}>{formatDay(today)}</Text>
      <Text style={styles.echo}>
        {cue ? `After ${cue.anchor}, in ${cue.place}.` : 'No cue set yet — read when it suits you.'}
      </Text>
      <Text style={styles.chapter}>{chapterLabel}</Text>
      <Text style={styles.progress}>
        Day {daysInBook} in {bookName(book)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    minHeight: 400,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  day: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
  },
  echo: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 28,
    color: tokens.color.ink60,
  },
  chapter: {
    fontFamily: tokens.font.display,
    fontWeight: '900',
    fontSize: 34,
    color: tokens.color.ink,
    marginTop: 16,
  },
  progress: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
  },
});
