import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bookName } from '../text/canon';
import { tokens } from '../ui/tokens';
import type { ProbeGrade } from '../lab/probe';

interface ProbeZoneProps {
  book: string;
  chapter: number;
  getChapterText: () => Promise<string>;
  onGrade: (grade: ProbeGrade) => void;
}

/**
 * §10/E9 — the next-day recall probe. Free recall on YESTERDAY's
 * chapter (distinct from RecallZone's Leitner passages), reveal, one
 * of four self-grades. Consequence-free, same guarantee as ordinary
 * recall: grading never touches seal, streak, weave, or dose.
 */
export function ProbeZone({ book, chapter, getChapterText, onGrade }: ProbeZoneProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [graded, setGraded] = useState(false);

  const reveal = async () => {
    setRevealed(await getChapterText());
  };

  const grade = (g: ProbeGrade) => {
    onGrade(g);
    setGraded(true);
  };

  if (graded) {
    return (
      <View style={styles.zone}>
        <Text style={styles.done}>Probe done for today.</Text>
      </View>
    );
  }

  return (
    <View style={styles.zone}>
      <Text style={styles.prompt}>
        Yesterday you read {bookName(book)} {chapter}. What do you remember?
      </Text>
      {revealed === null ? (
        <Pressable style={styles.revealBtn} onPress={() => void reveal()}>
          <Text style={styles.revealLabel}>Reveal</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.revealed} numberOfLines={6}>
            {revealed}
          </Text>
          <View style={styles.gradeRow}>
            <Pressable style={styles.gradeBtn} onPress={() => grade('held')}>
              <Text style={styles.gradeLabel}>Held it</Text>
            </Pressable>
            <Pressable style={styles.gradeBtn} onPress={() => grade('partial')}>
              <Text style={styles.gradeLabel}>Partly</Text>
            </Pressable>
            <Pressable style={styles.gradeBtn} onPress={() => grade('lost')}>
              <Text style={styles.gradeLabel}>Lost it</Text>
            </Pressable>
          </View>
        </>
      )}
      <Pressable style={styles.skipBtn} onPress={() => grade('skipped')} accessibilityLabel="Skip today's probe">
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
  prompt: {
    fontFamily: tokens.font.display,
    fontSize: 15,
    color: tokens.color.ink,
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
    fontSize: 17,
    lineHeight: 26,
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
