# Status

_Last updated: 2026-10-11, after every session was wrapped up. Run `node scripts/catch-me-up.mjs` for live branch and worktree state; this page is the plan._

## Where things stand

- **Released:** `v0.12.0` (2026-10-10). It contains:
  - a 2.5 s launch on a linen splash;
  - seal and unravel holds that show progress from touch-down;
  - sliding sheets and fast verse taps;
  - bundled italics;
  - the device-sweep wording fixes.

  The owner's phone runs v0.11.0 in the real app (`com.sngugi.thread`).
- **On `main`, not released** (as of `60ed2e8`):
  - **reading-screen-and-motion waves 3–4:**
    - Direction A: a short arrival header and one "Before you read" list;
    - the arrival weft and stitched rows;
    - sealing weaves today's row;
    - the knot's selvedge.
  - **#77:** a backup fix. Every second recovery snapshot failed to rotate.
- **Saved, not approved:** the **experiments opt-in** plan (C4). It is on branch `docs/experiment-suite-review` (`b9e5866`), not on `main`.
- **No sessions are running.** All app sessions were wrapped up on 2026-10-11. No PRs or issues are open.

## Next actions

In order. Each item says what blocks it and where the details live.

- [ ] 1. **Find the blank white screen on `main` (it blocks any release from `main`).**
      - **What was seen:** the dev app on a dev bundle of `743eab4` (waves 3–4) showed a full white frame. uiautomator found no nodes. Yet JS logged `launchDismissed` at 3634 ms with no errors. Metro also logged `[study] prewarm` three times; it should run once.
      - **Comparison:** `v0.12.0`, served by the same Metro ten minutes earlier, rendered normally.
      - **Confidence:** this was seen once and never reproduced.
      - **How to check:** cold-start the dev app on current `main` twice. If it's blank, bisect `v0.12.0..main` (waves 3 and 4 are four merges). Fix it before anything else ships.
      - **Not the cause:** the "SplashScreenManager not found" error in logcat comes from the old dev-client APK and appears on every launch.
      - **Needs:** the phone, plugged in and unlocked, with the owner's OK to take the screen.
- [ ] 2. **A patch release for the backup fix (owner's yes).** The real app has #77's bug, so every second recovery snapshot fails. `main` can't ship until item 1 is resolved.
      - **Option:** cut `v0.12.1` from `v0.12.0` with only #77 cherry-picked, on a release branch, with a What's new entry only if the owner wants one.
      - **Otherwise:** the fix waits for `v0.13.0`.
- [ ] 3. **The reading-screen-and-motion device review, then tag `v0.13.0` (owner's yes).**
      - The checklist is in `docs/plans/reading-screen-and-motion/OUTCOME.md` → "Remaining gaps".
      - It includes rechecking cb00f1a, Direction A on a busy and a quiet day, a one-verse seal with no scroll, TalkBack order, and reduce motion (ask before toggling it).
      - The What's new lines are drafted in that file.
- [ ] 4. **Decide on the experiments opt-in plan (owner).** Why it exists: the owner couldn't tell the probe from their own memory passages, and the day's reading had shrunk to a few verses without explanation. Read `docs/plans/experiment-suite-review/plan.html` on its branch, then approve, change or drop it.
      - What it does:
     - the research engine goes behind one Experiments switch, off by default;
     - the probe is removed from "Before you read";
     - the shorter reading after a lapse says why, and offers "Read the whole chapter";
     - nudge delivery is recorded.
      - **If approved:**
     - rebase its branch onto `main` first, because its exec.md predates waves 3–4 landing;
     - its release becomes `v0.14.0` if `v0.13.0` ships first;
     - it changes notification scheduling, so its mandatory device checklist must pass before its tag.
- [ ] 5. **Owner device checks still open from earlier releases.** These need the phone and the owner's hands. The sweep session's results are in each plan's PROGRESS.md (#70).
      - **recall-cloze-ladder:** cloze card wrapping, the narrowed probe, TalkBack.
      - **recall-settings:** the memory library actions, the daily cap, the book-end multi-pick.
      - **knot-opener-icon:** the Translation row and the Report a problem link. Live NIV/ESV keys are a separate item below.
      - **seal-affordance:** rail and line alignment on the punch-hole camera.
      - **app-quality-foundations:**
     - the TalkBack plus 200% text matrix;
     - real launch timing;
     - the on-device recovery snapshot (now with #77).
      - **API-key help** (`src/ui/KeyGuide.tsx`, 1dd4325): the links open the right pages, and onboarding step 4 fits a small phone.
      - **Licensed translations:** smoke-test `src/text/esv.ts` and `src/text/apiBible.ts` with real keys in the knot's Translation row.
      - **Ticket 6 matrix:** the launcher name and notification shade by eye, and the origin passage at 200% type with a screen reader.
      - **Loom:** Psalms and Jude widths, and the warp colour `#8F8779` on a real screen.
- [ ] 6. **Housekeeping.** Do these any time; none of them needs the phone.
      - Install the fresh dev-client APK built from `main` (Actions run 38034971708). The installed dev client predates `expo-splash-screen`, so it can't show the splash.
      - Delete the stale `origin/feat/reading-motion` (95b2873) and the merged remote branches. This needs the owner's yes; it can't be undone.
      - Bring the `thread/` checkout up to `main`. It sits at `f05cd0d`; its one uncommitted journal entry is now on `main`.
- [ ] 7. **Not yet planned.** These need a grill or plan first, and the owner picks the order. See `ROADMAP.md` → Under consideration.
      - night mode;
      - the shelf of finished books;
      - a sitting-length setting;
      - a home-screen widget;
      - audio.
- [ ] 8. **Longer-running items:**
      - a cultural review of the origin context line, by someone competent in Jewish biblical practice;
      - a real component renderer for the test suite (it would add `react-native-web`, which is that item's own decision).

## Sessions and worktrees

- **One session drives the phone at a time** (AGENTS.md → "The owner's phone"). Check `adb reverse --list` first, ask the owner before taking the screen, and never open the release app.
- **Worktrees on 2026-10-11:**
  - `thread/`: the main checkout, behind `main` (see item 6).
  - `thread-reading-motion/`: on a docs branch; it can be removed once that branch is merged.
  - `thread-experiment-suite-review/`: holds the saved plan's branch, committed and pushed.
- Sessions open short-lived sibling worktrees (`thread-<topic>`) for their own branches. Leave any you didn't create alone, and commit before you stop. An uncommitted plan was nearly lost when its session closed (2026-10-11).
- **2026-09-07 lesson (kept):** `git fetch` updates remote-tracking refs, not local branches. Branch from `origin/main`, not from a local `main` that was never fast-forwarded.

## Active plans

Keep this list and `docs/plans/README.md` in sync.

- **reading-screen-and-motion** — ✅ built (C4). Waves 1–2 in `v0.12.0`; waves 3–4 on `main`, unreleased. Open: next actions 1 and 3.
- **experiment-suite-review** — 📋 saved, not approved (C4), on branch `docs/experiment-suite-review`. Open: next action 4.
- **bibleproject-book-videos** — ✅ shipped `v0.11.0`. Open: restore from file on a device (unit-tested).
- **whats-new** — ✅ shipped `v0.10.0`.
- **recall-settings** — ✅ shipped `v0.9.0`. Open: device checks (next action 5).
- **recall-cloze-ladder** — ✅ shipped `v0.8.0`. Open: device checks (next action 5).
- **seal-affordance** — ✅ shipped `v0.8.0`. Open: device checks (next action 5).
- **knot-opener-icon** — ✅ shipped `v0.7.0`. Open: device checks (next action 5).
- **arrival-zone-progress-display** — ✅ shipped `v0.7.0`. E11/E12 are queued behind the lab's existing phases.
- **knot-declutter** — ✅ shipped `v0.6.1`.
- **one-blue-thread-rebrand** — ✅ shipped `v0.6.0`. Open: cultural review (next action 8).
- **app-quality-foundations** — ✅ shipped `v0.5.0`. Open: device matrix (next action 5).

## History (kept for reference)

**The app opens again (2026-09-06).** `v0.4.0` through `v0.5.1` froze on the launch screen. `cueTerms` re-normalised each verse once per dictionary candidate inside `Flow`'s render. Fixed in `v0.6.0`: 6222 ms became 35 ms. The same function was again the cause of the 13 s launch fixed in `v0.12.0`, where it now uses pre-normalised aliases. See `JOURNAL.md`.

**Verification (Tyndale release).** `npm run check:tyndale` verifies 17,477 study resources and 6,010 dictionary articles. The compressed Android export is 10.4 MiB.
