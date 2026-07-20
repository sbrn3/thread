import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SRBAI_QUESTIONS, type SrbaiAnswers } from '../lab/srbai';
import { tokens } from '../ui/tokens';

interface SrbaiZoneProps {
  eyeballDates: string[];
  onSave: (answers: SrbaiAnswers) => void;
}

const SCALE = [1, 2, 3, 4, 5];

function LikertRow({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={styles.likertRow}>
      {SCALE.map((n) => (
        <Pressable
          key={n}
          style={[styles.likertDot, value === n && styles.likertDotActive]}
          onPress={() => onChange(n)}
          accessibilityLabel={`${n} of 5`}
        >
          <Text style={[styles.likertLabel, value === n && styles.likertLabelActive]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * §09/§19 — once a month: the SRBAI-initiation questions, one line
 * of free reflection, and the plain eyeball list of dates the app
 * believes you read. ~30 seconds; the only signal in the app that's
 * just asked rather than inferred from logs.
 */
export function SrbaiZone({ eyeballDates, onSave }: SrbaiZoneProps) {
  const [answers, setAnswers] = useState<[number | null, number | null, number | null, number | null]>([
    null,
    null,
    null,
    null,
  ]);
  const [reflection, setReflection] = useState('');
  const [showEyeball, setShowEyeball] = useState(false);
  const [saved, setSaved] = useState(false);

  const canSave = answers.every((a) => a !== null);

  const setAnswer = (i: number, v: number) => {
    setAnswers((prev) => {
      const next = [...prev] as typeof prev;
      next[i] = v;
      return next;
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      q1: answers[0]!,
      q2: answers[1]!,
      q3: answers[2]!,
      q4: answers[3]!,
      reflection: reflection.trim(),
    });
    setSaved(true);
  };

  if (saved) {
    return (
      <View style={styles.zone}>
        <Text style={styles.done}>Thanks — see you next month.</Text>
      </View>
    );
  }

  return (
    <View style={styles.zone}>
      <Text style={styles.label}>Once a month · ~30 seconds</Text>
      {SRBAI_QUESTIONS.map((q, i) => (
        <View key={q} style={styles.question}>
          <Text style={styles.questionText}>{q}</Text>
          <LikertRow value={answers[i]} onChange={(v) => setAnswer(i, v)} />
        </View>
      ))}
      <Text style={styles.scaleHint}>1 = strongly disagree · 5 = strongly agree</Text>

      <TextInput
        style={styles.reflectionInput}
        value={reflection}
        onChangeText={setReflection}
        placeholder="One line — anything stayed with you this month?"
        placeholderTextColor={tokens.color.ink40}
        multiline
      />

      <Pressable onPress={() => setShowEyeball((v) => !v)}>
        <Text style={styles.eyeballToggle}>
          {showEyeball ? 'Hide' : 'Show'} the {eyeballDates.length} day{eyeballDates.length === 1 ? '' : 's'} it
          thinks you read this month
        </Text>
      </Pressable>
      {showEyeball && (
        <View style={styles.eyeballList}>
          {eyeballDates.length === 0 ? (
            <Text style={styles.eyeballDate}>Nothing this month.</Text>
          ) : (
            eyeballDates.map((d) => (
              <Text key={d} style={styles.eyeballDate}>
                {d}
              </Text>
            ))
          )}
        </View>
      )}

      <Pressable style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
        <Text style={styles.saveBtnLabel}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
  },
  label: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
  },
  question: { gap: 8 },
  questionText: {
    fontFamily: tokens.font.scripture,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.color.ink,
  },
  likertRow: { flexDirection: 'row', gap: 8 },
  likertDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likertDotActive: {
    backgroundColor: tokens.color.ink,
    borderColor: tokens.color.ink,
  },
  likertLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.color.ink,
  },
  likertLabelActive: {
    color: tokens.color.paper,
  },
  scaleHint: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    color: tokens.color.ink40,
  },
  reflectionInput: {
    fontFamily: tokens.font.scripture,
    fontSize: 15,
    color: tokens.color.ink,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
    borderRadius: 10,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  eyeballToggle: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.thread,
    textDecorationLine: 'underline',
  },
  eyeballList: {
    gap: 2,
  },
  eyeballDate: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink60,
  },
  saveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
  done: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
  },
});
