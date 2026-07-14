import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import type { Services } from '../services';
import { useSession } from '../state/session';
import { logicalToday } from '../log/time';
import type { Grade, Passage } from '../log/types';
import { DAILY_RECALL_CAP } from '../memory/leitner';
import { bundledChapterCount } from '../text';
import { ArrivalZone } from './ArrivalZone';
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
  const { db, log, text, memory } = services;
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

  const logReadingStart = useCallback(() => {
    if (readingStartLogged.current) return;
    readingStartLogged.current = true;
    log.write({ type: 'reading_start', book: session.book, chapter: session.chapter, sitting: session.sittingIndex });
  }, [log, session.book, session.chapter, session.sittingIndex]);

  const logScrollEnd = useCallback(
    (scrollPct: number) => {
      if (scrollEndLogged.current) return;
      scrollEndLogged.current = true;
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
      refreshMonthGrid();
    });
  }, [session, db, log, text, today, refreshMonthGrid, readingStartFired, scrollEndFired]);

  const handleHoldCancel = useCallback(() => {
    log.write({ type: 'hold_cancel', book: session.book, chapter: session.chapter, sitting: session.sittingIndex });
  }, [log, session.book, session.chapter, session.sittingIndex]);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [candidates, setCandidates] = useState<Passage[]>([]);

  useEffect(() => {
    setCandidates(session.justFinishedBook ? memory.candidates(session.justFinishedBook) : []);
  }, [session.justFinishedBook, memory]);

  const handleMarkVerse = useCallback(
    (verse: number) => {
      memory.markCandidate({ book: session.book, chapter: session.chapter, verseStart: verse, verseEnd: verse });
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

  if (session.loading) return null;

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
            />
            <DismissalZone
              book={session.book}
              chapter={session.chapter}
              chapterCount={bundledChapterCount(session.book)}
              justFinishedBook={session.justFinishedBook}
              candidates={candidates}
              onPromote={handlePromote}
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
