# Journal

Reverse-chronological session notes. Newest first. Keep entries short: what
changed, why, and anything the next session needs to know.

---

## 2026-10-11 — every session wrapped up; one plan for what's next

The owner asked for all the sessions to be wrapped up and the docs brought into line. STATUS.md was rewritten around one ordered **Next actions** list. Read that first; this entry only records what happened.

- **Sessions:**
  - bible-reading-app-76 (headnotes and the device sweep) stopped. All its work is merged (#64, #66, #67, #70, #71, #73, #77).
  - bible-reading-app-62 had nothing open.
  - This session (reading-screen-and-motion) stopped after the docs.
  - No session is driving the phone.
- **Saved from loss:**
  - The experiments opt-in plan (experiment-suite-review, C4) was uncommitted in `thread-experiment-suite-review/` after its session closed. It is now committed as it was, on branch `docs/experiment-suite-review` (`b9e5866`). It isn't approved and isn't on main.
  - A 2026-10-07 side-tab journal entry (API-key help) was uncommitted in `thread/`. It's now in place below.
- **Found, not yet fixed:**
  - **A blank white screen**, seen once on the dev app running `743eab4` (waves 3–4): JS reached `launchDismissed` with no errors. It's unreproduced, and it blocks any release from main (Next actions 1).
  - **The real app still has #77's backup bug**, so every second recovery snapshot fails. A `v0.12.1` patch cut from `v0.12.0` is proposed (Next actions 2).
- **Dev app data:** deliberately not restored at the owner's request. Sealing is "hold", the v0.11.0 card is dismissed, and its recovery folder heals on the next snapshot.
- **The release app:** v0.11.0 was installed over it on 2026-10-10 with `adb install -r`, keeping its data. It wasn't opened.

## 2026-10-10 — reading screen and motion built (C4); waves 1–2 shipped in v0.12.0

Merged in wave order:
- **#68 (wave 1):** the device toolkit (`scripts/device/`) and the motion tokens.
  - Launch fix: the reading screen paints in 2.5 s instead of 13 s. `cueTerms` had been re-normalising 7,943 dictionary aliases during the first render.
  - A linen splash.
  - Seal and unravel holds that show progress from touch-down.
  - Bundled italics.
- **#69 (wave 2):** the knot opens without a jump, full-screen sheets slide (`ui/Sheet.tsx`), and verse taps are fast (the study pack is prewarmed).
- **#72 (wave 3):** Direction A. A short arrival header and one "Before you read" list; the arrival weft; rows that stitch open.
- **#74 (wave 4):** sealing weaves today's row into the cloth, and the knot's selvedge and heading wefts.
- **Audit:** a folded "Before you read" row unmounted its zone, so a graded recall card could be graded again. Fixed in the wave-5 PR.

v0.12.0 (tagged by another session, release PR #73) carries waves 1–2 and the device-sweep fixes (#70).

## Decision 2026-10-10 — Direction A and three measurement boundaries

The owner chose Direction A, "Open at the text", on 2026-10-08. Scripture starts on the first screen, under one "Before you read" list. Three boundaries were accepted, so analyses that span them should split there:
- **E1** (hold vs tap): the seal hold now shows progress from touch-down and commits while the finger is down (S02, `7f4b11d`, follow-up `cb00f1a`). `hold_cancel` and the signature's mechanic-friction rate now come from a hold that gives feedback. Before cb00f1a, a committed hold could also log a spurious `hold_cancel` on finger-up. That bug never shipped in a release.
- **E9** (probe): presentation only (S06, `127e00c`). The probe sits inside the list, open by default, and is still logged at load. `recall_shown` is still logged when passages are due, but memory now starts folded, so the event means "listed" rather than "on screen".
- **E4/signature:** short sittings fire `reading_start`/`scroll_end` without a scroll (PR #66, `af73832`). That entry recorded it as a bug fix, not a boundary, so it is recorded here.

## 2026-10-09 — book bookends shipped as v0.11.0

The device checklist ran on the dev client in two rounds, and the dev DB was restored byte-identical afterwards. Passed:
- the v13 → v14 upgrade, with every event kept;
- writing, editing, narrowing and deleting a headnote, and its keyboard behaviour;
- a kill and reopen;
- the contents at the end of a book and in Reading history;
- the first-sitting headpiece.

Fixed along the way:
- **#66:** a short sitting never unlocked the seal (an existing bug), and the field's rule was drawn on all four sides.
- **The release PR:** the verse picker list went blank (FlatList `initialScrollIndex`), and a headnote deleted in history stayed on the reading screen. `src/state/headnoteEpoch.ts` now signals Flow to re-read.

**Handoff:** export and unravel passed on the device on 2026-10-10. Restoring from file and a pre-V14 restore were not run on a device, and unit tests cover both.
**Branch:** fix/headnotes-device-round2

## 2026-10-08 — book bookends built: BibleProject overviews and headnotes (C4)

Merged in slice order as PRs #57–#64, with no release tagged yet.
- **#57 (S00):** the README and both website pages refreshed for the shipped app: features, the Loom tokens and the real copy. This covers the cloze recall, the probe, the verse sheet, the fell-line seal, the gear, the knot's tiers and the book end. Claims were checked against the code.
- **#58 (S01):** BibleProject overview links on a book's first sitting and at "You finished". All 71 URLs were verified by page title (`npm run check:overviews`), because the site answers 202 to any path.
- **#59 (S02):** an additive **V14 `headnotes`** table; the optional "Write a headnote" sheet after the seal; backup and reset coverage; boundary tests.
- **#60 (S03):** each book's contents in Reading history, and the headnote above the chapter in the viewer.
- **#61 (S04):** the contents at "You finished".
- **#62 (S05):** narrowing a headnote to verses.
- **#63 (S06):** the site and README show the feature.
- **#64:** final-audit fixes. The audit found no HIGH issues; the MEDIUM finding was the sheet reviving stale words.

Design: five rounds. Headnotes was chosen in round 3, and round 5 kept it clean with two hairline ornaments. Round 4's "woven" art was rejected as tacky (see the plan's Aesthetics tab).
**Handoff:** the plan's **mandatory migration/backup/reset checklist has not been run** on the dev client (`com.sngugi.thread.dev`). Don't tag a release until it has. Once it has: tag `v0.11.0` with the What's-new lines drafted in PROGRESS.md, then write OUTCOME.md.
**Branch:** feat/headnotes (worktree `../thread-headnotes`)

## Decision 2026-10-07 — takeaways (now "headnotes") are the reader's editable words, kept outside the event log

**Decision:** a daily takeaway is optional, offered after the seal, and linked to the day's passage (or to verses the reader narrows it to). The reader can edit and delete it, so it lives in its own table rather than in the append-only `events` log.
**Why:** these are the reader's own words. A typo or a regretted line has to be fixable, which the log's append-only rule can't allow. Making a takeaway optional keeps the seal unchanged and keeps it from becoming a chore.
**Consequences:** migrations are additive-only, so the table is permanent once shipped. Takeaways can't be reconstructed from the log, so backup and the unravel must handle them explicitly. Book summaries will have gaps on days with no takeaway.
**Branch:** main (grill only; `docs/plans/bibleproject-book-videos/`)

## Side-tab 2026-10-07 — API-key instructions for licensed translations

**Job:** explain how to get an NIV/ESV API key in Settings → Translation (and onboarding).
**Changes:**
- New shared `src/ui/KeyGuide.tsx`: one line on why a key is needed, three numbered steps per publisher, and a signup link with a typed-URL fallback. It is used in `knot/TranslationSection.tsx` and `onboarding/screens/TranslationScreen.tsx`.
- Steps checked against the publishers' docs. API.Bible: dashboard → **Plan** → edit plan → add the NIV (Starter allows up to 3 copyrighted Bibles, no approval needed). ESV: `api.esv.org/account/create-application/`.
- Defined "Licensed translation" in `docs/CONTEXT.md`. Registered KeyGuide in `ui-contracts` and `brand-voice-inventory`.
- Committed and pushed as `1dd4325`.
**Handoff:** not yet checked on a device: the links open the right pages, and onboarding step 4 still fits a small phone. Neither key provider has been tried with a real key.
**Branch:** main

## Decision 2026-10-07 — Apple support parked; the web/PWA plan is discarded

**Decision:** drop `apple-web-pwa` from the plans and STATUS; keep Apple support only as a distant ❄️ item in `ROADMAP.md` → Parked. The plan files were never committed; their only copy was discarded with the `thread-aesthetic-loom/` worktree.
**Why:** there are no Apple readers. The plan would have cost about 12 sessions, given up backup on web and the in-app cue, and shipped with no Apple hardware to verify it. If Apple readers appear, re-plan from current `main`.

## 2026-10-07 — memory library built (recall-settings)

Merged as PR #48 (`7659fcd`) and released as `v0.9.0`.
Built the plan from the 2026-10-06 decision below:
- migration V13 (`passages.source`);
- the Memory API (any number per book, add, edit, start over, delete, daily cap);
- the probe no longer reads marks;
- the passage picker;
- the library sheet in the knot;
- a reading-screen recall set frozen per day, and a multi-pick book end.

The Smart Review's 3 HIGH findings shaped the build: the frozen daily set, one shared duplicate check, and the contract entries moving with the picker. Next: owner device check.
**Branch:** feat/recall-settings

## Decision 2026-10-06 — memory passages become a library you control; the probe stops using marks

**Decision:** memory passages get a library in the knot (see all, add any passage via a book/chapter/verse picker, edit the range, reset, delete, review now). The §21 "one promoted passage per book, at book end" rule is dropped: promote any time, and the book-end prompt stays as an optional offer of that book's marks. The daily cap becomes a setting (1–10, default 2). The E9 probe stops preferring marked verses and uses only the seeded span; picker-added passages do not count as E4 marks.
**Why:** a fixed one-per-book choice made at book end can't fix a range picked too short or too long, or learn a passage you didn't read that day. Keeping the experiments (E4, E9) independent of library actions keeps their data clean.
**Consequences:** §21's scarcity is gone, so recall load is bounded only by the cap. Probe spans after this change no longer favour marks — a second E9 boundary after the 2026-10-02 one. E4 marks-per-chapter and the R6 held-60-days count still read the passages table, so deleting or starting over a passage changes their past values. This is accepted, because those are reader-owned corrections.
**Branch:** grill/recall-settings

## 2026-10-06 — recall cloze ladder built (#40, #41)

Merged as PR #45 (`d85f963`) and released as `v0.8.0`. Built the plan from
the 2026-10-02 decision below: migration V12, cloze engine
and ladder, seal records the verse range read, the narrowed E9 probe, and the
new RecallZone/ProbeZone. 564 tests green. Not checked on a device: how the
underscore gaps and stubs wrap, and screen-reader reading. Existing promoted
passages start on a rung derived from their box. Next: owner device check.
**Branch:** feat/recall-cloze-ladder

## Decision 2026-10-02 — the next-day probe asks about a few verses, not the chapter

**Decision:** E9's next-day probe narrows from "recall yesterday's whole chapter" to a span of about 3 verses — a verse the reader marked in that chapter, else a seed-chosen run inside the verses actually read — shown with its reference. Issues #40 and #41 are planned together as the cloze ladder (`docs/plans/recall-cloze-ladder/`): cloze cards only, scheduling stays Leitner with the 2-a-day cap.
**Why:** a whole chapter a day after one reading is not something anyone can recall, so the probe measured nothing useful and read as a bug. Adopting only Anki's cloze idea keeps the §21 "deliberately not Anki" scheduling choice.
**Consequences:** E9 grades before and after this change are not comparable; the dose analysis counts only span-level probe grades. Probe logging stays keyed by book and chapter.
**Branch:** feat/recall-cloze-ladder

## Decision 2026-10-02 — the seal is the fell line (supersedes the open-row plan)

**Decision:** the weave-as-button seal is replaced by a thread across the page
with an outlined pill; the rail's fell locks onto it and sweeps to the bottom
once sealed. Rail fix (windowed bare warp, full-height cloth) landed with it. Merged as PR #43; goes out in the next release after v0.7.0.
**Why:** the weave neither read as a button nor fit the page. **Next:** check on
device — rail/line alignment on a notched phone, hold feel, tap mode.

---

## 2026-10-02 — knot-opener-icon shipped as v0.7.0 (PR #42)

Grilled, planned (C3, `docs/plans/knot-opener-icon/`), built and released in one
sitting: gear opener, stable knot (Preferences / Your data / About, nothing
promoted, backup demoted), translation switch (absorbed the parked
`knot-translation-switch`), "Report a problem" link, and fixes for Start over
and cue saving. Decisions are in the 2026-10-01 entry below and the translation
plan's 2026-09-05 one.

Next session needs to know: **neither fix has run on a device.** Start over's
cause is a hypothesis (the long-press sits in an RN Modal and needed its own
`GestureHandlerRootView`; a pre-wipe failure now shows an error instead of being
silent). The cue bug was two separate state copies (`Flow` and `Knot`); it is now
one `CueService.subscribe`/`useCue`. NIV and ESV have still never run against a
live key: pasting one into Translation is the first real test. Night mode and
its Appearance row remain a separate, unstarted grill. Branch: `main`.

## Decision 2026-10-01 — the knot stops promoting Safekeeping and Support

**Decision:** When Safekeeping or Support needs attention, it no longer jumps
to the top of the knot and force-expands. It stays in its normal group (Your
data / About), collapsed like every other item, and carries a visible "needs
attention" marker. This reverses the `promoted` mechanic `knot-declutter`
shipped (`Knot.tsx` `handleOpen()`, `MoreSection.tsx`'s `promoted` guards).

**Why:** Grill on issue #30. The reader's real complaint about the sheet's
order and hierarchy was not the Your data / Practice / About axis but that the
layout rearranged itself ("why would all the safekeeping settings be expanded
and at the top?"). A sheet whose order changes depending on state can't be
learned; things are never where you last found them. Trade-off accepted: an
urgent problem is now one glance-and-tap further away than when it was
pre-expanded.

**Amendment (same day, owner):** backup is not a priority for this reader, so
Safekeeping is demoted further. It never raises the opener's dot or a "Needs
attention" marker; only Support does. Trade-off knowingly accepted: a failing
backup now surfaces only when you open Safekeeping. Automatic snapshots keep
running.

**Consequences:** The everyday tier loses its conditional attention slot, so
it is the same every time. The opener's attention dot must now point at a
marked row inside More, not at something already visible. Grouping axis stays
Your data / Practice / About.

**Branch:** none yet (grill only; see `docs/plans/knot-opener-icon/`).

## 2026-09-22 — the start-over control, shaped like a button

Reader feedback on issue #31: the hold-to-erase control (`ResetSection.tsx`)
didn't read as a control — it rendered `Unravel`, a wide (260×150) illustration
of the current book's cloth pulling apart chapter-by-chapter. The ask was for
something that looks like "a normal circular seal button." The progressive
hold feedback it also asked for already existed (the cloth visibly unravelled
as you held); only the shape was the actual gap.

Replaced `Unravel` with a new `UnravelRing` (`src/ui/UnravelRing.tsx`): a
96×96 SVG ring matching the silhouette of `SealZone.tsx`'s own circular
tap-mode fallback (`ringFallback`), coloured with the current book's dye.
Kept it the deliberate inverse of the seal (docs/CONTEXT.md): the seal's ring
*fills* as you hold; this one *empties* — same `strokeDasharray`/
`strokeDashoffset` mechanic, opposite direction, still driven by the same
shared `progress` value `ResetSection` already animated. No change to the
gesture, timing, scroll-lock, or reduced-motion/screen-reader fallback path —
only the visual in the hold-and-confirm state.

`src/ui/Unravel.tsx` and its per-chapter warp/weft rendering are gone —
nothing else referenced it. `bundledChapterCount` and `bolt.sealed` are no
longer needed in `ResetSection.tsx` since the ring doesn't depict individual
chapters; `deriveBolt` is still called for `bolt.book`, which the ring's dye
color comes from.

`npm test` (462 cases, 461 passed/1 todo) and `npm run typecheck` both clean.
No device check — no Android device or emulator available in this
environment; the shape change is inferred from source and the same-mechanic
`progress` wiring, not verified against real touch/haptics timing on a phone.

ROADMAP.md's #31 entry moved from "Under consideration" to "Shipped."

## Decision 2026-09-22 — two new reversal experiments for ArrivalZone's progress lines

**Decision:** Add two new experiments to the reversal queue (after `E3`,
same "Visible"/"Hidden" arm shape as `E3` STREAK VISIBILITY): a day-count
experiment on `ArrivalZone`'s "Day N in {Book}" line, and a sitting-count
experiment on its "sitting X of Y" line. Queue becomes `E7, E4, E1, E3,
<day-count>, <sitting-count>` — day-count first since it's the line
actually suspected of causing harm (anxiety/comparison), sitting-count
after since it was flagged as probably-functional wayfinding but the user
wanted it tested rather than assumed. Hidden arm = line fully removed
(matches `E3`'s own convention), not de-emphasized.

**Why:** `CONTEXT.md` already declares the fell line the app's only
progress indicator, in tension with these two raw numeric counters; rather
than resolve that by judgment, the existing on-device reversal-experiment
engine (zero telemetry, single-user, `src/lab`) already has the exact
mechanism needed (E3 is structurally the same visible/hidden toggle) so
it's used instead of guessing or building new infrastructure. E7/E4 stay
first because their outcomes redefine what "sealed" means and would
re-base anything queued after them; these two are pure display questions
like E1/E3, so they trail.

**Consequences:** Each reversal experiment runs 4 phases × 21 days ≈ 84
days; appending two more extends the full queue by roughly 168 days on top
of the existing ~336-day backlog (E7→E4→E1→E3) before both new questions
get an answer — this is a single-user, one-reversal-at-a-time trial, so
there's no way to parallelize or speed this up. Only informs this one
profile's read on the question, not a general answer for all readers.

**Branch:** fix/lapse-zone-cue-save

## 2026-09-07 — the knot declutter

Two faults behind one complaint ("the knot is a mess, buttons don't work,
it's cluttered"): `HistoryModal` and `ChapterViewer` opened as a second
`<Modal>` stacked on an already-open one — React Native never presents that,
so "Reading history" and chapter rows did nothing — and the knot had grown
into a flat six-section accordion of ~60 controls at equal weight. Plan:
`docs/plans/knot-declutter/plan.html`, grade C2, direction A confirmed
through `/grill` and a mockup gate.

Fixed by nesting both modals inside the knot's own modal tree (matching what
`DictionaryLibrary` already did correctly), and split the sheet into an
everyday tier (weave, cue, reading history) over one "More" disclosure
grouped Your data / Practice / About — dissolving the old "App" grab bag.
Safekeeping or Support promotes into the everyday tier, already open, when
either needs attention. The opener gained a hairline pill affordance and a
live attention dot, backed by a new `hasSupportAttention(db)` — a cheap,
bounded stand-in for `needsAttention(getSupportSummary(db))` so the opener
can light its dot on the reading screen without repeating the unbounded
amendment-log read that caused the `cueTerms` launch hang. Added a
source-walking invariant (`test/ui-contracts.test.ts`) so no component can
ship a modal-opening child rendered outside its own modal tree again.

**Accepted risk, decided by the owner:** merged on the automated gate
(`npm test` + `npm run typecheck`, 461 passed/1 todo) with the device check
(reading history actually opens) deferred to release rather than gating the
merge. The modal diagnosis is inferred from source, not reproduced — no
Android device or emulator exists in this environment. Named fallback if
history is still dead after this ships: the `KeyboardAvoidingView`
(`behavior="height"` on Android) wrapping the sheet.

**Also found and fixed in-flight:** `fix/knot-declutter` had been branched
from a stale local `main`, 24 commits behind `origin/main` (missing the
whole One Blue Thread rebrand and font bundling — `BrandOrigin` didn't exist
on the branch). Caught before merge by re-checking `main`..`origin/main`;
fast-forwarded and rebased cleanly, no conflicts. Worth the reminder: `git
fetch` updates remote-tracking refs, not local branch refs — cutting a new
branch from a local `main` that hasn't itself been fast-forwarded silently
drops everything merged since.

Branch: `fix/knot-declutter`, PR #24.

## 2026-09-06 — the app had not opened since v0.4.0

Every release from `v0.4.0` to `v0.5.1` froze on the launch screen. `cueTerms`
scans ~7,900 dictionary candidates against every verse, and `locateCandidates`
re-normalised the whole verse text on each call - the same text, ~7,900 times
per verse. When a sitting yields fewer than the 4 cues it wants there is no
early return, so a 21-verse sitting scanned the lot: 6222ms on desktop V8, and
far worse on Hermes, where NFD normalisation goes out to ICU. It runs
synchronously in a `useMemo` during `Flow`'s render and only bites once
`session.sittings` is populated. Normalising once per verse: **6222ms → 35ms**,
byte-identical cues.

**Why it stayed hidden for four releases.** The weave kept animating, because
Reanimated runs on the UI thread - the app looked alive while it was dead.
`LaunchWeave`'s 14s stall timeout never fired, because `setTimeout` needs the
JS thread, so the Retry button that would have escaped it could never appear.
And the suite is logic-only with no component renderer: nothing has ever
rendered `Flow`, which is exactly where this lived.

**How it was found, and the lesson.** Three device builds were spent on wrong
guesses - `splitSittings` with a zero target, `datesBetween` walking a
malformed bound, `deriveBolt` sizing an array from a bad date. The first two
are real defects and are now guarded; none was this bug. What actually found
it was numbering every effect and the render tail, then a seven-second Node
benchmark. Instrument before theorising, and prefer a benchmark to a device
build for anything reproducible off-device.

**Also shipped here:** the three typefaces `tokens.font` has always named were
never bundled and `expo-font` was never called, so Android logged
`Build font failed` and silently drew everything in the system fallback - the
app had never once looked the way the design system specifies. Bundled as
upstream OFL variable builds, whose weight axes cover the 400-900 range in
use, so no style needed renaming. `useFonts` is deliberately not a render
gate: blocking the tree on an async load is how the launch screen froze.

**Verified** on a Motorola edge 50 neo (Android 16): installed over a
populated build, reading history intact, reaches the reading screen, all three
fonts render, JS thread idle instead of pinning a core. Tagged `v0.6.0`.

**Loop cost.** Five release builds, ~100 minutes, and every change in them was
JS or an asset. A `Dev client APK` workflow and Gradle caching now exist so
that never has to be the loop again.

## Decision 2026-09-05 — no domain; the repo carries the canonical URL

**Decision:** One Blue Thread will not register a domain. The repository is
renamed `sbrn3/thread` → `sbrn3/one-blue-thread`, and
<https://sbrn3.github.io/one-blue-thread/> is the permanent canonical URL.

**Why:** the ownership gate existed to stop a naming conflict surfacing at
public launch. The exact-name search already found no competing Bible app or
active software brand, so the substantive half was satisfied; the domain and
renewal-owner half is disproportionate for a personal single-reader app
distributed as a GitHub release APK, not a commercially defended brand.

The plan named a repo rename as a non-goal, and the objection to doing one was
timing rather than principle: an unresolved domain meant the canonical URL
would move twice, burning the social-preview cache twice. Ruling the domain out
removes the second move, so the rename became a one-time, cheap change and
landed while the PR was still open.

**Consequences:** nine hardcoded URLs (canonical, `og:url`, `og:image`,
`SoftwareApplication` `url`/`downloadUrl`/`image`/`license`, sitemap, and the
README demo and release links) now point at the new address, and both worktree
remotes are updated. GitHub redirects the old repository and Pages URLs, so
existing links keep working. The repo slug was the last identifier still
reading "thread" that is genuinely public; `slug: "thread"`,
`com.sngugi.thread`, `thread.db`, and the SecureStore keys stay exactly as they
are, because those govern whether Android treats the release as an upgrade.

Ticket 0 is closed. Cultural content review of the origin context line and the
Android upgrade device matrix remain the only open gates.

## 2026-09-05 — The rebrand semantic audit is closed

Ticket 6's scoped name search over current surfaces (excluding `JOURNAL.md`,
`docs/plans/`, and bundled assets, which are historical by design) returns 99
hits, all classified:

- **Brand** — the new name on `app.json`, `src/brand/`, backup, knot and
  onboarding copy, `README.md`, `AGENTS.md`, site metadata, and the APK
  artifact.
- **Compatibility** — the legacy pending-notification matcher
  (`title !== 'Thread'`), the dual `thread-backup` / `one-blue-thread-backup`
  filename matcher and its near-miss tests, and the deliberately preserved
  `slug: "thread"` and `com.sngugi.thread`.
- **Technical** — the weaving "Thread count" comment in
  `scripts/lib/icon-mark.mjs`.

One defect: the 24 internal `.agents/skills/` documents still described the
product in the present tense as "Thread". Renamed. No source, schema, event,
seed, or time-boundary change was involved.

Verified: 430 tests, strict TypeScript, and `git diff -- app.json` showing only
`expo.name` changed. `refreshDisplayName()` is wired at the top of
`syncWindow()`, ahead of its early returns, so a paused or nudge-free reader
still gets the title migration.

Still open, and neither is code: ticket 0 (domain, trademark, and cultural
content review) gates public launch, and the Android upgrade/accessibility
device matrix needs physical hardware. The whole rebrand is still uncommitted
in `thread-aesthetic-loom/` on `main`, not on `feat/one-blue-thread-rebrand`
as the plan intends.

## Decision 2026-09-05 — One Blue Thread puts Scripture before product prose

**Decision:** The public product name is **One Blue Thread**, with the descriptor
“A quiet place to read Scripture.” The name is grounded in Numbers 15:37–41.
Whenever a product or marketing surface cites that source or explains the blue
cord, it presents the whole passage on the same surface with attribution; small
surfaces omit the explanation. The app does not generate devotional prose,
summaries, prayers, interpretations, takeaways, or simulated spiritual
authority. Scripture is the primary voice, followed by the reader's own words
and only the operational or factual prose the experience needs.

**Why:** The blue cord gives the name a memorable biblical centre, but the image
must remain subordinate to the passage rather than becoming an invented product
metaphor. The full-passage rule prevents the reference being reduced to a slogan.

**Consequences:** Current releases use the bundled public-domain World English
Bible for the origin passage. NIV remains preferred but cannot ship until
written permission covers every intended app, source, release, website, image,
and marketing surface. The public name changes while the Android package, Expo
slug, database, keys, event names, deterministic seeds, textile code terms, and
legacy backup import remain stable. Exact-name searching found no competing
Bible app or active software brand, and the user accepted unrelated descriptive
results; domain ownership, trademark research, and cultural content review still
gate public launch. Canonical rules live in `docs/BRAND.md`.

## Repair 2026-09-05 - align the SDK 57 native runtime

The installed release dependencies had drifted behind Expo SDK 57's current
compatibility matrix, including Expo core, React Native, SQLite, Notifications,
Reanimated, and Worklets. That is a native/JavaScript mismatch capable of
failing before React paints the launch weave. The dependency manifest and lock
file are now aligned with Expo's required SDK 57 patch versions, and Expo added
the `expo-status-bar` config plugin during the repair. Verification is clean:
426 tests, strict TypeScript, `expo install --check`, public config resolution,
and an Android production Metro export. A fresh APK launch on the affected
physical device remains the release gate.

## Decision 2026-09-05 — WEB is a translation you can choose, not silent infrastructure

**Decision:** The knot gains a translation section that can change provider
(NIV↔ESV), paste or replace a key, or select the bundled public-domain text
outright — named in full as "World English Bible (WEB)", in both the knot and
onboarding. Onboarding's escape becomes "Skip for now — read the World English
Bible" rather than a third card, so screen 5 keeps two licensed choices plus one
low-friction exit. A change logs a new `translation_changed` event that
`hasConfound()` treats exactly as it treats `cue_changed`. Keys are validated by
a live round-trip before being saved; a failed check refuses the save and leaves
the current setting untouched. Keys are kept per provider, so switching back
does not mean re-pasting. A switch reloads today's portion immediately and
restarts it at sitting 1. Both providers must pass a live round-trip before
merge, and the docs that wrongly imply NIV is already proven are corrected as
part of the same work.

**Why:** The plan says the opposite — line 297 calls WEB "silent, automatic
infrastructure, not a choice" and line 313 says it "is never mentioned", with
onboarding screen 5 "the only place translation is ever discussed". That stance
depends on WEB only ever appearing as an invisible catch during a network
failure. It stops holding the moment the knot can change translations at all:
`ChainedProvider` falls back to WEB silently, so an unnamed fallback plus a bad
key produces a reader who believes they are in NIV and is not, with nothing on
screen to contradict them. Naming WEB is what makes the silent fallback legible.
Validation before save closes the same hole from the other side. Restarting the
day's portion rather than clamping follows from sittings being derived from
verse counts that differ per translation — `load()`'s existing
`Math.min` clamp would otherwise drop a mid-read reader past verses they had not
seen, the precise kind of quiet wrongness the monthly eyeball exists to catch.
Re-reading is the safe failure; skipping is not.

**Consequences:** The plan's §19 settings table already classes translation as a
confound, so this is the first setting to make that clause real —
`hasConfound()` has only ever known about `cue_changed` and 7-day gaps, and days
around a switch will now be reported but excluded from verdicts. Recall probes
fetch verse text live, so switching mid-trial changes the wording of an
in-flight memory probe; the confound flag covers the data but the reader still
meets a passage they memorised in different words, which nothing undoes.
Per-provider keys mean two API keys resident in `meta`, which is inside
`BACKUP_TABLES` — an unencrypted export now carries both, where before it
carried one. `niv_bible_id` is cached in `meta` globally rather than per key and
must be cleared whenever the NIV key changes, or a replaced key inherits a stale
bible id. Multi-translation reading stays cut (plan line 226): this is one
primary at a time, changed deliberately, not passages shown side by side.

Designing this surfaced that **neither** licensed provider has ever made a real
network call in this codebase. ESV says so in three places; NIV says nothing, so
it reads as proven when its tests are equally mocked and its only verification
claim is that the host was checked against the published docs. That asymmetry is
not harmless: an earlier `apiBible.ts` pointed at the wrong host and would have
failed silently into the WEB fallback forever, a bug that survived exactly
because nothing exercised it live. The validation round-trip is therefore the
first real exercise of either provider, which is why both are gated on it rather
than ESV alone.

**Branch:** none yet — targets `main` (`efcf041`). Designed via `/grill`; not
implemented.

## 2026-09-05 — Account reset shipped as "the unravel"

Design settled by `/grill` (see the decision entry below), then implemented
directly at the user's request rather than going through `/plan`.

- The reset itself was already written but had never been committed — it sat as
  untracked files on `feat/account-reset`, 25 commits behind `main`. Rebuilt on
  current `main` as `feat/reset-unravel`.
- `performReset()` gained an `onWiped` callback. Without it the UI cannot tell a
  failure *before* the wipe (nothing lost, return to the sheet) from one *after*
  it (data already gone, the app must not carry on). The old `catch` did the
  wrong thing in the second case.
- `src/ui/Unravel.tsx` animates the current book's bolt coming apart: the warp
  stays strung and the weft withdraws, newest pass first, each on its own
  staggered window so it runs on the UI thread with no re-layout.
- Fallback for screen reader / reduced motion is the two-tap confirm, not a
  single tap — the accessible path keeps the same deliberation as the default.

Suite 365 → 374.

## Decision 2026-09-05 — Erasing the account is an unravel, not a danger zone

**Decision:** The account reset is a press-and-hold of about 2.5s that visibly
unravels the bolt of the book being read, re-weaving if released early. The
section is headed "Starting over", not "Danger zone". It offers no backup export
on the way out. Where a hold is unavailable (screen reader active, or reduced
motion), it falls back to the existing two-tap confirm rather than to a single
tap. If the post-wipe reload fails, the app blocks with a "close and reopen"
message instead of returning to the sheet.

**Why:** The app's commit gesture is a hold that weaves; making its destruction
the literal inverse costs almost nothing to build (the loom geometry already
exists) and is far harder to fire through by reflex than a second tap. A longer
hold than the seal's 1200ms prevents muscle memory carrying over from a daily
gesture into an irreversible one. "Danger zone" is borrowed from GitHub settings
and is out of register for an app that deliberately avoids alarm language
everywhere else — gaps stay gaps, a mirror not a threat. Offering an export on
the way out was rejected as friction aimed at the one person who has explicitly
asked for everything to be gone; backup already lives in the same sheet.

**Consequences:** The unravel animates the current book's bolt, which already
renders — so this needs no new derivation and stays inside the existing path
budget. Showing *everything* ever woven was considered and dropped: it would
have required a per-book sealed history that does not exist and a multi-bolt
render that hits the same limit already forcing Psalms to degrade, for a screen
most people see once. The near-empty case is shown honestly rather than
special-cased, so a reader with four days of history watches four rows come
apart; that is the correct signal, but it means the moment has little visual
weight for exactly the person most likely to use it. The two-tap fallback leaves
the accessible path with a different guard from the default one — equal in
deliberation, but not identical in kind.

**Branch:** feat/reset-unravel

## 2026-09-05 — Doc correction: Tyndale was already shipped

- Asked to rebase `feat/tyndale-open-resources` onto `main` (the assumption
  being it predated the loom PRs and would conflict with them). `git rebase
  main` came back with zero commits to replay — checked the reflog first (no
  data lost, original tip `7c5ce98` still reachable) before concluding why:
  the branch tip was already an ancestor of `main`. The 8 Tyndale commits sit
  directly in `main`'s line, fast-forwarded in *before* any loom PR (`#1`
  onward) — confirmed by `src/study/`, `assets/tyndale/`, and tags `v0.3.0`/
  `v0.3.1` all present on `main`, 365 tests passing.
- The branch's own `STATUS.md`/`JOURNAL.md` were never updated post-merge and
  still read "in release verification, pending merge" — that's what caused
  the wrong read the previous session. Corrected `STATUS.md` and
  `docs/plans/README.md` here on `main` to reflect both releases as shipped.
- Retired the now-fully-merged `feat/tyndale-open-resources` branch and its
  worktree (`../thread-tyndale-open-resources`).
- Left open: `feat/account-reset` is a similar situation in miniature — built
  on an older `main`, not yet merged. Worth a rebase check before merging,
  not assumed clean.

## 2026-09-05 — "The Loom" aesthetic rollout

Shipped the whole aesthetic pass as 7 PRs. Plan and design record in
`docs/plans/aesthetic-thread-textile/`.

- **The direction took three attempts.** The first two ("The Sampler", a
  cross-stitch grid; "The Impression", a debossed channel) were both rejected —
  guarding against twee had turned craft into *structure*, structure became
  **grids**, and a grid of discrete cells is the opposite of cloth. The fix was
  a corrected target: a loom, not a sampler. Threads under tension, not a lattice.
- **The idea worth keeping:** one book = one bolt. Warp threads are the book's
  chapters, rows are calendar days, a weft pass is a day read. A missed day
  leaves bare warp you can see through, and the first pass after a lapse leaves
  a permanent set mark. The texture of the cloth is the texture of the practice.
- **Smart Review earned its place.** It found 5 HIGH defects in the plan,
  including a second `WeaveZone` caller (`src/knot/Knot.tsx`) that a naive prop
  change would have broken, and a stale-session trap that would have rendered
  the wrong book's bolt on a book-finish day. Both are now covered by tests.
- **Two pre-existing bugs fixed in passing:** `ink40` was 2.64:1 against paper,
  well under the 4.5:1 floor for the secondary text it is used for; and
  `ThreadRail` forced progress to 1 under reduced motion, showing those readers
  fully woven cloth and no fell line.
- **Left open, deliberately:** a keyboard/switch user without a screen reader
  still gets only the press-and-hold seal. Closing it means restructuring
  §05/§13.4 code and wants its own change.
- **Needs a device:** Psalms (150 chapters) and Jude (1) at real widths, and
  whether the darker warp `#8F8779` reads correctly on a real screen.

Suite 318 → 365. Icons rebuild with `node scripts/build-icons.mjs`.

---

## 2026-09-04 — Offline Tyndale study resources

- Added the CC BY-SA Tyndale Open Study Notes and Bible Dictionary as a
  reproducible, checksum-pinned, partitioned offline corpus.
- Reading now uses contextual verse taps, restrained exact dictionary cues, and
  explicit single-verse or same-chapter passage remembering; the knot has full
  offline title/alias dictionary search.
- Kept lookup/search activity local and out of the event log. Existing memory
  events remain unchanged; identical active ranges are idempotent.
- The first v0.3.0 APK exposed a 28.4 MiB increase over v0.2.0, above the 18 MiB
  gate. The corpus was repacked as lazy gzip modules; Hermes bytecode fell from
  40.0 MB to 20.0 MB. v0.3.1 is the corrected release candidate.

## 2026-09-04 — Project docs, workflow skills, reset button planning

- Added project scaffolding docs: `STATUS.md`, `ROADMAP.md`, this `JOURNAL.md`,
  `docs/plans/README.md`. The repo had none — state was reconstructed from git
  history + README.
- Pulled the 16 workflow skills from the Surgery Logbook project into
  `.agents/skills/` and adapted every one to Thread's stack (Expo/RN, Vitest
  logic suite, `src/ui/tokens.ts`, the §13.6 hard rules, offline/single-user).
  Rewrote `AGENTS.md` into the full shared contract they lean on. The global
  `~/.claude/skills/` wrappers redirect here automatically.
- Added a global `~/.claude/skills/new-project` skill that scaffolds a new
  project (dir + git + skills + STATUS/ROADMAP/JOURNAL docs). Named
  `new-project`, not `init`, because Claude Code's built-in `/init` wins the
  typed command.
- Logged a planned **account reset button** (roadmap + `memory/deferred-account-reset.md`):
  the user hasn't really used the app and wants a clean restart.
- Noted an unresolved contradiction: README says `/src/partner` is "not yet
  built" but `66a9fe8` claims the W12 hand-off shipped. Needs checking.
- `docs/index.html` "the lab" landing-page section is written but still
  uncommitted from the prior session.
- Tests green: 301 passing.

## 2026-07-21 — Phases 5–10 (from git history)

W13 adaptive layer, §19 operations, W10 completion, R6 year review, monthly
SRBAI + the eyeball. Completes the plan's work-package table.

## 2026-07-14/15 — W1–W12 (from git history)

Foundation through the partner hand-off: Expo scaffold + event log + core
algorithms, WEB/NIV text layer, five-zone flow, the knot, recall zone,
cue-strength notifications, experiment engine, analysis + reports, encrypted
backup, onboarding, applied decision-rule profile, lapse ladder.
