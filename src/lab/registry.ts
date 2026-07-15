// §13 engine rule: "one reversal at a time" — persistent-state
// experiments run serially, never concurrently, so they can't
// contaminate each other. E7 runs first, deliberately (§14): if its
// 5-days/week arm wins, the weave, the primary metric, and the
// notification model all need re-basing — better known on day ~21
// than day ~300.
export const REVERSAL_QUEUE = ['E7', 'E4', 'E1', 'E3'] as const;
export type ReversalExpId = (typeof REVERSAL_QUEUE)[number];

// MRTs run in parallel with the reversal queue and with each other —
// day-level randomization is independent of the slow block conditions.
// 'dose_target' backs E10 (§14, day 190+, never during E4) — E9's
// probe firing lives in its own `probes` table instead, since it
// isn't a decision *about* the app's behavior the way these are.
export const MRT_POINTS = ['nudge_hour', 'post_miss_morning', 'dose_target'] as const;
export type MrtPoint = (typeof MRT_POINTS)[number];
