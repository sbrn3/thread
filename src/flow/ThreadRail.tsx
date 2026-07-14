import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { tokens } from '../ui/tokens';

// §04 — the thread rail on the left edge tracks scroll position;
// reading progress IS the scroll. Must run on the UI thread via a
// worklet, or it stutters during scroll and the concept dies (§05).

interface ThreadRailProps {
  scrollY: SharedValue<number>;
  contentHeight: SharedValue<number>;
  layoutHeight: SharedValue<number>;
  reducedMotion: boolean;
}

export function ThreadRail({ scrollY, contentHeight, layoutHeight, reducedMotion }: ThreadRailProps) {
  const { height: windowHeight } = useWindowDimensions();

  const fillStyle = useAnimatedStyle(() => {
    const scrollable = Math.max(1, contentHeight.value - layoutHeight.value);
    const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, scrollY.value / scrollable));
    return { height: `${progress * 100}%` };
  });

  return (
    <View style={[styles.rail, { height: windowHeight }]} pointerEvents="none">
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 3,
    backgroundColor: tokens.color.ink15,
    zIndex: 100,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    backgroundColor: tokens.color.thread,
  },
});
