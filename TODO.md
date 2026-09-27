# Current Priorities

<!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: no quotes in this file -->

One line per item, with where its detail lives. Work depth-first; punted items stay here or in ENGINE_FOLLOWUPS.md with what would reopen them, and one answered in chat leaves.

## Now

- The docs revamp: the app fresh agents built from the README alone is still unchecked in a browser.
- X1, the engineering.md pass's last item: rich-inline lines continue in the line walker instead of walking items again (RESEARCH.md, Rich Inline Boundaries, Joined Text). Not landed.
<!-- Q14 placeholder: if the maintainer answers, a task goes here: time one full `bun harness repin` per browser, and add a sampled first pass only if it takes more than minutes. -->
<!-- Q10 placeholder: the rebuild branch's public refs; an answer adds a task here. -->
<!-- Q11 placeholder: the quotes in the rebuild's docs; an answer adds a task here. -->

## End of project

- The API discussion: today's API stays, and alternatives are additions (RESEARCH.md, Caching And API Design; the studies are in Dead Ends). <!-- Q1: recommendation taken; the maintainer hasn't answered --> On its list:
  - idempotent layout without handles, perhaps with an optional prepare-like warm-up;
  - who owns and bounds the per-font width cache, which grows per new segment until `clearCache()`;
  - parked speed-ups: the width memo (drag frames 2.9-4.2× faster, new widths up to 26% slower), the font given at layout, a Firefox cache of Thai word boundaries;
  - an element's own language and `Content-Language` as inputs (ENGINE_FOLLOWUPS.md, Language and generic families);
  - the emoji correction in a worker (#292, PR #346);
  - a paragraph direction, and the device pixel ratio for Chrome's fit grid (#321's decisions 3 and 4); <!-- Q18: recommendation taken; the maintainer hasn't answered -->
  - `getTextClusters()` once Chrome ships it, no help for Firefox;
  - `extraWidth` on a rich item split across lines, which browsers pad only at its outer ends, and #201's fixed-width inline item;
  - how a browser whose Canvas lacks what its profile needs degrades, never to nothing.
- Then a release, not before.
- License notices for the ported engine code and data.
- File the collected browser bugs (ENGINE_FOLLOWUPS.md, External actions).
- The open demo and showcase issues (#94, #99, #150, #151, #152, #167). <!-- Q16 placeholder: the bubbles demo's stacking; an answer adds its task here. -->

## Open design questions

- Server-side measurement and other backends, such as React Native's: punted, not closed. Without `OffscreenCanvas`, Node and Bun need a Canvas supplied.
- Rich inline in `pre-wrap` (#173): not blocked by the architecture (RESEARCH.md, Box Edges And Pre-wrap); the hard parts are spaces hanging across a style change, tab stops across fonts and empty lines (`rebuild/research/PREWRAP-RICH.md` on `rebuild-20260916`).
- Source offsets and carets for editing rich text (#90, #198); whether bidi selection and copy stay outside Pretext.
- Changing text (#313): a handle per paragraph, as README advises (#362); incremental preparation isn't worth building yet (RESEARCH.md, Dead Ends, Caching, State And API Designs).
- `system-ui` (#336): why the browsers differ, and what support would take.
- Automatic hyphenation (`hyphens: auto`): out of scope today, a possible feature. <!-- Q3: recommendation taken; the maintainer hasn't answered --> <!-- Q3 note: P-SCO-22 -->
- Intrinsic or logical-width APIs beyond `measureNaturalWidth()`.
- A slower diagnostic mode that leaves `layout()` alone (March 2026's attempt: RESEARCH.md, Dead Ends, The Measurement Model).
