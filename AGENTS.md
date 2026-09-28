## Pretext

**Every time before you commit, ensure you've synced the docs**.
Do not change the existing tone of the documents unless they're wrong.
Before reversing a documented decision, read the Decisions Log at the end of `RESEARCH.md`; code comments that cite it mark where each one applies.
Do `bun install` if you're in a fresh worktree.
After a feature, with the whole picture in view, pass over all the files again for simplifications; don't change things for their own sake.

Changelog updates guideline: don't add dev-facing notes, only user-facing ones. Refer to closed PR numbers.

### Where things are

- `README.md`: the public source of truth for API examples and user-facing limitations, with no per-browser accuracy or speed figures. `RESEARCH.md`: intent (Part 1), evidence and dead ends (Part 2), the Decisions Log (Part 3).
- `harness/README.md`: how cases pass and grow; accuracy claims rest on its recordings and accepted lists. Speed claims and finished comparisons go in PR descriptions.
- `ENGINE_FOLLOWUPS.md`: open gaps, each dropped when its fix lands, when it's given up, or when the maintainer decides it. `PLATFORM_BUGS.md`: browser and OS bugs, read before changing an engine-profile workaround or a line-fit tolerance. `TODO.md`: priorities. `DEVELOPMENT.md`: the demo server, engine data, releases and profiling.
- `pages/demos/markdown-chat.md`: the chat demo's patterns for app developers, updated with the chat.

Terms the docs share:

- **#N** is a pull request or issue in this repository; after a tracker's name, as in WebKit #283408, Mozilla #2020917 or Chromium #560614560, it is that tracker's bug.
- **Main before #340** is commit 6d1d2106, the last `main` whose break rules were Pretext's own; PR #340 replaced them with ports of each engine's break scan.
- **The per-engine rebuild** (`rebuild/` on branch `rebuild-20260916`) is a from-scratch port of each engine's plain-text line breaking, measuring only through Canvas `measureText`. It never shipped; it's finished, kept up to date, and serves as the correctness reference.
- **The old test suite**, or the old suite, is `tests/wrapping`, which the harness replaced (#341). It was removed on 2026-09-25 (#348); rerunning it means checking out 6fadbe5, the last commit that has it.
- **webkit-host** is the harness's background app on the system WebKit, the one installed Safari runs.
- **Page history** is a result that depends on what the page measured or laid out before, through the browser's caches, which the paragraph alone can't predict (`harness/README.md`, What a case is and when it passes).
- **A gap** is a known way Pretext's lines differ from the browser's, written down with its cause and the text it affects; a *named gap* is one so written (`ENGINE_FOLLOWUPS.md` lists the open ones).
- **An oracle** is the reference a test scores against, such as the recorded browser lines a harness case is scored against.
- **engineering.md** and **ui.md** are the maintainer's general rules for code and for UI, `docs/engineering.md` and `docs/ui.md` in the vibescript repository, not yet public and to be open-sourced as chenguini. A pointer such as (engineering.md, Caching) names a section there; these docs keep only how a rule applies to Pretext, its evidence and Pretext's exceptions.

A text goes through:

1. **Analysis** (`src/analysis.ts`): white space per its CSS mode, break opportunities from ports of each engine's scan (the scans: Blink's and WebKit's, as Safari 27 runs it, in `src/line-breaks.ts`; Gecko's in `src/gecko-line-breaks.ts`), and segments between them.
2. **Measurement** (`src/prepare.ts` over `src/measurement.ts`): Canvas widths cached per font and segment across texts, and the width corrections at line edges (`RESEARCH.md`, Widths After A Line Break; Kerning At Line Edges).
3. **Line walking** (`src/line-break.ts`): arithmetic over the prepared arrays, for `src/layout.ts` and for rich inline (`src/rich-inline.ts`: one paragraph made of items in different fonts, such as bold runs, code spans and chips).

The engine profile is the per-engine record of rules and values that says how Blink, WebKit and Gecko differ, picked once from the user agent by `getEngineProfile()` (`src/measurement.ts`); its data tables are in `src/generated/`.

### Intent

Each bold label is the `RESEARCH.md` Part 1 section with the reasons. A fix that stays inside these limits lands on the agent's judgement, and the maintainer only skims it; one that goes outside them needs the maintainer's decision first.

- **What Pretext Is For.** Layout in the app's own code without DOM measurement, above all virtualized lists that call `prepare()` for many texts, so preparing new text matters as much as `layout()`; heights are exact, never estimated.
- **Limits.** `prepare()` and `layout()` read no DOM or style beyond the emoji-correction span, the `<html lang>` read and, when `OffscreenCanvas` is missing, a canvas element Pretext creates and never attaches (`src/measurement.ts`); a fix needing more is rejected, and the browser's limitation documented. Widths come only from Canvas `measureText`, through APIs all three browsers ship. Every browser on a modeled engine, Edge as Blink, gets a layout; a fringe browser gets a fix of its own only when it's extremely cheap and also serves the major browsers. Keep stricter editorial whole-word handling in userland instead of changing the library default (by default an overlong word breaks between graphemes, as `overflow-wrap: break-word` does).
- **The Correctness Stance.** A premise that no real font has been found to break may be taken for speed, as a documented default with a named gap. As a last resort for speed, correctness gives way: first where only an ad hoc rule would match the browser, next requirements no real text exercises, each with its cost stated. CJK stays well supported.
- **The Per-Engine Rebuild And What Counts As Done.** The per-engine rebuild is finished and only kept up to date. It shows how to fix a mismatch correctly and how to approximate one on principle, so `main` moves toward it and never slides back into the rules per input shape of main before #340 (special cases keyed on what a failing input looks like; `RESEARCH.md`, Dead Ends, Rules Per Input Shape).
- **Tests And Losses.** A lost pass may be an accident (two errors that cancelled) or a wrong test or oracle, accepted with the evidence written up; a true loss is the maintainer's call. Cases grow by the behaviour's shape, never by one pinned reproduction per bug (`harness/README.md`, How cases grow).
- **Engineering.** engineering.md's rules hold. Keep complexity down, with line count its usual proxy; per-engine code whose parts barely interact counts for less than its lines. The worst case, the slowest input's time per frame, is catered to (engineering.md, Control Flow) but may regress slightly for a real gain.
- **Caching And API Design.** Caching follows engineering.md, Caching; the prepare/layout split is itself a cache, kept for want of a better choice. The exports stay as they are until the API discussion, the review of the public API before the first release (`TODO.md`).
- **Tables Against Canvas.** Engine and Unicode data go in tables pinned to the engine's build; font facts come from Canvas at runtime.
- **Docs.** Leave out what the code shows cheaply; date each measured fact and dead end with its browser build and what would reopen it. Write for a reader who has seen none of the conversations or agent sessions behind a change: define each term where it's first used, state decisions as project rules in plain words rather than quoting conversations, and add the words that reader needs, since length is no goal.
- **Merge Bars And Landing.** A change that gains on correctness, speed or simplicity and loses on none, the code staying reasonably simple, merges; a change that trades one against another goes to the maintainer with numbers. A fix that doesn't make sense waits, even when validation passes: losses nobody can attribute, complexity out of proportion to the gain, special-case hacks.

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
- `layout()` is the resize hot path: no Canvas calls, no string work, no gratuitous allocations. `prepare()` stays the opaque fast handle, paying for nothing `layout()` doesn't read. Prepare-time diagnostics stay inside the bench tooling rather than becoming another public prepare function, and the per-segment break kinds (`SegmentBreakKind`, `src/analysis.ts`) aren't merged back into one can-break flag.
- Preparation makes a new Canvas context when its language changes, because Chrome's OffscreenCanvas picks fonts for a new language only when the font string changes. It doesn't on `clearCache()`, because Chrome caches shaped text per canvas, so a new canvas moves unrelated widths (`PLATFORM_BUGS.md`).
- Source imports keep `.js` specifiers in `.ts` files, so plain `tsc` emits working JS and `.d.ts`; `moduleResolution: "bundler"` accepts extensionless ones, which only `bun run package-smoke-test` catches.
- Comments cite a doc heading, as `RESEARCH.md, <Section>`, never a line number; `scripts/doc-citations.test.ts` checks the heading exists.
- Engine data is refreshed by hand, never in a build step (`DEVELOPMENT.md`). `Intl.Segmenter` only splits words, in the Southeast Asian runs the scans send it, since there it runs the browser's own dictionary or model (`RESEARCH.md`, Break Opportunities From Engine Data).

### Validation

- When you come back to the project, or after a browser or OS update, run `bun harness repin chrome`, `repin firefox` and `repin safari` first: each compares the installed browser's build with the one the recordings were made under and prints what changed (`harness/README.md`, Browsers and pins); `--write` takes the new build, in a commit of its own.
- Keep `bun test`, `bun run check` and `bun harness check` (Chrome, Firefox and webkit-host) green; run `bun harness gate` before landing a change to `src/` or `harness/`. Record new cases with `bun harness record --only-new`. Commit changed recordings and accepted or varying lists together with the change that caused them.
- Before landing a change to `src/` other than `layout.test.ts`, or to `harness/bench/`, paste `bun harness bench main`'s table, every row, into the PR; a row slower in every bench session (`harness/README.md`, Bench) needs a sentence, as does growth over 5% in the `measureText` calls or in the UTF-16 units submitted to `measureText` that `bun harness equal main` prints.
- Settle behaviour in the harness's pinned browsers, which run headed in background windows, not in headless ones; `--background` bench results are hypotheses. Jobs may run side by side while free plus inactive memory stays above about 30%, installed Safari's one at a time; the bench runs alone, in the foreground, on a quiet machine (`harness/README.md`, Bench).
- Use named fonts, and give probe pages an explicit, non-empty `lang`, or the language settings of the OS and browser running the page leak in (`RESEARCH.md`, Content Language And Fonts). Re-test the macOS emoji and `system-ui` bugs headed on a Retina display: headless DPR 1 masks them.
- Traps: a right line count can hide wrong breaks (`RESEARCH.md`, Reading Browser Output); WebKit's per-process caches make a webkit-host result depend on earlier layouts (`harness/README.md`, Accepted and varying lists); new results become the baseline only after a check by someone other than the tool or agent that made them, and an oracle can copy the library's mistake (`RESEARCH.md`, Evaluation Traps).

### Demos

Demos in `pages/demos/` follow ui.md. Each demo's model (the plain data its layout is computed from) owns every value Pretext measures or a layout width depends on, the text as painted, padding, borders and breakpoints included, so CSS adds nothing to a layout JS computed (ui.md, Layout); the painter (the code that writes the DOM) writes them inline, and a border inside a model width is an inset box-shadow. Demos never correct what Pretext reports (`RESEARCH.md`, Demos And The Chat). A scrolling page reserves scrollbar room and reads its width as ui.md, Layout, says, and an inner scroller also gets `scrollbar-gutter: stable` (`RESEARCH.md`, Scrolling And Scrollbars, has Chrome's numbers). After a demo fix, check the sibling demos (`RESEARCH.md`, Rich Inline Boundaries, Painting Lines).
