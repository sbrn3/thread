import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bookName } from '../text/canon';
import type { Passage } from '../log/types';
import { tokens } from '../ui/tokens';

interface DismissalZoneProps {
  book: string;
  chapter: number;
  chapterCount: number;
  justFinishedBook: string | null;
  /** Unpromoted candidates from the just-finished book (§21) — offered once, at book end. */
  candidates: Passage[];
  onPromote: (id: number) => void;
}

function reference(book: string, p: Passage): string {
  const range = p.verse_start === p.verse_end ? `${p.verse_start}` : `${p.verse_start}-${p.verse_end}`;
  return `${bookName(book)} ${p.chapter}:${range}`;
}

// §04 zone 5 — deliberately terminal. Engagement is not the goal;
// the reading is, and it happens off-screen. Book-end promotion
// (§21, W5): of everything marked while reading this book, choose
// exactly one to carry forward into the Leitner schedule.
export function DismissalZone({
  book,
  chapter,
  chapterCount,
  justFinishedBook,
  candidates,
  onPromote,
}: DismissalZoneProps) {
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

      {justFinishedBook && candidates.length > 0 && (
        <View style={styles.promoteBlock}>
          <Text style={styles.promoteLabel}>Carry one passage forward to memorise?</Text>
          {candidates.map((p) => (
            <Pressable key={p.id} style={styles.candidateRow} onPress={() => onPromote(p.id)}>
              <Text style={styles.candidateText}>{reference(justFinishedBook, p)}</Text>
            </Pressable>
          ))}
        </View>
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
  promoteBlock: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  promoteLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  candidateRow: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
  },
  candidateText: {
    fontFamily: tokens.font.display,
    fontSize: 14,
    color: tokens.color.ink,
  },
  close: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 20,
    color: tokens.color.ink60,
  },
});
