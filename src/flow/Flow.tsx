import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { getPendingReport, markApplied, type PendingReport } from '../lab/analysis/report';
import { gradeProbe, resolveTodaysProbe, type DailyProbe, type ProbeGrade } from '../lab/probe';
import { getProfile } from '../lab/profile';
import { computeStreak, meta } from '../log/log';
import type { Services } from '../services';
import { useSession } from '../state/session';
import { logicalToday } from '../log/time';
import type { Grade, Passage } from '../log/types';
import { DAILY_RECALL_CAP } from '../memory/leitner';
import { bundledChapterCount } from '../text';
import { ArrivalZone } from './ArrivalZone';
import { ProbeZone } from './ProbeZone';
import { RecallZone } from './RecallZone';
import { ScriptureZone } from './ScriptureZone';
import { SealZone } from './SealZone';
import { WeaveZone } from './WeaveZone';
import { DismissalZone } from './DismissalZone';
import { ThreadRail } from './ThreadRail';

interface FlowProps {
  services: Services;
}

// §04 — one flow, no navigation: Arrival → Recall (if due) →
// Scripture → Seal → Weave → Dismissal, one continuous scroll. Weave
// is also reachable any time via the knot (W5), independent of
// today's seal.
export function Flow({ services }: FlowProps) {
  const { db, log, text, memory, notifier } = services;
  const session = useSession();
  const reducedMotion = useReducedMotion();

  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(1);
  const layoutHeight = useSharedValue(1);
  const scriptureTop = useSharedValue(0);
  const scriptureBottom = useSharedValue(0);
  const readingStartFired = useSharedValue(false);
  const scrollEndFired = useSharedValue(false);

  const [monthGrid, setMonthGrid] = useState<{ sealedDays: Set<number>; daysInMonth: number }>({
    sealedDays: new Set(),
    daysInMonth: 31,
  });

  const today = useRef(logicalToday()).current;
  const readingStartLogged = useRef(false);
  const scrollEndLogged = useRef(false);

  useEffect(() => {
    void session.load(db, log, text, today);
  }, [db, log, text, today]);

  const refreshMonthGrid = useCallback(() => {
    const [y, m] = today.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const days = log.daysBetween(monthStart, today);
    setMonthGrid({
      sealedDays: new Set(days.filter((d) => d.sealed === 1).map((d) => Number(d.local_date.slice(8, 10)))),
      daysInMonth,
    });
  }, [log, today]);

  useEffect(() => {
    if (session.sealedToday) refreshMonthGrid();
  }, [session.sealedToday, refreshMonthGrid]);

  // §15 — reports surface once, after a seal, never before or during
  // reading.
  const [pendingReport, setPendingReport] = useState<PendingReport | null>(null);
  useEffect(() => {
    if (session.sealedToday) setPendingReport(getPendingReport(db));
  }, [session.sealedToday, db]);

  const handleApplyReport = useCallback(
    (expId: string) => {
      markApplied(db, expId, true);
      setPendingReport(null);
    },
    [db],
  );
  const handleKeepReport = useCallback(
    (expId: string) => {
      markApplied(db, expId, false);
      setPendingReport(null);
    },
    [db],
  );

  useEffect(() => {
    if (session.loading) return;
    // Known simplification: runs once per app open against whatever
    // cue is active then. Editing the cue mid-session (via the knot)
    // doesn't retroactively reschedule notifications already planned
    // for future dates — they catch up on the next open.
    const currentCue = services.cue.current();
    if (currentCue) void notifier.syncWindow(currentCue, today);
  }, [session.loading, notifier, services.cue, today]);

  // §14 E4, applied — the completion floor. 'one_verse' only requires
  // reading to have started; the default 'full_chapter' requires
  // having scrolled to the bottom. Mirrors the worklet-side
  // readingStartFired/scrollEndFired shared values into plain React
  // state so SealZone (a JS-thread component) can read them.
  const [hasStartedReading, setHasStartedReading] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const logReadingStart = useCallback(() => {
    if (readingStartLogged.current) return;
    readingStartLogged.current = true;
    setHasStartedReading(true);
    log.write({ type: 'reading_start', book: session.book, chapter: session.chapter, sitting: session.sittingIndex });
  }, [log, session.book, session.chapter, session.sittingIndex]);

  const logScrollEnd = useCallback(
    (scrollPct: number) => {
      if (scrollEndLogged.current) return;
      scrollEndLogged.current = true;
      setHasReachedEnd(true);
      log.write({
        type: 'scroll_end',
        book: session.book,
        chapter: session.chapter,
        sitting: session.sittingIndex,
        scroll_pct: scrollPct,
      });
    },
    [log, session.book, session.chapter, session.sittingIndex],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;

    const viewportMid = event.contentOffset.y + layoutHeight.value / 2;
    if (!readingStartFired.value && viewportMid > scriptureTop.value) {
      readingStartFired.value = true;
      runOnJS(logReadingStart)();
    }

    const reachedBottom =
      scriptureBottom.value > 0 && event.contentOffset.y + layoutHeight.value >= scriptureBottom.value;
    if (!scrollEndFired.value && reachedBottom) {
      scrollEndFired.value = true;
      const scrollable = Math.max(1, contentHeight.value - layoutHeight.value);
      runOnJS(logScrollEnd)(Math.min(1, event.contentOffset.y / scrollable));
    }
  });

  const handleSeal = useCallback(() => {
    void session.seal(db, log, text, today).then(() => {
      // The session advances to a new sitting/chapter in place (no
      // remount) — rearm the once-per-reading log guards for it.
      readingStartLogged.current = false;
      scrollEndLogged.current = false;
      readingStartFired.value = false;
      scrollEndFired.value = false;
      setHasStartedReading(false);
      setHasReachedEnd(false);
      void notifier.cancelToday(today); // §08 — sealing silences the phone for the rest of the day
      refreshMonthGrid();
    });
  }, [session, db, log, text, today, refreshMonthGrid, readingStartFired, scrollEndFired, notifier]);

  const handleHoldCancel = useCallback(() => {
    log.write({ type: 'hold_cancel', book: session.book, chapter: session.chapter, sitting: session.sittingIndex });
  }, [log, session.book, session.chapter, session.sittingIndex]);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [candidates, setCandidates] = useState<Passage[]>([]);

  useEffect(() => {
    setCandidates(session.justFinishedBook ? memory.candidates(session.justFinishedBook) : []);
  }, [session.justFinishedBook, memory]);

  const handleMarkVerse = useCallback(
    (verse: number, marked: boolean) => {
      const ref = { book: session.book, chapter: session.chapter, verseStart: verse, verseEnd: verse };
      if (marked) memory.markCandidate(ref);
      else memory.unmarkCandidate(ref);
    },
    [memory, session.book, session.chapter],
  );

  const handlePromote = useCallback(
    (id: number) => {
      memory.promote(id, today);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
    },
    [memory, today],
  );

  const handlePickNextBook = useCallback(
    (bookId: string) => {
      session.pickNextBook(db, bookId);
    },
    [session, db],
  );

  // §04 zone 1b — only if due; the zone does not exist otherwise.
  const [dueToday, setDueToday] = useState<Passage[]>([]);
  const recallShownLogged = useRef(false);

  useEffect(() => {
    if (session.loading) return;
    const due = memory.due(today).slice(0, DAILY_RECALL_CAP);
    setDueToday(due);
    if (due.length > 0 && !recallShownLogged.current) {
      recallShownLogged.current = true;
      log.write({ type: 'recall_shown' });
    }
  }, [session.loading, memory, today, log]);

  const getVerseText = useCallback(
    async (p: Passage) => {
      const verses = await text.getChapter(p.book, p.chapter);
      return verses
        .filter((v) => v.verse >= p.verse_start && v.verse <= p.verse_end)
        .map((v) => v.text)
        .join(' ');
    },
    [text],
  );

  const handleGradeRecall = useCallback(
    (id: number, grade: Grade) => {
      memory.grade(id, grade, today);
    },
    [memory, today],
  );

  const handleSkipRecall = useCallback(() => {
    log.write({ type: 'recall_skipped' });
  }, [log]);

  // §10/E9 — the next-day recall probe. Decided (and persisted) once
  // per day; resolveTodaysProbe() is itself idempotent, so re-running
  // this effect never re-rolls it.
  const [probe, setProbe] = useState<DailyProbe | null>(null);
  const probeFiredLogged = useRef(false);

  useEffect(() => {
    if (session.loading) return;
    const trialSeed = meta.get(db, 'trial_seed') ?? 'thread-default-seed';
    const probeRate = Number(getProfile(db, 'probeRate') ?? '0.6'); // §14 E9, applied
    const todaysProbe = resolveTodaysProbe(db, today, trialSeed, probeRate);
    setProbe(todaysProbe);
    if (todaysProbe && !probeFiredLogged.current) {
      probeFiredLogged.current = true;
      log.write({ type: 'probe_fired', book: todaysProbe.book, chapter: todaysProbe.chapter });
    }
  }, [session.loading, db, today, log]);

  const getProbeChapterText = useCallback(async () => {
    if (!probe) return '';
    const verses = await text.getChapter(probe.book, probe.chapter);
    return verses.map((v) => v.text).join(' ');
  }, [text, probe]);

  const handleGradeProbe = useCallback(
    (grade: ProbeGrade) => {
      if (!probe) return;
      gradeProbe(db, today, grade);
      log.write({ type: 'probe_graded', book: probe.book, chapter: probe.chapter });
    },
    [db, today, log, probe],
  );

  if (session.loading) return null;

  // §14, applied settings — read fresh each render (a plain SQLite
  // read, same pattern as services.cue.current() below) so a report
  // Applied moments ago takes effect on the very next render.
  const sealMode = getProfile(db, 'seal') === 'tap' ? 'tap' : 'hold';
  const floor = getProfile(db, 'floor') === 'one_verse' ? 'one_verse' : 'full_chapter';
  const canSeal = floor === 'one_verse' ? hasStartedReading : hasReachedEnd;
  const streak = getProfile(db, 'streakVisible') === '1' && session.sealedToday ? computeStreak(db, today) : null;

  return (
    <View style={styles.container} onLayout={(e) => (layoutHeight.value = e.nativeEvent.layout.height)}>
      <ThreadRail
        scrollY={scrollY}
        contentHeight={contentHeight}
        layoutHeight={layoutHeight}
        reducedMotion={reducedMotion}
      />
      <Animated.ScrollView
        style={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        onContentSizeChange={(_, h) => (contentHeight.value = h)}
      >
        <ArrivalZone
          today={today}
          cue={services.cue.current()}
          book={session.book}
          chapter={session.chapter}
          sittingIndex={session.sittingIndex}
          sittingsTotal={session.sittings.length}
          daysInBook={session.daysInBook}
        />
        {dueToday.length > 0 && (
          <RecallZone
            passages={dueToday}
            getVerseText={getVerseText}
            onGrade={handleGradeRecall}
            onSkip={handleSkipRecall}
          />
        )}
        {probe && (
          <ProbeZone
            book={probe.book}
            chapter={probe.chapter}
            getChapterText={getProbeChapterText}
            onGrade={handleGradeProbe}
          />
        )}
        <ScriptureZone
          verses={session.sittings[session.sittingIndex] ?? []}
          attribution={session.attribution}
          onLayout={(y, height) => {
            scriptureTop.value = y;
            scriptureBottom.value = y + height;
          }}
          onMarkVerse={handleMarkVerse}
        />
        <SealZone
          sealed={session.sealedToday}
          reducedMotion={reducedMotion}
          onSeal={handleSeal}
          onHoldCancel={handleHoldCancel}
          onScrollLock={(locked) => setScrollEnabled(!locked)}
          sealMode={sealMode}
          canSeal={canSeal}
        />
        {session.sealedToday && (
          <>
            <WeaveZone
              monthLabel={new Date(`${today}T12:00:00Z`).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
              daysInMonth={monthGrid.daysInMonth}
              sealedDays={monthGrid.sealedDays}
              todayDay={Number(today.slice(8, 10))}
              streak={streak}
            />
            <DismissalZone
              book={session.book}
              chapter={session.chapter}
              chapterCount={bundledChapterCount(session.book)}
              justFinishedBook={session.justFinishedBook}
              candidates={candidates}
              onPromote={handlePromote}
              needsNextBookPick={session.nextBookNeeded}
              onPickNextBook={handlePickNextBook}
              pendingReport={pendingReport}
              onApplyReport={handleApplyReport}
              onKeepReport={handleKeepReport}
            />
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, paddingLeft: 12 },
});
