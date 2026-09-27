# Harness

The browser's own layout of every case is recorded once per browser build and kept in git. Every later run only
predicts, in the real browser, the way an app does, and scores the prediction against the recording. `harness/cli.ts`'s
header lists the commands and flags, and each file's header says how its part works; this file holds the intent, how
cases grow, and the traps that took browser runs to find. Measurements below are dated, and were taken on an M5 Max
under macOS 27.0 (26A428) at device pixel ratio 2, in Chrome 153 until 2026-09-25 and 154.0.8037.57 after,
Firefox 156.0 until 2026-09-25 and 156.0.1 after, and Safari 27.0 (WebKit 22625.1.29.11.27).

<!-- Q2: recommendation taken; the maintainer hasn't answered -->

## What a case is and when it passes

A case is one paragraph at one width. It passes when the predicted line count is the browser's and each line's first
and last visible character sits in the predicted line of that index. A right count with a wrong break fails as
`breaks`: main before #340 passed 4.5-8.1% of the census cases that way, by accident (2026-09-24). The browser's widths
aren't judged; shrink-wrap is reported only, for now. The library's own consistency blocks on every case, recorded or
not: every line API must give the walk's lines, widths and text, and none may call `measureText` after preparing.

Recordings are sorted, with nothing that changes per run, and count only under the environment they were made in, so a
browser or OS update never reads as a regression. A case laid out differently in two recordings is page history, which
a prediction from the paragraph alone can't know, so it's never pinned. A case with no recording blocks, except in
installed Safari, which records a sample: unobserved is never a pass.

There is no must-pass tier. Every pinned case blocks alike, CJK included, and a change that fails one lists it under a
written reason, so a hard tradeoff goes on record instead of being ruled out. Made-up cases narrower than 24 px are
pinned too, and accepted as narrower than real layouts (the narrowest real-usage draw is 25 px).

### Two kinds of set

- **The real-usage sample** answers how often a user sees a wrong line. Its draws follow how often apps lay each
  surface, script, style and width out, every share in `sets/weights.json` names its source or what its guess leans on,
  and the weighted share it gets right is the headline. Rare groups get at least 300 draws, weighted back to their
  share, so one with no failure is under 1% wrong with 95% confidence.
- **The behaviour catalog** (`catalog`, `facts`, `rich`) answers which behaviours we model. It's generated and
  deduplicated by what the browsers do (below), so its size says nothing about real use.

Filed reports come from `sets/exact.ts` (below). The other sets, and main's adversarial families inside the catalog and
rich sets, were taken once, and `make.ts` can't make them again.

### Why the old suite went

The harness replaced main's `tests/wrapping` wholesale (#341) and decided afresh what mustn't regress, because a pass
rate means something only against how much its cases matter.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->
88% of the suite's 238,524 cases were under 80 px, one family was 120 copies differing by one control character, it
mixed repros with usage, and its line-count passes hid wrong lines. On 4,686 real paragraphs pre-#340 main's line counts
passed 99.96-100%, so the suite's 20-26% failure rate came from adversarial families and narrow widths (old suite,
2026-09-17; removed 2026-09-25). The harness keeps its exhaustive width sweeps, since
typography's bugs sit in combinations nobody can list, and tracks failures as well as passes, so a rewrite that moves a
case outside what Pretext claims still shows.

## How cases grow

New cases mustn't pile up into the old suite's repro per bug.
<!-- Q3: recommendation taken; the maintainer hasn't answered -->

- **A fix never adds to the sample**, which moves only with a sourced change to `weights.json`; otherwise the headline
  drifts toward the bugs someone looked at.
- **A fix adds a few templates in the behaviour's shape**, and so does a behaviour modelled but never recorded. A
  template is an input without a width, and a new one goes in a family of `sets/catalog.ts`, as #366's did; the facts
  set was taken once from `layout.test.ts`. `bun harness/sets/make.ts` finds where each browser's lines change across
  widths, and `sets/widths.ts`'s header says what it keeps and cuts: the catalog keeps a change only when it shows a
  kind of break no earlier template showed (the dedupe). A template that shows nothing new adds almost nothing. Never a
  cross product or a family per variant: every family keeps a case, so that gets past the dedupe. The Chrome HanKerning
  fix (#366) first made 72 families (9 marks × 4 line endings × 2 languages), 751 cases (+2%) and 18 accepted failures,
  and landed with 41 cases and a unit test (2026-09-27).
- **An exact rule's full matrix is a unit test** on the fake Canvas, confirmed by a few browser cases, and replaces any
  test of the same rule. The dedupe's kinds of break are coarser than behaviour: `」` and `。` share a UAX #14 class, so
  it dropped the `。` inputs, though Chrome trims `」` and never `。`.
- **The PR states each set's growth**; more than about 1% of a set needs a sentence on why.

Searching the whole catalog again derives every generated case again (8,926 at b1fd05fc), so a browser's drift lands in
the PR. #366 searched its own templates alone; a template added to an existing family should bring that family's older
cases back byte for byte. `make.ts cut catalog` writes the whole file from the search state in
`.artifacts/harness-sets/catalog/`, so after a partial search it keeps the frozen `main/*` cases and the searched ones
and silently drops the other generated cases: remove that state when done.

A repro's exact string may drop out when the sets are made again: its width moves to where the lines change, or its
template shows nothing new. That's accepted, since the sets sample behaviour; the filed report, `explain` and the fix's
PR keep the repro. `sets/exact.ts` pins a filed report's case exactly, past the width search and the dedupe, under its
issue number; a case the dedupe can't see calls for a finer dedupe (below), not a pin, since a hand-pinned repro per fix
is how the old suite grew.

When the sets are made again, drop the templates that show nothing other templates don't, audit `src/layout.test.ts`
against the facts set, and sweep the pins: search each as a template, without its width. If the dedupe keeps a change
from it, a general case covers the behaviour and the pin goes. If not, but the pin still catches something, refine the
dedupe's kinds of break (for Chrome, closing marks that trim and ones that don't) rather than keep the pin. The
`layout.test.ts` line numbers in `engine-facts.json`, the facts set's origins and four accepted reasons are 6d1d210's;
read them at that commit.

## Commands

AGENTS.md's Validation says when to run `repin`, `check`, `gate` and `bench`. `gate` adds a prediction in reverse order
(a message mustn't wrap otherwise because of what the app prepared before), a seeded 1,000 cases recorded again (the
recordings must still describe the browser), and each new failure recorded and predicted alone, to attribute it.
`explain` shows one case or any paragraph; `equal main`, `--offline` first, checks a change meant to change nothing; and
`record --only-new` records new cases.
<!-- Q14 placeholder: whether repin records a seeded sample first, and every case only if the sample differs, goes here once the maintainer answers -->

## Accepted and varying lists

`accepted/<browser>.txt` holds main's failures since #340, each under a written reason: the gate protects the new
engine's passes, not old main's accidental ones. A listed case that passes again or is gone blocks until it leaves, so a
fix gets recorded. A lost pass isn't a regression until it's attributed: a true loss, a pass from two errors cancelling,
or a bad test or oracle.

`varying/<browser>.txt` lists predictions that move with the browser's state: a `runs` case between runs, so it's never
judged; an `order` case only with what was predicted before it, so check judges it in its own order. A lone prediction
can't tell the library's caches from the browser's Canvas, so attribution never calls such a move a library defect.
Chrome's per-canvas shape cache (Chromium #560614560) is the known cause of `order` cases.

Page history misleads (`RESEARCH.md`, Evaluation Traps, has the cases; Engine Facts, Safari, WebKit's caches):

- A page-history label explains a failure only once the case fails the same way alone, and a webkit-host win or loss
  counts only if it holds in fresh documents in both orders, or alone.
- Two orders miss history both share, so the list is kept across every recording under one environment: one recording's
  two orders found 11 of webkit-host's 87 (2026-09-24). `repin` carries it to a new build; without that, 33 cases would
  have blocked when Firefox went to 156.0.1 (2026-09-25).

## Proving "no change"

A cleanup changes nothing only when every tool says so: `equal main` in the browsers and `--offline`, `check`, `gate`,
the invariants and the bench's floors. Run old and new side by side on the same inputs; don't argue it from reading.

- An offline replay detects change; it isn't an oracle. Its stand-in Canvas gives each character a fixed width, so it
  can't fail on shaping, painting or string storage.
- The invariants' Blink and Gecko processes need a desktop user agent and a string `letterSpacing` on the context, as
  those browsers have: without them, a held-handle defect went unseen in 500 draws.
- Refs from before the harness (#341), 6d1d210 among them, don't bundle for `equal`: this tree's adapter needs
  `src/graphemes.ts` (#344).
- Canvas-call counts before #355 aren't comparable with later ones: the adapter stopped calling `setLocale()` per case,
  which cut its calls 20-25% with no prediction change (2026-09-26).

## Bench

Speed claims rest on `bun harness bench`'s same-document ratios. Its rows follow what an app does, from new text
prepared once, as a virtualized list does, to `layout()` alone on resize. Never rank `prepare()` against `layout()`: one
is paid once, the other on every resize. New text means text no library or browser has laid out: Firefox and Safari
keep shaped text per font, shared by every canvas and the DOM, so a fresh canvas doesn't make text new.

- **A control copy.** Each document runs base, the candidate and a second copy of base, shuffled each round, since only
  same-document ratios survive drift between sessions (`RESEARCH.md`, Evaluation Traps, has the numbers behind this
  and the next two).
- **Focus and a quiet machine.** A background window's timers are slowed, so Chrome and Safari need a visible, focused
  window for the whole run. Using the machine spoils the sessions it overlaps, and only those; a loaded machine spoils
  them all.
- **Two sessions.** Pass `--sessions=2`, two per browser, and add one only when they disagree on a verdict that
  matters. The default of 3 is what calibrating the floors takes.
- **Floors** are the largest deviation the candidate or the control held in one direction in all three calibration
  sessions (1-6% by row), not the worst reading. One copy of the same code can run slower for a whole document: timing
  HEAD against itself on 2026-09-26, Firefox 156.0.1's base copy took about twice as long as the other two on kept CJK
  handles in one session, and Safari 27.0's 15-21% longer on keep-all brackets in two. Floors from such readings would
  have hidden a real 20-25% slowdown; these call all four known slowdowns (217c84b8 against 6d1d2106).
- **WebKit's width cache** samples one Canvas call in 21 after a run of misses, so a repeated prepare speeds up after
  21 / gcd(n, 21) runs. Compare submitted text and cold first prepares.

A full bench took about 27 minutes (2026-09-26); `--rows` narrows it. Nothing timed is checked in.

## Browsers and pins

Chrome and Firefox run as pinned copies (`pins.json`), with builds read from the app bundles, since a user agent names
only the major version. A pinned Firefox updated itself when macOS reopened it after a crash (156.0 to 156.0.1,
2026-09-25), so each copy gets its update policy before its first launch, after which macOS locks the copy. Safari can't
be pinned, and a macOS update moves all three browsers (system fonts, Core Text, ICU, emoji). Chrome 153 to 154 and
Firefox 156.0 to 156.0.1 left every recording byte-identical.

webkit-host is the system WebKit that installed Safari runs, in a background app, and lays text out as Safari 27.0 does:
the same line geometry on 25,180 cases in both orders (2026-09-17), and on installed Safari's 2,000-case sample except
page history (2026-09-24). A Safari or macOS update voids that until the comparison runs again. Installed Safari stalls
when hidden, as WebKit suspends a hidden page past a CPU limit averaged over 8 minutes, so its window stays uncovered
during a job.

Firefox changes fonts after it starts, in two ways. Emoji beside Arial laid out otherwise when recorded 11 s after
launch than at 12, 15 or 30 s (91 cases, 2026-09-24), so each Firefox job holds its first document until 15 s. And a
Canvas context first used in about the first 8 s keeps the fallback for localized family names (`PLATFORM_BUGS.md`, the
late family names).

## Bounds and blind spots

Every job is bounded in memory and time since 2026-09-25, when three orphaned test processes held 42-49 GB each and
froze a 36 GB Mac: a test started children with no timeout, and two planted defects made the library's text builder loop
without end, past any bound in the harness. A planted defect is exactly the input that makes a loop run away. Each test
file imports `watchdog.ts` itself, since `bunfig.toml`'s preload works only from the repository root. A job's browser is
capped, since a page that allocates without end grew Firefox's content process 1.35 GB a second, and of the three only
Chrome stops itself. Browsers start outside the harness's process group, so a SIGKILL leaves them running. Range
geometry is slow at book length: a 256,837-unit Arabic paragraph took 31-74 s natively in the rebuild's lab (September
2026), so a long paragraph is read by searching from each line's first character. Tools remove their own scratch files
directly, never through `trash`.

The harness can't see the hyphen drawn at a soft-hyphen break: the recordings keep no glyphs, and a rule over the boxes
found 93-358 mismatches per browser, some of them the recording's (2026-09-24), so it's left to `src/layout.test.ts`.
Nor does it see re-layout at a line's own width; a defect that rebuilds shared fit advances in place, as the stand-in
Canvas gives the same advances in every fit mode; a bracket-pair error in the Gecko bidi port; an emoji modifier split
from its base across rich items; Chrome's UI language, and so its `zh` table for pages without a `lang`; any rendering
but macOS's, while Android and Windows are 65% of page views (`weights.json`); chat that users wrote, as the sample's
chat draws are stand-ins; or the demos' painted layout.
<!-- Q9: recommendation taken; the maintainer hasn't answered -->
No planted fault guards the watchdog's kill, the bench's shuffle and separate compiles, Firefox's start-up hold, the
page passing the browser's name to the recorder, or the cap on a job's browser.
