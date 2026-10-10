# Experiment suite review — grill summary

## Framing

The owner's worry is that the experiment suite (`src/lab`) overcomplicates the
app and gets in the way of the reading. In their words: "I have no idea what
this probe thing is when it already asks for memory verses. And now it's
weirdly only showing me very few verses per day."

Two concrete symptoms:

- **The probe duplicates memory.** The E9 next-day probe ("what do you
  remember of verses 4–6?") reads as a second, unexplained memory feature next
  to the memory passages the reader chose.
- **The daily reading has shrunk without explanation.**

Added mid-round 1: "I'm pretty convinced that a lot of my reading habits are
externally driven e.g. going camping, change of roster etc." Misses come
mostly from life (being away, shift changes), not from the app's dose, cue or
mechanics. That undercuts both the lapse ladder's diagnosis (six in-app
causes, dose cut on day 2) and the reversal verdicts, which can't tell a
camping week from an arm effect.

## Facts established from the repo

- The shrinking reading is almost certainly the **silent dose ladder**
  (`src/lab/steps.ts` `diagnose()`, `src/lab/dose.ts`). On day 2 of every
  lapse it steps the dose down one rung, full chapter → 20 verses → 10 → 1,
  and says nothing. It steps back up one rung only after a complete 7-day
  sealed streak. Three short lapses with no full week between them leave the
  reader on one verse a day. Not yet confirmed against the device database.

## Resolved

- Who is the app for now? → **A reading app first.** Experiments survive only
  if they visibly help the reading; the research framing is secondary or goes.
  Round 1.
- Fix the silent dose cut now, ahead of the review? → **No, fold it into the
  review.** Round 1.
- The six 21-day reversal experiments (E7 frequency, E4 completion floor, E1
  hold-to-seal, E3 streak, E11 day count, E12 sitting count)? → **Keep, but
  opt-in.** Off by default; a switch turns the reversal queue on. Round 2.
- After a miss? → **Keep the dose ladder, but make it visible.** The arrival
  screen says why today's reading is shorter. Round 2.
- Mark planned time away (camping, roster change)? → **No, not needed.**
  Round 2.
- The E9 next-day probe? → **Remove it.** Memory passages already cover
  remembering. Round 2.
- With experiments off, how do the six behaviours work? → **Fixed at today's
  defaults** (daily, full-chapter floor, hold-to-seal with the tap option, no
  streak, day and sitting counts shown). In the owner's words, "there should be
  an algorithm to learn from the user/experiment still. Should be transparent
  in settings though and user should be able to change them." So each
  behaviour is shown in the knot with its current value and is changeable.
  How the learning works is round 4. Round 3.
- What else goes behind the switch? → **All research; the year review stays
  for everyone.** Behind it: monthly SRBAI and its date list, phase reports and
  charts, the nudge-hour, post-miss and E10 trials, the bandit. Round 3.
- The nudge-hour trial and the bandit can't learn without a
  notification-received listener. → **Build the listener.** They stay, behind
  the switch, and are made to work. Round 3.
- What does the learning algorithm learn from? → **Only experiments, while the
  switch is on.** Nothing is inferred from everyday use. Round 4.
- When it concludes something? → **It suggests, the reader approves.** The
  existing report-then-Apply flow is kept, and the setting shows the
  suggestion and its reason. Round 4.
- E10 without the probe? → **E10 judges on sealing alone.** Round 4.
- Switch on or off on the owner's phone at ship? → **Off, start clean.**
  Switching on later starts a fresh reversal queue. The in-progress phase and
  results so far stay in the log but are not resumed. Round 5.
- What the arrival screen shows when the dose ladder has shortened the
  reading? → **One line of explanation plus "Read the whole chapter".**
  Reading the full chapter also resets the dose ladder to the top. The dose
  ladder runs for everyone, not only behind the switch. Round 5.
- The switch's name? → **Experiments**, under the knot's Preferences.
  Round 5.

## Facts surfaced after round 3

- E10's analysis (`src/lab/analysis/dose.ts`) scores each dose arm partly on
  next-day probe grades. Removing the E9 probe (round 2) leaves E10 with
  only sealed or not as its outcome.
- `docs/CONTEXT.md` already defines **the ladder** as the cloze card ladder in
  memory, so the lapse mechanism needs its own distinct term (**dose ladder**).
- The knot's Preferences already has an "Adaptive policy" row (the bandit).

## Terms added to docs/CONTEXT.md

- Experiments
- Reversal
- Suggestion
- Dose ladder

## Decisions added to JOURNAL.md

- Decision 2026-10-10: the experiment engine becomes opt-in; the app is a
  reading app first. `/close-tab` and `/wrap-up` should reference this entry,
  not restate it.

## Open threads

- `docs/CONTEXT.md`'s **probe span** entry, and the README and site copy that
  mention the probe, go when the probe is removed.
- Where the six behaviour settings sit in the knot, and how each shows "came
  from a suggestion", is for `/plan`.
- The notification-received listener is device-level work. `/plan` should size
  it and decide whether it ships with this or after it.
- Undecided: what happens to an applied suggestion when the reader later turns
  Experiments off. The setting probably keeps its value.
- The rest of the lapse ladder (one question, off-ramp, dormant, partner
  hand-off) was not revisited and stays as it is.

## Confirmed understanding

Confirmed 2026-10-10, when the owner moved straight on to `/plan` after the restatement.

One Blue Thread is a reading app first. The research engine sits behind one
**Experiments** switch in the knot's Preferences, off by default and off on
the owner's phone (a clean start). Behind it: the six reversals, SRBAI,
reports and charts, the nudge-hour, post-miss and E10 trials, and the bandit.
With it off, the six behaviours sit at today's defaults, each shown and
changeable in the knot, and nothing is learned. With it on, the app learns only
from experiments and only suggests; the reader taps Apply. The E9 probe is
removed and E10 judges on sealing alone. The notification-received listener is
built. The dose ladder stays for everyone but is never silent: one line of
explanation and "Read the whole chapter", which returns it to the top. The
year review stays for everyone.
