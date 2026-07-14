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
import { bundledChapterCount } from '../text';
import { ArrivalZone } from './ArrivalZone';
import { ScriptureZone } from './ScriptureZone';
import { SealZone } from './SealZone';
import { WeaveZone } from './WeaveZone';
import { DismissalZone } from './DismissalZone';
import { ThreadRail } from './ThreadRail';

interface FlowProps {
  services: Services;
}

// §04 — one flow, no navigation: Arrival → Scripture → Seal → Weave →
// Dismissal, one continuous scroll. Weave + Dismissal are gated
// behind sealing until W5 makes the weave reachable any time via the
// knot. Recall (zone 1b, W6a) is omitted entirely for now.
export function Flow({ services }: FlowProps) {
  const { db, log, text } = services;
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
        <ScriptureZone
          verses={session.sittings[session.sittingIndex] ?? []}
          attribution={session.attribution}
          onLayout={(y, height) => {
            scriptureTop.value = y;
            scriptureBottom.value = y + height;
          }}
        />
        <SealZone sealed={session.sealedToday} onSeal={handleSeal} />
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
