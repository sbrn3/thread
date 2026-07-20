// The event log is the app's source of truth (§06). Its types are
// non-negotiable: strict, no `any` in /src/log or /src/lab (§13.6).

export type EventType =
  | 'app_open' // launched, however briefly
  | 'reading_start' // scripture zone entered
  | 'scroll_end' // reached bottom of chapter
  | 'hold_start' // seal pressed
  | 'hold_cancel' // released early — the annoyance signal
  | 'seal' // day completed
  | 'nudge_fired' // backup notification delivered
  | 'nudge_opened' // app opened from that notification
  | 'cue_changed' // anchor/place/time edited — a confound marker
  | 'book_start'
  | 'book_finish'
  | 'knot_open'
  | 'weave_view'
  | 'candidate_marked' // a verse/range struck you mid-read (§21) — the E4 signal
  | 'passage_promoted' // one per book, at book end
  | 'recall_shown'
  | 'recall_graded' // held | partial | lost. Consequence-free.
  | 'recall_skipped' // one tap. Never penalised, never blocks the seal.
  | 'probe_fired' // E9 — yesterday's chapter, randomized daily p=0.6
  | 'probe_graded' // held | partial | lost | skipped. Consequence-free, same as recall.
  | 'handoff_offered' // day 14 / dormancy. Offer shown.
  | 'handoff_tapped' // user opened Messages. NOTHING further is logged.
  | 'build_changed'; // §19 — build_sha differs from the last app_open. Marks deploy boundaries on the phase chart.

export interface AppEvent {
  id: number;
  ts: number; // epoch ms, stamped by the writer
  tz_offset: number; // minutes, stamped by the writer
  local_date: string; // 'YYYY-MM-DD' with the 4 AM boundary, stamped by the writer
  type: EventType;
  book: string | null;
  chapter: number | null;
  sitting: number | null; // for split chapters
  duration_ms: number | null; // open→seal, or hold duration
  scroll_pct: number | null; // max scroll depth reached, 0–1
  before_nudge: number | null; // 1 = read before backup notif fired
  exp_id: string | null; // active experiment, e.g. 'E1'
  exp_arm: string | null; // 'A' | 'B'
  verses_count: number | null; // §07 — the physical dose of a seal event. Verses, never chapters.
  target_verses: number | null; // §07 — that day's target, if a fixed one was active (E10/ladder); null in seed mode
  build_sha: string; // stamped by the writer
}

// What callers are allowed to provide. ts / tz_offset / local_date /
// build_sha are stamped by the writer, never by the caller (§13.3).
export type EventInput = { type: EventType } & Partial<
  Pick<
    AppEvent,
    | 'book'
    | 'chapter'
    | 'sitting'
    | 'duration_ms'
    | 'scroll_pct'
    | 'before_nudge'
    | 'exp_id'
    | 'exp_arm'
    | 'verses_count'
    | 'target_verses'
  >
>;

export type Dose = 'full_chapter' | 'half_sitting' | 'single_passage' | 'one_verse';

export interface Day {
  local_date: string;
  sealed: number;
  sealed_before_nudge: number | null;
  book: string | null;
  chapter: number | null;
  sitting: number | null;
  dose: Dose;
  verses_read: number | null;
  target_verses: number | null;
  exp_id: string | null;
  exp_arm: string | null;
  disturbed: number;
  build_sha: string | null;
}

export type Arm = 'A' | 'B';
export type Grade = 'held' | 'partial' | 'lost';

export interface Passage {
  id: number;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number; // a RANGE — meaning rarely stops at a verse
  marked_at: number;
  promoted_at: number | null; // NULL = candidate only, never memorised
  box: number; // Leitner 1–5
  due_date: string | null;
  last_grade: Grade | null;
  held_since: string | null; // first entry to box 5 → drives the 60d metric
}
