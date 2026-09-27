# Development

Commands are in `package.json` and the header of `harness/cli.ts`; the harness and the bench are in [harness/README.md](harness/README.md).

## The Demo Server

`bun start` listens on every network interface, not only localhost, so a phone on the same Wi-Fi can open the demos; a PR binding it to localhost was closed for that (#114). It first kills whatever listens on port 3000, so a server left running from before can't hold the port.

## Engine Data

The break and grapheme tables are refreshed by hand, never in a build step: each must be the copy one browser build ships, and copies drift (Chromium 147's `line_normal.brk` differs from 153's on 239 code points, 2026-09-16). `bun harness repin` says when a browser no longer holds the bytes in `scripts/engine-data/`; then refresh that folder as the generator's header describes, run `generate:engine-break-data`, then the grapheme check. Nothing checks Safari's generic-family table (`generate:webkit-generic-families`) against a newer macOS or iOS; only a new dump of Core Text's answers does.

The engine files stay checked in so the tables rebuild offline, and so does the 30 MB behavior catalog (`harness/cases/catalog.ndjson`): its widths came from bisecting in the browsers, so it can't be made again offline, and it's in history already.

### Grapheme Check

After a grapheme table changes, compare `src/graphemes.ts` with `Intl.Segmenter` in Chrome, Firefox and webkit-host (the harness's background app on the system WebKit that Safari runs); the headers in `scripts/grapheme-check/` have the commands.

## Releasing

No release until after the API discussion, the review of the public API that TODO.md lists under End of project. Before one, run `bun run package-smoke-test`, the only check that packs and imports the built package, so the only one an extensionless import in `src/` fails. License notices for the ported engine code and `scripts/engine-data/` aren't written yet. At release, fold CHANGELOG.md's Unreleased entries for break rules that #340's engine ports replaced into #340's entry.

Every push to `main` publishes the demo site (`.github/workflows/pages.yml`).

## Deep Profiling

Bun and Node microbenchmarks suit quick experiments; browser behavior needs browser measurements. For an algorithmic change, grow the text and its segments, forced lines and rich items (repeated punctuation, Arabic joins, CJK keep-all, long hyphenated URLs, whitespace runs), and count visited boundaries and submitted Canvas text with cold caches before trusting a timing: doubling an input should not quadruple repeated work ([RESEARCH.md](RESEARCH.md), Keeping Work Bounded).
