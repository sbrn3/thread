import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Cue } from '../cue';
import type { LadderResponse, Signature } from '../lab/ladder';
import { BookPicker } from '../ui/BookPicker';
import { tokens } from '../ui/tokens';
import { CueEditor } from '../knot/CueEditor';

interface LapseZoneProps {
  response: LadderResponse;
  partnerName: string | null;
  cue: Cue | null;
  currentBookId: string;
  onSaveCue: (c: Cue) => void;
  onExitBook: (bookId: string) => void;
  onPause: () => void;
  onKeepNudging: () => void;
  onHandoff: () => void;
  onDismiss: () => void;
}

const ONE_QUESTION_COPY: Partial<Record<Signature, string>> = {
  cue_collapse: "You used to read at the same point in your day; lately it's drifted, or stopped. Has something changed?",
  book_fatigue: "This book's been a slog lately, even though reading was going fine before it. Permission to stop here — that's allowed.",
  dose_too_high: "You've been opening the app without finishing the reading. Today's ask just got smaller — no need to catch up.",
  life_disruption: "It's been quiet. No pressure — just checking in, once.",
  drift: 'A few days have slipped by. Nothing broken, just noting it.',
};

/**
 * §11/§12 — the lapse ladder's user-facing tiers (one_question,
 * offramp, dormant). Rendered ungated by sealedToday — unlike a
 * report, this exists precisely because today may not get sealed.
 * Silent tiers ('none', 'reduce_dose') and the mechanic_friction
 * route never reach this component (see lapse.ts).
 */
export function LapseZone({
  response,
  partnerName,
  cue,
  currentBookId,
  onSaveCue,
  onExitBook,
  onPause,
  onKeepNudging,
  onHandoff,
  onDismiss,
}: LapseZoneProps) {
  const [renegotiatingCue, setRenegotiatingCue] = useState(false);
  const [pickingBook, setPickingBook] = useState<string | null>(null);

  if (response.action === 'one_question') {
    if (response.route === 'cue_collapse') {
      return (
        <View style={styles.zone}>
          <Text style={styles.prompt}>{ONE_QUESTION_COPY.cue_collapse}</Text>
          {renegotiatingCue ? (
            <CueEditor
              cue={cue}
              onSave={(c) => {
                onSaveCue(c);
                onDismiss();
              }}
            />
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.primaryBtn} onPress={() => setRenegotiatingCue(true)}>
                <Text style={styles.primaryBtnLabel}>Update it</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
                <Text style={styles.secondaryBtnLabel}>Still the same</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }

    if (response.route === 'book_fatigue') {
      return (
        <View style={styles.zone}>
          <Text style={styles.prompt}>{ONE_QUESTION_COPY.book_fatigue}</Text>
          {pickingBook !== null ? (
            <View style={styles.pickerBlock}>
              <BookPicker excludeId={currentBookId} selected={pickingBook} onSelect={setPickingBook} />
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  onExitBook(pickingBook);
                  onDismiss();
                }}
              >
                <Text style={styles.primaryBtnLabel}>Switch now</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.primaryBtn} onPress={() => setPickingBook('')}>
                <Text style={styles.primaryBtnLabel}>Pick something else</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
                <Text style={styles.secondaryBtnLabel}>Keep going</Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.zone}>
        <Text style={styles.prompt}>{ONE_QUESTION_COPY[response.route] ?? ONE_QUESTION_COPY.drift}</Text>
        <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
          <Text style={styles.secondaryBtnLabel}>OK</Text>
        </Pressable>
      </View>
    );
  }

  if (response.action === 'offramp') {
    return (
      <View style={styles.zone}>
        <Text style={styles.prompt}>It&apos;s been a couple of weeks. What would help?</Text>
        <View style={styles.row}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              onPause();
              onDismiss();
            }}
          >
            <Text style={styles.secondaryBtnLabel}>Pause</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              onKeepNudging();
              onDismiss();
            }}
          >
            <Text style={styles.secondaryBtnLabel}>Keep nudging</Text>
          </Pressable>
          {response.options.includes('handoff') && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                onHandoff();
                onDismiss();
              }}
            >
              <Text style={styles.secondaryBtnLabel}>Talk to {partnerName}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (response.action !== 'dormant') return null; // 'none'/'reduce_dose' never reach this component — see lapse.ts

  return (
    <View style={styles.zone}>
      <Text style={styles.farewell}>
        I&apos;ll be here.
        {response.farewell === 'handoff' && partnerName
          ? ` If you want to talk to someone about it, ${partnerName} is one tap away.`
          : ''}
      </Text>
      <View style={styles.row}>
        {response.farewell === 'handoff' && (
          <Pressable style={styles.secondaryBtn} onPress={onHandoff}>
            <Text style={styles.secondaryBtnLabel}>Talk to {partnerName}</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryBtn} onPress={onDismiss}>
          <Text style={styles.secondaryBtnLabel}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
  },
  prompt: {
    fontFamily: tokens.font.scripture,
    fontSize: 17,
    lineHeight: 26,
    color: tokens.color.ink,
  },
  farewell: {
    fontFamily: tokens.font.scripture,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 28,
    color: tokens.color.ink,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pickerBlock: {
    gap: 12,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.paper,
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
  },
  secondaryBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.ink,
  },
});
