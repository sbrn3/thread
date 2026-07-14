import { StyleSheet, Text, View } from 'react-native';
import type { Verse } from '../text/provider';
import { tokens } from '../ui/tokens';

interface ScriptureZoneProps {
  verses: Verse[];
  attribution: string | null;
  onLayout?: (y: number, height: number) => void;
}

// §04 zone 2 — one paragraph per verse, no chrome. Tap-to-mark-candidate
// (§21) is a /src/memory concern that lands with the knot (W5); this
// zone renders read-only text for W3.
export function ScriptureZone({ verses, attribution, onLayout }: ScriptureZoneProps) {
  return (
    <View
      style={styles.zone}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      {verses.map((v) => (
        <Text key={v.verse} style={styles.paragraph}>
          <Text style={styles.verseNum}>{v.verse} </Text>
          {v.text}
        </Text>
      ))}
      {attribution ? <Text style={styles.attribution}>{attribution}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 18,
  },
  paragraph: {
    fontFamily: tokens.font.scripture,
    fontSize: 19,
    lineHeight: 30,
    color: tokens.color.ink,
  },
  verseNum: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
  },
  attribution: {
    marginTop: 24,
    fontFamily: tokens.font.mono,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.color.ink40,
  },
});
