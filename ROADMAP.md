# Roadmap

Future features and larger changes, beyond the plan's W1–W13 work-packages
(which are all landed). Near-term tactical items live in `STATUS.md` → Next
actions; this file is for things that need their own design pass.

Status key: 📋 planned · 🔨 in progress · ✅ shipped · ❄️ parked

## Planned

- 📋 **Experiments become opt-in** — the research engine moves behind one
  Experiments switch, off by default; the probe goes; the shorter reading after a
  lapse says why and offers the whole chapter. Saved, not approved. The plan is on
  branch `docs/experiment-suite-review` (`docs/plans/experiment-suite-review/`).

## Under consideration

Each of these needs a grill and a plan before any work. The owner picks the order.

- **Night mode** — a dark linen palette, following the system setting or set in
  Preferences. Every token in `src/ui/tokens.ts` needs a dark pair, and the dyes
  need checking for contrast.
- **The shelf** — finished books as a row of woven bolts in the knot, each in its
  dye, opening to its contents (headnotes). "A year of reading is a polychrome shelf."
- **Sitting length** — a reader-set length for the day's reading, separate from
  the dose ladder. It overlaps with the experiments opt-in plan, so decide that first.
- **Memory-verse widget** *(owner, 2026-10-11)* — spaced repetition on the home
  screen. It shows a due memory passage as a cloze card, and the reader reveals and
  grades it without opening the app. It reuses the memory library's schedule
  (`src/memory/`) and the cloze ladder. Grades from the widget must land in the
  same schedule as grades in the app.
  - Open questions: whether a widget grade counts toward the daily cap and the
    `recall_shown` event; how much of a passage fits; and Android widget support
    in Expo, which probably needs a config plugin or a native module.
  - It replaces the earlier idea of a widget showing today's reference.
- **Grade buttons in Anki's order** *(owner, 2026-10-11)* — recall cards and the
  probe show **Held it · Partly · Lost it**, best first
  (`src/flow/RecallZone.tsx`, `src/flow/ProbeZone.tsx`). Anki, which the owner
  knows, runs worst first: **Again · Hard · Good · Easy**. Reversing the order to
  **Lost it · Partly · Held it** would match that habit.
  - Small, but it touches muscle memory, and the probe is part of E9. Check
    whether the experiments opt-in plan (which removes the probe) lands first.
  - Note that Anki has four grades; this app has three.
- **Audio** — listen to the day's reading. This needs a licensed or public-domain
  audio source, and a decision on what counts as reading for the seal.

## Parked

- ❄️ **Apple support** *(distant — parked 2026-10-07, no Apple readers)* —
  iOS has no sideloading equivalent to the APK. A 2026-09-05 plan for an
  offline-first PWA built from the React Native source through
  `react-native-web` was never approved or committed and has been discarded.
  Its cost: no backup on web, calendar alarms instead of the cue, no way to move
  an Android history across, and no Apple hardware to verify any of it.
  Revisit only if real Apple readers appear, re-planning from current `main`.

## Shipped

- ✅ 2026-10-10 — **Reading screen and motion, waves 1–2** (PRs #68, #69, `v0.12.0`).
  - Launch fell from 13 s to 2.5 s, on a linen splash.
  - The seal and unravel holds show progress from touch-down.
  - Sheets slide, verse taps are fast, and italics use the bundled fonts.
  - Waves 3–4 (Direction A and the woven motion, #72, #74) are on `main`, waiting for their device review.
- ✅ 2026-10-09 — **Book bookends** (`v0.11.0`): BibleProject overviews, daily
  headnotes, and the book's contents.
- ✅ 2026-10-07 — **What's new after an update** (PR #54, `v0.10.0`).

- ✅ 2026-10-07 — **Memory library in the knot** (PR #48, `v0.9.0`). See
  every memory passage; add any passage from the Bible, edit its verses, start
  over, delete, review now; a daily cap (1–10); the book end offers several
  marks; the next-day probe no longer looks at marks. Migration V13, additive.
- ✅ 2026-10-06 — **Recall cloze ladder + narrowed next-day probe** (#40, #41,
  PR #45, `v0.8.0`). Recall passages hide a few key words, then more, then the
  whole passage (letter stubs, then plain gaps); the E9 probe asks about up to 3
  verses you read instead of a whole chapter. Migration V12, additive.
- ✅ 2026-09-22 — **Start-over control as a circular seal-style button**
  (#31, PR #35, reclassified from issue then implemented same day). The
  hold-to-erase control read as a loom illustration, not a control; replaced
  the wide cloth-strip `Unravel` widget with `UnravelRing`, matching the
  seal's own circular tap-mode fallback (96×96, `SealZone.tsx`'s
  `ringFallback`). Progressive hold feedback was already there — this
  changed the shape, not the mechanic: the ring empties as you hold
  (deliberate inverse of the seal's ring, which fills), coloured with the
  current book's dye. `src/ui/Unravel.tsx` removed, no longer referenced.

- ✅ 2026-09-22 — **Knot opener clears safe-area insets** (#30, PR #37) so
  a right-edge display cutout or curved-edge screen can't clip the "Knot"
  label — reported as the pill rendering "kno". The IA half of #30
  ("should just be a settings icon") stays open under Under consideration.

- ✅ 2026-09-22 — **Edited cues actually persist** (#32, PR #36). `Flow.tsx`
  read `services.cue.current()` fresh on every render instead of from
  state, so a save via `CueEditor` never triggered a re-render and the
  edited sentence appeared to revert. Added `cueState`, mirroring the
  pattern `Knot.tsx` already used for its own copy of the cue.

- ✅ 2026-09-07 — **Knot declutter** (PR #24): nested-modal fix for the
  reading-history and chapter-row controls, plus the flat six-section
  accordion split into an everyday tier (weave, cue, reading history) over a
  grouped "More" tier (Your data · Practice · About).
  Plan: `docs/plans/knot-declutter/plan.html`.

- ✅ 2026-09-06 — **One Blue Thread rebrand** (PR #18, `2118227`, `v0.6.0`).
  Public identity, Numbers 15:37–41 in full from the bundled WEB text, the
  renamed repo and its canonical Pages URL. Package, slug, database and keys
  unchanged, so it upgrades in place. Cultural review of the origin context
  line is still open; NIV still needs surface-complete permission.

- ✅ 2026-09-06 — **The app opens again** (PR #19, `v0.6.0`). `cueTerms`
  re-normalised each verse once per dictionary candidate, freezing the JS
  thread during `Flow`'s render: 6222ms → 35ms. Every release from `v0.4.0`
  to `v0.5.1` was unusable on a device. Also bundles the three typefaces the
  tokens have always named, and guards two latent hangs.

- ✅ 2026-09-05 — **App quality foundations** (PRs #11–#17, tagged `v0.5.0`):
  packaged fonts, portrait-safe layouts, race-safe startup with visible
  loading/error/retry, a repository-wide 44pt interaction sweep, accessible
  sealing with a two-tap alternative, truly terminal post-seal dismissal,
  honest restorable recovery snapshots plus external backup confirmation, a
  quiet accordion knot with first-class local Support diagnostics,
  virtualized/searchable recorded reading history, and a study discovery
  hint. Device-verification pass (bundled fonts, screen-reader matrix, real
  launch timing, on-device recovery-snapshot exercise) remains open — see
  `docs/plans/app-quality-foundations/plan.html`.
  Plan: `docs/plans/app-quality-foundations/plan.html`.

- ✅ 2026-09-05 — **Account reset** ("the unravel"): press and hold to erase
  everything and return to first run. Design settled by `/grill`; see the
  decision entry in `JOURNAL.md`.

- ✅ 2026-09-05 — **"The Loom" aesthetic rollout** (PRs #1–#7): the demo page, a
  new app icon, the natural-dye palette, a tested cloth-geometry module, and the
  weave zone, thread rail and seal rebuilt as woven cloth. The weave zone now
  shows the current book as a bolt — warp = chapters, rows = calendar days, a
  missed day leaves bare warp — replacing the calendar-month grid.
  Plan: `docs/plans/aesthetic-thread-textile/plan.html`.

- ✅ 2026-09-04 — Tyndale Open study notes, Bible dictionary, and passage-range remembering
- ✅ 2026-07-21 — W13 adaptive layer (Thompson sampling nudge-hour bandit)
- ✅ 2026-07-21 — §19 operations, W10 completion, R6 year review
- ✅ 2026-07-15 — W12 lapse ladder + partner hand-off
- ✅ 2026-07-15 — W9 analysis engine + reports, W10 encrypted backup
- ✅ 2026-07-14 — W1–W8: foundation, text layer, five-zone flow, knot, recall,
  notifications, experiment engine
