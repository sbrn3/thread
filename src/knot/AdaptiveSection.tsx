import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { computeBucket, computeContext, describePolicy, isAdaptiveActive } from '../lab/bandit';
import type { SqlDb } from '../log/db';
import { getProfile, setProfile } from '../lab/profile';
import { tokens } from '../ui/tokens';

interface AdaptiveSectionProps {
  db: SqlDb;
  today: string;
}

/**
 * §18 "Full auditability. The knot always shows the current policy
 * in plain language... One-tap freeze, always. An optimiser you
 * cannot switch off is not a tool." Ships dormant — most of this
 * section's life is spent saying so, until day 366.
 */
export function AdaptiveSection({ db, today }: AdaptiveSectionProps) {
  const [frozen, setFrozen] = useState(() => getProfile(db, 'adaptive_frozen') === '1');

  const active = isAdaptiveActive(db, today);

  const handleToggleFreeze = () => {
    const next = !frozen;
    setProfile(db, 'adaptive_frozen', next ? '1' : '0');
    setFrozen(next);
  };

  if (!active) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>
          {frozen
            ? 'Frozen — will not activate even once eligible.'
            : "Not active yet. It only starts learning once you've been through a full year, and never touches which day you read or how much — only whether and when it nudges."}
        </Text>
        {!frozen && (
          <Pressable style={styles.freezeBtn} onPress={handleToggleFreeze}>
            <Text style={styles.freezeBtnLabel}>Freeze it now</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const ctx = computeContext(db, today);
  const bucket = computeBucket(ctx.daysSinceRead, ctx.nudgeRecencyDays);
  const policy = describePolicy(db, bucket);

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>{policy}</Text>
      <Pressable style={styles.freezeBtn} onPress={handleToggleFreeze}>
        <Text style={styles.freezeBtnLabel}>{frozen ? 'Unfreeze' : 'Freeze'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.color.ink60,
  },
  freezeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.ink15,
  },
  freezeBtnLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.ink,
  },
});
