# Outcome: Reading screen and motion (C4)

Built 2026-10-09 to 2026-10-10. Plan: [plan.html](plan.html). Execution: [exec.md](exec.md). Live log: [PROGRESS.md](PROGRESS.md).

## What shipped

| Wave | PR | Slices | Release |
|---|---|---|---|
| 1 | #68 | S00 device scripts, S05 motion tokens, S01 launch and splash (F1), S02 holds (F2/F3), S03 italics (F9) | v0.12.0 |
| 2 | #69 | S04: no knot jump (F4), sliding sheets (F5), prewarmed verse taps (F6) | v0.12.0 |
| 3 | #72 | S06 Direction A (F10), S07 arrival weft and stitched rows | unreleased |
| 4 | #74 | S08 sealing weaves today's row (F8), S09 the knot's selvedge | unreleased |
| 5 | (this PR) | S10: audit fix, journal, docs | unreleased |

## Measured
- Launch on the release-speed bundle: weave first frame went from 13.0 s to 2.1–2.6 s, and the reading appears at 2.6–2.9 s. The device check on 7f4b11d gave 2552 ms.
- The verse sheet's prewarm and lookup times are logged under `[study]`. They haven't been read on a device yet.

## Verified
- `npm test`: 662 passed, 1 todo. Typecheck clean at the end of every wave.
- Device, wave 1 on 7f4b11d (another session plus the owner's finger):
  - seal hold, short-hold unwind, unravel rehearsal, italics, launch.
  - The three oddities it found were fixed in cb00f1a.

## Final audit
A review of the whole diff against plan.html and exec.md found:
- **HIGH, fixed (3790314):** folding a "Before you read" row unmounted its zone. A recall card graded before folding could be graded again on reopening. A body that has been open now stays mounted when folded, only hidden (`bodyMount`, tested).
- No other HIGH or MEDIUM findings. The review covered:
  - logging paths unchanged (probe_fired at load, grade, skip, dismiss);
  - E9 exposure (the probe starts open);
  - the sheet's exit while its contents change;
  - reduce motion on every new animation;
  - the seal-commit guard;
  - no `Math.random` and no `fontStyle`.

## Remaining gaps (device)

**First, and blocking:** a blank white screen.
- **What was seen:** on 2026-10-10 the dev app ran a dev bundle of `743eab4` (waves 3–4, plus the then-uncommitted #77 fix). It showed a full white frame, and uiautomator found no nodes. JS logged `flowRender` 1519, `sessionReady` 3302, `weaveFirstFrame` 3312 and `launchDismissed` 3634 ms, with no errors.
- **Comparison:** `v0.12.0` from the same Metro rendered normally ten minutes earlier.
- **Confidence:** seen once and not reproduced.
- **Also:** `[study] prewarm` logged three times when it should log once. Its effect re-ran, which is worth a look while bisecting.
- **Next step:** cold-start `main` twice. If it's blank, bisect #72, #74 and #75 (wave 5's fold fix).

The phone was in use by another session through waves 2–5, so none of these have been seen on a device:
- **cb00f1a:** a held seal stays blue after the finger lifts, and no `hold_cancel` is logged after a commit.
- **S04:**
  - the knot opens without a reflow (`rec.mjs knot`);
  - history and memory visibly slide;
  - a verse tap opens in ≤150 ms (check the `[study]` logs).
- **S06:**
  - busy-day and quiet-day arrival recordings;
  - a one-verse sitting seals without a scroll (PR #66 path);
  - the TalkBack order (date, title, verses, cue, list rows, Scripture);
  - the lapse cue editor stays above the keyboard.
- **S07:** the weft draws within 600 ms; a memory row stitches open.
- **S08:** the rehearsal shows the shuttle pass and then the beat; a reopened sealed day is still.
- **S09:** the selvedge and staggered wefts; open-to-usable ≤ ~300 ms.
- **Reduce motion:** every end state shows at once. This needs the owner's OK before toggling "Remove animations" on the phone.
- **Splash:** needs a fresh dev-client APK, or the release APK, to see it.

## Next release: What's new drafts (≤120 characters each)
- "Scripture now starts on the first screen, and anything due before reading is gathered above it."
- "Sealing weaves today's row into the cloth."

The tag waits for the owner's yes, ideally after the device gaps above are checked.
