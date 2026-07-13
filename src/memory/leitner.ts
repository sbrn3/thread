import type { Grade, Passage } from '../log/types';
import { addDays } from '../log/time';

// §21 — deliberately not Anki. Five boxes, fixed intervals.
export const INTERVALS = [1, 3, 7, 21, 60] as const; // days by box

// HARD RULE (§21): reschedule/grade has NO side effects outside this
// module. It cannot touch seal, streak, weave, or dose. There is no
// import from /src/lab or the seal/dose stores — the absence of the
// import is the guarantee, and a test enforces it.
export function reschedule(p: Passage, g: Grade, today: string): Passage {
  const box = g === 'held' ? Math.min(p.box + 1, 5) : g === 'partial' ? p.box : 1; // lost → back to the start
  return {
    ...p,
    box,
    last_grade: g,
    due_date: addDays(today, INTERVALS[box - 1]),
    held_since: box === 5 && p.box < 5 ? today : p.held_since,
  };
}

/** Caller caps at 2 due cards per day; the zone does not render when nothing is due. */
export const DAILY_RECALL_CAP = 2;
