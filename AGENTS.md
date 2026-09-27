## Pretext

**Every time before you commit, ensure you've synced the docs**.
Do not change the existing tone of the documents unless they're wrong.
Before reversing a documented decision, read the Decisions Log at the end of `RESEARCH.md`; code comments that cite it mark where each one applies.
Do `bun install` if you're in a fresh worktree.
After a feature, with the whole picture in view, pass over the files again for simplifications; don't change things for their own sake. <!-- Q17: recommendation taken; the maintainer hasn't answered -->

Changelog updates guideline: don't add dev-facing notes, only user-facing ones. Refer to closed PR numbers.

### Where things are

- `README.md` is the public source of truth for API examples and user-facing limitations, with no per-browser accuracy or speed figures. `RESEARCH.md` holds the intent (Part 1), the evidence and dead ends (Part 2) and the Decisions Log (Part 3).
- `harness/README.md` says how cases pass and grow. Accuracy claims rest on its recordings and accepted lists; speed claims and finished comparisons go in PR descriptions.
- `ENGINE_FOLLOWUPS.md` lists open gaps; update it when one lands, is dropped or is answered in chat. `PLATFORM_BUGS.md` is the browser/OS bug ledger: read it before changing an engine-profile workaround or a line-fit tolerance. `TODO.md` has the priorities, `DEVELOPMENT.md` engine data and releases.
- `pages/demos/markdown-chat.md` teaches app developers the chat demo's patterns; update it when the chat changes. <!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md is folded into RESEARCH.md Part 2 and left off this list -->

Engine differences live in the engine profile (`getEngineProfile()`, `src/measurement.ts`) and the tables in `src/generated/`. A text goes through:

1. **Analysis** (`src/analysis.ts`): white space as the CSS mode treats it, break opportunities from ports of the engine's own scan (Blink's and WebKit's, as Safari 27 runs it, in `src/line-breaks.ts`; Gecko's in `src/gecko-line-breaks.ts`), and segments between them.
2. **Measurement** (`src/prepare.ts` over `src/measurement.ts`): Canvas widths cached per font and segment across texts, and what changes at a line's edges.
3. **Line walking** (`src/line-break.ts`): arithmetic over the prepared arrays, for `src/layout.ts` and `src/rich-inline.ts` alike.

### Intent

Each bold label names the section of `RESEARCH.md` Part 1 that gives its reasons. The maintainer skims fixes that stay inside these lines, which is why they're written down (Why The Intent Is Written Down). <!-- Q1: recommendation taken; the maintainer hasn't answered -->

- **What Pretext Is For.** Userland layout without the DOM, above all virtualized lists with many `prepare()` calls, so `prepare()`'s cost counts too. Heights are exact, never estimated.
- **Lines Drawn.** No DOM or style reads in `prepare()` or `layout()` beyond the emoji-correction span, the `<html lang>` read and the detached-canvas fallback; a fix that needs more is rejected, and the limitation documented. Widths come from Canvas `measureText` alone, through APIs all three browsers ship. Every browser on a modeled engine, Edge as Blink, gets a layout, and fringe browsers get no rules of their own. Keep stricter editorial whole-word handling in userland instead of changing the library default. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **The Correctness Stance.** A premise no real font has falsified may buy speed, as a default with a named gap. As a last resort ad hoc rules give way, then petty requirements, with the cost stated; CJK stays well supported.
- **The Redo And What Counts As Done.** The redo is done, upkeep only, and the north star against sliding back into old main's rule per input shape.
- **Tests And Losses.** Attribute a lost pass (a true loss, an accident or a bad test) before calling it a regression; true losses go to the maintainer. Cases grow by behaviour, not by repro: a fix never adds to the real-usage sample, adds a few templates in the behaviour's shape rather than a cross product, and puts an exact rule's matrix in a fake-Canvas unit test, and its PR states each set's growth (`harness/README.md`, How cases grow). <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Engineering.** Keep complexity down, with line count its proxy; per-engine code that barely interacts counts for less than its lines. <!-- Q15: recommendation taken; the maintainer hasn't answered --> Cater to the worst case, though a slight worst-case regression is fine for a real gain.
- **Caching And API Design.** Add a cache only when a measurement asks for it, and keep the exports as they are until the API discussion.
- **Tables Against Canvas.** Engine and Unicode data go in tables pinned to the engine's build; font facts come from Canvas at runtime. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Docs.** Leave out what the code shows cheaply, date each measured fact and dead end with its browser build and what would reopen it, and quote the maintainer exactly, only where the wording is the point. <!-- Q2: recommendation taken; the maintainer hasn't answered -->
- **Merge Bars And Landing.** A change that's Pareto-optimal on correctness, speed and decent simplicity merges; a trade goes to the maintainer with numbers. A fix that doesn't make sense waits, even when validation passes.

### Fixing a mismatch

- Start from the engine's source: find where Blink, WebKit or Gecko decides the behaviour, and port that rule or its data, citing where it lives.
- Model the structure, not the symptom: a fix reads as "the browser does X", never as "inputs shaped like Y get Z". Nothing keyed on font names or on the failing strings.
- Where Pretext can't do what the engine does cheaply, state the premise it takes instead and name its gap: what it gets wrong, and when. Pretext itself is such an approximation: Canvas widths summed per segment, with the engines' known differences corrected.
- For plain text, the per-engine rebuild (`rebuild/` on branch `rebuild-20260916`) is the correctness reference: where it gets a case right, port its rule. For rich inline, follow the engine's own inline model: one paragraph's text broken across its spans.
- Engine differences live in the engine profile and its tables, not in branches elsewhere.
- Attribute every case a change moves (fixed, right by luck, page history) before landing; a new accepted failure needs a written reason.
- Write plain predictable code; don't shape code to one JIT's heuristics, and accept a small regression a JIT alone explains. Don't keep dead or redundant code because one JIT runs it faster, whatever the regression, and note what it costs (`RESEARCH.md`, Decisions Log).

### Implementation notes

- Plain objects and functions, not classes: one class field doubles Firefox's compile time for the whole bundle (Firefox 156, 2026-09-23). A line walker keeps its state in its own locals and its loop bounds integers, since V8 boxes numbers a nested function captures and JavaScriptCore types an infinite bound as a double (`RESEARCH.md`, Keeping Work Bounded).
- `prepare()` stays the opaque fast handle, paying for nothing `layout()` doesn't read, and there's no second public prepare surface. Keep the break kinds (`SegmentBreakKind`) apart rather than one boolean.
- Preparation replaces the measurement context when its language changes, never on `clearCache()`: Chrome's OffscreenCanvas keeps an unchanged font string's old fonts, and Chrome caches shaped text per canvas (`PLATFORM_BUGS.md`).
- A comment whose reason outgrows it cites a doc heading as `RESEARCH.md, <Section>`, never a line number; `scripts/doc-citations.test.ts` fails when a cited heading is gone.
- Engine data is regenerated by hand from each browser's own shipping copy (`DEVELOPMENT.md`), never in a build step. `Intl.Segmenter` gives only word boundaries, in the Southeast Asian runs the scans send it, where it runs the browser's own dictionary or model.

### Validation

- When you come back, or after a browser or OS update, run `bun harness repin chrome`, `repin firefox` and `repin safari` first; `--write` takes the new build, in a commit of its own. <!-- Q14 placeholder: whether repin records a seeded sample before every case; unanswered, so nothing here changes yet -->
- Keep `bun test` and `bun harness check` green in Chrome, Firefox and webkit-host, and run `bun harness gate` before landing a change to `src/` or `harness/`. A new accepted failure needs a written reason; a case that passes again leaves the list in the same change. Commit recordings and lists with their cause.
- Before landing a change to `src/` other than `layout.test.ts`, or to `harness/bench/`, paste `bun harness bench main`'s table for every row into the PR. A row slower in every session needs a sentence, and so does growth over 5% in the `measureText` calls or submitted units `bun harness equal main` prints.
- Behaviour is settled in the harness's browsers, never headless; `--background` bench results are hypotheses. Harness jobs may run side by side while free plus inactive memory stays above about 30%; installed Safari takes one at a time, and the bench runs alone in the foreground on a quiet machine (`harness/README.md`, Bench).
- Use named fonts, and give probe pages an explicit, non-empty `lang`, since the runner's languages leak in otherwise (`RESEARCH.md`, Content Language And Fonts). Re-test the macOS emoji and `system-ui` bugs headed on a Retina display, since headless DPR 1 masks them.
- Traps: a right line count can hide wrong breaks (`RESEARCH.md`, Reading Browser Output); WebKit's per-process caches make a webkit-host result depend on earlier layouts (`harness/README.md`, Accepted and varying lists); an evaluator mustn't certify its own run, and an oracle can copy the library's mistake (`RESEARCH.md`, Evaluation Traps).

### Demos

In `pages/demos/`, the model owns every value Pretext measures or a layout width depends on (fonts, letter spacing, the text as painted, padding and borders, breakpoints), and the painter writes them inline; a border inside a model width is an inset box-shadow. A page that scrolls sets `html { scrollbar-gutter: stable }` and reads `document.body.clientWidth`, since Chrome's `documentElement.clientWidth` ignores the gutter until a scrollbar is drawn (Chrome 153, 2026-09-15; `RESEARCH.md`, Scrolling And Scrollbars); an inner scroller reads its own `clientWidth`, with `scrollbar-gutter: stable`. Demos never correct what Pretext reports. After a demo fix, check the sibling demos (`RESEARCH.md`, Demos And The Chat). <!-- Q16 placeholder: whether the bubbles demo places each bubble from Pretext's heights, as the Markdown chat does; unanswered, so nothing here changes yet -->
