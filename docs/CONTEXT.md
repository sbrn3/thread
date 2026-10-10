# CONTEXT

Glossary of canonical project terms. Definitions only — no implementation
detail, no spec prose. If a term here conflicts with usage in code or docs, this
file is the one to fix or the usage is wrong.

## The product

**One Blue Thread** — the canonical public product name.

**A quiet place to read Scripture.** — the canonical descriptor.

**Scripture-first voice** — Scripture is quoted verbatim and attributed; the
reader's language comes next; necessary operational and factual prose stays
brief. The app does not generate devotionals, summaries, prayers,
interpretations, takeaways, spiritual diagnoses, or simulated spiritual
authority.

**The blue cord** — the source of the product name in Numbers 15:37–41. Any
product or marketing surface that cites that source or explains the name shows
the entire passage on the same surface with its translation and notice. See
`docs/BRAND.md` for the release-safe source and usage constraints.

## The cloth

**Bolt** — the current book of the Bible rendered as one piece of woven cloth.
Its width is the book's chapter count; its length is calendar days since the
book was started. One book, one bolt.

**Warp** — the vertical threads. They are the book's chapters, strung before
reading begins. Undyed.

**Weft** — a horizontal pass. One weft pass is one day that was read. Each book
takes its own natural dye.

**Bare warp** — a row with no weft: a day that was not read. Visible as an
opening you can see through. Bare warp is information, not an absence of it.

**Fell line** — the edge where bare warp becomes cloth. It is the app's only
progress indicator; there is no bar and no percentage.

**Set mark** — the permanent displacement left where weaving resumes after a
lapse. A weaver returning to a loom never beats the first pass flush against the
old cloth, and the line it leaves never comes out.

## The text

**The World English Bible (WEB)** — the public-domain translation bundled in the
app binary. Both the offline floor that serves when a licensed provider fails,
and a translation the reader may choose outright: it is named, not hidden.

**Licensed translation** — a copyrighted translation (NIV via API.Bible, ESV via
api.esv.org) that the reader unlocks with their own free, non-commercial API key
from the publisher. Its source is the **licensed provider**.

## Actions

**The seal** — the press-and-hold that commits a day's reading. Drawn as the fell
line itself: a thread run across the page under an outlined "Hold to seal" pill;
holding pulls the weft taut along it. The rail's fell locks onto this line, so
the rail cannot weave past the seal until the day is sealed.

**The unravel** — the press-and-hold that erases the account and returns the app
to first run. The deliberate inverse of the seal: the cloth comes apart while
held, and re-weaves if released early.

**The knot** — the settings sheet, and the app's only persistent control. Opened
by a gear icon; the word "Knot" is the name of the sheet, not its label.

**The everyday tier** — the part of the knot visible the moment it opens: the
weave, the cue, and reading history. Holds only what is touched daily.

**The rare tier** — everything else in the knot, one "More" disclosure deep,
grouped Preferences, Your data, and About. Nothing is ever promoted out of it
or opened for the reader — the sheet is the same every time. Only Support
carries a "Needs attention" marker (and lights the gear's dot); backup state
never does.

**Experiments** — the Preferences switch that lets the app test small changes
on the reader and suggest what works. Off by default. Everything research-shaped
lives behind it; with it off, the app is a plain reading app.

**Reversal** — an experiment that switches one behaviour of the app (such as
reading frequency or hold-to-seal) between two settings in 21-day phases, to see
which suits the reader. Runs only with Experiments on.

**Suggestion** — what an experiment concludes, offered to the reader as a change
to a setting with its reason. Nothing changes until the reader applies it.

**Dose ladder** — how much is offered as the day's reading after a lapse: the
full chapter, then 20 verses, 10, one. Always says so on the arrival screen, and
reading the whole chapter returns it to the top. Not to be confused with **the
ladder**, which belongs to cloze cards.

**Preferences** — the rare tier's first group: how the app behaves for you
(Sealing, Partner, Adaptive policy, and later Translation and Appearance). Not
to be confused with the everyday tier's "Practice" row, which is the cue.

**The cue** — the one if-then sentence ("After X, I read in Y") that the whole
product is built to deliver.

## Your words

**Headnote** — one line, in the reader's own words, about a day's reading,
named after the one-line summary printed Bibles set before each chapter.
Optional; skipping it costs nothing. It belongs to the passage read that day,
or to the specific verses the reader narrows it to. Set in the app's voice,
never in the Scripture face. The app never writes one. (Planned as a
"takeaway"; the product word is headnote.)

**Contents** — a book's headnotes read back as its contents page, one row per
chapter in the book's own order. A chapter with no headnote shows only its
number. Each reading of a book keeps its own contents.

**Overview** — BibleProject's video overview of a book, linked (never
embedded) before the first sitting and after finishing. External, attributed
human commentary.

## Memory

**Cloze card** — a recall card for a memory passage with some of its key words
hidden. You try to fill the gaps, reveal, and grade yourself.

**Key words** — the words of a passage that a cloze card may hide: every word
that is not a common English function word.

**The ladder** — how much a cloze card hides as a passage is reviewed more
times: a few key words first, then most of them, finally the whole passage.
Each amount is met twice, first with letter stubs and then with plain gaps. A
"Lost it" grade steps the ladder back one rung.

**The memory library** — the Memory sheet in the knot's everyday tier: every
memory passage, where each is on the ladder and when it is next due, plus the
marked list. Passages are added, edited, reset, reviewed and deleted here.

**The marked list** — verses you marked while reading that you have not chosen
to learn yet. "Learn this" turns one into a memory passage.

**The daily cap** — how many due memory passages the reading screen shows in a
day (1–10, default 2). The library can review beyond it.

**The probe span** — the few verses the next-day probe asks about: a short run
chosen by the trial seed, always inside the verses you actually read. It never
looks at your marks; memory work and the probe run separately.
