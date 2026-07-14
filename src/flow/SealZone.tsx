import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../ui/tokens';

interface SealZoneProps {
  sealed: boolean;
  onSeal: () => void;
}

/**
 * PLACEHOLDER for W4. The real seal is a ~1.2s press-and-hold with an
 * SVG ring and haptic ramp, composed with the scroll view via
 * Gesture.Simultaneous so it neither steals the scroll nor cancels on
 * 1px of drift (§05 — budgeted a full day, the highest-risk code in
 * the app). This zone exists now so the flow has all five zones and
 * so sealing writes a real `seal` event and unlocks Weave/Dismissal;
 * it is a plain tap, not the ritual, until W4 replaces it.
 */
export function SealZone({ sealed, onSeal }: SealZoneProps) {
  return (
    <View style={styles.zone}>
      {sealed ? (
        <Text style={styles.sealedLabel}>Sealed</Text>
      ) : (
        <Pressable
          onPress={onSeal}
          style={({ pressed }) => [styles.ring, pressed && styles.ringPressed]}
          accessibilityRole="button"
          accessibilityLabel="Seal today's reading"
        >
          <Text style={styles.ringLabel}>Seal</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
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
