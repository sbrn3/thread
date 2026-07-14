import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { bundledChapterCount } from '../../text';
import { CANON, bookName, type Book } from '../../text/canon';
import { tokens } from '../../ui/tokens';
import { OnboardingScreen } from '../OnboardingScreen';

interface BooksScreenProps {
  onNext: (book: string, nextBook: string) => void;
}

const RECOMMENDED = ['philippians', 'mark', 'james', 'psalms'];

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

// §05 screen 6 — pick a current book, then (§04) the next one, so a
// finished book never becomes a decision point. Self-selection matters
// (§02) — recommendations are a shortcut, search across all 66 is the
// real path.
export function BooksScreen({ onNext }: BooksScreenProps) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [book, setBook] = useState<string | null>(null);
  const [nextBookId, setNextBookId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);

  const excludeId = phase === 2 ? book : null;
  const pool = CANON.filter((b) => b.id !== excludeId);
  const filtered = query ? pool.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())) : pool;

  const selected = phase === 1 ? book : nextBookId;
  const select = (id: string) => (phase === 1 ? setBook(id) : setNextBookId(id));

  const handlePrimary = () => {
    if (phase === 1) {
      setPhase(2);
      setQuery('');
      setBrowseOpen(false);
    } else if (book && nextBookId) {
      onNext(book, nextBookId);
    }
  };

  return (
    <OnboardingScreen
      step="5 of 6 · The books"
      title={phase === 1 ? 'Where do you want to start?' : 'And after that?'}
      sub={
        phase === 1
          ? 'One book at a time. No plan, no schedule.'
          : 'Choose it now, while you have momentum. The moment a book ends is the worst time to make a decision.'
      }
      primaryLabel="Next"
      primaryDisabled={!selected}
      onPrimary={handlePrimary}
    >
      <TextInput
        style={styles.search}
        placeholder="Search any of the 66 books…"
        placeholderTextColor={tokens.color.ink40}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {!query && phase === 1 && (
        <>
          <Text style={styles.sectionLabel}>A few common starting points</Text>
          {RECOMMENDED.map((id) => {
            const b = CANON.find((c) => c.id === id);
            if (!b) return null;
            return <BookRow key={id} book={b} selected={selected === id} onPress={() => select(id)} />;
          })}
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
          filtered.map((b) => <BookRow key={b.id} book={b} selected={selected === b.id} onPress={() => select(b.id)} />)
        ))}

      {phase === 2 && book && (
        <View style={styles.queue}>
          <Text style={styles.queueText}>
            Reading now: <Text style={styles.queueBold}>{bookName(book)}</Text>
          </Text>
        </View>
      )}
    </OnboardingScreen>
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
  queue: {
    backgroundColor: '#EEF0FF',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  queueText: { fontFamily: tokens.font.display, fontSize: 13, color: tokens.color.ink },
  queueBold: { color: tokens.color.thread, fontWeight: '700' },
});
