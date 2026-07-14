import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Passage } from '../log/types';
import { bookName } from '../text/canon';
import { BookPicker } from '../ui/BookPicker';
import { tokens } from '../ui/tokens';

interface DismissalZoneProps {
  book: string;
  chapter: number;
  chapterCount: number;
  justFinishedBook: string | null;
  /** Unpromoted candidates from the just-finished book (§21) — offered once, at book end. */
  candidates: Passage[];
  onPromote: (id: number) => void;
  /** True whenever the next-book queue is empty (§04) — persists across days until picked, not gated by justFinishedBook. */
  needsNextBookPick: boolean;
  onPickNextBook: (bookId: string) => void;
}

function reference(book: string, p: Passage): string {
  const range = p.verse_start === p.verse_end ? `${p.verse_start}` : `${p.verse_start}-${p.verse_end}`;
  return `${bookName(book)} ${p.chapter}:${range}`;
}

// §04 zone 5 — deliberately terminal. Engagement is not the goal;
// the reading is, and it happens off-screen. Book-end promotion
// (§21, W5): of everything marked while reading this book, choose
// exactly one to carry forward into the Leitner schedule. The
// next-book queue (§04) is refilled by the user here, never
// auto-picked — a finished book must not become a decision point,
// but it also must not become the app's decision instead of yours.
export function DismissalZone({
  book,
  chapter,
  chapterCount,
  justFinishedBook,
  candidates,
  onPromote,
  needsNextBookPick,
  onPickNextBook,
}: DismissalZoneProps) {
  const [pending, setPending] = useState<string | null>(null);
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

      {needsNextBookPick && (
        <View style={styles.queueBlock}>
          <Text style={styles.promoteLabel}>What&apos;s next, after {bookName(book)}?</Text>
          <BookPicker excludeId={book} selected={pending} onSelect={setPending} />
          {pending && (
            <Pressable style={styles.queueBtn} onPress={() => onPickNextBook(pending)}>
              <Text style={styles.queueBtnLabel}>Queue {bookName(pending)}</Text>
            </Pressable>
          )}
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
  queueBlock: {
    width: '100%',
    gap: 8,
  },
  queueBtn: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  queueBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
  close: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 20,
    color: tokens.color.ink60,
  },
});
