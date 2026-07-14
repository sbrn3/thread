import { StyleSheet, Text, View } from 'react-native';
import { bookName } from '../text/canon';
import { tokens } from '../ui/tokens';

interface DismissalZoneProps {
  book: string;
  chapter: number;
  chapterCount: number;
  justFinishedBook: string | null;
}

// §04 zone 5 — deliberately terminal. Engagement is not the goal;
// the reading is, and it happens off-screen.
export function DismissalZone({ book, chapter, chapterCount, justFinishedBook }: DismissalZoneProps) {
  const pct = chapterCount > 0 ? Math.round((chapter / chapterCount) * 100) : 0;

  return (
    <View style={styles.zone}>
      {justFinishedBook ? (
        <Text style={styles.finished}>You finished {bookName(justFinishedBook)}.</Text>
      ) : (
        <Text style={styles.progress}>
          {bookName(book)} · {pct}% through
        </Text>
      )}
      <Text style={styles.close}>Now close the app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 16,
  },
  progress: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.color.ink40,
  },
  finished: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 18,
    color: tokens.color.thread,
    textAlign: 'center',
  },
  close: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 20,
    color: tokens.color.ink60,
  },
});
