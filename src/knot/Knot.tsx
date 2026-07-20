import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Cue } from '../cue';
import { WeaveZone } from '../flow/WeaveZone';
import { ScriptureZone } from '../flow/ScriptureZone';
import { getAmendmentLog } from '../lab/analysis/amendments';
import { buildDiagnostics } from '../lab/diagnostics';
import { getProfile } from '../lab/profile';
import { computeStreak, meta } from '../log/log';
import { logicalToday } from '../log/time';
import type { Services } from '../services';
import { bookName } from '../text/canon';
import type { Verse } from '../text/provider';
import { tokens } from '../ui/tokens';
import { AdaptiveSection } from './AdaptiveSection';
import { BackupSection } from './BackupSection';
import { ChapterStrip, type ChapterEntry } from './ChapterStrip';
import { CueEditor } from './CueEditor';
import { DiagnosticsSection } from './DiagnosticsSection';
import { PartnerSection } from './PartnerSection';

interface KnotProps {
  services: Services;
}

/**
 * §04 — the knot: the app's sole persistent control, present on
 * every screen. One sheet: the weave (viewable any time, not gated
 * behind sealing), a chapter strip for revisiting anything already
 * read, and the cue editor. The only concession to non-linear use.
 */
export function Knot({ services }: KnotProps) {
  const { db, log, text, cue, backup, partner } = services;
  const today = useRef(logicalToday()).current;

  const [open, setOpen] = useState(false);
  const [cueState, setCueState] = useState<Cue | null>(() => cue.current());
  const [viewing, setViewing] = useState<{ entry: ChapterEntry; verses: Verse[] } | null>(null);
  const [paused, setPaused] = useState(() => meta.get(db, 'paused') === '1');

  const monthGrid = useMemo(() => {
    if (!open) return { sealedDays: new Set<number>(), daysInMonth: 31 };
    const [y, m] = today.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const days = log.daysBetween(monthStart, today);
    return {
      sealedDays: new Set(
        days.filter((d) => d.sealed === 1).map((d) => Number(d.local_date.slice(8, 10))),
      ),
      daysInMonth,
    };
  }, [open, log, today]);

  const chapterEntries: ChapterEntry[] = useMemo(() => {
    if (!open) return [];
    return db.all<ChapterEntry>(
      `SELECT local_date, book, chapter, sitting FROM days
       WHERE sealed = 1 AND book IS NOT NULL ORDER BY local_date DESC LIMIT 100`,
    );
  }, [open, db]);

  const handleSelect = useCallback(
    async (entry: ChapterEntry) => {
      log.write({ type: 'knot_open' });
      const verses = await text.getChapter(entry.book, entry.chapter);
      setViewing({ entry, verses });
    },
    [log, text],
  );

  const handleCueSave = useCallback(
    (next: Cue) => {
      cue.set(next);
      setCueState(next);
    },
    [cue],
  );

  const handleOpen = () => {
    log.write({ type: 'knot_open' });
    setOpen(true);
  };

  const handleResume = () => {
    meta.set(db, 'paused', '0');
    setPaused(false);
  };

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Open the knot: weave, past chapters, and cue"
      >
        <View style={styles.knotDot} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.sheet}>
            <Pressable style={styles.closeRow} onPress={() => setOpen(false)}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              {paused && (
                <View style={styles.pausedBanner}>
                  <Text style={styles.pausedText}>Notifications are paused.</Text>
                  <Pressable onPress={handleResume}>
                    <Text style={styles.resumeLabel}>Resume</Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.sectionLabel}>The weave</Text>
              <WeaveZone
                monthLabel={new Date(`${today}T12:00:00Z`).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
                daysInMonth={monthGrid.daysInMonth}
                sealedDays={monthGrid.sealedDays}
                todayDay={Number(today.slice(8, 10))}
                streak={getProfile(db, 'streakVisible') === '1' ? computeStreak(db, today) : null}
              />

              <Text style={styles.sectionLabel}>Chapters read</Text>
              <ChapterStrip entries={chapterEntries} onSelect={handleSelect} />

              <Text style={styles.sectionLabel}>The cue</Text>
              <CueEditor cue={cueState} onSave={handleCueSave} />

              <Text style={styles.sectionLabel}>Partner</Text>
              <PartnerSection partner={partner} />

              <Text style={styles.sectionLabel}>Backup</Text>
              <BackupSection backup={backup} />

              <Text style={styles.sectionLabel}>Adaptive policy</Text>
              <AdaptiveSection db={db} today={today} />

              <Text style={styles.sectionLabel}>Support</Text>
              <DiagnosticsSection diagnosticsText={buildDiagnostics(db)} amendments={getAmendmentLog(db)} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={viewing !== null} animationType="slide" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewerWrap}>
          <Pressable style={styles.closeRow} onPress={() => setViewing(null)}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          {viewing && (
            <ScrollView>
              <Text style={styles.viewerTitle}>
                {bookName(viewing.entry.book)} {viewing.entry.chapter}
              </Text>
              <ScriptureZone verses={viewing.verses} attribution={text.attribution()} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  knotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.color.thread,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 22, 26, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.color.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 12,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  closeRow: {
    alignSelf: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  close: {
    fontFamily: tokens.font.mono,
    fontSize: 13,
    color: tokens.color.ink40,
  },
  pausedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.color.ink15,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pausedText: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    color: tokens.color.ink60,
  },
  resumeLabel: {
    fontFamily: tokens.font.display,
    fontWeight: '700',
    fontSize: 13,
    color: tokens.color.thread,
  },
  sectionLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: tokens.color.ink40,
    marginTop: 20,
    marginBottom: 4,
  },
  viewerWrap: {
    flex: 1,
    backgroundColor: tokens.color.paper,
    paddingTop: 56,
  },
  viewerTitle: {
    fontFamily: tokens.font.display,
    fontWeight: '900',
    fontSize: 28,
    color: tokens.color.ink,
    paddingHorizontal: 32,
  },
});
