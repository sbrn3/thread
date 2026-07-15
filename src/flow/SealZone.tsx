import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { tokens } from '../ui/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RADIUS = 40;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PULSES = 6; // haptic pulses over the hold, evenly spaced
const UNWIND_MS = 220;

interface SealZoneProps {
  sealed: boolean;
  reducedMotion: boolean;
  onSeal: () => void;
  onHoldCancel: () => void;
  onScrollLock: (locked: boolean) => void;
  /** §14 E1, applied: 'tap' renders the fallback button unconditionally, independent of accessibility state. Defaults to 'hold'. */
  sealMode?: 'hold' | 'tap';
  /** §14 E4, applied — the completion floor: whether today's reading has met the bar to seal yet. Defaults to true (no gate) when omitted. */
  canSeal?: boolean;
}

/**
 * §05 / §13.4 — the highest-risk code in the app. A LongPress
 * (minDuration ~1.2s, maxDistance 20px so small drift doesn't cancel
 * it) composed with the scroll view via Gesture.Simultaneous so
 * neither steals the other. Scroll is disabled for the duration of
 * the hold (onScrollLock) rather than relying on gesture arbitration
 * alone. Release early → the ring unwinds and nothing is logged but
 * hold_cancel (§06 — the annoyance signal); holding the full duration
 * commits the seal.
 *
 * §04 accessibility floor: every gesture needs a tap fallback. A
 * screen reader flattens gesture-handler's press timing, so with one
 * active (or under reduced motion, where the ring wouldn't animate
 * anyway) this renders a plain button that seals immediately instead.
 */
export function SealZone({
  sealed,
  reducedMotion,
  onSeal,
  onHoldCancel,
  onScrollLock,
  sealMode = 'hold',
  canSeal = true,
}: SealZoneProps) {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const ringProgress = useSharedValue(0);
  const pulseTick = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => sub.remove();
  }, []);

  const triggerPulse = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const triggerSuccess = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSeal();
  };

  const hold = Gesture.LongPress()
    .minDuration(tokens.seal.holdMs)
    .maxDistance(tokens.seal.maxDriftPx)
    .enabled(canSeal)
    .onBegin(() => {
      runOnJS(onScrollLock)(true);
      ringProgress.value = withTiming(1, { duration: tokens.seal.holdMs, easing: Easing.linear });
      pulseTick.value = 0;
      pulseTick.value = withSequence(
        ...Array.from({ length: PULSES }, () =>
          withTiming(1, { duration: tokens.seal.holdMs / PULSES }, (finished) => {
            if (finished) runOnJS(triggerPulse)();
          }),
        ),
      );
    })
    .onFinalize((_event, success) => {
      runOnJS(onScrollLock)(false);
      cancelAnimation(pulseTick);
      if (success) {
        cancelAnimation(ringProgress);
        ringProgress.value = 1;
        runOnJS(triggerSuccess)();
      } else {
        cancelAnimation(ringProgress);
        ringProgress.value = withTiming(0, { duration: UNWIND_MS }); // release early → unwinds, nothing logged
        runOnJS(onHoldCancel)();
      }
    });

  const composed = Gesture.Simultaneous(hold, Gesture.Native());

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  if (sealed) {
    return (
      <View style={styles.zone}>
        <Text style={styles.sealedLabel}>Sealed</Text>
      </View>
    );
  }

  if (sealMode === 'tap' || screenReaderEnabled || reducedMotion) {
    return (
      <View style={styles.zone}>
        <Pressable
          onPress={onSeal}
          disabled={!canSeal}
          style={({ pressed }) => [
            styles.ringFallback,
            pressed && canSeal && styles.ringPressed,
            !canSeal && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Seal today's reading"
          accessibilityState={{ disabled: !canSeal }}
        >
          <Text style={styles.ringLabel}>Seal</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.zone, !canSeal && styles.disabled]}>
      <GestureDetector gesture={composed}>
        <View style={styles.ringWrap} accessible={false}>
          <Svg width={(RADIUS + STROKE) * 2} height={(RADIUS + STROKE) * 2}>
            <Circle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              stroke={tokens.color.ink15}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RADIUS + STROKE}
              cy={RADIUS + STROKE}
              r={RADIUS}
              stroke={tokens.color.thread}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={ringProps}
              strokeLinecap="round"
              rotation={-90}
              originX={RADIUS + STROKE}
              originY={RADIUS + STROKE}
            />
          </Svg>
          <Text style={styles.holdLabel}>Hold to seal</Text>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdLabel: {
    position: 'absolute',
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.ink,
  },
  ringFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: tokens.color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPressed: {
    borderColor: tokens.color.thread,
  },
  disabled: {
    opacity: 0.4,
  },
  ringLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 15,
    color: tokens.color.ink,
  },
  sealedLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.color.thread,
  },
});
