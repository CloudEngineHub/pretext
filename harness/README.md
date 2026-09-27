# Harness

Each case's layout in the browser is recorded once per browser build and kept in git; later runs predict in the real
browser, as an app does, and are scored against it. `harness/cli.ts`'s header lists the commands, and each file's header
its part. Measurements are dated, on an M5 Max under macOS 27.0 (26A428) at device pixel ratio 2, in Chrome 153
(154.0.8037.57 from 2026-09-25), Firefox 156.0 (156.0.1 from 2026-09-25) and Safari 27.0 (WebKit 22625.1.29.11.27).

## What a case is and when it passes

A case is one paragraph at one width. It passes when the line count is the browser's and each line's first and last
visible character sits in the predicted line of that index; a right count with a wrong break fails as `breaks`: main
before #340 (commit 6d1d2106, the last main whose break rules were Pretext's own rather than ports of the engines' line
breakers) had the right count with a wrong break on 4.5-8.1% of the census set's cases, real paragraphs from `corpora/`
(2026-09-24). Widths aren't judged; shrink-wrap is only reported, for now. The library's consistency blocks on every
case, recorded or not: every line API gives the walk's lines, widths and text, and none calls `measureText` after
preparing.

Recordings count only under the environment that made them, so a browser or OS update never reads as a regression. A
case laid out differently in two recordings is page history, which the paragraph alone can't predict, so it's never
pinned. A case with no recording blocks, except in installed Safari, which records a sample: unobserved is never a pass.

There is no must-pass tier: every pinned case blocks alike, CJK included, and a change that fails one lists it under a
written reason, so a hard tradeoff goes on record instead of being ruled out. Made-up cases under 24 px are pinned too,
accepted as narrower than real layouts (the narrowest real-usage draw is 25 px).

### Two kinds of set

- **The real-usage sample** answers how often a user sees a wrong line. Its draws follow how often apps lay out each
  surface, script, style and width, each share in `sets/weights.json` naming its source or what its guess leans on, and
  the weighted share right is the headline. Rare groups get at least 300 draws, weighted back, so one with no failure
  is under 1% wrong at 95% confidence.
- **The behaviour catalog** (`catalog`, `facts`, `rich`) answers which behaviours we model; deduplicated by what the
  browsers do, its size says nothing about real use.

Filed reports come from `sets/exact.ts`; the other sets, and the catalog's and rich set's `main/*` families (adversarial
cases taken from `tests/wrapping`, the old test suite), were taken once, and `make.ts` can't make them again.

### Why the old suite went

The harness replaced the old test suite, `tests/wrapping`, wholesale (#341; the suite was removed on 2026-09-25 in #348)
and decided afresh what mustn't regress, since a pass rate means something only against how much its cases matter. 88%
of the suite's 238,524 cases were under 80 px, one family was 120 copies differing by one control character, and repros
mixed with usage: main before #340 passed 99.96-100% of line counts on 4,686 real paragraphs but failed 20-26% of the
suite (2026-09-17). The harness keeps exhaustive width sweeps, since typography's bugs sit in combinations nobody can
list, and tracks failures as well as passes, so a rewrite that moves a case outside what Pretext claims still shows.

## How cases grow

New cases mustn't pile up as the old suite's did, a hand-written repro per bug.

- **A fix never adds to the sample**, which moves only with a sourced change to `weights.json`, or the headline drifts
  toward the bugs someone looked at.
- **A fix adds a few templates in the behaviour's shape** (inputs without a width, in a `sets/catalog.ts` family), as
  does a behaviour modelled but never recorded. The width search (`sets/make.ts`, `sets/widths.ts`) keeps a change only
  if it shows a kind of break no earlier template did (the dedupe), so a template showing nothing new adds almost
  nothing. Never a cross product or a family per variant: every family keeps a case, which gets past the dedupe. The fix
  for Chrome's `text-spacing-trim` at a line end (#366, `src/han-kerning.ts`) first made 72 families (9 marks × 4 line
  endings × 2 languages), 751 cases (+2%) and 18 accepted failures, and landed with 41 cases and a unit test
  (2026-09-27).
- **An exact rule's full matrix is a unit test** on the unit tests' fake Canvas (`src/layout.test.ts`), confirmed by a
  few browser cases, and replaces any test of the same rule. The dedupe's kinds of break are coarser than behaviour: `」`
  and `。` share a UAX #14 class, so it dropped the `。` inputs, though Chrome trims `」` and never `。`.
- **The PR states each set's growth**; more than about 1% of a set needs a sentence on why.

A whole-catalog search derives every generated case again (8,926 at b1fd05fc), so a browser's drift lands in the PR,
and a template added to an existing family should bring its older cases back byte for byte. `make.ts cut` keeps only
the frozen `main/*` cases and the templates the saved search holds, silently dropping the rest after a partial search:
remove `.artifacts/harness-sets/<set>/` when done.

A repro's exact string may drop out when the sets are made again, since they sample behaviour; the filed report,
`explain` and the fix's PR keep it. `sets/exact.ts` pins filed reports exactly, by issue number; a case the dedupe can't
see calls for a finer dedupe, not a pin, since a hand-pinned repro per fix is how the old suite grew.

When the sets are made again, drop templates that show nothing others don't, audit `src/layout.test.ts` against the
facts set, and search each pin as a template without its width: it goes if the dedupe keeps a change from it; if not,
but it still catches something, refine the dedupe's kinds of break (for Chrome, closing marks that trim and ones that
don't). `engine-facts.json`'s `layout.test.ts` line numbers, the facts set's origins and four accepted reasons point at
the files of main before #340 (6d1d210), not today's.

## Commands

AGENTS.md's Validation says when to run `repin`, `check`, `gate` and `bench`. `gate` adds a prediction in reverse order
(a message mustn't wrap otherwise because of what the app prepared before), 1,000 seeded cases recorded again (the
recordings must still describe the browser), and each new failure recorded and predicted alone, to attribute it.
`record --only-new` records new cases.

## Accepted and varying lists

`accepted/<browser>.txt` holds the cases main has failed since #340, each under a written reason: the gate protects what
main passes since #340, whose break rules port the engines' own, not what main before #340 passed by accident. A listed
case that passes again or is gone blocks until it leaves, so a fix gets recorded. A lost pass isn't a regression until
it's attributed: a true loss, two errors that cancelled, or a bad test or oracle.

`varying/<browser>.txt` lists predictions that move with the browser's state, between runs (`runs`, never judged) or
with what was predicted before (`order`, judged in their own order). A lone prediction can't tell the library's caches
from the browser's Canvas, so attribution never calls such a move a library defect; Chrome's per-canvas shape cache
(Chromium #560614560) causes the known `order` cases.

Page history misleads (`RESEARCH.md`, Evaluation Traps, has the cases; Engine Facts, Safari, WebKit's caches): a
history label explains a failure only once the case fails the same way alone, and a webkit-host win or loss counts only
if it holds alone or in fresh documents in both orders. Two orders miss history both share, so the list is kept across
every recording under one environment (one recording's two orders found 11 of webkit-host's 87, 2026-09-24), and
`repin` carries it to a new build: without that, 33 cases would have blocked when Firefox went to 156.0.1 (2026-09-25).

## Proving "no change"

A cleanup changes nothing only when every tool says so, run on old and new with the same inputs: `equal main`
(`--offline` first, then in the browsers), `check`, `gate`, the invariants and the bench's floors.

- An offline replay detects change but isn't an oracle: its stand-in Canvas gives each character a width from a
  formula, moved a little by each pair of neighbouring characters (`offline-equal.ts`), so it can't fail on shaping,
  painting or string storage.
- Without the invariants' desktop user agent and string `letterSpacing` (`invariants.ts`), a held-handle defect went
  unseen in 500 draws.
- Canvas-call counts before #355 aren't comparable with later ones: the harness's adapter (`run.ts`) stopped calling
  `setLocale()` per case, cutting its calls 20-25% with no prediction change (2026-09-26).

## Bench

Speed claims rest on `bun harness bench`'s same-document ratios. Its rows follow what an app does; never rank
`prepare()` against `layout()`, as one is paid once and the other on every resize. New text is text no library or
browser has laid out: Firefox and Safari keep shaped text per font, shared by every canvas and the DOM, so a fresh
canvas doesn't make text new.

- **A control copy.** Each document runs base, the candidate and a second copy of base, shuffled each round, since only
  same-document ratios survive drift between sessions (`RESEARCH.md`, Evaluation Traps, has the numbers behind this
  and the next two).
- **Focus and a quiet machine.** Background windows' timers are slowed, so Chrome and Safari need a visible, focused
  window throughout. Using the machine spoils the sessions it overlaps, and only those; a loaded machine spoils them
  all.
- **Two sessions** (`--sessions=2`) do unless they disagree on a verdict that matters; the default of 3 calibrates the
  floors.
- **Floors** (1-6% by row) take the largest deviation held in one direction in all three calibration sessions, not the
  worst reading: timing HEAD against itself (2026-09-26), one copy ran slow for a whole document (Firefox 156.0.1's base
  copy took about twice as long as the other two on kept CJK handles in one session), and floors from such readings
  would have hidden a real 20-25% slowdown. These floors flag all four slowdowns known between main before #340
  (6d1d2106) and 217c84b8, a commit of #340.
- **WebKit's width cache** samples one Canvas call in 21 after a run of misses, so a repeated prepare speeds up after
  21 / gcd(n, 21) runs: compare submitted text and cold first prepares.

A full bench took about 27 minutes (2026-09-26). Nothing timed is checked in.

## Browsers and pins

Chrome and Firefox run as pinned copies (`pins.json`), builds read from the app bundles since a user agent names only
the major version. Each copy gets its update policy before first launch, since a pinned Firefox updated itself
(`browsers.ts`, 2026-09-25). Safari can't be pinned, and a macOS update moves all three (system fonts, Core Text, ICU,
emoji). Chrome 153 to 154 and Firefox 156.0 to 156.0.1 left every recording byte-identical.

webkit-host, the system WebKit that installed Safari runs, in a background app (`browsers.ts`), lays text out as Safari
27.0 does: the same line geometry on 25,180 cases in both orders (2026-09-17) and on installed Safari's 2,000-case
sample except page history (2026-09-24); a Safari or macOS update voids that until the comparison runs again. Installed
Safari stalls when hidden (WebKit suspends a hidden page past a CPU limit averaged over 8 minutes), so keep its window
uncovered during a job.

Firefox changes fonts after it starts (see also `PLATFORM_BUGS.md`, the late family names): emoji beside Arial laid out
otherwise when recorded 11 s after launch than at 12, 15 or 30 s (91 cases, 2026-09-24), so each Firefox job holds its
first document until 15 s.

## Bounds and blind spots

Every job is bounded in memory and time since 2026-09-25, when three orphaned test processes held 42-49 GB each and
froze a 36 GB Mac: children with no timeout ran two planted defects that looped the library's text builder past any
bound in the harness, and a planted defect is exactly the input that makes a loop run away (`watchdog.ts`). A job's
browser is capped too, and a SIGKILL of the harness leaves its browsers running (`browsers.ts` has both). Long
paragraphs are searched, not scanned (`observe.ts`): range geometry took 31-74 s natively on a 256,837-unit Arabic
paragraph while building the per-engine rebuild (branch `rebuild-20260916`, a from-scratch port of each engine's line
breaking, kept as the plain-text correctness reference; September 2026). Tools remove their own scratch files directly,
never through `trash`.

The harness can't see the hyphen drawn at a soft-hyphen break: recordings keep no glyphs, and a rule over the boxes
found 93-358 mismatches per browser, some the recording's (2026-09-24), so it's left to `src/layout.test.ts`. Nor does
it see re-layout at a line's own width; a defect that rebuilds shared fit advances in place (the stand-in Canvas gives
the same advances in every fit mode); a bracket-pair error in the Gecko bidi port; an emoji modifier split from its base
across rich items; Chrome's UI language, and so its `zh` table for pages without a `lang`; rendering other than macOS's,
though Android and Windows are 65% of page views (`weights.json`); chat users wrote (the sample's chat draws are
stand-ins); or the demos' painted layout.
No planted fault guards the watchdog's kill, the bench's shuffle and separate compiles, Firefox's start-up hold, the
page passing the browser's name to the recorder, or the cap on a job's browser.
