import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Grade, Passage } from '../log/types';
import { bookName } from '../text/canon';
import { tokens } from '../ui/tokens';

interface RecallZoneProps {
  passages: Passage[]; // already capped at DAILY_RECALL_CAP by the caller
  getVerseText: (p: Passage) => Promise<string>;
  onGrade: (id: number, grade: Grade) => void;
  onSkip: () => void;
}

function reference(p: Passage): string {
  const range = p.verse_start === p.verse_end ? `${p.verse_start}` : `${p.verse_start}-${p.verse_end}`;
  return `${bookName(p.book)} ${p.chapter}:${range}`;
}

/**
 * §04 zone 1b / §21 — up to 2 memory passages. Reference shown; you
 * recall, reveal, self-grade. Skippable in one tap; a failed recall
 * (grading "lost") is consequence-free — Memory.grade() has no
 * import capable of touching seal, streak, weave, or dose (§13.6).
 * The caller doesn't render this zone at all when nothing is due —
 * there is deliberately no empty state.
 */
export function RecallZone({ passages, getVerseText, onGrade, onSkip }: RecallZoneProps) {
  const [revealedText, setRevealedText] = useState<Record<number, string>>({});
  const [done, setDone] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState(false);

  const remaining = passages.filter((p) => !done.has(p.id));

  const reveal = async (p: Passage) => {
    const text = await getVerseText(p);
    setRevealedText((prev) => ({ ...prev, [p.id]: text }));
  };

  const grade = (p: Passage, g: Grade) => {
    onGrade(p.id, g);
    setDone((prev) => new Set(prev).add(p.id));
  };

  const skipAll = () => {
    onSkip();
    setSkipped(true);
  };

  if (skipped || remaining.length === 0) {
    return (
      <View style={styles.zone}>
        <Text style={styles.done}>Recall done for today.</Text>
      </View>
    );
  }

  return (
    <View style={styles.zone}>
      {remaining.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.reference}>{reference(p)}</Text>
          {revealedText[p.id] === undefined ? (
            <Pressable style={styles.revealBtn} onPress={() => void reveal(p)}>
              <Text style={styles.revealLabel}>Reveal</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.revealed}>{revealedText[p.id]}</Text>
              <View style={styles.gradeRow}>
                <Pressable style={styles.gradeBtn} onPress={() => grade(p, 'held')}>
                  <Text style={styles.gradeLabel}>Held it</Text>
                </Pressable>
                <Pressable style={styles.gradeBtn} onPress={() => grade(p, 'partial')}>
                  <Text style={styles.gradeLabel}>Partly</Text>
                </Pressable>
                <Pressable style={styles.gradeBtn} onPress={() => grade(p, 'lost')}>
                  <Text style={styles.gradeLabel}>Lost it</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ))}
      <Pressable style={styles.skipBtn} onPress={skipAll} accessibilityLabel="Skip recall for today">
        <Text style={styles.skipLabel}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 16,
  },
  card: {
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
  },
  reference: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    letterSpacing: 0.5,
    color: tokens.color.ink40,
  },
  revealBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink,
  },
  revealLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.ink,
  },
  revealed: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 27,
    color: tokens.color.ink,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gradeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: tokens.color.ink15,
  },
  gradeLabel: {
    fontFamily: tokens.font.display,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.color.ink,
  },
  skipBtn: {
    alignSelf: 'flex-start',
  },
  skipLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
    textDecorationLine: 'underline',
  },
  done: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
  },
});
