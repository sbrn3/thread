// §04 — one flow, no navigation. Five zones, one scroll:
//   1  Arrival    day, cue echo, book + chapter          (W3)
//   1b Recall     only if due; absent otherwise          (W6a)
//   2  Scripture  one paragraph per verse, no chrome     (W3)
//   3  Seal       press-and-hold ring, haptic ramp       (W4)
//   4  Weave      the month as woven cloth               (W4)
//   5  Dismissal  book progress, "now close the app"     (W3)
//
// The thread rail maps to SCROLL POSITION, never a fixed verse count.
// Reanimated worklets only — a JS-thread animation stutters during
// scroll and the whole concept dies (§05).

export {};
