# Status

_Last updated: 2026-10-07 (What's new plan approved and built on `feat/whats-new`)_

## Current phase

Plan work-packages W1–W13 are complete. Four subsequent releases have also
shipped and are on `main`: the **Tyndale Open Resources** addition (offline
study notes, dictionary discovery/search, book introductions, passage-range
remembering — tagged `v0.3.0`, then `v0.3.1` after a corpus-size fix), the
**"The Loom" aesthetic rollout** (PRs #1–#8, tagged separately in the journal),
**account reset as "the unravel"** (PR #9), and **app-quality-foundations**
(fonts/safe-areas/race-safe startup, 44pt controls, operable seal, honest
on-device recovery + external backup, a quiet knot with local Support,
searchable reading history, and a one-time study hint — 7 stacked PRs,
#11–#17, tagged `v0.5.0`) — see `docs/plans/README.md`.

## Branch state

`main` at `c090a25`, level with `origin/main`. Since `v0.6.0` (`25a3faf`):
#23/#24 (`fix/launch-hang` render-path guard, then knot declutter — nested
modals, opener affordance, everyday/rare tiers), #25 (unravel hold survives
the sheet's ScrollView), #26 (grill skill framing), #27 (landing page
realigned with the shipped app), #28/#29 (README reordered and trimmed), #33
(a "Sealing" toggle in the knot so a reader can switch back from tap-to-seal
to hold-to-seal), #34 (deterministic `catch-me-up` fact sheet,
`scripts/catch-me-up.mjs`), and today's #35/#36/#37: the start-over control
reshaped as a ring (#31), an edited cue actually persisting on screen (#32,
previously silently reverting), and the knot opener clearing safe-area
insets so its label can't clip (the other half of #30 — "should just be a
settings icon" — is tracked in `ROADMAP.md`, not fixed here). The `v0.4.0`,
`v0.5.0` and `v0.5.1` release notes carry a warning that those builds do not
open.

Run `node scripts/catch-me-up.mjs` for live worktree/branch state instead of
trusting a paragraph here — it was stale for two weeks the last time someone
hand-wrote it (see `JOURNAL.md`'s 2026-09-07 entry for what that cost).

**Worktrees - check `git worktree list` before trusting any of them.**

- `thread/` is on `main` and is the authoritative checkout.
- 2026-10-07 cleanup (owner's call): the `thread-aesthetic-loom`,
  `thread-catch-me-up`, `thread-lab-trial-integrity` and `thread-seal-fell-line`
  worktrees, every merged branch, and the empty leftover folders were removed.
  The uncommitted work they held was discarded on purpose: the apple-web-pwa and
  lab-trial-integrity plans, and the unfinished lab-integrity code. Re-plan it
  from scratch if it is ever wanted.
- Other sessions open short-lived sibling worktrees (`thread-<topic>`) for their
  own branches. Leave any you didn't create alone.

**2026-09-07 correction (kept for the lesson):** `git fetch` updates
remote-tracking refs, not local branch refs. `fix/knot-declutter` was branched
from a local `main` that had never been fast-forwarded, putting it 24 commits
behind `origin/main` and missing the whole rebrand and font bundling. Caught
before merge by re-checking `main..origin/main`. See `JOURNAL.md`'s 2026-09-07
entry.

## The app opens again

`v0.4.0` through `v0.5.1` all shipped an app that froze on its launch screen.
`cueTerms` re-normalised each verse once per dictionary candidate (~7,900 per
verse); with no early return a 21-verse sitting scanned the lot, blocking the
JS thread inside a `useMemo` during `Flow`'s render. Normalising once per
verse took that from 6222ms to 35ms. The weave kept animating throughout
because Reanimated runs on the UI thread, and `LaunchWeave`'s stall timeout
could never fire because `setTimeout` needs the blocked thread - so the Retry
button that would have escaped it never appeared.

The SDK 57 dependency alignment (tagged `v0.5.1`) was never the cause, but its
device-launch gate is now satisfied along with everything else: the `v0.6.0`
build was installed over a populated build on a Motorola edge 50 neo
(Android 16), kept its reading history, reached the reading screen, rendered
all three bundled typefaces, and sat idle instead of pinning a core.

## Verification (Tyndale release, historical)

- `npm test` - 318 passing at the time; 461 passed / 1 todo at the knot-declutter
  merge, 462 cases today.
- `npm run typecheck` — clean.
- `npm run check:tyndale` — 17,477 study resources, 6,010 dictionary articles,
  66 canonical book partitions, references, links, hashes, and notices verified.
- Android production Metro export — clean after runtime corpus packing; compressed
  export is 10.4 MiB and Hermes bytecode is 20.0 MB, down from 40.0 MB in v0.3.0.
- Physical-device accessibility/startup profiling for Tyndale, and the two
  loom device checks (Psalms/Jude widths, warp colour on a real screen), remain
  open manual checks — no Android device or emulator available in this
  environment.

## Active plans

- **experiment-suite-review** - 📋 planned, saved for later (C4, not yet approved). The experiment engine goes behind one Experiments switch, off by default. Also: the E9 probe is removed, the dose ladder becomes visible with "Read the whole chapter", nudge delivery is recorded, and the knot gets Reading settings and Experiments rows (direction C). The Smart Review is done. The owner authorized merge-and-deploy in one run once the plan is approved. See `docs/plans/experiment-suite-review/`.

- **bibleproject-book-videos** — ✅ shipped in `v0.11.0` (C4; PRs #57–#64 and #66, plus the release PR). BibleProject overview links at a book's start and end. Optional daily **headnotes**, read back as the book's **contents** at "You finished" and in Reading history. Hairline headpiece/tailpiece ornaments. The README and website are refreshed. The device check passed. The backup export/restore round trip on a device is still owed, and unit tests cover it. See `docs/plans/bibleproject-book-videos/OUTCOME.md`.
- **whats-new** — 🔨 in progress (C2, approved 2026-10-07). After an update, a
  quiet What's new card above the reading, and every note under Knot › More ›
  About. Notes are bundled per release tag in `src/whatsNew/`, and new readers
  never see a card. Both slices are built on `feat/whats-new`. See
  `docs/plans/whats-new/`.
- **recall-settings** — ✅ merged (PR #48, `7659fcd`), released in `v0.9.0`.
  A memory library in the knot (add any passage, edit, start over, delete,
  review now, daily cap), optional multi-pick book end, and the probe stops
  using marks. Migration V13 is additive. Owner device check outstanding (see
  `OUTCOME.md`). See `docs/plans/recall-settings/`.
- **recall-cloze-ladder** — ✅ merged (PR #45, `d85f963`), released in `v0.8.0`.
  Recall passages are cloze cards on a seven-rung ladder, and the next-day probe
  asks about up to 3 verses you read (#40, #41). Migration V12 is additive. Owner
  device check outstanding (see `OUTCOME.md`). See `docs/plans/recall-cloze-ladder/`.
- **one-blue-thread-rebrand** — ✅ shipped in `v0.6.0` (PR #18, `2118227`).
  Public name, notification title, backup filenames, onboarding, knot, website
  and release artifact all renamed; the Android package, Expo slug, database,
  keys and deterministic seeds are untouched, so it installs as an upgrade. The
  repository is now `sbrn3/one-blue-thread` and the GitHub Pages URL is the
  permanent canonical address - no domain will be registered. Numbers 15:37-41
  ships in full from the bundled WEB text wherever the name is explained; NIV
  remains gated on surface-complete written permission. Still open: cultural
  review of the origin context line.
  See `docs/plans/one-blue-thread-rebrand/plan.html`.

- **app-quality-foundations** — ✅ shipped. 7 PRs (#11–#17) merged to `main`
  in order, tagged `v0.5.0`; each independently focused-tested. See
  `docs/plans/app-quality-foundations/plan.html`'s per-slice ledger for exact
  gaps per PR — the device pass below remains open.

- **knot-declutter** - ✅ shipped on `main` (PR #24, `3c873f8`). The knot's
  "Reading history" and chapter rows opened nothing (a second `<Modal>` stacked
  on an already-open one); fixed by nesting both inside the knot's own modal
  tree. Also split the flat six-section accordion into an everyday tier (weave,
  cue, reading history) over a "More" disclosure grouped Your data · Practice ·
  About, with attention-promotion preserved. A follow-up, PR #25 (`e5bfc61`),
  let the unravel hold survive the sheet's `ScrollView`. Owner device check
  (reading history actually opens) was deferred to release by decision and is
  still outstanding. Issues #30 and #32 were the first reader feedback on this
  surface, both fixed today (PR #37 — knot opener label clipping; PR #36 —
  edited cues not persisting on screen); #30's "should be a settings icon"
  half is tracked separately in `ROADMAP.md`.
  See `docs/plans/knot-declutter/plan.html`.

- **arrival-zone-progress-display** — 🔨 implementation complete; PR open.
  Adds `E11`/`E12` reversal experiments (day-count and sitting-count line
  visibility in `ArrivalZone`) to the existing lab queue, appended after
  `E3`, using the same mechanism. C2: 8 files, 2 commits landed (486
  passed/1 todo, typecheck clean). PR #39 on
  `feat/arrival-zone-progress-visibility`. Both experiments are inert until
  an active phase — ~11 months out behind the existing queue.
  See `docs/plans/arrival-zone-progress-display/plan.html`.

- **knot-opener-icon** - 🔨 implemented in the working tree, not committed. Gear
  opener, stable re-ordered knot (Preferences / Your data / About), backup
  demoted, Start over and cue-save fixes, Report a problem link, translation
  switch (absorbs `knot-translation-switch`). Open: owner device checks (Start
  over hold, cue edits) and live NIV/ESV key round-trips before merging the
  translation half. See `docs/plans/knot-opener-icon/plan.html`.
- **seal-affordance** - ✅ merged to `main` (PR #43), included in the next release after `v0.7.0`. The seal is now the fell
  line (outlined pill on a thread across the page) and the rail locks onto it;
  rail fix ships first. Open: owner device checks (rail/line alignment on a
  notched phone, hold feel, tap mode). See `docs/plans/seal-affordance/plan.html`.

## Next actions

- [x] ~~Build and install a fresh APK; confirm cold launch on the Android
      device.~~ Done 2026-09-06 on `v0.6.0` - and it found the launch hang that
      had been shipping since `v0.4.0`.
- [ ] Give the suite a real component renderer. PR #21 added a stand-in -
      `test/render-path-cost.test.ts` calls what one `Flow` render calls, in
      render order, against Psalm 119 (176 verses, the canon's worst case), and
      was verified to fail: reintroducing the defect takes it to ~30s against a
      2s bound. That guards this bug class, not the gap itself - nothing still
      renders `Flow`. The obvious route to a renderer adds `react-native-web`;
      with Apple support parked, that dependency choice is this item's own.
- [x] Install the dev-client APK. Done 2026-10-01 and confirmed over adb on
      2026-10-07 (`DEBUGGABLE` plus the dev launcher). How to check it and how
      to serve it a bundle is in `AGENTS.md` → "The owner's phone".
- [ ] One Blue Thread: cultural content review of the origin context line by
      someone competent in Jewish biblical practice. Ticket 0 is otherwise
      closed - no domain will be registered, and the repo is now
      `sbrn3/one-blue-thread` with the GitHub Pages URL as the permanent
      canonical address. NIV stays gated on written, surface-complete
      permission; the bundled WEB passage ships.
- [ ] One Blue Thread ticket 6 device matrix - partly done on 2026-09-06.
      Confirmed: installs over a populated build with reading history intact,
      and `refreshDisplayName()` ran (the boot trace logged it completing).
      Still unchecked: the launcher name and notification shade by eye, and the
      origin passage under Knot -> App at 200% type with a screen reader.
- [ ] Physical-device checks: Tyndale accessibility/startup profiling; loom
      Psalms/Jude widths and warp colour `#8F8779` on a real screen.
- [ ] app-quality-foundations device pass: ~~bundled font assets~~ (done in
      `v0.6.0` - three OFL variable fonts bundled and confirmed rendering on
      device), TalkBack/VoiceOver/
      Switch Control + 200% text matrix, real launch timing (fast/400ms/13s/
      14s/rejected), and an on-device exercise of the real `expo-file-system`
      recovery-snapshot move/rotation calls (PR #14 is fake-IO tested only).
- [ ] Smoke-test `src/text/esv.ts` and `src/text/apiBible.ts` against real keys by pasting each into the knot's Translation row.
