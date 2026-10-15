# Harness

Each case's layout in the browser is recorded once per browser build and kept in git; later runs predict in the real
browser, as an app does, and are scored against it. `harness/cli.ts`'s header lists the commands, and each file's header
its part. Dated measurements are from an M5 Max under macOS 27.0 (26A428) at device pixel ratio 2, in Chrome 153,
Firefox 156.0 and Safari 27.0 (WebKit 22625.1.29.11.27); the pins moved to Chrome 154.0.8037.57 and Firefox 156.0.1 on
2026-09-25, Chrome's to 154.0.8037.98 on 2026-10-06 and Firefox's to 157.0.1 on 2026-10-10, and every recording stayed
the same but for line widths in 15 cases at the last move, which Firefox 156.0.1 records as 157.0.1 does (Browsers and
pins).

## Setup

- `bun install`, then `bun test --parallel`, which runs the harness's offline tests with no browser.
- Chrome and Firefox run as pinned copies of the installed apps, kept in `~/github/browser-engines/apps` (or the folder
  `HARNESS_APPS` names) and named in `pins.json`. `bun harness repin chrome` or `repin firefox` copies the installed app
  there; `--write` makes the copy the pin.
- webkit-host is the system WebKit that installed Safari runs, in a background app: build it with
  `harness/webkit-host/build.sh`, which puts it in `.artifacts/webkit-host/`. The harness won't run a build made from
  other source.
- Installed Safari is driven through AppleScript, so macOS asks once to let the terminal control Safari and System
  Events.
- Recordings count only on the machine setup they were made under (What a case is and when it passes): on another Mac,
  or under other OS languages, record every case again first (`bun harness record`).

## What a case is and when it passes

A case is one paragraph at one width. It passes when the line count is the browser's and each line's first and last
visible character sits in the predicted line of that index. `check` prints each failure with its status: `count` (a
wrong line count), `breaks` (the right count with a character on the wrong line) or `error` (the prediction threw).
`check` judges no width. It prints two things about the passing cases' widths and never fails on them: the shrink-wrap
check, whether a bubble sized to the predicted widest line, rounded up, is at least as wide as the browser's widest
line, and the share of lines whose predicted width is more than 0.05, 0.5 and 1 px from the recorded one. Between two
builds widths are compared exactly: to `equal <ref>` a line width that differs at all is a difference, on every case
(Proving "no change"). The library's consistency blocks on every case, recorded or not: the line APIs (`layout()`,
`measureLineStats()`, `walkLineRanges()`, `layoutNextLineRange()`, `layoutNextLine()`, `layoutWithLines()`,
`materializeLineRange()` and their rich-inline counterparts) must agree on lines, widths and text, and none may call
`measureText` after preparing. A rich fragment's text is its item's text between the fragment's `sourceStart` and
`sourceEnd` as painted, white space collapsed, invisible breaks and what the engine profile's analysis takes out of
the text left out, with the hyphen of a soft hyphen its line ends at (`fragmentProblem()`). A box is a visible
character whatever its width, placed by its top. Every case is laid out start-aligned in an element with no text
decoration or background, so a browser rule that depends on those is recorded on one side only: Chrome keeps a word's
kerning with a hanging space in such text and drops it in the others (`RESEARCH.md`, Kerning At Line Edges).

A predicted line's range runs over the source, so white space the library leaves out inside a text is in the line of the
unit before it (`alignStream`, `predict.ts`), as white space that ends a line is in its line: Firefox gives such a
space, or a CR, a box at the end of a line it doesn't trim, where it is the line's last visible character. A text's
leading and trailing white space is in no line's range. That rule came with #399, whose fix it also scores, so each
recorded case was predicted with and without it by one build of the library (2026-10-01; Chrome 154.0.8037.57,
Firefox 156.0.1, webkit-host): no verdict moves in webkit-host, none in Chrome but that of the case listed as varying
between runs, and 4 in Firefox, `a`, two CRs or FFs, `b` at 7.9px under -1px letter spacing, where Firefox's first line
ends at the second CR and the prediction's at `a`. Of 124,283 probe cases recorded in Firefox, 496 move. Every move is
from `breaks` to a pass, between two predictions with the same line starts and widths, whose line ends differ only by
white space.

A recording counts only under the environment that made it, the key in its file's first line: browser build, OS build,
OS languages, page languages, device pixel ratio and a hash of the served fonts. `check` refuses to score under any
other ("Record again before scoring"), so a browser or OS update never reads as a regression. A case whose lines start
or end elsewhere in two recordings under one key has page history: its result depends on what the page laid out before,
through the browser's caches, which the paragraph alone can't predict, so it's never pinned. A pinned case is one whose
recordings all agree on that, and only pinned cases are scored; line widths and heights may move between recordings,
since the pass rule doesn't read them. A new case fails `check` until `bun harness record --only-new` records it,
except in installed Safari, which records only a seeded sample: unobserved is never a pass.

Pinned cases come in two tiers (`RESEARCH.md`, Decisions Log, 2026-10-11). A case blocks when it is 24 px or wider (the
narrowest real-usage draw is 25 px), away from the edges of a line change (an edge case sits 1/64 px beside a width
where the browser's lines change, where the fit arithmetic decides and not the break rules), inside what Pretext claims
(README, Caveats) and not one of the old-gate set: about 23,400 of each browser's 43,800 to 45,200 pinned cases, CJK
included. A change that fails one lists it under a written reason, so a hard tradeoff goes on record instead of being
ruled out. Every other pinned case is counted: recorded, predicted and compared by `equal` like any other, and printed
by `check` a line a kind, but one that fails needs no accepted entry and no reason (Accepted and varying lists).

### Two kinds of set

- **The real-usage sample** answers how often a user sees a wrong line. Its draws follow how often apps lay out each
  surface (chat bubbles, AI replies, cards, documents, UI labels, editorial pages), script, style and width, by the
  shares in `sets/weights.json`. A share names a source or says it is a guess, and most are guesses, many with nothing
  written that they lean on (`bun harness/sets/make.ts sizes` counts them); a share that names a source may still be a
  judgement made from it. The headline, which `check` prints under the blocking cases' counts, is the weighted share
  of draws that pass among the draws inside what Pretext claims: neither a style the adapter can't express
  (`break-all`) nor a `system-ui` font list (README, Caveats). The share over every draw prints with the counted
  cases, since the draws outside the claims are counted and their weight is a guess. Each has a 95% interval, which
  covers the error of drawing a sample and none of the guesses, so the headline is no firmer than the weights. Rare
  groups get at least 300 draws, weighted back, so one with no failure is under 1% wrong at 95% confidence.
- **What the headline pools away** prints under it. About half the sample's weight is paragraphs the browser lays out
  on one line, which nearly always pass, so `check` prints the share right where the browser wraps, and the share with
  a wrong line count, the wrong height a virtualized list would get. Then a table counts draws one each, by script and
  by style (letter spacing, soft hyphens, pre-wrap, keep-all, rich inline, emoji): draws and failures, the same among
  the draws the browser wraps, the passing draws that fail the shrink-wrap check, and the passing draws of plain text
  with a line predicted more than 1 px wider or narrower than the browser's (`off`), which pass on widths that aren't
  the browser's. A row's rate doesn't move with the share `weights.json` gives its script or style, though the mix
  inside the row still follows the weights. Read the worst rows with the headline: easy kinds flatter a pooled number
  (`RESEARCH.md`, Evaluation Traps).
- **The behaviour catalog** (`catalog`, `facts`, `rich`) answers which behaviours we model; deduplicated by what the
  browsers do, its size says nothing about real use. `check` prints first the count over a behaviour's cases at 24 px
  and wider, among the behaviours that have one there, away from the edges, that the browser lays out on more than one
  line. The others aren't counted: two thirds of the catalog's behaviours have a single case that wide, at 100,000 px
  on one line, which passes whatever the library does at a break. The count at the edges is likewise among the
  behaviours whose lines change at 24 px or wider. After those it prints the count over every width, where a
  behaviour is modelled when each of its cases away from the edges passes, width 1 and the widths under 24 px
  included, which are narrower than any real layout.

| File in `cases/` | Holds | Made by |
|---|---|---|
| `sample.ndjson` | The real-usage sample | `make.ts write` |
| `reports.ndjson` | Filed reports with the text, font and width as filed (`sets/exact.ts`) | `make.ts write` |
| `catalog.ndjson` | Families of templates, from the engines' rules, the UAX #14 classes between the scripts apps mix, the shapes `ENGINE_FOLLOWUPS.md` names, bidi controls where Firefox's line breaking looks past them, CJK marks Chrome halts next to other punctuation, letter-spaced words whose ligatures the browsers turn off, emoji characters a named font draws itself and one word wider than its line, kerned or joined, that each browser cuts between letters its own way, plus adversarial `main/*` cases taken from the old test suite | the width search |
| `facts.ndjson` | The engine facts `src/layout.test.ts` checked on plain text when each was added, in a browser; a unit test that alone caught no planted defect has since been taken out | the width search |
| `rich.ndjson` | Rich-inline paragraphs: styled runs, span edges, chips, padded code spans, boxes (an empty inline-block of a width and a height, top-aligned), the shapes whose lines changed when items began to continue the line (#369), keep-all and pre-wrap paragraphs, fullwidth punctuation at an item's edge, a line's return from an unfit soft hyphen to a break between two text segments, a lone carriage return at an item's edge, a line separator that ends an item before white space, paragraphs narrower than 1px, searched from 0px, and characters of no width, a tab, a hyphen or U+3000 at an item's edge, where rich inline has the browsers' lines and where it doesn't, plus `main/*` cases | the width search |
| `census.ndjson`, `books.ndjson`, `smoke.ndjson` | Real paragraphs of `corpora/` at several widths, and whole books, from the per-engine rebuild | taken once |
| `oracles.ndjson` | The mode oracles (pre-wrap, keep-all, symbols, letter spacing, soft hyphens) the old test suite ran | taken once |
| `followups.ndjson` | Two fuzz strings `ENGINE_FOLLOWUPS.md` names | taken once |
| `old-gate.ndjson` | Cases the old test suite's pre-landing check (its gate) lost to #340's engine ports at 24 px and wider, whose input no other case showed failing | taken once |

A browser takes the cases every browser shares and the ones its own width search made, which a case's `browsers`
names, so the files' total is no browser's count: each takes about three fifths of them (`bun harness/sets/make.ts
sizes` prints each file's count per browser and the totals). A case another browser's search made is neither recorded
nor predicted there.

A contributor adds to the catalog, facts or rich set through a template (How cases grow); the sets taken once can't be
made again, since their generators are gone. The old test suite is `tests/wrapping`, which the harness replaced (#341)
and which was removed in #348; read it with `git show 6d1d2106:tests/wrapping/<file>`.

### Why the old suite went

The harness replaced the old test suite wholesale and decided afresh what mustn't regress, since a pass rate means
something only against how much its cases matter. 88% of the suite's 238,524 cases were under 80 px, one family was 120
copies differing by one control character, and repros mixed with usage: main before #340 (commit 6d1d2106, the last main
whose break rules were Pretext's own rather than ports of the engines' line breakers) passed 99.96-100% of line counts
on 4,686 real paragraphs but failed 20-26% of the suite (2026-09-17), and it had the right count with a wrong break on
4.5-8.1% of the census set's cases (2026-09-24). The harness keeps exhaustive width sweeps, since typography's bugs sit
in combinations nobody can list, and tracks failures as well as passes, so a rewrite that moves a case outside what
Pretext claims still shows.

## How cases grow

New cases mustn't pile up as the old suite's did, a hand-written repro per bug.

- **A fix never adds to the sample**, which moves only with a sourced change to `weights.json`, or the headline drifts
  toward the bugs someone looked at.
- **A fix adds a few templates in the behaviour's shape** (inputs without a width, in a `sets/catalog.ts` family: a
  named group of templates, each family keeping at least one case), as does a behaviour modelled but never recorded. The
  width search (`sets/make.ts`, `sets/widths.ts`) finds each width where a browser's lines change, and the dedupe keeps
  a change only when its kind of break (the UAX #14 classes, Unicode's line-breaking classes, on either side) is one no
  earlier template showed, so a template showing nothing new adds almost nothing. Never a cross product or a family per
  variant: every family keeps a case, which gets past the dedupe. For example, the fix for Chrome's `text-spacing-trim`
  at a line end (#366, `src/han-kerning.ts`) first made 72 families (9 marks × 4 line endings × 2 languages), 751 cases
  (+2%) and 18 accepted failures, and landed with 41 cases and a unit test (2026-09-27).
- **When a rule is a small fixed table**, such as which closing marks Chrome trims, test every entry in a unit test on
  the unit tests' fake Canvas (`src/layout.test.ts`), confirmed by a few browser cases, in place of any test of the same
  rule. The dedupe's kinds of break are coarser than behaviour: `」` and `。` share a UAX #14 class, so it dropped the
  `。` inputs, though Chrome trims `」` and never `。`.
- **The PR states each set's growth** (`bun harness/sets/make.ts sizes`); more than about 1% of a set needs a sentence
  on why.

### Adding a case

`sets/make.ts`'s header has the commands:

1. Add templates to a family in `sets/catalog.ts` (or `facts.ts`, `rich.ts`).
2. `make.ts first <set> --browser=<b>` in Chrome, Firefox and webkit-host, then `make.ts select <set>`, then
   `make.ts bisect <set> --browser=<b>` in each.
3. `make.ts cut <set>` writes `cases/<set>.ndjson`. It keeps only the frozen `main/*` cases and the templates the saved
   search holds, so it refuses a search that doesn't cover every template of the set (a cut after a partial search
   dropped 8,926 generated cases with no word at b1fd05fc); search the whole set before cutting, then remove
   `.artifacts/harness-sets/<set>/`. The rich set is the exception: its earlier templates' widths were searched in older
   browser builds, so each later group of its templates is searched and cut on its own, by calling `sets/widths.ts`'s
   `recordFirst`, `select`, `bisect` and `cut` over the new templates alone (no `make.ts` command takes part of a set),
   and its cases are added to the file (`sets/rich.ts`'s header; ENGINE_FOLLOWUPS.md, Harness debt, has the additions to
   the catalog and the facts set that weren't a whole cut either). A template added to an existing family should bring
   its older cases back byte for byte, and a whole-catalog search derives every generated case again, so a browser's
   drift lands in the PR. The catalog's older cases didn't come back as checked in from a whole search on 2026-10-01,
   for a reason not traced, so a new catalog template's cases are added beside them, as the rich set's are
   (ENGINE_FOLLOWUPS.md, Harness debt).
4. `bun harness record --only-new`, then `bun harness check`; a new blocking failure the change doesn't fix goes on the
   accepted list with `check --accept="<reason>"`.

A bug filed as a GitHub issue with its text, font and width goes in `sets/exact.ts` under the issue number; one whose
width came from the reporter's own Canvas becomes a catalog template. A repro's exact string may drop out when the sets
are made again, since they sample behaviour; the filed report, the fix's PR and `bun harness explain --text=…` keep it.
A case the dedupe can't see calls for a finer dedupe, not a hand-kept repro, since a repro per fix is how the old suite
grew.

`sets/data/engine-facts.json`'s `layout.test.ts` line numbers, the facts set's case origins and the two accepted-list
reasons that cite a `layout.test.ts` line point at the files of main before #340 (6d1d2106), not today's; read them with
`git show 6d1d2106:<path>`. The two facts #396 added (lines 1948 and 2015) point at that pull request's `layout.test.ts`, and
name the fonts they run in where that isn't 16px Arial. A fact added after them names its test's line as of the commit
that added or last changed the fact, which this paragraph names, since a later merge moves the test and a case's family
and origin keep the line: line 1000 at dbfab0de (#399), Firefox's white space around bidi controls, line 2140 at
785e5af2 (#446), Chrome's return from an unfit hyphen to a break between two text segments, whose second row runs in
16px Hiragino Sans, line 1575 at f2e54d1b (#455), the WebKit profile's lone carriage return, which runs in 16px
Menlo alone: there Safari gives the carriage return a character's width, the profile gives it none, and of
webkit-host's six failures at 24 px and wider the two away from an edge are accepted and the four at one counted
(`RESEARCH.md`, Decisions Log, 2026-10-06), line 5959 at c3e28361 (#525), a zero-width space after content that
doesn't fit its line, whose rows of a letter wider than its line run in 40px Arial, the size the fact names, so that
the letter is wider than a line of 24 px, and line 1320 at 474acee6 (#525), two zero-width spaces before a tab that
doesn't fit, between which no line ends, so that Firefox's line keeps both with the letter before them. Such a fact
also names the
paragraph directions it runs in where a browser's lines turn on them (the first of those, both). The facts set has no
cover, so it keeps the width where a template's words join, which the catalog's cover drops once a narrower change has
shown that kind of break: a fact that rests on a line's width, such as one space against two, goes there.
ENGINE_FOLLOWUPS.md, Harness debt, has what to prune when the sets are made again. The oracle set's origins each name a
mode and a case's label in `src/test-data.ts`'s oracle arrays, gone from today's file; read them with
`git show f26640eb:src/test-data.ts`, main at #340's merge, since #340 added two of the 56 labels, the Latin-1 and
16-bit control cases of Safari's keep-all.

## Commands

AGENTS.md's Validation says when to run `repin`, `check`, `gate` and `bench`. `gate` adds a prediction in reverse order
(a paragraph mustn't wrap differently because of what was prepared before it), 1,000 cases recorded again (the
recordings must still describe the browser), and each new failure recorded and predicted alone, to attribute it. Check's
prediction, the reverse one and the recording start together, each in a browser process of its own, since the stored
recordings already say which cases are pinned; `equal`'s two builds predict side by side the same way. The
1,000 are drawn by the commit under test, so one commit always draws the same and successive changes cover every
recording; the gate prints the seed, and `--seed` draws with another. One draw can hold ten times the text of another,
so the time the recording takes moves with the commit. It also runs the offline invariants (`invariants.ts`, which
`bun test` runs on 600 seeded draws) over every checked-in case in the browser's engine profile, beside the browser's jobs,
but not on a run with `--cases`; a child that dies blocks like a failing invariant. A drawn case whose lines differ from
its recording is recorded once more in a browser process of its own: laid out as recorded there, it's page history, and
the gate lists it; laid out otherwise there too, it blocks, since either the recording is stale or it holds page history
both of `record`'s orders shared. `bun harness record --cases=<a file of those cases>` then lists it as page history.
`record --only-new` records new cases, `check --accept="<reason>"` puts the new blocking failures on the accepted list
under that reason, drops the entries that pass again and rewrites the counted list, and `explain` shows one case, or a
paragraph given with `--text`, line by line against the browser.

## Accepted and varying lists

`accepted/<browser>.txt` holds the blocking cases main has failed since #340, each under a written reason: the gate
protects what main passes since #340, whose break rules port the engines' own, not what main before #340 passed by
accident. A listed case that passes again or is gone blocks until `check --accept="<reason>"` takes it off, so a fix
gets recorded. A lost pass isn't a regression until it's attributed: a true loss, two errors that cancelled, or a bad
test or recording.

A reason isn't always a cause. The reasons #340's failures were accepted under name a shape of input and say that the
browser breaks there otherwise ("Arabic and Hebrew beside brackets, controls, U+FFFC or rich-item edges, at 24 px and
wider: Chrome breaks there where the library doesn't"), not the engine's rule: 258 of Chrome's 314 entries, 184 of
Firefox's 244 and 118 of webkit-host's 165 (2026-10-11). Those entries are untraced, not explained. A new reason names
the browser's rule, or says that it isn't traced.

`counted/<browser>.txt` holds the failing cases that don't block (What a case is and when it passes), each under why it
is counted: under 24 px, an edge of a line change, outside the claims, old-gate. `check --accept="<reason>"` writes it,
and nobody writes a reason into it. `check` prints how many of each kind pass and fail and, against the list, the
failures it lacks and its entries that no longer fail (`since the list: +3, -0`); `equal` shows which cases moved
between two builds. A change that moves a counted case owes nothing for it: no attribution, no reason, and `check` stays
green. One that moves a blocking case owes what it always did. Until 2026-10-11 every pinned case blocked, and the
counted failures were 9,822 of the three browsers' 10,545 accepted entries.

`varying/<browser>.txt` lists predictions that move with the browser's state, between runs (`runs`, never judged) or
with what was predicted before (`order`, judged in their own order). A lone prediction can't tell the library's caches
from the browser's Canvas, so attribution never calls such a move a library defect; Chrome's per-canvas shape cache
(Chromium #560614560) causes the known `order` cases.

Page history misleads (`RESEARCH.md`, Evaluation Traps, has the cases; Engine Facts, Safari (WebKit), has WebKit's
caches): when the gate's attribution calls a failure page history, that holds only once the case fails the same way
alone, and a webkit-host win or loss counts only if it holds alone in a process of its own (`bun harness explain
--cases=<a file of the one case>`) or in fresh documents in both orders. The cases seen with page history,
`recordings/<browser>.history.txt`, are kept across every recording under one environment, and `repin` carries them to a
new build, since two orders miss history both share: one recording's two orders found 11 of webkit-host's 87
(2026-09-24), and without the carried list 33 cases would have blocked when Firefox went to 156.0.1 (2026-09-25).
`record`'s second order is its first reversed, so every case is laid out once before and once after each other one:
WebKit lays a right-to-left paragraph out with the items of a left-to-right one of the same text laid out before it, and
when the second order was a shuffle, which keeps half of all pairs in order, 29 webkit-host cases were pinned to the
order both had shared, which the first recording in sorted and reversed order listed (2026-09-30). The two orders don't
show every such pair: WebKit's cache drops entries at random once it holds enough text, which a pass over every case
reaches (`RESEARCH.md`, Engine Facts, Safari (WebKit)), so a case whose twin's entry was dropped before the case came
stays pinned, at its layout alone, until a gate draws the two together and lists it. For the same reason which pass
shows which layout differs between recordings, so a case recorded again keeps what is stored while it holds the layouts
just recorded, a page-history pair in either order, and a full `record` under the same environment rewrites a file only
where a case's lines moved.

## Proving "no change"

A cleanup changes nothing only when every tool says so, run on old and new with the same inputs: `equal main`
(`--offline` first, then in the browsers), `check`, `gate`, the offline invariants (`bun test
harness/invariants.test.ts`) and the bench's floors.

- `equal` compares each case's predictions in the two builds, pinned or not: the lines, each line's width exactly, the
  line text, the line APIs' disagreements and the Canvas calls after preparing. So a change that moves only widths,
  which `check` never fails on, still shows there.
- An offline replay detects change but isn't an oracle: its stand-in Canvas gives each character a width from a
  formula, moved a little by each pair of neighbouring characters (`standInWidth()` in `invariants.ts`), so it can't
  fail on shaping, painting or string storage. Every stand-in font kerns the space, and kana on a context under
  `optimizeLegibility`, so offline the Chromium profile never takes the path of a font that kerns nothing with
  either, which `src/layout.test.ts` and the browsers run.
- Without the stand-in's kerning and ligatures between neighbouring letters (#435), every word measured as its letters
  do alone, so the fits of a word cut between letters all gave one answer: a planted defect that overwrote the advances
  a held handle keeps when its word was fit another way went unseen in 600 draws of every profile. With them, the
  unknown profile, whose context takes no `letterSpacing`, fails it in 84 draws of 600. The WebKit profile measures
  letter-spaced text with the rest too, its context taking none when this was run and, since the profile asks Canvas
  how many letter spacings a grapheme takes, one that keeps the ligatures, as Safari's does; it failed in 1 of the 600
  drawn before the cut-word cases joined the sets and in none of those drawn since. The Blink and Gecko profiles
  measure letter-spaced text apart, so no word there is fit two ways. A planted miss of a line-start width in
  `layout()`'s count fails the Blink profile's agreement check in 3 draws of 600.
- The stand-in halts a closing fullwidth mark by a few tenths of a pixel, so almost no line there fits only by a halt:
  with the halt that a mark at a rich item's end keeps on a line with content (`itemEndHalts`) taken out of the walker,
  0 of 21,251 inputs differed in every profile (2026-10-07). A change to that rule rests on the unit tests and on
  predictions in Chrome.
- Canvas-call counts before #355 aren't comparable with later ones: the harness's adapter (`run.ts`) stopped calling
  `setLocale()` per case, cutting its calls 20-25% with no prediction change (2026-09-26).

## Bench

`bun harness bench <base>` times `<base>`'s `src/` against this tree's, or `--lib=<dir|ref>`'s, in the same documents.
Each document runs base, the candidate and a control, a second copy of base, and a table row (an *entry*: one operation
on one document's texts) reads slower or faster only when candidate/base sits outside the band in every session: the
larger of the row's floor (`FLOORS` in `bench/report.ts`, 2 to 6% by row) and how far the control sat from base. Speed
claims rest on these ratios; nothing timed is checked in.

- **The run a change lands on** is the default: the harness's own background windows, webkit-host for WebKit, three
  sessions a browser, every session of every browser side by side. It needs no focus and no screen and takes its
  slowest session's time, about two and a half minutes. Time it alone on a quiet machine, on mains or a battery above
  20%.
- **Two builds of the same bytes aren't timed.** A change to comments or types alone builds base's bundle: the bench
  says so in a second and starts no browser, and that line is what its pull request quotes. `--lib=<base>` times a
  build against itself.
- **What to paste.** The output ends with one line that names the builds, how they were timed and how many entries
  read slower, faster and within noise, then each entry that read slower or faster, or a line that says none did. A
  pull request quotes those lines and gives each entry there a sentence. Main against itself was called on none to two
  of a run's 192 entries, 204 since 2026-10-12, so a call counts when the change runs that entry's code, or when a
  second run repeats it.
- **A background window times as a foreground one**: the harness's Chrome starts with its three switches against
  throttling, webkit-host's window reports itself visible whatever covers it, and the page yields with a
  `MessageChannel` message, never a timer or an animation frame. The exception is a Firefox window covered whole, whose
  page is hidden and slowed: the output counts the documents that ran hidden, and a run that counts any is timed again.
- **`--quick`** times three rounds a document, where the default times twelve or sixteen, and no fresh page, in about
  45 s, for iterating. No claim rests on it: it calls main against itself on one to three entries a run, and of a build
  with work planted in it it called 50 and 52 entries where the default called 67.
- **`--foreground`** times pinned Chrome and Firefox and installed Safari in focused windows, one at a time: two
  sessions and a third of the documents whose entries were called, about eleven minutes with the screen, by floors of
  its own. A release's bench against the last release uses it (`DEVELOPMENT.md`, Releasing).
- **`--rows=`, `--browser=` and `--sessions=`** time some rows, some browsers, or another number of sessions; a verdict
  of one session is a hypothesis.

The rows follow what an app does: `new` (text no library or browser has laid out, and UI labels), `fresh` (a fresh page
a library: compiling and running the bundle and its first batches, as medians with no verdict), `rich` (rich inline, on
stress items and on the chat demo's paragraphs), `seen` (text prepared before), `resize` (`layout()` on kept handles),
`lines` (the line functions, on messages the simple stepper lays out) and `worst` (eleven worst-case shapes, five of
which reach the full walker). Never rank `prepare()` against `layout()`, as one is paid once and the other on every
resize.

- **"within noise (±x%)"** gives the widest band of the entry's sessions, the smallest change they could have called.
  Far above the row's floor, a copy of the library kept another speed for a document, and the entry says nothing of a
  smaller change: time its row again alone, with more sessions (`--rows`, `--sessions`).
- **A verdict is marked** "(unconfirmed)" when only two sessions back it, "(hypothesis: one session)" after one, and
  "(moves with the bundle)" on three Firefox entries that unrelated changes move.
- **A call on an entry whose code the change doesn't run** comes from how the browser runs the changed bundle, or from
  chance. Time a build one unused local apart before blaming the change, and name commits on both sides for a figure a
  decision rests on.

`harness/bench/README.md` has the rest: each row's texts and the code they reach, the measurements behind this protocol,
how each form's floors were fitted, the entries known to misread, and what a run takes and saves.

## Browsers and pins

Builds are read from the app bundles, since a user agent names only the major version. Each Firefox copy gets its update
policy before its first launch, since a pinned Firefox once updated itself (`browsers.ts` has how). A Chrome copy has no
such guard: Google's updater updated the pinned copy of 154.0.8037.57 in place to 154.0.8037.98 (2026-10-06), after
which `record`, `check` and `gate` refuse until a repin. That build recorded all 43,203 cases as 154.0.8037.57 had,
lines, widths and height, and holds the same break data. The pin went to 155.0.8059.80 on 2026-10-14, after the
installed Chrome updated itself twice: 155.0.8059.40 (2026-10-13) and 155.0.8059.80 each recorded all 43,795 cases as
154.0.8037.98 had, lines, widths and height, and hold the same break data. Safari can't be pinned, and a macOS update
moves all three browsers (system fonts, Core Text, ICU, emoji). `repin` records every case with the new build into a
scratch copy of the recordings and prints the cases laid out otherwise, the new page history, and whether the browser
still holds the files of `scripts/engine-data/` that its `sources.json` lists: the engines' compiled break rules and
ICU's character properties, not the two pair tables (DEVELOPMENT.md, Engine Data).

Firefox's pin went from 156.0.1 to 157.0.1 on 2026-10-10, four days after the installed Firefox updated itself. The two
builds recorded all 44,881 cases alike that day, lines, widths and height, and 157.0.1 holds the same break data.
Against the recordings kept until then no case starts or ends a line elsewhere, and 15 differ in line widths, in both
builds alike: each was page history with two recordings that differ only in widths (2026-09-24), pinned with the first
when page history was decided on line ends (2026-09-30), and a stored recording is kept while its lines hold (Accepted
and varying lists). In 9 the new recording is the second of the two, a width that moves with what the process laid out
before. In the other 6 the width that changed is that of a line ending in a space: the two recordings count the space
in it, and were made before the recorder left such spaces out, later that day. Those widths are all the repin changed
in the recordings.

webkit-host lays text out as Safari 27.0 does: the same line geometry on 25,180 cases in both orders (2026-09-17, in
the per-engine rebuild's harness) and on installed Safari's 2,000-case sample here, where the 1,990 cases pinned in both
recordings are identical, widths included, and the other 5 are page history in webkit-host (2026-09-24). That
compares the browsers' layouts only. Pretext's predictions aren't scored in installed Safari: it has no accepted list,
so `check --browser=safari` would report webkit-host's accepted failures as new, and its sample holds none of the cases
added since it was drawn. A Safari or macOS update voids the comparison until `repin safari`, which records both
browsers and prints on how many of the cases both pin their lines agree, shows they agree again. Installed Safari
stalls when hidden (WebKit suspends a hidden page past a CPU limit averaged over 8 minutes), so keep its window
uncovered during a job.

Firefox changes fonts after it starts (see also `PLATFORM_BUGS.md`, the late family names): emoji beside Arial laid out
otherwise when recorded 11 s after launch than at 12, 15 or 30 s (91 cases, Firefox 156.0, 2026-09-24), so each Firefox
job that records holds its first document until 15 s. A job that predicts starts at once: in Firefox 157.0.1 all 44,881
cases were predicted the same, lines and widths, with the hold and without it, twice, as were the 2,288 cases with
emoji predicted alone, without the hold (2026-10-11); `types.ts` says what would bring the hold back. Since Firefox 157
a tab's 201st navigation within 10 seconds does nothing and throws nothing (`PLATFORM_BUGS.md`, By design, or unfiled),
and a full `record`'s 201st navigation comes 7 to 13 s after its first, so each Firefox job's profile turns that limit
off (`browsers.ts`).

Pinned Chrome and Firefox open each job's window on the user's screen, behind the others. Its page is blank and dark
(`#111` on html and body; a case's paragraph is added, read and removed in one call, so none is ever painted), and its
title reads "This tab doesn't need focus - pretext harness", or "... - pretext bench" for the bench's: such a job
runs on fetches alone. The bench's own document is dark too, in the foreground as well. Chrome's window is the
smallest Chrome gives, 500x375. With all three, every case recorded the same lines, widths and height in both
orders, and was predicted the same, as with main's white page, bare title and 1200x900 window: Chrome's 43,101 and
Firefox's 44,205 (2026-10-05, Chrome 154.0.8037.57, Firefox 156.0.1). The one Chrome prediction listed as varying
between runs moved in check's order in 11 of 100 runs with them and in 14 of 100 without, and in reverse order in none
of either; no other prediction moved in any. None of the three reaches a case:

- **The colour** replaces the white that html and body already had, and a background isn't inherited, so each case's
  computed style is what it was. Chrome's rule that reads a background (What a case is and when it passes) reads the
  style of the element that holds the line's last text (`NeedsAccurateEndPosition`, Blink's `line_breaker.cc`), so the
  colour never goes on a case's own element: there it changed 171 of Chrome's recordings, 26 of them in a line's ends.
- **The title** is never laid out or measured. A sentence in the page, or an image of one, is: with either, that
  varying prediction moved in reverse order too, in 4 of 10 runs.
- **The window's size** isn't read by a case, whose box is placed absolutely at a width in px; a tenth of the cases
  overflowed the 1200 px window too.

The other windows are as they were. The bench's foreground runs keep the bare title and Chrome's 1200x900, which their
floors were fitted with, until a foreground run shows another form within them. The dark page is such a form: a
foreground bench of main against its own `src/` with it, three sessions on an idle machine, called no row in Chrome or
Firefox, and its rows' noise bands were the white page's (medians of 3.3% and 2.8% against 2.8% and 3.2%; 2026-10-05).
Firefox's window keeps its size: Firefox hides the page of a window covered whole, as a small one is more easily, and
three documents of one background bench at 500x375 ran hidden, two of them 1.7 and 3 times slower. Installed Safari's
page wasn't run, and webkit-host's window is transparent. During a recording job's hold a Firefox window shows Firefox's
own blank page. None of this was run with macOS set to always show scroll bars, where a case that overflows only the
small window would newly get one.

## Other ratios and phones

The checked-in recordings are one setup, macOS at device pixel ratio 2. A run outside it keeps its recordings and lists
in a store, a harness folder outside git (`--store=<dir>`, `.artifacts/harness-store` by default), and the environment
key carries the ratio, Chrome's zoom and a simulator's builds, so a store holds one setup per browser and `check`
refuses to score another. A new store has no accepted list, so every blocking failure reads as new; copy `accepted/`,
`counted/` and `varying/` into it first and `check` blocks on what differs from the checked-in setup: the new failures
fail there only, and the accepted cases that pass, pass there only. These runs are evidence; nothing gates on them.

- **`--scale=<n>`** runs Chrome and Firefox at device scale factor n (Chrome's `--force-device-scale-factor`, Firefox's
  `layout.css.devPixelsPerPx`), and **`--zoom=<n>`** runs Chrome at that page zoom, on `record`, `check`, `gate` and
  `explain`; webkit-host has no switch for either. Inside what Pretext claims, the sample was wrong on 0.49%, 0.51%,
  0.50%, 0.49%, 0.50% and 0.49% of paragraphs in Chrome 154.0.8037.57 at ratios 1, 1.25, 1.5, 2, 2.5 and 3, and on
  0.13%, 0.14%, 0.15% and 0.15% in Firefox 156.0.1 at 1, 1.5, 2 and 3; at most 5 of 11,901 cases flip against ratio 2,
  none at 3 (2026-09-30). Chrome's page zoom is the same number to its layout: at 125% on a ratio-2 display it recorded
  every sample case as at ratio 2.5, widths included.
- **`--browser=ios --runtime="iOS 26.0"`** runs Safari in an iOS simulator. Each job makes a device of that runtime's
  first iPhone, boots it with `xcrun simctl` alone, so Simulator.app never opens, opens the page in its Safari and
  deletes the device; a boot takes about a minute. The cases are Safari's, so webkit-host's lists copied to
  `accepted/ios.txt`, `counted/ios.txt` and `varying/ios.txt` compare it with Safari 27. Safari 26.0.1 in the iOS 26.0 simulator (23A8464)
  was wrong on 0.29% of the sample's paragraphs inside what Pretext claims, against 0.08% in Safari 27: of the 30 cases
  failing there only, 29 are `keep-all` paragraphs and one has a curly quote beside Hangul (2026-09-30; the WebKit
  profile follows Safari 27 only, `RESEARCH.md`, Decisions Log). No iOS 27 runtime was installed, so iPhone Safari 27
  has no number yet.

## Bounds and blind spots

Every job and its children have a memory and a time limit (`watchdog.ts`), since a planted defect, a deliberately broken
copy of `src/` run to prove a check catches it, is exactly the input that makes a loop run away: on 2026-09-25 three
orphaned test processes running such defects, with no timeout, held 42-49 GB each and froze a 36 GB Mac. A job's browser
is capped too (`browsers.ts`). The harness closes its browsers when it exits or is interrupted, but a SIGKILL leaves
them running: find them by their profiles (`pgrep -fl .artifacts/harness-profiles`, and `pgrep -fl webkit-host`) and
quit them, and delete a simulator device it left (`xcrun simctl list devices | grep pretext-harness`). Long paragraphs
are recorded by binary search over DOM `Range` rectangles for each line's end, not by reading every character's
rectangle (`observe.ts`): reading them all took 31-74 s natively on a 256,837-unit Arabic paragraph while building the
per-engine rebuild (branch `rebuild-20260916`, a from-scratch port of each engine's line breaking, kept as the
plain-text correctness reference; September 2026). Tools delete their own scratch files with `rmSync`.

The harness can't see the hyphen drawn at a soft-hyphen break: recordings keep no glyphs, and a rule over the boxes
found 93-358 mismatches per browser, some the recording's (2026-09-24), so it's left to `src/layout.test.ts`. A recorded
line width is the extent of the line's text boxes (`observe.ts`), which leaves out a padded span's padding at either end
of a line, so the shrink-wrap check can't fail on such a line and the width report counts the padding as a difference.
In webkit-host and Safari a line that ends in a space with a box, as a pre-wrap line that wraps at a space does, is
recorded in whole pixels, up to a pixel narrower than drawn: the recorder takes the space off by its box, which WebKit
rounds (`types.ts`, `wholePixelBoxes`). The width report leaves those lines out and prints how many: with them 8.6% of
the lines of webkit-host's passing sample draws inside the claims were more than 0.05 px off, without them 0.8%
(2026-10-01). The shrink-wrap check keeps them, so there it misses a box up to a pixel too narrow where such a line is
the widest, as in a fifth of the sample's pre-wrap draws, and webkit-host's `narrow` column reads low on pre-wrap text.
The table's `off` column counts no rich draw, and it leaves a line that ends in a space with a box out in every browser
(`score.ts`, `widthsOff`): a third of the lines of the sample's plain pre-wrap draws (2026-10-12), which it reads by
their other lines. It counts the draws that vary between runs (`varying/`) as the table's other columns do, so its row
for `system-ui` font lists reads 77 or 78 in webkit-host from one run to the next (2026-10-12).
The harness doesn't see re-layout at a line's own width; several rules of the Gecko profile's analysis of bidi
controls (`ENGINE_FOLLOWUPS.md`, Harness debt); an emoji modifier split from its
base across rich items; a rich paragraph of one item, which the adapter writes as plain text, so `src/layout.test.ts`
checks its line functions against the same item with an empty item after it, the form of the rich set's one such
paragraph (`under-1px/one-item`); text nodes of one style, which the adapter writes as one text, where Firefox's lines
turn on the node a zero-width space is in after preserved spaces that hang (`ENGINE_FOLLOWUPS.md`, Line edges); a line
that holds only an atomic item of white space, or in Firefox a padded item of
only a soft hyphen, which has no text for the recorder to list, so a prediction with that line is scored as a line too
many though the recorded height has it; Chrome's UI language, and so its `zh` table for pages without a
`lang`; rendering other than macOS's and an iOS simulator's (Other ratios and phones), though Android and Windows are
65% of page views (`weights.json`); text chat users wrote (the sample's chat draws are stand-ins; written prompts and replies in their place moved the
headline by 0.03 points or less, RESEARCH.md, Decisions Log, 2026-10-05); or the demos' painted
layout. `ENGINE_FOLLOWUPS.md`, Harness debt, lists the mechanisms and checks that no planted defect guards.
