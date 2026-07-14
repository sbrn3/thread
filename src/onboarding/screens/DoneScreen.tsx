import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bookName } from '../../text/canon';
import { tokens } from '../../ui/tokens';
import type { OnboardingDraft } from '../types';

interface DoneScreenProps {
  draft: OnboardingDraft;
  onFinish: () => void;
}

function formatHour(h: number | null): string {
  if (h === null) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

export function DoneScreen({ draft, onFinish }: DoneScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.step}>Ready</Text>
        <Text style={styles.title}>That&apos;s everything.</Text>

        <View style={styles.sentence}>
          <Text style={styles.sentenceText}>
            After <Text style={styles.blank}>{draft.anchor}</Text>,{'\n'}
            I read in <Text style={styles.blank}>{draft.place}</Text>.{'\n'}
            {draft.nudgeHour !== null ? (
              <>
                If I haven&apos;t by <Text style={styles.blank}>{formatHour(draft.nudgeHour)}</Text>, remind me.
              </>
            ) : (
              <Text style={styles.dim}>No reminder — the anchor does the work.</Text>
            )}
          </Text>
        </View>

        <Text style={styles.note}>
          <Text style={styles.noteBold}>{draft.book ? bookName(draft.book) : '—'}</Text>, then{' '}
          <Text style={styles.noteBold}>{draft.nextBook ? bookName(draft.nextBook) : '—'}</Text>. Nothing else to
          decide.
        </Text>
        <Text style={styles.note}>
          {draft.provider
            ? `Reading in ${draft.provider.toUpperCase()} — falls back to the offline text automatically if a chapter can't be fetched.`
            : 'Reading from the offline public-domain text — add a translation any time from the knot.'}
        </Text>
        <Text style={styles.note}>Tomorrow, after your anchor, open this and read. That&apos;s the whole thing.</Text>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={onFinish}>
          <Text style={styles.primaryLabel}>Start reading</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.paper },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 64, gap: 10 },
  step: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: tokens.color.thread,
    marginBottom: 8,
  },
  title: {
    fontFamily: tokens.font.display,
    fontWeight: '900',
    fontSize: 30,
    color: tokens.color.ink,
    marginBottom: 16,
  },
  sentence: {
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  sentenceText: { fontFamily: tokens.font.scripture, fontSize: 19, lineHeight: 29, color: tokens.color.ink },
  blank: { color: tokens.color.thread, fontWeight: '500' },
  dim: { color: tokens.color.ink40 },
  note: { fontFamily: tokens.font.display, fontSize: 13, lineHeight: 20, color: tokens.color.ink40 },
  noteBold: { color: tokens.color.ink, fontWeight: '700' },
  footer: { paddingHorizontal: 32, paddingBottom: 32, paddingTop: 12 },
  primaryBtn: { backgroundColor: tokens.color.ink, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryLabel: { fontFamily: tokens.font.display, fontWeight: '700', fontSize: 14, color: tokens.color.paper },
});
