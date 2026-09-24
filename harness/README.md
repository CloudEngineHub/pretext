# Harness

The browser's own layout of every case is recorded once per browser build and kept in git. Every later run only
predicts, in the real browser, the way an app does, and scores the prediction against the recording. The case format is
the per-engine rebuild's without inline structure.

```sh
bun harness record [--only-new]         # the browser's layout of every case, sorted and shuffled, in fresh short documents
bun harness check [--accept="<reason>"]  # predict every pinned case and score it; about a minute
bun harness gate [--sample=1000]         # check, plus reverse-order predictions, a fresh re-recording and attribution
bun harness equal <ref>                  # whether <ref>'s src/ predicts the same lines on every case
bun harness explain <id>                 # one case's recorded lines against the predicted ones
```

Every command takes `--browser=chrome|firefox|webkit-host|safari` (several with commas; default Chrome, Firefox and
webkit-host side by side), `--cases=<file.ndjson>` in place of `harness/cases/*.ndjson`, and `--lib=<dir>` to predict with
another build's `src/`. `bun test harness` runs the offline tests.

## How a case is judged

- **Pass:** the predicted line count is the browser's, and each line's first and last visible character is in the
  predicted line of that index. Predicted lines are ranges in source order, so that checks every visible character. A
  right count with a wrong break is a failure of its own, `breaks`.
- **Lines come from rect positions:** text box rects grouped by vertical centre, never height divided by line height.
- **A visible character** is a code point whose positive-size Range rects all sit on one line. Chrome also reports a
  soft hyphen's box for the code point next to it; that copy is left out.
- **Recording:** paragraphs under 1,000 UTF-16 units are read code point by code point; longer ones search from each line's
  first visible character for the next line's.
- **Pinned:** every recorded case with a visible character whose recordings agree: its two orders, and every earlier
  recording under the same environment key. A case laid out differently in any two is page history and is never pinned,
  so recording again under one key only adds to that list. Cases with nothing visible, or a style the browser refused,
  aren't.
- **Accepted failures:** a pinned case that fails blocks unless `harness/accepted/<browser>.txt` lists it under a
  written reason. Each run prints every reason with its count and, for real-usage draws, the share of real paragraphs it
  covers. A listed case that passes again, or is no longer pinned, blocks until it leaves the list; `--accept` writes the
  new failures under its reason and removes those.
- **Real-usage sample:** cases with `sample: { group, weight }` give the headline, the weighted share of real paragraphs
  right with a 95% interval from resampling within groups. It also prints the share of the weight outside what Pretext
  claims (break-all, rich-inline in pre-wrap, system-ui font lists) and the share right without it.
- **Shrink-wrap, report only:** a bubble sized to the predicted widest line, rounded up, is at least the browser's widest line.
- **Environment key:** browser build, OS build, the OS's and the page's languages, device pixel ratio and the web fonts
  served. The harness refuses to score recordings made under another key.

The gate adds three checks, each blocking: predictions in reverse order must break every line where the forward ones
do; a random sample recorded again must equal the recordings; and each new failure is recorded alone in a fresh
document (page history if it differs) and predicted alone (order-dependent if its breaks move), else reported as a true
loss with its family, width band and first differing line. Predictions whose line widths alone move with the order are
printed, not blocked: Chrome's per-canvas shape caches (Chromium #560614560) and a Firefox width-1 case move them in main
too, and widths only reach the shrink-wrap check, which reports.

What each piece catches, as an app developer would see it. `bun test harness` plants each fault except the gate's two,
which need a browser:

| Piece | Without it |
|---|---|
| Line count | A message loses or gains a line, so its bubble or row has the wrong height |
| First and last visible character per line | A word paints on the wrong line while the height is right; main passed 4.5-8.1% of its census cases this way |
| Chrome's soft hyphen copies left out | A wrong break at a soft hyphen passes unseen |
| Lines from rect positions | Fractional line boxes read as a wrong count, as Safari 27's did in main's harness |
| Line-start search | Long paragraphs would take minutes per browser; a wrong search would hide or invent a book's wrong line |
| Environment key | A browser or OS update reads as library regressions or fixes |
| Page-history list, kept across recordings of one environment | Cases that lay out differently after other cases block changes at random; one recording's two sorted orders found 11 of WebKit's 87 |
| Firefox's first document held until 15 s after launch | Emoji beside Arial lay out differently for Firefox's first 12 s: 91 cases, and the gate's fresh recording, would block at random |
| Accepted list with reasons | Accepted losses go silent, and a fix goes unrecorded |
| Exact widths through the adapter | Text that exactly fits its bubble wraps (a width 1/64 px short) |
| Reverse-order predictions (gate), judged by where lines break | A message wraps differently depending on what the app prepared before; widths moved by Chrome's shape caches would block main too |
| Fresh re-recording (gate) | Stored recordings stop describing the browser |
| Layout asking Canvas nothing (test), Canvas calls per 1,000 units (printed) | Every window resize measures text again, or preparing gets slower unnoticed |
| Two recordings kept apart, sorted and stable | The gate is green or red on another case's layout, and every recording churns in git |
| Sample draws weighted back to their share | A rare group topped up to 300 draws moves the headline far more than it moves real apps |
| The checked-in sample equal to what the weights draw | A changed weight scores the old usage |
| Controls of one category merged where browsers agree | Each copy of a pasted-control family counts as a behaviour of its own |
| Only the widths around a change, at most three per template, the widest first | One input is pinned at hundreds of widths, and review drowns in near-copies |
| A width inside each layout besides the edges of a change | A behaviour the library models reads as missing whenever its fit is off by 1/128 px |
| One change per kind of break in the catalog | Two inputs that break alike double the review for one behaviour |

## Files

- `recordings/<browser>.txt`: one case per line, sorted, under a `# env` header: `<id>\t<height>\t<first>-<last>:<width> ...`
  per line, `-` for a line with no visible character. `recordings/<browser>.history.txt`: two recordings of each
  page-history case that differ. `recordings/safari.txt` holds installed Safari's recording of 2,000 cases.
- `accepted/<browser>.txt`: `## <reason>` headings, each followed by `<id> <status>` lines.
- `cases/*.ndjson`: one case per line. `smoke.ndjson` holds the rebuild's hand-written smoke cases within what Pretext
  claims, and 300 real-text census cases across 18 corpora and six widths. The case sets are below.

## Case sets

`bun harness/sets/make.ts` makes every case file but the smoke, census and book sets, which are the rebuild's, taken
once; its header lists the steps. A case's id hashes what the browser lays out, so making a set again keeps its ids and
their recordings.

| File | Cases | What it holds | Reported as |
|---|---:|---|---|
| `sample.ndjson` | 11,901 | The real-usage sample: 10,000 draws by `sets/weights.json`, plus the draws that bring 21 rare groups to 300 each, weighted back to their real share | The headline |
| `catalog.ndjson` | 37,511 (18,101-19,514 per browser) | main's adversarial families, the rebuild's rule families, filed reports whose reporter measured the width, and every UAX #14 line-break class between the scripts apps mix, pairwise over the CSS settings the library takes | Behaviours modelled |
| `facts.ndjson` | 10,018 (4,820-4,929) | The 28 engine facts `src/layout.test.ts` checks on plain text with a fake Canvas, in a browser | Behaviours modelled |
| `rich.ndjson` | 3,334 (1,617-1,636) | Rich-inline paragraphs: styled runs, span edges, atomic chips and padded code spans, main's inline items, #120, #171, #177, #323 and main's engine facts about rich items | Behaviours modelled |
| `census.ndjson` | 4,386 | The rebuild's census of real text (census-20260919): paragraphs of the 18 corpora at six widths, less the 300 in the smoke set | Pinned cases |
| `books.ndjson` | 72 | The rebuild's book survey: each corpus whole, raw and as main normalizes it, at the narrowest and widest step-10 widths | Pinned cases |
| `reports.ndjson` | 28 | Filed reports, with the input and width as filed | Pinned cases |
| `oracles.ndjson` | 54 | The mode oracles in `src/test-data.ts`, now in Firefox too | Pinned cases |

**The sample.** A draw picks a surface (chat, AI replies, cards, documents, UI, editorial pages), a script by that
surface's mix, a text from the pools, the style settings apps use, and a width from a device, its viewport and the
app's rule. Every share in `weights.json` names a source or says what its guess leans on, and `pools` names each text
pool's source and license. The rare groups (break-all, pre-wrap with newlines, URLs and long words, keep-all Korean, soft
hyphens, Windows-only font lists, letter spacing, mixed scripts, table cells, and every script) get at least 300 draws,
so a group with no failure is under 1% wrong with 95% confidence. A draw whose text stands in for the kind asked for
(every chat draw, since no chat that users wrote is checked in yet) is marked, and `check` prints their share.

**The searched sets** (catalog, facts, rich) start from templates, inputs without a width:
1. `first` records each template at a coarse grid and at width 1 and 100000, in each browser.
2. `select` merges inputs that differ only in which Cc or Cf control they hold, where all three browsers lay them out
   alike. The catalog then keeps a change between neighbouring widths only when it shows a kind of line break no
   earlier template showed in that browser, and every family keeps one. The facts and rich sets keep every change.
3. `bisect` narrows each kept change to one layout unit: 1/128 px in Chrome, 1/64 px in WebKit, 1/60 px in Firefox.
4. `cut` pins width 1 and 100000 and, per browser, at most three exact changes per template, each a new kind of break,
   the widest first. Each change gets a width 1/64 px either side of where the lines change (`edge`, where
   the fit is exact to 1/64 px) and a whole pixel well inside each of its two layouts (where the break chosen is checked
   away from the fit). One Chrome layout unit (1/128 px) either side was finer than the fit is exact to: half those
   cases failed for main and the hybrid alike.

`check` reports a behaviour as modelled when every width away from the edges passes, and counts those that pass at the
edges too.

The searches' own recordings stay in `.artifacts/harness-sets/`. A behaviour narrower than 24 px is pinned like any
other, so one the library doesn't model goes on the accepted list with a reason such as "narrower than real layouts".

## Browsers

Chrome and Firefox are pinned copies in `~/github/browser-engines/apps` (`HARNESS_APPS`), named in `browsers.ts`: make one
with `ditto` from `/Applications` and bump the version there. Chrome gets its own profile, an en-US interface and one
background window opened through the DevTools protocol; Firefox launches through LaunchServices, which macOS 27 needs.
For about 12 s after it starts, Firefox changes fonts under a page (`PLATFORM_BUGS.md`, the late family names), so every
Firefox job holds its first document until 15 s after launch. WebKit runs as webkit-host (`webkit-host/build.sh`), the
system WebKit.framework that installed Safari runs, in a window below every other. Nothing takes focus.

Installed Safari opens a window of its own, only while another app is frontmost, and hands the focus back if it takes it;
the window must stay uncovered while a job runs. It is recorded on a sample drawn from every set,
`bun harness record --browser=safari --sample=2000 --seed=20260924`, which webkit-host matched on every case but WebKit's
page history.
