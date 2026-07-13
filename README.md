# Thread

_A Bible reading app for one person._ A single-flow, gesture-driven reading
ritual with a built-in experiment engine.

The full specification is `../thread-plan.html` (v3.0). This README covers only
what the plan doesn't: how to run this repo.

## Commands

```sh
npm start          # Expo dev server
npm run android    # run on Android (dev build required for notifications)
npm test           # vitest — the simulation/invariant suite
npm run typecheck  # tsc --noEmit, strict
```

## Repository shape (plan §05)

```
/src
  /flow      Arrival · Recall · Scripture · Seal · Weave · Dismissal   (W3–W6a)
  /knot      Sheet: weave, chapter strip, cue editor                   (W5)
  /cue       Cue model, cue_strength metric                            (W1 ✓ / W6b)
  /notify    Rolling 30d window, cancel-on-seal + decision voiding     (W6b)
  /text      TextProvider, sitting splitter                            (W2)
  /log       Event log: schema, driver, writer, time                   (W1 ✓)
  /lab       PRNG, phase assignment, ladder, reconcile skeleton        (W1 ✓ / W7–W9)
  /memory    Leitner scheduler                                         (W1 ✓ / W6a)
  /partner   Hand-off only. No network, by construction                (W11b)
  /backup    Encrypted export/restore                                  (W10)
  /ui        Design tokens                                             (W1 ✓)
/test        vitest suite incl. §13.6 import-boundary invariants
/assets/bible  Bundled public-domain translation (W2 — not yet added)
```

## Hard rules (enforced by tests, §13.6)

- `events` is append-only; migrations are additive-only.
- `ts` / `local_date` (4 AM boundary) / `build_sha` are stamped by the writer.
- No `Math.random()` anywhere — seeded PRNG only; the trial year is
  reconstructible from `trial_seed`.
- `/src/lab` never imports `/src/ui`; `/src/memory` never imports `/src/lab`;
  `/src/partner` has no code path to a network.

## What's still needed (see plan §07, §13)

1. **Bundled translation** — a WEB (public domain) JSON for `/assets/bible`.
2. **Dev build** — `npx eas build --profile development` (needs a free Expo
   account) or `npx expo run:android` locally with Android Studio.
3. **NIV (optional, Path A)** — an API.Bible key; add `ApiBibleProvider`.
