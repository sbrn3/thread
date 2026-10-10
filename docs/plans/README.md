# Plans

One folder per C2-C4 planned change: `docs/plans/<slug>/`. `plan.html` owns
approved intent/scope, `exec.md` owns execution recipes, `PROGRESS.md` owns live
status, and C4 adds `OUTCOME.md` after completion. Companion
`grill-summary.md` / `level-up.md` / `mockup.html` files remain evidence/scratch.
Created by `/plan`; retained by `/save-plan`.

| Slug | Intent | Status | Next action |
|------|--------|--------|-------------|
| tyndale-open-resources | Offline study context, dictionary cues/search, and passage remembering | ✅ shipped | Merged to `main`, tagged v0.3.0 then v0.3.1 (corpus-size fix). |
| aesthetic-thread-textile | Icon, palette, and the weave zone become woven cloth ("The Loom") | ✅ shipped | Merged as PRs #1–#7. Open: device checks for Psalms/Jude widths and the warp colour. |
| account-reset | Erase everything and return to first run, as an unravel of the current bolt | ✅ shipped | Implemented directly from the grill; no plan.html. Decision is in `JOURNAL.md`. |
| app-quality-foundations | Fonts, safe areas, race-safe startup, 44pt controls, operable seal, honest recovery, quiet knot/Support, searchable history, study hint | ✅ shipped | Merged to `main` as PRs #11–#17, tagged `v0.5.0`. Open: bundled font assets, TalkBack/VoiceOver/Switch Control matrix, real `expo-file-system` recovery-snapshot exercise, real launch timing — see plan.html's per-slice ledger for exact gaps. |
| one-blue-thread-rebrand | Rename the public product, centre the full Numbers 15:37–41 passage, and enforce a Scripture-first voice | ✅ shipped | Merged in `v0.6.0` (PR #18). Cultural review of the origin context line and NIV surface-complete permission remain open — see plan.html. |
| knot-declutter | Fix the knot's dead reading-history/chapter-viewer controls (nested modals), and split the flat six-section accordion into an everyday tier (weave, cue, reading history) over a grouped rare tier (Your data · Practice · About) | ✅ shipped | Merged 2026-09-07 (PR #24), all 3 slices landed (461 passed/1 todo, typecheck clean). Owner device check (reading history actually opens) deferred to release by decision — see plan.html's Dependencies and unresolved gates. |
| arrival-zone-progress-display | Add `E11`/`E12` reversal experiments (day-count and sitting-count line visibility in `ArrivalZone`) to the existing lab queue, using the same mechanism as `E3` STREAK VISIBILITY | ✅ shipped | Merged as PR #39. Both experiments are queued after `E3` and stay inert until an active phase. See plan.html and exec.md. |
| knot-opener-icon | Gear opener, a knot that orders itself the same every time, backup demoted, Start over and cue-save fixes, Report a problem link, and the translation switch (absorbs `knot-translation-switch`) | ✅ shipped | Merged as PR #42, released in v0.7.0. Open: owner device checks and live NIV/ESV key round-trips. See plan.html and exec.md. |
| recall-cloze-ladder | Recall passages become cloze cards on a ladder (a few key words hidden, then more, then the whole passage; letter stubs then plain gaps), and the next-day probe asks about specific verses you read instead of a whole chapter (#40, #41) | ✅ merged | C4. PR #45 (`d85f963`), released in v0.8.0; see OUTCOME.md. Owner device check outstanding. |
| recall-settings | A memory library in the knot: see, add (any passage), edit, start over, delete and review memory passages; a daily cap setting; book end becomes an optional multi-pick; the probe stops using marks | ✅ merged | C4. PR #48 (`7659fcd`), released in v0.9.0; Smart Review + final audit done; see OUTCOME.md. Owner device check outstanding. |
| whats-new | After an update, a quiet What's new card above the reading (study-hint style) and every note under Knot › More › About; notes bundled per release tag | 🔨 in progress | C2. Approved 2026-10-07; both slices built on `feat/whats-new`. Next: PR, merge, then the owner's dev-client check. See exec.md. |
| bibleproject-book-videos | BibleProject overview links at a book's start and end. Optional daily headnotes, read back as the book's contents. README and website refreshed for today's app | ✅ shipped | C4. `v0.11.0` (PRs #57–#64, #66 and the release PR). The device check passed; the backup round trip on a device is still owed. See OUTCOME.md. |

Status: 📋 planned · 🔨 in progress · ✅ shipped · ❄️ parked.
`knot-translation-switch` is absorbed into `knot-opener-icon` at the owner's request; its plan.html stays as the code-level recipe reference.
| seal-affordance | The seal becomes the fell line: a button-like pill on a thread across the page, and the rail locks onto it | ✅ shipped | Merged to `main` as PR #43 (rail fix + fell-line seal), in the next release after `v0.7.0`. Open: device check of rail/line alignment, hold feel, notched phone. |
| experiment-suite-review | The experiment engine becomes opt-in behind one Experiments switch (off by default). The probe goes, the shorter reading after a lapse says why and offers "Read the whole chapter", nudge delivery is recorded, and the knot gets Reading settings and Experiments rows | 📋 planned (saved, not approved) | C4, 8 slices. When ready: approve plan.html, then S00 rebases onto main and runs the slices through to v0.13.0. See exec.md. |

Keep this table and `STATUS.md`'s Active Plans table in sync.
