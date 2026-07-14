import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Verse } from '../text/provider';
import { tokens } from '../ui/tokens';

interface ScriptureZoneProps {
  verses: Verse[];
  attribution: string | null;
  onLayout?: (y: number, height: number) => void;
  /** Tap a verse to mark it as a memory candidate (§21). Omitted in read-only views (the knot's chapter strip). */
  onMarkVerse?: (verse: number) => void;
}

// §04 zone 2 — one paragraph per verse, no chrome. Tapping a verse
// marks it as a candidate for memorisation — a tap, no text stored
// (§21); drag-range marking is deferred past W5. Marks are ephemeral
// UI state here (reset whenever the verse set changes, i.e. a new
// chapter/sitting) — the durable record lives in /src/memory.
export function ScriptureZone({ verses, attribution, onLayout, onMarkVerse }: ScriptureZoneProps) {
  const [marked, setMarked] = useState<Set<number>>(new Set());

  useEffect(() => {
    setMarked(new Set());
  }, [verses]);

  const toggleMark = (v: number) => {
    if (!onMarkVerse) return;
    setMarked((prev) => new Set(prev).add(v));
    onMarkVerse(v);
  };

  return (
    <View
      style={styles.zone}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
    >
      {verses.map((v) => (
        <Pressable
          key={v.verse}
          onPress={onMarkVerse ? () => toggleMark(v.verse) : undefined}
          disabled={!onMarkVerse}
        >
          <Text style={[styles.paragraph, marked.has(v.verse) && styles.marked]}>
            <Text style={styles.verseNum}>{v.verse} </Text>
            {v.text}
          </Text>
        </Pressable>
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
  marked: {
    // A translucent wash of the app's one accent — not a new colour,
    // just the existing thread at low opacity (§04: one accent, no
    // gradients).
    backgroundColor: 'rgba(31, 63, 255, 0.08)',
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
