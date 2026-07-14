import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';

interface AnchorValidationProps {
  onResult: (validated: boolean) => void;
}

const QUESTIONS = ['Did this happen yesterday?', 'The day before?', 'The day before that?'];

/**
 * §05 — three taps, eight seconds. Catches the dominant onboarding
 * failure mode: an anchor that sounds concrete ("in the morning")
 * but isn't actually an event that happens every day. Fewer than 3/3
 * means the anchor isn't stable enough to hang a habit on; the user
 * can still keep it, but it's stored validated=false.
 */
export function AnchorValidation({ onResult }: AnchorValidationProps) {
  const [answers, setAnswers] = useState<Array<boolean | null>>([null, null, null]);

  const answer = (i: number, value: boolean) => {
    const next = [...answers];
    next[i] = value;
    setAnswers(next);
    if (next.every((a) => a !== null)) {
      onResult(next.every(Boolean));
    }
  };

  const allAnswered = answers.every((a) => a !== null);
  const score = answers.filter(Boolean).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Is this actually stable?</Text>
      {QUESTIONS.map((q, i) => (
        <View key={q} style={styles.row}>
          <Text style={styles.question}>{q}</Text>
          <View style={styles.yn}>
            <Pressable
              style={[styles.ynBtn, answers[i] === true && styles.ynBtnYes]}
              onPress={() => answer(i, true)}
            >
              <Text style={[styles.ynLabel, answers[i] === true && styles.ynLabelPicked]}>Yes</Text>
            </Pressable>
            <Pressable
              style={[styles.ynBtn, answers[i] === false && styles.ynBtnNo]}
              onPress={() => answer(i, false)}
            >
              <Text style={[styles.ynLabel, answers[i] === false && styles.ynLabelPicked]}>No</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {allAnswered && (
        <Text style={[styles.verdict, score === 3 ? styles.verdictPass : styles.verdictFail]}>
          {score === 3
            ? '✓ Stable. This is something that actually happens — good anchor.'
            : `✗ Only ${score} of 3. This doesn't happen reliably enough to hang a habit on — try something that happens every day.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  label: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.color.thread,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  question: {
    fontFamily: tokens.font.display,
    fontSize: 13.5,
    color: tokens.color.ink,
    flexShrink: 1,
  },
  yn: { flexDirection: 'row', gap: 6 },
  ynBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
    backgroundColor: '#fff',
  },
  ynBtnYes: { borderColor: tokens.color.thread, backgroundColor: tokens.color.thread },
  ynBtnNo: { borderColor: '#B4483C', backgroundColor: '#B4483C' },
  ynLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 11,
    color: tokens.color.ink40,
  },
  ynLabelPicked: { color: '#fff' },
  verdict: {
    marginTop: 8,
    fontFamily: tokens.font.display,
    fontSize: 13,
    lineHeight: 19,
  },
  verdictPass: { color: tokens.color.thread, fontWeight: '500' },
  verdictFail: { color: '#B4483C' },
});
