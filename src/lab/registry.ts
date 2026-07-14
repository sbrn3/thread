// §13 engine rule: "one reversal at a time" — persistent-state
// experiments run serially, never concurrently, so they can't
// contaminate each other. This is the serial queue for the
// experiments already wired end-to-end (E1 seal, E3 streak, E4 floor).
//
// E7 (frequency), E9 (probe), and E10 (dose titration) are in the
// revised plan's roadmap but are NOT in this queue yet — they need a
// verse-normalized dose model (verses_read/target_verses) this pass
// deliberately doesn't build. Adding them is a separate, dedicated
// pass, not an oversight.
export const REVERSAL_QUEUE = ['E4', 'E1', 'E3'] as const;
export type ReversalExpId = (typeof REVERSAL_QUEUE)[number];

// MRTs run in parallel with the reversal queue and with each other —
// day-level randomization is independent of the slow block conditions.
export const MRT_POINTS = ['nudge_hour', 'post_miss_morning'] as const;
export type MrtPoint = (typeof MRT_POINTS)[number];
