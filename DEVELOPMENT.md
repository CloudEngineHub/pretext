# Development

Commands are in `package.json` and the header of `harness/cli.ts`; the harness and the bench are in [harness/README.md](harness/README.md).

## The Demo Server

`bun start` listens on every network interface, not only localhost, so a phone on the same Wi-Fi can open the demos; a PR that bound it to localhost was closed for that (#114). It first kills whatever listens on port 3000, so a server left from an earlier session can't hold the port.

## Engine Data

The break and grapheme tables are refreshed by hand, never in a build step: each must be the copy one browser build ships, and copies drift (Chromium 147's `line_normal.brk` differs from 153's on 239 code points, 2026-09-16). `bun harness repin` says when a browser no longer holds the bytes in `scripts/engine-data/`; refresh that folder as the generator's header describes, run `generate:engine-break-data`, then the grapheme check. Nothing checks Safari's generic-family table (`generate:webkit-generic-families`) against a newer macOS or iOS; only a new dump of Core Text's answers does.

The engine files stay checked in so the tables rebuild offline. So does the 30 MB behaviour catalog (`harness/cases/catalog.ndjson`): its widths came from bisecting in the browsers, so it can't be made again offline, and it's in history already.

### Grapheme Check

After a grapheme table changes, compare `src/graphemes.ts` with `Intl.Segmenter` in Chrome, Firefox and webkit-host; `scripts/grapheme-check/` has the commands in its headers.

## Releasing

No release until after the API discussion (TODO.md). License notices for the ported engine code and the files in `scripts/engine-data/` aren't written yet. At release, fold CHANGELOG.md's pre-#340 break-rule entries into #340's. <!-- Q8: recommendation taken; the maintainer hasn't answered -->

Every push to `main` publishes the demo site (`.github/workflows/pages.yml`).

## Deep Profiling

Bun and Node microbenchmarks suit quick experiments; browser behaviour needs browser measurements. For an algorithmic change, grow the text and its number of segments, forced lines and rich items (repeated punctuation, Arabic joins, CJK keep-all, long hyphenated URLs, whitespace runs), and count visited boundaries and submitted Canvas text with cold caches before trusting a timing: doubling an input should not quadruple repeated work ([RESEARCH.md](RESEARCH.md), Keeping Work Bounded).
