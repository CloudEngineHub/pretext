# Harness

The browser's own layout of every case is recorded once per browser build and kept in git. Every later run only
predicts, in the real browser, the way an app does, and scores the prediction against the recording. The case format is
the per-engine rebuild's without inline structure.

```sh
bun harness record [--only-new]         # the browser's layout of every case, in two orders, in fresh short documents
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
  soft hyphen's box for the code point next to it; that rect is left out.
- **Recording:** paragraphs under 1,000 UTF-16 units are read code point by code point; longer ones search from each line's
  first visible character for the next line's.
- **Pinned:** every recorded case with a visible character whose two recordings agree. A case laid out differently in its
  two orders is page history and is never pinned. Cases with nothing visible, or a style the browser refused, aren't.
- **Accepted failures:** a pinned case that fails blocks unless `harness/accepted/<browser>.txt` lists it under a
  written reason. Each run prints every reason with its count and, for real-usage draws, the share of real paragraphs it
  covers. A listed case that passes again, or is no longer pinned, blocks until it leaves the list; `--accept` writes the
  new failures under its reason and removes those.
- **Real-usage sample:** cases with `sample: { group, weight }` give the headline, the weighted share of real paragraphs
  right with a 95% interval from resampling within groups.
- **Shrink-wrap, report only:** a bubble sized to the predicted widest line, rounded up, is at least the browser's widest line.
- **Environment key:** browser build, OS build, the OS's and the page's languages, device pixel ratio and the web fonts
  served. The harness refuses to score recordings made under another key.

The gate adds three checks, each blocking: predictions in reverse order must equal the forward ones (results that depend
on what was prepared before are a library defect); a random sample recorded again must equal the recordings; and each new
failure is recorded alone in a fresh document (page history if it differs) and predicted alone (order-dependent if it
differs), else reported as a true loss with its family, width band and first differing line.

## Files

- `recordings/<browser>.txt`: one case per line, sorted, under a `# env` header: `<id>\t<height>\t<first>-<last>:<width> ...`
  per line, `-` for a line with no visible character. `recordings/<browser>.history.txt`: both recordings of each
  page-history case.
- `accepted/<browser>.txt`: `## <reason>` headings, each followed by `<id> <status>` lines.
- `cases/*.ndjson`: one case per line. `smoke.ndjson` holds the rebuild's hand-written smoke cases within what Pretext
  claims, and 300 real-text census cases across 18 corpora and six widths.

## Browsers

Chrome and Firefox are pinned copies in `~/github/browser-engines/apps` (`HARNESS_APPS`), named in `browsers.ts`: make one
with `ditto` from `/Applications` and bump the version there. Chrome gets its own profile, an en-US interface and one
background window opened through the DevTools protocol; Firefox launches through LaunchServices, which macOS 27 needs.
WebKit runs as webkit-host (`webkit-host/build.sh`), the system WebKit.framework that installed Safari runs, in a window
below every other. Installed Safari opens a window of its own, which must stay uncovered while a job runs. Nothing takes focus.
