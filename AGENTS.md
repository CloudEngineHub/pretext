## Pretext

**Every time before you commit, ensure you've synced the docs**.
Do not change the existing tone of the documents unless they're wrong.
Before reversing a documented decision, read the Decisions Log at the end of `RESEARCH.md`; code comments that cite it mark where each one applies.
Do `bun install` if you're in a fresh worktree.
After a feature, with the whole picture in view, pass over the files again for simplifications; don't change things for their own sake. <!-- Q17: recommendation taken; the maintainer hasn't answered -->

Changelog updates guideline: don't add dev-facing notes, only user-facing ones. Refer to closed PR numbers.

### Where things are

- `README.md`: the public source of truth for API examples and user-facing limitations, with no per-browser accuracy or speed figures. `RESEARCH.md`: intent (Part 1), evidence and dead ends (Part 2), the Decisions Log (Part 3).
- `harness/README.md`: how cases pass and grow; accuracy claims rest on its recordings and accepted lists. Speed claims and finished comparisons go in PR descriptions.
- `ENGINE_FOLLOWUPS.md`: open gaps, updated when one lands, is dropped or is answered in chat. `PLATFORM_BUGS.md`: browser and OS bugs, read before changing an engine-profile workaround or a line-fit tolerance. `TODO.md`: priorities. `DEVELOPMENT.md`: engine data and releases.
- `pages/demos/markdown-chat.md`: the chat demo's patterns for app developers, updated with the chat. <!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md is folded into RESEARCH.md Part 2 and left off this list -->

A text goes through:

1. **Analysis** (`src/analysis.ts`): white space per its CSS mode, break opportunities from ports of each engine's scan (Blink's and WebKit's, as Safari 27 runs it, in `src/line-breaks.ts`; Gecko's in `src/gecko-line-breaks.ts`), and segments between them.
2. **Measurement** (`src/prepare.ts` over `src/measurement.ts`): Canvas widths cached per font and segment across texts, and what changes at line edges.
3. **Line walking** (`src/line-break.ts`): arithmetic over the prepared arrays, for `src/layout.ts` and `src/rich-inline.ts`.

The engine profile is `getEngineProfile()` (`src/measurement.ts`), its tables in `src/generated/`.

### Intent

Each bold label is the `RESEARCH.md` Part 1 section with the reasons; the maintainer skims fixes inside these lines. <!-- Q1: recommendation taken; the maintainer hasn't answered -->

- **What Pretext Is For.** Userland layout without the DOM, above all virtualized lists of many `prepare()` calls, whose cost counts too; heights exact, never estimated.
- **Lines Drawn.** `prepare()` and `layout()` read no DOM or style beyond the emoji-correction span, the `<html lang>` read and the detached-canvas fallback; a fix needing more is rejected, the limitation documented. Widths come only from Canvas `measureText`, through APIs all three browsers ship. Every browser on a modeled engine, Edge as Blink, gets a layout; fringe ones get no rules of their own. Keep stricter editorial whole-word handling in userland instead of changing the library default. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **The Correctness Stance.** A premise no real font has falsified may buy speed, as a default with a named gap; as a last resort ad hoc rules give way, then petty requirements, cost stated. CJK stays well supported.
- **The Redo And What Counts As Done.** Done, upkeep only: the north star against sliding back into old main's rules per input shape.
- **Tests And Losses.** A lost pass may be an accident or a bad test; true losses go to the maintainer. Cases grow by behaviour, not by repro (`harness/README.md`, How cases grow). <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Engineering.** Complexity kept down, line count its proxy; per-engine code that barely interacts counts for less than its lines. <!-- Q15: recommendation taken; the maintainer hasn't answered --> Cater to the worst case, which may regress slightly for a real gain.
- **Caching And API Design.** Caches only where a measurement asks; exports stay until the API discussion.
- **Tables Against Canvas.** Engine and Unicode data in tables pinned to the engine's build; font facts from Canvas at runtime. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Docs.** Leave out what the code shows cheaply; date each measured fact and dead end with its browser build and what would reopen it; quote the maintainer exactly, only where the wording is the point. <!-- Q2: recommendation taken; the maintainer hasn't answered -->
- **Merge Bars And Landing.** A change Pareto-optimal on correctness, speed and decent simplicity merges; a trade goes to the maintainer with numbers. A fix that doesn't make sense waits, even when validation passes.

### Fixing a mismatch

- Start from the engine's source: find where Blink, WebKit or Gecko decides the behaviour, and port that rule or its data, citing where it lives.
- Model the structure, not the symptom: a fix reads as "the browser does X", never as "inputs shaped like Y get Z". Nothing keyed on font names or on the failing strings.
- Where Pretext can't do what the engine does cheaply, state the premise it takes instead and name its gap: what it gets wrong, and when. Pretext itself is such an approximation: Canvas widths summed per segment, with the engines' known differences corrected.
- For plain text, the per-engine rebuild (`rebuild/` on branch `rebuild-20260916`) is the correctness reference: where it gets a case right, port its rule. For rich inline, follow the engine's own inline model: one paragraph's text broken across its spans.
- Engine differences live in the engine profile and its tables, not in branches elsewhere.
- Attribute every case a change moves (fixed, right by luck, page history) before landing; a new accepted failure needs a written reason.
- Write plain predictable code; don't shape code to one JIT's heuristics, and accept a small regression a JIT alone explains. Don't keep dead or redundant code because one JIT runs it faster, whatever the regression, and note what it costs (`RESEARCH.md`, Decisions Log).

### Implementation notes

- Plain objects and functions, not classes, and a line walker's state in its own locals with integer loop bounds: a class field doubles Firefox 156's compile time for the whole bundle, V8 boxes a captured number, and JavaScriptCore types an infinite bound as a double (`RESEARCH.md`, Keeping Work Bounded).
- `layout()` is the resize hot path: no Canvas calls, no string work, no gratuitous allocations. `prepare()` stays the opaque fast handle, paying for nothing `layout()` doesn't read, with no second public prepare surface; the break kinds (`SegmentBreakKind`) stay apart, not one boolean.
- Preparation replaces the measurement context when its language changes, never on `clearCache()`: Chrome's OffscreenCanvas keeps an unchanged font string's old fonts, and Chrome caches shaped text per canvas (`PLATFORM_BUGS.md`).
- Source imports keep `.js` specifiers in `.ts` files, so plain `tsc` emits working JS and `.d.ts`; `moduleResolution: "bundler"` accepts extensionless ones, which only `bun run package-smoke-test` catches.
- Comments cite a doc heading, as `RESEARCH.md, <Section>`, never a line number; `scripts/doc-citations.test.ts` checks the heading exists.
- Engine data is refreshed by hand, never in a build step (`DEVELOPMENT.md`). `Intl.Segmenter` only splits words, in the Southeast Asian runs the scans send it, since there it runs the browser's own dictionary or model (`RESEARCH.md`, Tables Against Canvas).

### Validation

- On coming back, or after a browser or OS update, run `bun harness repin chrome`, `repin firefox` and `repin safari` first; `--write` takes the new build, in a commit of its own. <!-- Q14 placeholder: whether repin records a seeded sample before every case; unanswered, so nothing here changes yet -->
- Keep `bun test`, `bun run check` and `bun harness check` (Chrome, Firefox, webkit-host) green; run `bun harness gate` before landing a change to `src/` or `harness/`. Commit recordings and lists with their cause.
- Before landing a change to `src/` other than `layout.test.ts`, or to `harness/bench/`, paste `bun harness bench main`'s table, every row, into the PR; a row slower in every session needs a sentence, as does growth over 5% in the `measureText` calls or submitted units `bun harness equal main` prints.
- Settle behaviour in the harness's browsers, not headless; `--background` bench results are hypotheses. Jobs may run side by side while free plus inactive memory stays above about 30%, installed Safari's one at a time; the bench runs alone, in the foreground, on a quiet machine (`harness/README.md`, Bench).
- Use named fonts, and give probe pages an explicit, non-empty `lang`, or the runner's languages leak in (`RESEARCH.md`, Content Language And Fonts). Re-test the macOS emoji and `system-ui` bugs headed on a Retina display: headless DPR 1 masks them.
- Traps: a right line count can hide wrong breaks (`RESEARCH.md`, Reading Browser Output); WebKit's per-process caches make a webkit-host result depend on earlier layouts (`harness/README.md`, Accepted and varying lists); an evaluator mustn't certify its own run, and an oracle can copy the library's mistake (`RESEARCH.md`, Evaluation Traps).

### Demos

In `pages/demos/`, the model owns every value Pretext measures or a layout width depends on, the text as painted, padding, borders and breakpoints included; the painter writes them inline, and a border inside a model width is an inset box-shadow. Demos never correct what Pretext reports (`RESEARCH.md`, Demos And The Chat). A scrolling page sets `html { scrollbar-gutter: stable }` and reads `document.body.clientWidth`, an inner scroller its own `clientWidth` with the same gutter, as Chrome's `documentElement.clientWidth` ignores the gutter until a scrollbar is drawn (Chrome 153, 2026-09-15; `RESEARCH.md`, Scrolling And Scrollbars). After a demo fix, check the sibling demos (`RESEARCH.md`, Rich Inline Boundaries, Painting Lines). <!-- Q16 placeholder: whether the bubbles demo places each bubble from Pretext's heights, as the Markdown chat does; unanswered, so nothing here changes yet -->
