# Thread

_A Bible reading app for one person._ A single-flow, gesture-driven reading
ritual with a built-in experiment engine.

The full specification is `../thread-plan.html` (v3.0). This README covers only
what the plan doesn't: how to run this repo.

## Try it

[**Live demo →**](https://sbrn3.github.io/thread/) — an interactive preview of the designed daily
flow (arrival → recall → scripture → seal → weave), running entirely in your browser. The real
app is still early (see roadmap below); this is what it's built toward.

**Install on Android:** grab `thread.apk` from the
[latest release](https://github.com/sbrn3/thread/releases/latest).

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
/assets/bible  Bundled public-domain translation (W2 ✓)
```

## Hard rules (enforced by tests, §13.6)

- `events` is append-only; migrations are additive-only.
- `ts` / `local_date` (4 AM boundary) / `build_sha` are stamped by the writer.
- No `Math.random()` anywhere — seeded PRNG only; the trial year is
  reconstructible from `trial_seed`.
- `/src/lab` never imports `/src/ui`; `/src/memory` never imports `/src/lab`;
  `/src/partner` has no code path to a network.

## Install on the phone (Android)

Every push to `main` builds `thread.apk` in GitHub Actions (Actions → latest
run → Artifacts). Tagging a version publishes it under **Releases**:

```sh
git tag v0.1.0 && git push --tags
```

Then on the phone: open the repo's Releases page, download `thread.apk`,
and allow the install ("install unknown apps"). Updates install over the
old version — the signing key is stable across builds.

## Bible text (plan §07)

Bundled **WEB** (public domain) ships in `assets/bible/web.json` — the app
always works offline. Regenerate it with `node scripts/build-bible.mjs`.

**NIV (licensed, Path A):** create a free non-commercial key at
https://scripture.api.bible, note the NIV bible id listed for your account,
and set both at build time:

```sh
# .env (never committed) or CI secrets
EXPO_PUBLIC_APIBIBLE_KEY=your-key
EXPO_PUBLIC_APIBIBLE_ID=your-niv-bible-id
```

With the key present the app reads NIV (cached per chapter after first
fetch, offline thereafter) and falls back to WEB with no network. The
licence's copyright notice renders under every NIV chapter via
`attribution()`. Bulk-downloading the translation is not permitted and
the provider deliberately has no method for it.
