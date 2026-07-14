import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { bundledChapterCount } from '../text';
import { CANON, type Book } from '../text/canon';
import { tokens } from './tokens';

interface BookPickerProps {
  /** Excluded from every list — e.g. the book already picked as current, so it can't be queued twice. */
  excludeId?: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  recommended?: string[];
}

const DEFAULT_RECOMMENDED = ['philippians', 'mark', 'james', 'psalms'];

function BookRow({ book, selected, onPress }: { book: Book; selected: boolean; onPress: () => void }) {
  const chapters = bundledChapterCount(book.id);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View>
        <Text style={styles.rowTitle}>{book.name}</Text>
        <Text style={styles.rowSub}>
          {chapters} {chapters === 1 ? 'chapter' : 'chapters'}
        </Text>
      </View>
      <View style={[styles.pick, selected && styles.pickSelected]} />
    </Pressable>
  );
}

/**
 * Shared book-selection UI (§05 onboarding screen 6, §04 the next-book
 * choice at book end) — a handful of common starting points plus
 * search across all 66. Self-selection matters (§02): recommendations
 * are a shortcut, never the only path.
 */
export function BookPicker({ excludeId, selected, onSelect, recommended = DEFAULT_RECOMMENDED }: BookPickerProps) {
  const [query, setQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);

  const pool = CANON.filter((b) => b.id !== excludeId);
  const filtered = query ? pool.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())) : pool;
  const recommendedBooks = recommended
    .map((id) => CANON.find((b) => b.id === id))
    .filter((b): b is Book => !!b && b.id !== excludeId);

  return (
    <View>
      <TextInput
        style={styles.search}
        placeholder="Search any of the 66 books…"
        placeholderTextColor={tokens.color.ink40}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {!query && recommendedBooks.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>A few common starting points</Text>
          {recommendedBooks.map((b) => (
            <BookRow key={b.id} book={b} selected={selected === b.id} onPress={() => onSelect(b.id)} />
          ))}
        </>
      )}

      <Pressable style={styles.browseToggle} onPress={() => setBrowseOpen((o) => !o)}>
        <Text style={styles.browseLabel}>Browse all 66 books</Text>
        <Text style={styles.browseArrow}>{browseOpen || query ? '↑' : '↓'}</Text>
      </Pressable>

      {(browseOpen || query) &&
        (filtered.length === 0 ? (
          <Text style={styles.noResults}>No book matches &quot;{query}&quot;.</Text>
        ) : (
          filtered.map((b) => <BookRow key={b.id} book={b} selected={selected === b.id} onPress={() => onSelect(b.id)} />)
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: tokens.font.display,
    fontSize: 14,
    color: tokens.color.ink,
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
    marginTop: 14,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
  },
  rowTitle: { fontFamily: tokens.font.display, fontWeight: '700', fontSize: 15, color: tokens.color.ink },
  rowSub: { fontFamily: tokens.font.display, fontSize: 11.5, color: tokens.color.ink40, marginTop: 2 },
  pick: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tokens.color.ink15,
  },
  pickSelected: { borderColor: tokens.color.thread, backgroundColor: tokens.color.thread },
  browseToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.ink15,
    marginTop: 4,
  },
  browseLabel: { fontFamily: tokens.font.display, fontWeight: '700', fontSize: 13.5, color: tokens.color.thread },
  browseArrow: { fontFamily: tokens.font.display, fontSize: 13.5, color: tokens.color.thread },
  noResults: {
    fontFamily: tokens.font.display,
    fontSize: 13,
    color: tokens.color.ink40,
    paddingVertical: 16,
  },
});
