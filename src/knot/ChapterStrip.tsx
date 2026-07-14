import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { bookName } from '../text/canon';
import { tokens } from '../ui/tokens';

export interface ChapterEntry {
  book: string;
  chapter: number;
  sitting: number | null;
  local_date: string;
}

interface ChapterStripProps {
  entries: ChapterEntry[];
  onSelect: (entry: ChapterEntry) => void;
}

// §04 — the chapter strip: revisiting anything already read, any
// time. Gating your own data behind the daily ritual would be
// user-hostile.
export function ChapterStrip({ entries, onSelect }: ChapterStripProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyLabel}>Nothing sealed yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(e, i) => `${e.local_date}-${i}`}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => onSelect(item)}>
          <Text style={styles.rowTitle}>
            {bookName(item.book)} {item.chapter}
            {item.sitting != null && item.sitting > 0 ? ` · sitting ${item.sitting + 1}` : ''}
          </Text>
          <Text style={styles.rowDate}>{item.local_date}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 12 },
  emptyLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink40,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
  },
  rowTitle: {
    fontFamily: tokens.font.display,
    fontSize: 14,
    color: tokens.color.ink,
  },
  rowDate: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    color: tokens.color.ink40,
  },
});
