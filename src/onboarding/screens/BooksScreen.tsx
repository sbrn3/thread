import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { bookName } from '../../text/canon';
import { tokens } from '../../ui/tokens';
import { BookPicker } from '../../ui/BookPicker';
import { OnboardingScreen } from '../OnboardingScreen';

interface BooksScreenProps {
  onNext: (book: string, nextBook: string) => void;
}

// §05 screen 6 — pick a current book, then (§04) the next one, so a
// finished book never becomes a decision point.
export function BooksScreen({ onNext }: BooksScreenProps) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [book, setBook] = useState<string | null>(null);
  const [nextBookId, setNextBookId] = useState<string | null>(null);

  const selected = phase === 1 ? book : nextBookId;
  const select = (id: string) => (phase === 1 ? setBook(id) : setNextBookId(id));

  const handlePrimary = () => {
    if (phase === 1) {
      setPhase(2);
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
      <BookPicker excludeId={phase === 2 ? book : null} selected={selected} onSelect={select} />

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
  queue: {
    backgroundColor: '#EEF0FF',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  queueText: { fontFamily: tokens.font.display, fontSize: 13, color: tokens.color.ink },
  queueBold: { color: tokens.color.thread, fontWeight: '700' },
});
