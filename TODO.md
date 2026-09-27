# Current Priorities

<!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: no quotes in this file -->

What's next, one line each, with where the detail lives. Work depth-first: finish what's open before new discovery, and keep whatever gets punted here or in ENGINE_FOLLOWUPS.md, with what would reopen it. Decisions are made in chat; one answered there leaves this file.

## Now

- The docs revamp, then its check: fresh agents doing each reader's job with only the docs, and fixing what they trip over. `scripts/doc-citations.test.ts` already keeps every `<DOC>.md, <Section>` citation in code naming a heading.
- X1, the last item of the engineering.md pass: rich-inline lines continue in the line walker instead of walking items again. Not landed.
- Whether the width cache's `Map` key changes what Chrome measures: being probed (ENGINE_FOLLOWUPS.md).
<!-- Q14 placeholder: if the maintainer answers, a task goes here: time one full `bun harness repin` per browser, and add a sampled first pass only if it takes more than minutes. -->
<!-- Q10 placeholder: the rebuild branch's public refs; an answer adds a task here. -->
<!-- Q11 placeholder: the quotes in the rebuild's docs; an answer adds a task here. -->

## End of project

- The API discussion. It starts from today's API, which stays, and weighs alternatives as additions to it (RESEARCH.md, Part 1: Intent). <!-- Q1: recommendation taken; the maintainer hasn't answered --> On its list:
  - idempotent layout without handles, perhaps with an optional prepare-like warm-up (a study on 2026-09-26 recommended keeping handles);
  - who owns and bounds the per-font width cache, which lives until `clearCache()` and grows with every new segment;
  - three parked speed-ups: the width memo (drag frames 2.9-4.2× faster, new widths up to 26% slower), taking the font at layout instead of at prepare, and a Firefox cache of Thai word boundaries (text prepared before 10-15× faster, new text unchanged);
  - an element's own language and `Content-Language` as inputs (ENGINE_FOLLOWUPS.md, Language and generic families);
  - handing the emoji correction to a worker (#292, PR #346);
  - a paragraph direction, and the device pixel ratio for Chrome's fit grid (#321's decisions 3 and 4); <!-- Q18: recommendation taken; the maintainer hasn't answered -->
  - `getTextClusters()` once Chrome ships it, which wouldn't help Firefox;
  - `extraWidth` on a rich item split across lines, which browsers pad only at its outer ends, and #201's fixed-width inline item;
  - how a browser whose Canvas lacks what its profile needs degrades, never showing nothing.
- Then a release, not before.
- License notices for the ported engine code and the checked-in engine data.
- File the collected browser bugs (ENGINE_FOLLOWUPS.md, External actions).
- A pass over the open demo and showcase issues (#94, #99, #150, #151, #152, #167). <!-- Q16 placeholder: the bubbles demo's stacking; an answer adds its task here. -->

## Open design questions

- Server-side measurement, and React Native or other measurement backends: punted, not closed. Without `OffscreenCanvas`, Node and Bun need a Canvas supplied.
- Rich inline in `pre-wrap` (#173): the architecture doesn't block it. The redo got line counts right on 99.3-100% of 1,334 rich pre-wrap cases per browser (2026-09); the hard parts are spaces hanging across a style change, tab stops across fonts and empty lines (`rebuild/research/PREWRAP-RICH.md`, branch `rebuild-20260916`).
- Source offsets and carets for rich-text editing (#90, #198), and whether bidi selection and copy stay outside Pretext.
- Changing text (#313): per-paragraph handles are the README's answer (#362), and a cost model on 2026-09-26 found incremental preparation not worth building yet.
- `system-ui` (#336): why each browser differs and what supporting it would take.
- Automatic hyphenation (`hyphens: auto`): out of scope today, a possible feature. <!-- Q3: recommendation taken; the maintainer hasn't answered --> <!-- Q3 note: P-SCO-22 -->
- Intrinsic or logical-width APIs beyond `measureNaturalWidth()`.
- A slower diagnostic mode that leaves `layout()` alone. The one tried in March 2026, a word sum with one Canvas call for lines near the width, brought back Chrome's emoji inflation and needed segment texts at layout time.
