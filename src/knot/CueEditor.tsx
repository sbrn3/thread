import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Cue } from '../cue';
import { tokens } from '../ui/tokens';

interface CueEditorProps {
  cue: Cue | null;
  onSave: (cue: Cue) => void;
}

const DEFAULT_CUE: Cue = {
  anchor: 'my morning coffee',
  place: 'the armchair by the window',
  nudgeHour: 21,
  validated: false,
};

function formatHour(h: number | null): string {
  if (h === null) return 'no reminder';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

/**
 * §04 — the most important screen in the app. Rendered as a
 * fill-in-the-blank sentence, not a settings form. Anchor (event) +
 * place (context) + nudge hour (safety net) — Gollwitzer's if-then
 * format, literally. The standing warning is load-bearing: changing
 * the cue often weakens it, since sameness is the active ingredient.
 */
export function CueEditor({ cue, onSave }: CueEditorProps) {
  const current = cue ?? DEFAULT_CUE;
  const [editing, setEditing] = useState<'anchor' | 'place' | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (field: 'anchor' | 'place') => {
    setDraft(current[field]);
    setEditing(field);
  };

  const commitEdit = () => {
    if (editing) {
      const value = draft.trim() || current[editing];
      // Editing the anchor via the knot doesn't re-run the 3-question
      // validation (that lives in onboarding) — so a changed anchor's
      // validated flag reverts to false rather than carrying forward
      // a verdict about text that no longer exists.
      const validated = editing === 'anchor' && value !== current.anchor ? false : current.validated;
      onSave({ ...current, [editing]: value, validated });
    }
    setEditing(null);
  };

  const adjustHour = (delta: number) => {
    const base = current.nudgeHour ?? 21;
    onSave({ ...current, nudgeHour: (base + delta + 24) % 24 });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.warning}>
        Changing your cue often weakens it — sameness is what builds the habit.
      </Text>

      <Text style={styles.sentence}>
        After{' '}
        {editing === 'anchor' ? (
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            autoFocus
          />
        ) : (
          <Text style={styles.blank} onPress={() => startEdit('anchor')}>
            {current.anchor}
          </Text>
        )}
        {',\n'}I read in{' '}
        {editing === 'place' ? (
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            autoFocus
          />
        ) : (
          <Text style={styles.blank} onPress={() => startEdit('place')}>
            {current.place}
          </Text>
        )}
        {".\n"}If I haven't by <Text style={styles.blank}>{formatHour(current.nudgeHour)}</Text>, remind me.
      </Text>

      <View style={styles.stepper}>
        <Pressable onPress={() => adjustHour(-1)} style={styles.stepBtn} accessibilityLabel="Move nudge hour earlier">
          <Text style={styles.stepLabel}>− 1h</Text>
        </Pressable>
        <Pressable onPress={() => adjustHour(1)} style={styles.stepBtn} accessibilityLabel="Move nudge hour later">
          <Text style={styles.stepLabel}>+ 1h</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  warning: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.color.ink40,
  },
  sentence: {
    fontFamily: tokens.font.scripture,
    fontSize: 19,
    lineHeight: 30,
    color: tokens.color.ink,
  },
  blank: {
    color: tokens.color.thread,
    textDecorationLine: 'underline',
  },
  input: {
    fontFamily: tokens.font.scripture,
    fontSize: 19,
    color: tokens.color.thread,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.thread,
    minWidth: 120,
    padding: 0,
  },
  stepper: {
    flexDirection: 'row',
    gap: 12,
  },
  stepBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
  },
  stepLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.color.ink,
  },
});
