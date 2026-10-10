# Execute Experiments opt-in (experiment-suite-review)

Grade: C4. About 38 files across `lab`, `flow`, `knot`, `notify`, `state` and the docs, in 8 slices. It changes notification scheduling and what `reconcile()` writes, both protected mechanisms. It also adds a new cross-layer state, whether Experiments is on.

## Protocol

Use one fresh session per slice. Read only `AGENTS.md`, this protocol, the slice,
`git status --short`, `git log --oneline -5`, and the files the slice names. Don't read
`plan.html`, other slices or `../thread-plan_3.html` unless the slice names them.
When a slice is done, append one `PROGRESS.md` entry of at most 80 tokens, return a
result of at most 150 tokens, and stop.

Inspect narrowly. List paths first, search for bounded symbols, read line ranges, and
check `git diff --stat` before running a targeted diff. Use red-green order: write the
failing test first, then the change.

## Standing decisions

- **Merge and deploy in one run (owner, 2026-10-10).** The owner authorized one
  continuous run that commits, pushes, opens each slice's PR, merges the PRs in order
  once each passes CI, and tags the release.
  - A slice merges only after its gate passes: focused tests, `npm test` and
    `npm run typecheck` green, and CI green on the PR.
  - The run **stops before the tag** if the S07 mandatory device checklist can't run
    (no phone, or the phone is busy with another session) or if any item fails.
    That checklist exists because this changes notification scheduling. Merges
    before that point stand.
  - Stopping is not a failure. Record the gap in `PROGRESS.md` and hand off. The
    tag waits until the checklist passes.
  - This authorization does not extend to anything outside this plan.
- **Branches.** The run starts by rebasing `docs/experiment-suite-review` onto
  `origin/main`, which was at `743eab4` on 2026-10-10. Commit the planning docs. Then
  branch each slice from the previous slice's merged `main` as
  `feat/experiments-sNN-<topic>`, open one PR per slice, and merge them in slice order.
  Other sessions open sibling worktrees, so use separate branches and merge PRs in
  order.
- **reading-screen-and-motion has already landed.** Its S06, S08 and S09 are on
  `main`, and `v0.12.0` is tagged. The earlier "probe removal before S06" ordering is
  moot. S01 removes the probe from S06's "Before you read" list (`src/flow/beforeList.ts`).
  S02 puts the dose note in S06's header. This plan's release is `v0.13.0`.
- **Hard rules.** `events` stays append-only. No migration is needed, and the plan adds
  none (if one turns out to be needed, stop and re-plan). No `Math.random()`. `/src/lab`
  never imports `/src/ui`.
- **Unverifiable steps.** Record each one as a gap. Never claim a pass you didn't see.
- **Integration owner.** S07, inline.

## Shared facts (copied here so slices don't need each other)

- **Behaviours.** Six profile keys. Each has a default, the reversal that tests it,
  and an A/B arm value.

  | Key | Default | Reversal | A | B |
  |---|---|---|---|---|
  | `frequencyTarget` | `daily` | E7 | `daily` | `5_per_week` |
  | `floor` | `full_chapter` | E4 | `full_chapter` | `one_verse` |
  | `seal` | `hold` | E1 | `hold` | `tap` |
  | `streakVisible` | `0` | E3 | `1` | `0` |
  | `dayCountVisible` | `1` | E11 | `1` | `0` |
  | `sittingCountVisible` | `1` | E12 | `1` | `0` |

  This matches `PROFILE_EFFECTS` in `src/lab/analysis/report.ts:60`.
- **Today only E7, E11 and E12 read the active phase.** They go through
  `notifier.ts` `e7ArmBActive` and `arrivalVisibility.ts`. E1, E3 and E4 never reach
  the UI: `Flow.tsx` (~669) reads profile only. S03 and S04 fix this, so every
  reversal applies its arm.
- **Experiments state is derived from events.** The `experiments_on` and
  `experiments_off` events in the append-only log are the source of truth.
  - `experimentsOnAt(db, date)` returns the latest such event with
    `local_date < date`. It is **strictly before**: reconcile closes a day at that
    day's first open, before any toggle made later that day, so a replay must not see
    that toggle either (Smart Review).
  - With no event it is off, which covers every existing install, including the
    owner's phone.
  - The UI asks `experimentsOnNow(db)`, which looks at the latest event of any date.
- **The lab clock.** It starts the day after the most recent `experiments_on`
  (`labStart(db)`).
  - The first reversal starts on that day. There's no 21-day baseline, because the
    reader has chosen to take part.
  - E10 starts at labStart + 190 days, and the bandit at labStart + 366.
  - `trial_start` keeps meaning only "the reading year" (the year review).
- **Starting clean.** While off, `advancePhase` marks any `active` `exp_phases` row
  `stopped`. This is idempotent.
- **Which experiment runs next.** It is the first `REVERSAL_QUEUE` experiment that is:
  1. not **complete**, meaning it has no `done` row for phase 3. This is keyed on
     phases, not on `reports`, because a report is written after reconcile and never
     when every phase was disturbed;
  2. not **retired by the reader**, meaning there is no `setting_changed` event for
     its behaviour key after its first phase's start date. A reader's choice ends that
     test for good: it never restarts on its own.
- **Seeding the next experiment.**
  - First, delete that experiment's `stopped` rows. `exp_phases` is a derived table,
    and `events` is untouched.
  - **Never seed over a `done` row.** `seedPhase` checks for one first, and the
    `ON CONFLICT` upsert only ever replaces `stopped` or `active` rows.
  - Completed experiments keep their reports and suggestions.
- **The decisions `delivered` flag.** `1` means a real comparison point, `0` means
  pending, and `-1` means voided because the reader sealed before the nudge fired.
  `-1` is new and needs no migration. Analysis only ever reads `delivered = 1`.
  - Each new nudge row stores `ctx = {"triggerAt": <epoch ms>}`, which is the
    trigger it was actually scheduled with. Delivery is inferred only for rows that
    carry it.
  - A one-time pass, guarded by `meta.nudge_delivery_v1`, sets every older past
    `delivered = 0` nudge row to `-1`. Those rows were voided or unknown, and must
    never be counted as delivered.
- **Mechanic friction is offered, not applied (owner, 2026-10-10).**
  - `diagnose()` stops calling `setProfile(seal, 'tap')`.
  - The `one_question` route for `mechanic_friction` now surfaces like the other
    routes, as the lapse row in "Before you read". Its copy: "Holding keeps getting
    cancelled — switch to tap?", with Switch and Keep hold.
  - Switch calls `chooseBehaviour(seal, 'tap')`. This applies with Experiments on
    or off.
- **Arms with Experiments off.**
  - Nudges use arm `standard`: one nudge every unsealed day, with the cue copy
    (owner, 2026-10-10).
  - `analysis/mrt.ts` and the bandit ignore `standard`.
  - No E6 or E10 decision rows are written.

## Execution waves

This is C4 and serial by design. Every slice touches `Flow.tsx` or a shared lab seam, so
no two slices have disjoint ownership. Every slice runs inline.

| Task | Wave | Depends | Mode | Exclusive ownership |
|---|---:|---|---|---|
| S00 | 0 | — | inline | branch setup, plan docs |
| S01 | 1 | S00 | inline | probe removal files (below) |
| S02 | 2 | S01 | inline | dose note and resume files (below) |
| S03 | 3 | S02 | inline, **high-effort** | `src/lab/experiments.ts`, `behaviours.ts`, `steps.ts`, `bandit.ts`, `dose.ts` (gating), `lapse.ts`, `arrivalVisibility.ts`, `analysis/report.ts`, `analysis/reversal.ts`, `analysis/mrt.ts`, `log/types.ts` |
| S04 | 4 | S03 | inline | `Flow.tsx` (behaviour reads, SRBAI/report gating, friction offer), `LapseZone.tsx`, `beforeList.ts` (lapse detail), `analysis/yearReview.ts`, `knot/Knot.tsx` (streak line only) |
| S05 | 5 | S04 | inline, **high-effort** | `src/notify/notifier.ts`, `src/services/index.ts`, `App.tsx` (foreground hook), `Flow.tsx` (`handleSeal` order only), `state/session.ts` (`before_nudge` only), `lab/steps.ts` (`attributeRewards`/`updateBandit` sweep), `lab/signature.ts` (cue-strength window) |
| S06 | 6 | S05 | inline | `src/knot/MoreSection.tsx`, `ReadingSettingsSection.tsx` (NEW), `ExperimentsSection.tsx` (NEW), `SealModeSection.tsx` (DELETE), `AdaptiveSection.tsx`, `Knot.tsx` (section keys only) |
| S07 | 7 | all | inline | docs, `src/whatsNew/index.ts`, device checklist, final audit, tag, `OUTCOME.md` |

---

## S00 — Rebase and commit the plan

Depends: none. Budget: 0 product files, ≤4 turns.

- `git fetch`, then rebase `docs/experiment-suite-review` onto `origin/main`.
  `JOURNAL.md` conflicts are prepend-only, so keep both sides.
- Re-check that every cited line still holds on the new `main` before S01. If a
  symbol moved, update this file in the same commit.
- Commit `JOURNAL.md`, `docs/CONTEXT.md` and `docs/plans/experiment-suite-review/` as a
  docs PR, and merge it per the standing authorization.
- Done when `main` has the plan and `npm test` and `npm run typecheck` are green.

## S01 — Remove the E9 next-day probe

Depends: S00. Budget: ~13 files, 4 test files, ≤10 turns.
Owns: the files below.

### Files

- `src/flow/Flow.tsx` — MODIFY.
  - Delete the probe import (~17), the `probe` state and effect, `getProbeSpanText`
    and `handleGradeProbe` (~612–646).
  - Delete the `probe` input passed to `buildBeforeYouRead` (~766).
  - Delete the `case 'probe'` body (~791).
  - Update the S06 comment at ~759.
- `src/flow/beforeList.ts` — MODIFY.
  - Drop `'probe'` from `BeforeKind`, `BEFORE_ORDER`, `BeforeInput`, `DONE_DETAIL`
    and `buildBeforeYouRead`.
  - Update the header comment: memory and what's new start folded, and the lapse
    starts open.
- `src/flow/BeforeYouRead.tsx` — MODIFY. Remove the `probe` dot style and colour
  entries (~21, ~28) and the probe mentions in the comments.
- `src/flow/ProbeZone.tsx` — DELETE.
- `src/lab/probe.ts` — DELETE.
- `src/lab/analysis/dose.ts` — MODIFY.
  - `analyzeDoseCurve` drops `recallScore` and `GRADE_SCORE`, so
    `composite = sealRate`, and `DoseCurvePoint` loses `recallScore`.
  - The doc comment says E10 judges on sealing alone (JOURNAL Decision 2026-10-10).
  - Fix the stale "E14" mention.
- `src/lab/registry.ts` — MODIFY. Drop the E9 sentence from the `MRT_POINTS` comment.
- `src/state/session.ts` — MODIFY. Remove the "next-day probe" comment (~129). Keep
  `readNums` and `verse_first`/`verse_last`, which headnotes use.
- `src/log/types.ts` — MODIFY. Keep `probe_fired` and `probe_graded` for historical
  events, annotated "retired 2026-10; no longer written".
- `src/log/schema.ts`, `src/backup/dump.ts` and `src/reset/index.ts` — **unchanged**.
  The `probes` table stays, because migrations are additive-only and old backups
  restore into it.
- `docs/brand-voice-inventory.json` — MODIFY. Remove the `src/flow/ProbeZone.tsx`
  key. `test/brand-voice.test.ts` compares keys exactly.
- `docs/CONTEXT.md` — MODIFY. Delete the **probe span** entry.

### Tests

- `test/probe.test.ts` and `test/probe-span.test.ts` — DELETE.
- `test/beforeList.test.ts` — MODIFY. Remove `probe` from `NONE` and `ALL`, and the
  span-title and "no probe on day 1" cases. The expected orders become
  `['lapse', 'memory', 'whatsNew']`, and only the lapse starts open.
- `test/dose-analysis.test.ts` — MODIFY. Assert `composite === sealRate`, and that the
  probes table is ignored.
- `test/ui-contracts.test.ts` — MODIFY. Drop the ProbeZone case (~218). Add an
  assertion that `Flow.tsx` contains neither `ProbeZone` nor `lab/probe`.
- `test/memory.test.ts:402` keeps inserting into `probes`, because the table still
  exists. Leave it alone.

### Done when

- No `src` file imports `lab/probe`.
- The suite and the typecheck are green.
- Stories 7 and 8 are satisfied.
- Rollback: revert the PR. The table and the events were never touched.

## S02 — The dose ladder says so, and "Read the whole chapter"

Depends: S01. Budget: 7 files, 3 test files, ≤12 turns.
Owns: `src/lab/dose.ts`, `src/text/sittings.ts`, `src/state/session.ts` (portion,
resume and reset), `src/flow/ArrivalZone.tsx`, `Flow.tsx` (pass-through only),
`src/log/types.ts` (`dose_reset`) and `docs/brand-voice-inventory.json`.

### Files

- `src/lab/dose.ts` — MODIFY.
  - Add `todaysDose(db, date): { target: number | null; reason: 'ladder' | 'experiment' | 'suggested' | null }`.
    It uses the same resolution order as `todaysTarget`:
    - a ladder rung below `full_chapter` gives `'ladder'`;
    - `profile.doseTarget` gives `'suggested'`;
    - an active E10 arm gives `'experiment'`.
  - `todaysTarget` becomes `todaysDose(...).target`, so callers stay unchanged.
  - Add `resetDoseLadder(db)`, which sets `meta.dose = 'full_chapter'`.
- `src/text/sittings.ts` — MODIFY. Add a pure `remainderFrom(verses, fromVerse): Verse[]`.
- `src/state/session.ts` — MODIFY.
  - **Bug found in planning.** `splitSittings(chapter, 1)` cuts a chapter into about
    one sitting per verse. The stored `current_sitting` index then points at other
    verses once the target changes, and `load` only clamps it.
  - **Fix: record the position as a chapter and verse.** `seal` writes
    `meta.current_position = '<chapter>:<verse>'`, the first verse of the next
    sitting. It's written only when the seal stays inside the same single chapter,
    and cleared when advancing to a new chapter or book.
  - **On `load`**, when `current_position` names today's `chapter` and isn't the
    first verse of `sittings[clampedIndex]`:
    1. rebuild today's portion from `remainderFrom(chapterVerses, verse)`;
    2. re-split it by today's target;
    3. use index 0;
    4. **set `portionChapters = [chapter]`**, so a merged-forward next chapter is
       never skipped (Smart Review);
    5. never merge forward from a remainder.
  - **Add `readWholeChapter(db, log, text, today)`:**
    1. `resetDoseLadder(db)`;
    2. `log.write({ type: 'dose_reset' })`;
    3. today's portion becomes `remainderFrom(chapter, firstVerseOfCurrentSitting)` as
       a single sitting, with `portionChapters = [chapter]`;
    4. set `current_sitting` to 0 and `current_position` to match.
  - The session state gains `doseReason`.
- `src/log/types.ts` — MODIFY. Add `'dose_reset'`, documented as "reader chose the
  whole chapter; the dose ladder returns to the top".
- `src/flow/ArrivalZone.tsx` — MODIFY. This is the post-S06 header (date line, title,
  `verses a–b` subline, cue).
  - Add props `doseNote: { verses: number; reason } | null` and `onReadWholeChapter`.
  - Render the note directly under the `verses a–b` subline: a `View` with a 2 px
    thread left rule, holding a mono 12/18 ink60 line.
    - ladder: "A shorter reading today, N verses, after a few missed days. Seal a full week and it grows back."
    - experiment: "N verses today. The dose experiment is trying different lengths."
    - suggested: "N verses a day — you applied this from an experiment."
  - Add an `ActionButton variant="quiet"` labelled "Read the whole chapter", except
    for `suggested`, which is a setting the reader changes in the knot.
  - Hide the note when `reason` is null, or when the portion already covers the rest
    of the chapter.
  - Accessibility order: after the subline, before the cue.
- `src/flow/Flow.tsx` — MODIFY. Pass `doseNote` and the handler. The handler calls
  `session.readWholeChapter`. The fit and scroll checks re-run from `sittingVerses`.
- `docs/brand-voice-inventory.json` — MODIFY if its ArrivalZone classes need an
  "operation" entry.

### Tests

- `test/dose.test.ts` — the reasons and precedence of `todaysDose`, and `resetDoseLadder`.
- `test/sittings.test.ts` — `remainderFrom` at the start, in the middle, at the end,
  and past the end.
- `test/session.test.ts`:
  - At `one_verse`, at sitting 4 of James 4, `readWholeChapter` starts at the next
    unread verse, logs one `dose_reset`, and leaves `portionChapters` at `[4]`.
  - The next day loads the full chapter.
  - A ladder step-up mid-chapter resumes at the position.
  - **Resume when the chapter is short** (shorter than the target, so normally merged
    forward): the next chapter is read the following day, not skipped.

### Done when

- Stories 9–12 are satisfied.
- The note's three states match `mockup.html#dose`.
- Rollback: revert the PR. Older code ignores `meta.current_position`.

## S03 — The Experiments switch and the behaviours resolver (lab only)

Depends: S02. Mode: **high-effort**, because it changes `reconcile()` output, and
replay must stay byte-identical on a re-run.
Budget: 12 files, 7 test files, ≤16 turns.

### Files

- `src/lab/experiments.ts` — NEW.
  - `experimentsOnAt(db, date)` uses a strict `<`; see Shared facts.
  - `experimentsOnNow(db)`.
  - `labStart(db)` is the day after the latest `experiments_on`.
  - `setExperiments(db, log, on, today)` logs an event only when the state changes.
    Turning it off also marks any `active` phases `stopped` straight away. The caller
    (S06) re-syncs the notifier.
- `src/lab/behaviours.ts` — NEW.
  - `BEHAVIOURS` is the table in Shared facts.
  - `effectiveBehaviour(db, key, date)`:
    - the arm value, when `experimentsOnAt(db, date)` and that experiment has an
      `active` phase covering `date`;
    - otherwise the profile value;
    - otherwise the default.
    - There is no precedence conflict: a reader's choice stops the test, so an active
      arm and a fresh choice never coexist.
  - `behaviourSource(db, key, date)` returns
    `{ kind: 'default' | 'chosen' | 'suggested' | 'testing' | 'earlier', until?, appliedOn?, expId? }`.
    It reads `profile['<key>.source']`. `earlier` means a profile value with no
    source, i.e. pre-existing data such as the owner's `seal = tap` from the old
    silent override.
  - `chooseBehaviour(db, log, key, value, today)`:
    - writes the profile and sets `<key>.source = 'chosen'`;
    - logs a `setting_changed` event with `exp_id = key` and `exp_arm = value`;
    - if that behaviour's experiment is active, marks its rows `stopped`. That
      experiment is now retired (see Shared facts), and the queue moves on at the next
      reconcile.
- `src/lab/steps.ts` — MODIFY.
  - **`advancePhase`.**
    - When `!experimentsOnAt(date)`, stop the active rows and return.
    - Otherwise:
      - if nothing is active, seed the next experiment per Shared facts, with phase 0
        starting on `max(date, labStart)`;
      - for each ending `active` row, mark it `done` and seed the next phase. After
        phase 3, seed the next experiment from the day after its `end_date`.
    - Delete the "first phase after `trial_start` + 21" branch.
    - `seedPhase` refuses to overwrite a `done` row.
  - **`diagnose`.**
    - Write the E6 decision only when on.
    - E10 goes through the gated `activeE10Arm`.
    - Remove the `setProfile(ctx.db, 'seal', 'tap')` line (~151). Mechanic friction
      is now an offer; see Shared facts.
    - Leave the dose stepping as it is.
- `src/lab/lapse.ts` — MODIFY. `getPendingLadderResponse` no longer filters out
  `one_question` with `route = 'mechanic_friction'`. Rewrite the doc comment.
- `src/lab/bandit.ts` — MODIFY. `isAdaptiveActive` requires `experimentsOnAt(date)`
  and at least 366 days since `labStart`. Its callers are the notifier, `updateBandit`
  and `AdaptiveSection`, and their signatures are unchanged.
- `src/lab/dose.ts` — MODIFY. `activeE10Arm` requires `experimentsOnAt` and at least
  190 days since `labStart`.
- `src/lab/arrivalVisibility.ts` — MODIFY. Both functions become one-liners over
  `effectiveBehaviour`.
- `src/lab/analysis/report.ts` — MODIFY.
  - `getPendingReport(db, today?)` returns null when `today` is given and experiments
    are off. The parameter is **optional**, so `Flow.tsx` still typechecks until S04.
  - `applyRecommendation` also writes `<key>.source = 'suggested:<expId>:<date>'`.
  - Add `getPendingReports(db)` for S06.
- `src/lab/analysis/reversal.ts` — MODIFY. `analyzeReversal` and `phaseMetrics` skip
  `stopped` rows.
- `src/lab/analysis/mrt.ts` — MODIFY. `rowsFor` excludes `arm = 'standard'`.
- `src/log/types.ts` — MODIFY. Add `'experiments_on'`, `'experiments_off'` and
  `'setting_changed'`.

### Tests

New files: `test/experiments.test.ts` and `test/behaviours.test.ts`. Use
`test/util/testDb.ts`, following `test/reconcile-steps.test.ts` and `test/lab.test.ts`.
Cover:

- Off by default: no phases seed, and no E6 or E10 rows are written.
- On: E7 phase 0 starts the next day.
- A toggle made today doesn't change today's already-closed day, and a replay agrees.
- Off mid-phase marks the phase `stopped`. Switching on again restarts E7 at phase 0
  with no stale rows.
- An experiment with phase 3 `done` is skipped, even with no `reports` row (all phases
  disturbed), and its `done` rows are never overwritten.
- `chooseBehaviour` on the key under test stops it. The next reconcile starts the
  **next** experiment, and the stopped one is never reseeded.
- `effectiveBehaviour` covers every key and arm, including E1, E3 and E4.
- Mechanic friction no longer changes `seal`, and `getPendingLadderResponse` now
  returns its offer.
- Replay: two `reconcile` runs give byte-identical tables. Extend the existing
  idempotency case.
- Update `bandit.test.ts`, `dose.test.ts`, `report.test.ts`,
  `report-generation.test.ts`, `arrivalVisibility.test.ts`, `lapse.test.ts`,
  `ladder.test.ts` and `reconcile-steps.test.ts`. Their fixtures add an
  `experiments_on` event dated before the days under test.

### Done when

- Stories 1, 4–6, 13–16 and 25 are satisfied.
- `test/boundaries.test.ts` is green.
- S03 is safe to ship alone: Flow still reads profile until S04, and the friction
  offer reaches LapseZone through its existing fallback copy until S04 rewrites it.
- Rollback: revert the PR. Older code would resume seeding phases from `trial_start`,
  so revert S04 first if it has merged.

## S04 — The reading screen follows the behaviours

Depends: S03. Budget: 6 files, 3 test files, ≤10 turns.

### Files

- `src/flow/Flow.tsx` — MODIFY.
  - `sealMode`, `floor` and `streak` (~669–672 before the rebase) use
    `effectiveBehaviour(db, key, today)`.
  - `srbaiDue` also requires `experimentsOnNow(db)`.
  - The report effect passes `today`.
  - The lapse handler for a `mechanic_friction` offer: Switch calls
    `chooseBehaviour(db, log, 'seal', 'tap', today)`, and Keep hold just marks it
    responded.
- `src/flow/LapseZone.tsx` — MODIFY. Add a `mechanic_friction` branch: the copy
  "Holding keeps getting cancelled — switch to tap?", with a secondary "Switch to tap"
  and a quiet "Keep hold". Update the comment at ~37.
- `src/flow/beforeList.ts` — MODIFY if needed, so the lapse row's detail for this
  route reads "Sealing".
- `src/knot/Knot.tsx` — MODIFY. Touch only the WeaveZone `streak` prop, which moves to
  `effectiveBehaviour`.
- `src/lab/analysis/yearReview.ts` — MODIFY. In `verdictFor`, with fewer than 2 SRBAI
  points, never use the SRBAI-flat verdict. When behaviour is up and retention is
  fine, the verdict is: "Behaviour is up and the reading held. Without monthly
  check-ins there's no automaticity measure — the days sealed are the finding."
- `docs/brand-voice-inventory.json` — MODIFY. Classify the new LapseZone strings.

### Tests

- `test/year-review.test.ts`: no SRBAI and at least 50% sealed gives the new verdict,
  never "compliance".
- `test/ui-contracts.test.ts`: there is no `getProfile(db, 'seal'|'floor'|'streakVisible')`
  in `Flow.tsx`, and the new LapseZone buttons are on the allowlist.
- `test/beforeList.test.ts`: the friction lapse row.

### Done when

- Stories 13, 17, 18 and 25 are satisfied.
- Rollback: revert the PR. S03 still works without it.

## S05 — Nudges: fixed when off, reset on toggle, delivery recorded and rewarded

Depends: S04. Mode: **high-effort**. This is notification scheduling, so the mandatory
checklist applies.
Budget: 8 files, 3 test files, ≤16 turns.

### Files

- `src/notify/notifier.ts` — MODIFY.
  - `e7ArmBActive` becomes `effectiveBehaviour(db, 'frequencyTarget', d) === '5_per_week'`.
  - **`syncWindow`.**
    - When `!experimentsOnNow(db)`, use arm `standard` (the anchor copy) and never a
      silence day.
    - When on, use the E5 or bandit arm, as today.
    - Each inserted row stores `ctx = JSON.stringify({ triggerAt })`.
  - **`resetFutureWindow(cue, today)`.**
    1. Cancel every scheduled `nudge-<date>` with `date > today`.
    2. Delete the `decisions` rows with `point = 'nudge_hour'`, `local_date > today`
       and `reward IS NULL`. These are future and not evidence. The one-row-per-day
       invariant (`checkInvariants` #2) still holds.
    3. Call `syncWindow`.
    - Called on every Experiments toggle, and on a `frequencyTarget` change (S06).
  - **`recordDeliveries(now = Date.now())`.** This is the "listener's" background half.
    - Run the one-time `meta.nudge_delivery_v1` pass first; see Shared facts.
    - Then, **only if permission is `granted`**, for `nudge_hour` rows with
      `delivered = 0`, a `ctx.triggerAt <= now`, and an identifier absent from
      `getAllScheduledNotificationsAsync()`: set `delivered = 1`.
    - Use the stored trigger as the source of truth. Never use the current cue hour.
  - `markReceived(identifier)` sets `delivered = 1` for the matching date. This is the
    foreground half.
  - **`nudgeStateToday(today, now)`** returns `'pending' | 'fired' | 'none'`, from
    today's row plus whether `nudge-<today>` is still scheduled.
  - **`cancelToday(today)`.**
    - `pending`: cancel and set `delivered = -1`.
    - `fired`: set `delivered = 1`.
    - Silence rows are never touched.
- `src/flow/Flow.tsx` — MODIFY, `handleSeal` only.
  1. Await `notifier.nudgeStateToday` **before** `session.seal`.
  2. Pass `beforeNudge = state !== 'fired'` into `seal`.
  3. Then call `cancelToday`.
- `src/state/session.ts` — MODIFY. `seal` takes `beforeNudge: boolean`, replacing the
  hard-coded `before_nudge: 1` (~139).
- `src/services/index.ts` — MODIFY. Register `ExpoNotifications.addNotificationReceivedListener((n) => notifier.markReceived(n.request.identifier))`
  once, and expose its `remove` for teardown.
- `App.tsx` — MODIFY. On app open, and on each `AppState` change to `active`:
  1. `await notifier.recordDeliveries()`;
  2. then run reconcile.
  - Before this, reconcile ran synchronously at ~92 and `syncWindow` only ever ran
    once per mount.
- `src/lab/steps.ts` — MODIFY. **Late-reward sweep** (Smart Review HIGH 1).
  - `attributeRewards(ctx, date)` also fills `reward` for any row where
    `point IN ('nudge_hour', 'dose_target')`, `delivered = 1`, `reward IS NULL` and
    `local_date < date`, using the `days` row for that row's own `local_date`.
  - `updateBandit` likewise folds every rewarded row where `bandit_updated = 0` and
    `local_date <= date`.
  - Both stay idempotent.
- `src/lab/signature.ts` — MODIFY.
  - Cue strength counts only days on or after `meta.cue_strength_since`, which is set
    once at this build's first open. Every older day carries the hard-coded
    `before_nudge = 1`.
  - With no qualifying days, `cue_collapse` isn't diagnosed.
  - `yearReview`'s `computeCueStrengthAt` uses the same window.

### Tests

- `test/notify.test.ts` (the fake `NotificationsLike`):
  - Off: 30 days, arm `standard`, never silence, and `ctx.triggerAt` stored.
  - On: the E5 weights apply.
  - `resetFutureWindow` cancels only future identifiers and keeps today.
  - `recordDeliveries` marks only past rows that carry `ctx` and are no longer
    pending. It does nothing without permission. The v1 pass turns old `0` rows
    into `-1`.
  - `cancelToday`: pending gives `-1`, fired gives `1`.
  - Silence rows are never voided, and the one-a-day ceiling holds after a reset.
  - **Update the existing case at ~301–306**, which expects `delivered = 0` after
    `cancelToday`.
- `test/reconcile-steps.test.ts`:
  - A row marked `delivered = 1` a day after its date gets its reward at the next
    reconcile, and the bandit folds it once.
  - **Retitle and adjust ~81**, "nothing has delivered=1 yet".
- `test/signature.test.ts`: days before `cue_strength_since` don't trigger
  `cue_collapse`.

### Done when

- Stories 19–22 are satisfied.
- Rollback: revert the PR. Older code reads `-1` rows as not delivered and ignores `ctx`.

## S06 — The knot: Reading settings and Experiments (direction C)

Depends: S05. Budget: 7 files, 2 test files, ≤14 turns. Follow `mockup.html#c` and the
off state in `#1b`.

### Files

- `src/knot/ReadingSettingsSection.tsx` — NEW.
  - Six labelled `ChoiceChip` pairs:
    - How often: Every day / 5 days a week
    - What counts as read: Whole sitting / Any reading
    - Sealing: Hold / Tap
    - Streak: Shown / Hidden
    - Day count: Shown / Hidden
    - Sitting count: Shown / Hidden
  - Each pair has a source line from `behaviourSource`, in mono 11/16 ink40:
    - default: no line
    - "You chose this"
    - "Suggested by an experiment, applied <d MMM>"
    - "Being tested until <d MMM> — choosing one ends the test" (madder)
    - "Changed earlier"
  - Pressing a chip calls `chooseBehaviour`. A `frequencyTarget` change also calls
    `notifier.resetFutureWindow`.
- `src/knot/ExperimentsSection.tsx` — NEW.
  - An RN `Switch` with the line: "Let the app try small changes on you, three weeks at
    a time, and suggest what works. It asks a short question once a month. Nothing
    changes until you apply it."
  - Toggling calls `setExperiments` and then `notifier.resetFutureWindow`.
  - When on, it shows:
    - each pending suggestion card, with its recommendation and Apply / Keep
      (`markApplied`);
    - "Now testing: <behaviour> until <date>";
    - what's queued next;
    - a nested `AdaptiveSection`.
- `src/knot/MoreSection.tsx` — MODIFY.
  - Preferences becomes: Translation, Reading settings (with a short summary as its
    status), Experiments (status Off, or On · N suggestions), Partner.
  - Remove the Sealing and Adaptive policy rows.
  - In `MoreSectionKey`, `seal` and `adaptive` become `reading` and `experiments`.
- `src/knot/SealModeSection.tsx` — DELETE. Its job moves into ReadingSettingsSection.
  Its copy, which described the silent switch, is obsolete.
- `src/knot/AdaptiveSection.tsx` — MODIFY. The copy "once you've been through a full
  year" becomes "after a year of experiments".
- `src/knot/Knot.tsx` — MODIFY. Change only the `moreSections` initial keys (~89–99).
- `docs/brand-voice-inventory.json` — MODIFY. **Remove the `src/knot/SealModeSection.tsx`
  key (~37)** and add the two new files.

### Tests

- `test/ui-contracts.test.ts`:
  - the new Pressables are on the allowlist;
  - nothing references `SealModeSection`;
  - Preferences order is Translation, Reading settings, Experiments, Partner.
- `test/brand-voice.test.ts` stays green, because its keys match exactly.

### Done when

- Stories 1–5, 14 and 23 are satisfied.
- `scripts/device/rec.mjs knot` captures of the on and off states on the dev client
  match `mockup.html` C.
- Rollback: revert the PR. The behaviours stay readable through profile.

## S07 — Docs, release, device checklist, and tag

Depends: all. Budget: ~10 docs files, ≤12 turns.

### Docs

- `README.md`: the daily-flow line drops the probe, and Experiments is mentioned as
  optional.
- `docs/index.html`: remove the `.probe` block (~361).
- `docs/what-thread-asks-you.html`: rewrite as two prompts. Memory recall is for
  everyone. The monthly check-in appears only with Experiments on. Remove the
  recall_score paragraph.
- `docs/CONTEXT.md` is already done in S01.
- `ROADMAP.md`: add a ✅ entry.
- `STATUS.md` and `docs/plans/README.md`: keep the two in sync.
- `JOURNAL.md`: add a session entry that refers to the Decision 2026-10-10 entry
  without restating it.
- `src/whatsNew/index.ts`: add a new entry keyed by the tag.
  - Draft:
    - "The next-day question is gone; memory passages are where you practise remembering."
    - "A shorter reading now says why, and \"Read the whole chapter\" is one tap away."
    - "Experiments are now optional and off — turn them on in Knot › More › Experiments."
  - `test/whatsNew.test.ts` keeps this format honest.

### Mandatory device checklist

Run it on the **dev client only** (`com.sngugi.thread.dev`), never on the release app.
Use a restored backup or synthetic data, and the `scripts/device/` toolkit. Stop and
record if the phone is in use by another session.

1. Install over v0.12.x data. Expect: the app opens and Experiments shows Off. No
   phase-chart report or SRBAI prompt appears, and active phases are now `stopped`
   (query via `adb shell run-as`).
2. With Experiments off and a nudge hour 2 minutes ahead, leave the day unsealed and
   background the app. Expect: one notification with the cue wording. On reopening,
   its decision row has `delivered = 1`.
3. Set the nudge hour 2 minutes ahead, then seal before it. Expect: no notification.
   The row is `delivered = -1`.
4. Seal *after* the nudge fires. Expect: the row is `delivered = 1`, and the `days`
   row has `sealed_before_nudge = 0`.
5. Turn Experiments on. Expect: future scheduled nudges are replaced (check
   `getAllScheduledNotificationsAsync` via a dev log, or `adb shell dumpsys notification`),
   there is never more than one per day, and "Now testing: How often" appears from
   tomorrow.
6. Turn Experiments off again. Expect: the future window is rebuilt with no silence
   days, and the active phase is `stopped`.
7. Change Sealing while E1 is being tested. Expect: the madder line goes and the test
   ends, and the next reconcile starts the next experiment.
8. Set up a lapse (synthetic data where the ladder is at `one_verse`). Expect: the
   arrival note shows. "Read the whole chapter" gives the rest of the chapter from the
   next unread verse, and one `dose_reset` event is logged.
9. Friction offer: synthetic data where holds are cancelled above 15%. Expect: a "switch to tap?" lapse row. Keep hold changes nothing, and Switch sets tap and shows "You chose this".
10. Failure and retry: revoke notification permission, then reopen. Expect: no crash,
   nothing scheduled, and no rows marked delivered.

### Release

- If every item passes, tag `v0.13.0` per `AGENTS.md`.
- If any item can't run or fails, merge stands and the tag waits. Record the gap.
- Write `OUTCOME.md` after the independent final audit (C4). The audit is a read-only
  agent reviewing the final diff against `plan.html` and `exec.md`. Fix HIGH and
  MEDIUM findings before the tag.
