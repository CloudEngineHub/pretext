# Research Log

Why Pretext is the way it is. Part 1 is the intent: the lines drawn, the merge bars and the stances behind them. Part 2
is the evidence: measured facts, traps and dead ends, each with its browser build, its date and what would reopen it.
Part 3 is the Decisions Log. Quoted words attributed to the maintainer are exact, typos kept, dated in Pacific time; the
rest is the project's wording. "Pre-#340 main" is 6d1d2106, before the engine ports; "the hybrid" is main since #340;
"the redo" is the per-engine rebuild on branch `rebuild-20260916`.
<!-- Q2: recommendation taken; the maintainer hasn't answered -->

## Part 1: Intent

<!-- Q1: recommendation taken; the maintainer hasn't answered -->

### Why The Intent Is Written Down

The maintainer skims fixes that stay inside these lines, trusting the agent's judgement, so the lines are written down.
A reason the code doesn't show gets reverted by the next agent, so it goes in a comment at the code site, a written
reason on the accepted list or the Decisions Log. Each entry is the statement that stands and names what it replaced.

### What Pretext Is For

- **Measurements without the DOM, painted by the browser** (reasons in `thoughts.md`). The maintainer (2026-09-15): "The
  only real requirement for pretext is that it reuses DOM font rendering. The rest is free-for-all".
- **Many `prepare()` calls.** The maintainer (2026-09-12): "the major use-case of pretext isn't in its flashy demos, but
  in measuring text so that text can unblock userland js layout measurement. Notably, virtualization of lots of rows".
  So preparing new text counts as much as `layout()`, costed per text box times boxes per page, CJK-heavy pages
  included.
- **The browser's own lines** (breaks, count and widths), not an ideal such as balanced lines: copying them sizes text
  the browser wraps, such as a textarea, ahead of time, and makes owning layout nearly free.
- **Exact heights**: an exact fast method comes before a clever lossy one callers must patch; the range APIs came from
  finding the cost was garbage collection and string allocation.
- **No batching again.** The maintainer (2026-09-18): "the whole point of pretext is to avoid dom read/write
  interleaving from expensive dom measurement of text", so no API should bring batching back, though that's no hard
  rule; callers get lines to lay out themselves, not just a height.

### Lines Drawn

Inside these, fixes land on judgement; outside, ask the maintainer first.

- **No DOM**: `prepare()` and `layout()` read no DOM or computed style and force no style or layout, since a style
  recalc triggers reflow; a fix that needs it is presented as rejected, the browser's limit documented. Of AGENTS.md's
  exceptions, the emoji span is read once per font, never per text box.
- **Canvas widths only**, from a font declaration, through APIs all three browsers have: no font files (even the app's),
  glyph pixels, language detection or font loading. Per-font facts an app would supply stay explorations; font knowledge
  enters only as general facts baked in, as a last resort.
- **No observers**: reading `<html dir>` per `prepare()` was dropped as hidden state that goes stale, which argues
  against `devicePixelRatio` in `layout()` too. Content language comes from the page, provided `prepare()` and
  `layout()` do nothing new and expensive in the browser without careful thought.
- **Browsers**: the major engines and their mainstream variants, Edge as Blink, detected by engine, not brand; a modeled
  engine is never refused or shown nothing. A fringe browser gets a rule only when the fix is extremely cheap and
  shared; unrecognized engines take Blink's profile; runtimes such as React Native need only not crash or do anything
  catastrophically worse than pre-#340 main; Firefox ESR, old browsers and quirks mode get nothing that costs
  complexity; the WebKit profile follows Safari 27 only (Decisions Log). Windows is untested, and sampling what we can't
  run (Windows, Android) stays modest, since fewer Pretext users target them and browser-agnostic shares come first
  (2026-09-24).
- **Keep fixing** common app text (Latin, CJK, Arabic, Hebrew, emoji, chat punctuation, URLs), rich inline, the
  documented CSS and the major browsers; rare Unicode (NEL, controls) only when cheap and lossless. Document, don't
  chase, browser bugs, effects Canvas can't see and shapes only fuzzing makes. Speed may regress a bit for a fix that
  matters. Accuracy under 80 px counts for little; an unmodeled behavior under 24 px may be accepted as narrower than
  real layouts.
- **Out of scope, punted or parked**: server-side measurement and other backends, such as React Native's; mixed font
  sizes in a paragraph (Pretext gives widths and breaks, not line heights); `hyphens: auto` and `overflow-wrap: normal`
  (hyphenation stays on TODO.md as a possible feature); a `fontKerning` option (README assumes default kerning);
  `system-ui` (issue #336 says what support would take); source offsets (#90) and carets (#198) for editing.
  <!-- Q4: recommendation taken; the maintainer hasn't answered --> <!-- Q4 note: README drops "and soon, server-side", since server-side needs a Canvas supplied -->
  <!-- Q3: recommendation taken for hyphens; the maintainer hasn't answered -->
- **Userland**: stricter editorial whole-word handling, never a changed default (an overlong word breaks at grapheme
  boundaries, as with `overflow-wrap: break-word`), scroll anchoring and overscan. The rich-inline API stays public; an
  engine swap keeps every demo's result possible, if not through the same APIs.
  <!-- Q3: recommendation taken for whole-word handling; the maintainer hasn't answered -->
- **PRs closed against these lines** (2026-09-12) include rem and em sizes (#109, a computed-style read) and a
  localhost-only `bun start` (#114; it binds the LAN on purpose, so phones reach the demos).

### The Correctness Stance

**The standing statement (2026-09-23).** A premise nobody has falsified in real fonts may be taken for speed, as a
documented default with a named gap. As a last resort correctness gives way, ad hoc rules first, then petty requirements
no real text exercises, their cost stated; CJK stays well supported. The maintainer: "Heck we might need to strip even
more from the correctness as a last perf resort (ad hoc stuff go away first)" and "we do try to support cjk well at the
very least". It replaced three stances, fix measurement errors before optimizing (2026-03-03), correctness first in the
rebuild (2026-09-16) and don't be religious about correctness (2026-09-18); not optimizing prematurely and taking the
rebuild's facts back to main still stand.

- **"Fixing a mismatch"** (AGENTS.md) is the method, since no rule should be chosen by a score, an insight that
  generalizes beats special-casing a browser, and no shortcut that makes an early version look good may erode its
  structure later. Its second point carries the maintainer's line against monkey-patching (2026-04-15), which they
  deleted in #363.
- **No tolerances**: a gap between Canvas and the DOM is handled on purpose or named, never hidden in a tolerance; each
  engine's fit arithmetic is exact in its own units. Main's 0.005 px `lineFitEpsilon` (Blink and Gecko profiles) is an
  open gap (ENGINE_FOLLOWUPS.md).
- **A rule traced in engine source may be off in one profile** only when that engine's losses are attributed to a named
  missing model, the off value explicit in the profile.
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Replacing main** meant losing no triaged objective fact and no use case main's API serves, not keeping every case
  main passed, which would copy its accidents (2026-09-17). The maintainer merged the hybrid as "roughly a superset of
  main barring edge-casey tests" (2026-09-23), the bar for any later swap. Where the older design is faster at the same
  coverage, it did something right: take it back unless it doesn't fit.
- **Summing words** mustn't become pre-#340 main's road, a sum patched with corrections tuned until tests pass: sum only
  where that provably equals the engine's answer, the exact port being fallback and judge.
- **Hunt your own assumptions** and test them: the biggest early Safari win came from dropping one, that an emoji's DOM
  width equals the font size. Corrections are measured from the running browser, never hard-coded, and don't vary
  inexplicably item by item (the emoji correction is one value per font). A proof that a fix is impossible under the
  current model is a definitive answer.

### The Redo And What Counts As Done

The redo (`rebuild/`) is an unshipped, correctness-first reference for plain text: one port per engine, Canvas
`measureText` its only measurement. The maintainer closed it on 2026-09-26 to upkeep only (re-pin, sync main, adopt
browser APIs that can replace a Canvas measurement) and, after the hybrid, asked for guidelines "so that we don't veer
too much back into old main's heuristics territories", with the redo as "a north star on how to correctly fix things and
how to approximate them principally": main interpolates between pre-#340 main and the redo, never past them. They asked
twice for its philosophy in writing: `rebuild/README.md`, "Lines drawn" (1f380af7). In short:
- Correctness before speed and simplicity, but not completionism: what would need the DOM or a new feature is a named
  exception, not a goal. Plain text only: rich inline done correctly, with kerning between sibling spans, is "a big
  quest for another time" (the maintainer, 2026-09-26).
- No right line is lost silently: each is traced and classed before a change is accepted, and a remaining difference
  must be explained and named. Losses aren't banned: some are invisible to Canvas (Zapfino's shaping data moves Chrome's
  breaks without moving any width), and lines main gets right by rounding luck aren't losses to chase.
- Done meant: every remaining difference a named gap with a cause, a made-up or variation-extreme font, or under 24 px;
  a superset of main in all three engines; speed recipes ending with Blink's words first and the cut predictor.
- A speed premise holds only where no installed font, at any settings CSS can ask for, breaks it in the pinned browser;
  where one does, the premise is bounded by zoomed size, a font property Canvas can check or the text a source shows it
  failing on, never by a font's name, and the exact recipe runs there.

The redo's harness never runs main's cases, so compare a rule by reading it and its unit tests
(`rebuild/src/engines/<engine>/`) against the engine's source.
<!-- Q11 placeholder: four rebuild documents quote paraphrases as the maintainer's words. This summary quotes only
principles.md, so their answer changes nothing here. -->

### Tests And Losses

- **A lost pass may be an accident or a bad test.** The maintainer (2026-09-12), after passes that were wrong tests
  blocked #210's fix: "whenever things regress we don't just go "regress is bad" but instead we check whether we've been
  overly inclusive of bad tests/accidents in the past." A lost case is a true loss, an accident (two errors that
  cancelled) or a wrong test or oracle; the last two are accepted with the evidence written up, true losses are the
  maintainer's call. #210 gained 1,814 results and lost 106, each traced to an existing mismatch (old suite, removed
  2026-09-25).
  <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **Importance over pass rate**: easy cases drown out hard ones, so the harness that replaced the old suite decided
  afresh what mustn't regress, weighting real usage beside a behavior catalog (harness/README.md, Why the old suite
  went), with no must-pass tier (Decisions Log, 2026-09-24). Broad generated combinations are fine while they're fast.
- **Cases grow** by behavior, not by pre-#340 main's repro per bug (harness/README.md, "How cases grow").
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Tests signal real regressions**, not false ones, fast enough to iterate on; once a suite is trusted, speed it up by
  engineering and by batching what isn't timing-sensitive. "No change" for a cleanup means every tool harness/README.md
  lists agrees, never an argument from reading.
- **Sample before re-recording**: repin first on coming back (AGENTS.md), but don't redo expensive recordings only to
  confirm nothing changed (said of the redo's scans).
  <!-- Q14 placeholder: whether main's `bun harness repin` samples first. The answer goes here and in harness/README.md
  "Browsers and pins". -->

### Engineering

- **Tiny.** Ablate away complexity and state that cost no accuracy or speed; don't overbuild. Line count is complexity's
  usual proxy (2026-09-15); bundle bytes aren't tight, nor saved with hacks. Per-engine code that barely interacts
  counts for less than its lines, and line count waits while correctness is being established (said of the redo,
  2026-09-18). Reuse existing machinery before adding code; derive sets from the generated tables, not by hand.
  <!-- Q15: recommendation taken; the maintainer hasn't answered -->
- **Simplify** after each stretch of work, checking growth in complexity and cost: the same results from less is exactly
  what's wanted, and an architecture change removes the logic it made redundant, saying what now gives the same answer.
  A simplification changes no observable behavior and adds no optimization machinery; removing public API or changing
  line breaks is the maintainer's call. A small deletion that loses coverage becomes a PR opened and closed at once, for
  the history (#343). Delete dead code, don't silence it; no stale scripts or temporary tooling; rules against a class
  of bug stay light. The maintainer's AGENTS.md line for a pass over the files after each feature (2026-04-15), dropped
  on 2026-09-05 with no reason recorded, is back. <!-- Q17: recommendation taken; the maintainer hasn't answered -->
- **Order of work**: correctness with trusted tests, simpler data structures and flow, profiling and optimization, the
  API last; engineering (data layout, typed arrays, no allocation) before algorithms. Pick engine work by demand, not by
  sweeping ENGINE_FOLLOWUPS.md. Bound a design's best case before investing: the Amdahl bound of 2026-09-22 on the
  redo's preparing of new text led to the hybrid (Dead Ends). Speed work has no fixed stop threshold; record a solution
  that costs much speed or complexity for a tiny gain as such, so these can be weighed together.
- **Plain objects with fixed shapes** (AGENTS.md) and, in new code, indexed `for` loops over `for...of`, `.forEach` and
  allocating `.map` chains. The maintainer's principles are `docs/engineering.md` and `ui.md` in their `vibescript`
  repository: data first, one source of truth, per-browser differences in one place, no caches unless measured, no
  defensive code.
- **Cater to the worst case** over the common path (compute per frame, not only GC pauses), preferring changes that
  improve it for every input over tuning to a guessed distribution. The maintainer (2026-09-26), replacing the
  assistant's same-day rule that it can't get worse: "I think we've gained enough perf that regressing worst-case a
  slight bit can be accepted; the general advice is more that we should cater to worst-case, not that worst-case can't
  regress ever." Of the width memo, up to 26% slower at new widths in Chrome (Dead Ends): "yeah 26% is a bit intense."
  Layout stays on the main thread, workers a last resort.
- **JIT tuning.** Soft line, for every change (2026-09-25): don't optimize against JIT behavior that depends on the
  browser, its version or the machine. Hard line, the maintainer (2026-09-26): "we're not gonna cater to JIT magic like
  that, that'd be my line. Keeping dead code to please JIT is something accidental and not reproducible if we wrote the
  code clean". Such code goes whatever the regression, its cost noted, reversing the 2026-09-24 decision to keep
  `countPreparedLines()`'s leading-space skip (#364). No rule is written out twice for a small JIT gain, though a small
  split of live code is fine if it reads as ordinary code and a comment says why. The precedent: #365 (2026-09-27) made
  Firefox 156.0.1 prepare right-to-left rows 15-32% faster, but its shared helper, which the JIT doesn't inline, leaves
  a few left-to-right rows a few percent slower than two copies would, and the maintainer called that a good trade
  (Decisions Log, 2026-09-26). Report a speed fix's cost in lines beside its gain, and what a percentage is of.

### Caching And API Design

- **Caching is a cost.** The maintainer (2026-09-18): "Caching sucks and main pretext reached for it in the form of
  prepare + layout out of lack of choice back then" and "The best-case scenario is that we don't need it (this'd be a
  huge userland unlock)." Invisible acceleration that can't go stale or leak is welcome; handles the app must carry
  hurt, worst when one text needs a prepare per font size. That never meant no caches: ablate, profile, put back those
  that earn it. What lives one frame or call is data flow, not a cache; an eviction cap must surely exceed what a page
  sends.
- **Two lifetimes**: the shared width cache holds facts of one font and one segment's own characters, the prepared
  handle facts of the whole text; more global caching would explode. Name both wherever caching comes up: the maintainer
  had forgotten the shared one. Handles going stale when the page language changes is disliked but accepted, since line
  breaking needs the language.
- **The API is open, and loved.** The prepare/layout split was a sweet spot and may not be now, but its direction is
  loved; alternatives are additions to talk through. Idempotent layout without handles stays interesting if lifetime can
  be controlled, though a study recommends keeping handles (Dead Ends). Old incremental-prepare work mostly made up for
  slowness: it may inspire an API, not bias one. Immediate mode: nothing relies on object identity, and changed text
  should be cheap to prepare again (#313). A 2 s bar for 10,000 rich messages (2026-09-18) was withdrawn as
  unsubstantiated.
- **Design from shared structure**: once plain speed engineering is exhausted, find what calls share and skip
  recomputing it, from a cost model first. Demos aren't usage data; the maintainer (2026-09-26): "They're examplary
  technical edges for folks to interpolate their own usages from." Don't overfit to today's uses.
- **Exports stayed exact** while engine work landed. The API discussion is the end-of-project item, before any release,
  with issue #321's `direction` option and `devicePixelRatio` in `layout()` on its list. One bundle serves every engine
  (Decisions Log, 2026-09-26).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **The rich surface** stays split between stats and range helpers and materializing ones, one decision algorithm behind
  batch walks and one-line steps; speed work for rich text and manual layout belongs in the range and cursor APIs.
  `getTextClusters()` is wanted once it ships but can't be waited on, since it doesn't help Firefox.

### Tables Against Canvas

- **Neither comes first**: a table that isn't per-font data can beat a Canvas recipe when its lookups can be enumerated
  roughly exhaustively (2026-09-19, replacing the assistant's fixed order). Choose by what the fact depends on: engine
  or Unicode data goes in a table pinned to the engine's build; a font fact is asked of Canvas at runtime, never kept
  per font; OS facts case by case, such as Safari's small Core Text table of generic families.
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Generated data beats** hand-written lists or hacks below a size threshold. The engines' tables replaced Pretext's
  rules, Chromium's Chinese line table included against issue #321's advice, their growth accepted because they made
  analysis much faster, and the end-of-project size check is closed (Decisions Log, 2026-09-23 and 2026-09-26).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **`\p{…}`** follows the JavaScript engine's Unicode tables, not layout's, so the redo takes no engine decision from
  it; main's scans do, through `hasProperty()`.
- **`Intl.Segmenter`** stays for Southeast Asian words (AGENTS.md; Dead Ends has the alternatives) because Pretext needs
  the browser's split, not the right one. Firefox's slow Thai segmentation is its own trade for download size, so no bug
  was filed.

### Demos And The Chat

- **Demos show Pretext's numbers**: no CSS sizes reverse-engineered in JS, DOM reads or hard-coded line counts, and
  placement from Pretext, not quiet CSS flow. They never correct what Pretext reports: fix the library, or have it
  expose the fact. <!-- Q16 placeholder: whether the bubbles demo places each bubble from Pretext's heights or keeps
  flex and says only its widths come from Pretext. The answer goes here. -->
- **Immediate mode**: with Pretext owning layout and virtualization, on-screen rects stay around two digits, so
  rebuilding each frame is fine. Pooling ties state to an eviction policy; reusing a node and keeping its state are
  separate. No ResizeObserver or other event-like control flow: if Pretext owns the breaks, nothing needs observing.
  Read vibescript's `ui.md` before proposing UI architecture.
- **The Markdown chat** takes the worst case first, resize and random scroll seek, and every lossy height method was
  worse (Dead Ends, The Markdown Chat At Scale). Its scrollbar has the full history's correct size, capped only by what
  the browser can handle (Scrolling And Scrollbars). It assumes fonts loaded up front and every embed size known.
- **Scrolling** follows vibescript's `Scrolling.md` by construction, assuming as little as possible about `scrollTop`:
  scroll only when this frame's layout moved the anchor, never clamp, keep the value read back, never detect a case such
  as rubber-banding to patch it. The macOS and iOS overlay scrollbar comes first, and a scrollbar appearing never nudges
  content.
- **The chat is exemplary**, teaching the important patterns without noise so developers pick a subset rather than
  extrapolate; its guide stays short. Its techniques move to the other rich demo only if strictly better. Demo code's
  control and data flow count, not only its numbers; a pass over a demo against vibescript's engineering.md and ui.md
  seeks simplifications that bring fewer lines, fixes and speed together.
- **Not in the package** (Decisions Log, 2026-09-25), replacing the maintainer's wish earlier that day to keep them
  runnable from it.
- When a demo looks wrong, first find whether the library or the demo is at fault, in a real browser at several widths.
  A layout fix's commit message names the bug and explains the fix.

### Docs

- **The criterion (2026-09-27).** The maintainer: "trust that the future agent is at least as smart as you so you don't
  need to document the obvious stuff they can discover" and "I'd document all the philosophies we've talked about,
  because the smart model would still want to know our intent (and can abide by it). And the various traps that
  smartness doesn't necessarily solve, such as dead ends (I'm making an example here so don't over-index on this in
  particular please)". They accepted three refinements the same morning: discoverable means cheap to discover, so facts
  that take hours of browser runs stay; every measured fact and dead end carries its date, browser build and what would
  reopen it; AGENTS.md may hold one screen of pipeline map.
- **Dead ends stay open to question.** The maintainer (2026-03-03): "document but don't be too stern. I want future
  attempts to be able to question this". Say what was tried, how deep, by whom and whether anyone checked it; never
  "impossible". A thin, unsupervised attempt is weak evidence: Chrome's word sums were written off after one, then
  reopened and landed.
- **README**, the one user-facing doc, gets extra care: illustrative and to the point, only caveats app developers act
  on, its API glossary kept, examples correct on their own and ordered simple to complex, every term defined, every
  claim true of the algorithm and confirmed in real browsers, nothing changed that wasn't asked for.
- **Voice**: short, nuances kept, each document in its own tone (AGENTS.md) and `thoughts.md` in the maintainer's. A
  rewrite keeps technical meaning and opinions and loses pseudo-jargon, common words in uncommon senses, vague pronouns
  and slogans, but not words that carry meaning, such as "regression". Concrete cases over a general warning.
- **What goes in**: point to numbers that go stale rather than copy them; give a fresh agent objective facts, not
  designs that fence it in. A cleanup removes only what's provably stale; docs another model wrote are checked for
  accuracy and for fitting what was done. The changelog and doc-sync rules are the maintainer's own AGENTS.md lines,
  kept word for word.
- **Decisions happen in chat**, and the maintainer rarely reads TODO.md or ENGINE_FOLLOWUPS.md, so a decision answered
  in chat leaves their open lists. Work depth-first, tracking every punted item with what would reopen it. Every quote
  names its speaker and is checked against its source; text the maintainer forwarded from another agent isn't their
  view.

### Merge Bars And Landing

- **The standing bar (2026-09-26).** The maintainer: "Anything that's basically pareto optimal in terms of correctness
  perf and decent simplicity within known goals are basically good merge." A change trading one against another goes to
  the maintainer with numbers; they may waive one named cost to judge it.
- **Try fixes eagerly**, long-standing gaps included, but hold back one that doesn't make sense even when validation
  passes: losses nobody can attribute, complexity out of proportion, special-case hacks. Worst-case fixes to a change go
  in the same PR. Close an issue only when it's solved on main, and a superseded community PR with thanks.
- **Public posts** go out only at the maintainer's word, once verified, and sound like them: casual, details kept, no
  report phrasing or demands, in the contributor's language. Public issues and branches carry no private details. A
  feature too hard for now is parked in an issue with the findings and what support would take; a stale public issue
  gets a new comment and a one-line status at the top.
  <!-- Q18 placeholder: the status comment on #321 waits for the maintainer's word. -->
- **Browser bugs** are recorded and filed as PLATFORM_BUGS.md says. A crash or hang found while probing stays out of
  public issues, branches and docs until triaged; the Chrome hang went in as a restricted security report. <!-- Q10
  placeholder: whether the rebuild's public refs that still hold its page get cleaned; the answer changes refs, not this
  line. -->
- **License notices** for the ported engine code and data are deferred.

## Part 2: Evidence

<!-- Q1: recommendation taken; the maintainer hasn't answered -->

Measured facts, traps and dead ends, each with its build and date or the engine source it was read from. Unless noted,
a fact is from the maintainer's Mac (Apple silicon, DPR 2, a Chinese-first OS language list, which changes results:
Content Language And Fonts) in that date's installed browsers: Chrome 153, then 154.0.8037.57 from 2026-09-25; Firefox
155, then 156.0 and 156.0.1 from about 2026-09-17; Safari 26.5.2 on macOS 26, then 27.0 on macOS 27 from 2026-09-16. The
WebKit profile follows Safari 27, where a 26.5.2 fact is unconfirmed. Dates are Pacific.

*Old suite* numbers (its "installed gate", "suite rows") are from `tests/wrapping`, removed 2026-09-25 and runnable only
from 6fadbe5, kept where they carry a decision. *Main then* is main on the fact's date. An *offline replay* ran Pretext
in Bun over recorded Canvas answers and browser rows, and a *stand-in Canvas* is a numeric one: both measure Pretext,
not a browser, and a replay flags change without judging it, blind to string storage, painting and dictionary text
(Evaluation Traps). The *redo lab* is the redo's harness (2026-09-16 to 26, agents with critics, the maintainer
steering; scores in `rebuild/research/`), in Chrome 153, Firefox 156 and webkit-host unless noted. The *emulation study*
ran each engine's own break and shaping code offline (2026-09-15 to 20, issue #321).
<!-- Q11 placeholder: the rebuild branch's docs quote paraphrases as the maintainer's words; the answer changes that branch, not these pointers -->
<!-- Q18 placeholder: no status comment on #321 yet; link it here if one is posted -->
<!-- Q7: recommendation taken; the maintainer hasn't answered -->
<!-- Q7 note: Every "old suite" label below depends on it -->

### Measurement Model

The premise: a segment is as wide as Canvas measures it alone, a line is the sum, and each engine's known differences
are corrected in its profile (Part 1, The Correctness Stance). Whole-line measurement during layout, uniform scaling, a
pair-kerning table and hidden DOM or SVG text lost (Dead Ends).

Every Canvas measures U+0009-U+000D as spaces, Firefox's also U+001C-U+001F, NEL and U+2029 (other C0 controls as
hexboxes). Pages differ: Chrome gives 1,185 of 1,429 controls an advance; Safari gives CR its glyph's advance on the
simple text path only, other controls `.notdef`'s; Firefox gives CR, FF, VT, hidden C0 and C1 controls, DEL, U+2028 and
U+2029 none (Chrome 153, Safari 26.5.2 and 27, Firefox 155 and 156, 2026-09-16/17). The HTML parser turns CR into LF,
so probes set CR from script.

Chrome's Canvas turns SHY, ZWSP, LRM, RLM, U+202A-U+202E and U+FEFF into U+200B, ending a Canvas word, while its page
shapes through them (`plain_text_node.cc:47-62`). Leaving the soft hyphen out changes 2,356 words in 168 of 399
families, whose `morx` or `kerx` machines see it; U+2060 in its place matches the page on all (redo lab, 2026-09-17). A
nonspacing mark after that U+200B can measure as a dotted circle, where the page gave such marks no width in about
20,000 observations (old suite), so the Chromium profile gives none. Safari's Canvas and page keep the soft hyphen, and
a mark after it takes its fallback font's advance in both.

A chosen soft hyphen paints U+2010 where the primary font maps it, else `-`; since fallback supplies U+2010, only
measuring under two fallbacks whose U+2010 differ tells which (36 of 36 families, redo lab). Only Safari letter-spaces
the hyphen. Pretext measures `-`, a gap ENGINE_FOLLOWUPS.md sizes.
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: side finding 9 becomes an ENGINE_FOLLOWUPS gap -->

Safari's page turns off `liga`, `clig`, `dlig` and `hlig` under any non-zero letter spacing and its Canvas
`letterSpacing` doesn't (WebKit #283408 lacks #176215's fix): 32px Hoefler Text `ffi fl` at 0.001px is 54.403px in
Canvas, 57.414px on the page (webkit-host and Safari 27, 2026-09-16 to 19); Chrome's agree. Pretext's model, the
unspaced width plus the spacing per grapheme after the first, is 2-3px off Safari in Amiri, Hoefler Text and Futura,
and no Canvas string gets two letters unligated into one Safari shaping call (1,596 strings in 15 fonts; Dead Ends,
Kerning). A WebKit fix would make it exact.

Contexts read language their own ways (Content Language And Fonts). Safari's has no `lang`, `fontKerning` or
`textRendering` (WebKit #285993), and an attribute a browser lacks, once set, is silently a plain JavaScript property:
check each non-default attribute with two contexts, and letter spacing on one letter repeated 16 times, since a Canvas
that rounds fractional totals hides it on one or two. Repeats are bit-identical (0 of 2.17 million differed, Chrome
153) except where Firefox's per-process fallback state moves them (Engine Facts, Firefox).

A connected `<canvas>` isn't neutral: Chrome's keeps its element's CSS letter and word spacing (PLATFORM_BUGS.md),
Safari's copies the element's font and forces style updates, Firefox's holds the page's advances but needs `document`
(its OffscreenCanvas: Engine Facts, Firefox). A context can't be cloned or transferred (`DataCloneError`), so a worker
makes its own, and the redo's prepared paragraphs, which hold contexts, can't cross (redo lab).

Each engine fits in its own units. Chrome rounds items up to 1/64 device px, truncates the available width, and fits
while the position is at most that plus one unit (`line_breaker.h:307-317`), a 1/128 CSS px grid at DPR 2; 4,844 of
pre-#340 main's 6,844 Chrome width failures missed by one such unit (old suite). Safari sums float32 CSS px against the
width truncated to 1/64 px plus 1/64 px, ignoring DPR (`InlineLineBuilder.cpp:1172-1183`, webkit-7625.1.29.11.27), which
reproduced Core Text's widths on all but 17 of 2.6 million items (emulation study, Safari 26.5.2). Firefox fits in
integer app units, 60 per px, rounded per glyph: 16px Courier New `aaaa bbbb` is one line at 86.4px, two at 86.38px. The
WebKit profile fits with WebKit's 1/64 px, the Blink and Gecko profiles with 0.005px, no engine's arithmetic; Chrome's
grid needs a DPR `layout()` doesn't read (ENGINE_FOLLOWUPS.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: decision 4, `devicePixelRatio` in `layout()`, goes to the API discussion -->

Emergency breaks follow each engine's loop: Chrome lays the line out again with a break allowed between any two
graphemes (`line_breaker.cc:4258-4330`), Firefox takes a cluster start only while the line has no ordinary break
(`gfxTextRun.cpp:1068-1074`), and Safari searches prefixes in a fixed order, carrying the rest unmeasured (Engine Facts,
Safari). They fall only between shaper clusters, which a ligature merges, so Chrome and Firefox never split lam from
alef, or `ffi`, in a font that ligates them. HarfBuzz joins marks, a ZWJ before a pictograph, emoji modifiers and tags
to the cluster before, even across SHY, ZWSP or U+2060 (`hb-ot-shape.cc:471-585`): `a`, U+2060, U+0301, `b` stays one
line at width 0 (Chrome 153).

Widths don't compose. A string can be narrower than a window inside it (by up to 117 zoomed px in calligraphic Arabic
at 256px); HarfBuzz can mark an offset unsafe though its sides sum to the whole (Zapfino, Apple SD Gothic Neo), and
Chrome reshapes there; a word's tail can be negative (Mishafi's `حالاً` in Firefox); Euphemia UCAS, alone of 393
families, kerns its space only under `latn`, so a space Canvas shapes as Common stays wide. In Chrome a stretch with no
script of its own (` , ` between Devanagari words) measures up to 4.8 zoomed px off alone: measure it with the letter
after it. A whole word matching the page says nothing of its prefixes (redo lab), and letters alone can be far from
their word (Shantell Sans, Content Language And Fonts).
<!-- Q6: recommendation taken; the maintainer hasn't answered -->
<!-- Q6 note: FONT_DIAGNOSTICS.md folds into Content Language And Fonts -->

Canvas can learn some font facts in about 10 calls per font per page: Arabic joining, from beh and U+07FA alone and
together (29 of 29 families, blind on fixed-pitch fonts), a font's own hyphen, monospace, an optical-size axis (not in
Firefox's Canvas), and partly ligatures and coverage; not, in Chrome or Safari, which glyph carries a pair's kerning. A
wrong learned fact is worse than an unknown one, and a missing named family can resolve to a system font, so dropping
all font checks changes real lines (redo lab; Part 1, Tables Against Canvas).
<!-- Q3: recommendation taken; the maintainer hasn't answered -->
<!-- Q3 note: P-DAT-2 -->

No shipped `TextMetrics` (Chrome 153, Firefox 156, Safari 27's engine) gives advances inside shaped text by default: no
`getTextClusters()`, `getSelectionRects()` or advances array. Arabic joined across a soft hyphen, lam + alef and kerning
inside a word wait on them, so `getTextClusters()` shipping in Chrome would reopen them (Engine Facts, Chrome).

### Reading Browser Output

DOM geometry is evidence to interpret, not a map from source to lines. Chrome can give a letter after a soft hyphen
rects on both lines, copying the soft hyphen's box onto it, so "first rect" and "first positive rect" both misassign
source. Range extents aren't advances under kerning, letter spacing, bidi or invisible controls (Safari 26.5.2 split one
NEL's advance 13/11px at 1px of spacing, 14/10px at 2px). Range can't show whether a soft hyphen is painted under
keep-all (16px Arial `a`, U+00AD, `b` at width 10 paints `a` / `b`, the hidden soft hyphen's rect positive), and the
harness can't see the hyphen at a soft-hyphen break (harness/README.md). Take source offsets from segments and cursors,
never `line.text.length`, which can hold a hyphen the source doesn't.

Spans per character or segment change the breaks observed. WebKit breaks inside an inline box from its text plus the
previous box's last two characters: a span per grapheme moved 275 of 1,336 of the harness's pre-wrap and URL-query
cases, mostly under 24px (Safari 27.0, 2026-09-25). Spans change Thai, Lao, Khmer and Myanmar breaks in every browser,
and gave March 2026's false verdict that Thai was unfixable. Read Range on the one text node, as the harness does.

Lines from rects: per-character `top`s scramble on bidi text (a Range's `getClientRects()` over the node gives a rect
per line); positive-area rects alone miss a ZWJ or the letter after it on a second line; vertical centres misplace tall
fallback-font rects; the collapsed space after an inline box reports a zero-width rect on the next line in WebKit and
Blink; `text-transform` (ß to SS) shifts Range offsets. A combining accent can have no usable rect, but lines follow
text order, so a character between two on one line is on it: that premise checked 5,018 to 13,358 more rows per browser
with no false failures (old suite), and the harness keeps it.

Rects are encoded per engine (redo lab). Chrome floors a slice's start and ceils its end to its layout unit, so
neighbors overlap by one, exact to 1/128 px at DPR 2 but not at zoom 1.5 or 2.2. Safari gives one rect per display box,
snaps partial rects to whole px and splits a glyph's advance among its code points by UTF-16 units. Firefox puts edges
on app units, stored as `floor(a × 65536/60 + 0.5)/65536` in float32, a cluster's advance on its last code point.
Rects drift from advance sums past about 16,000px, and summed per-grapheme widths overshoot at each boundary: take
extents as edge differences.

A diagnostic must establish its own setup. In March 2026 a container's `white-space: pre` kept both test boxes from
wrapping and gave a 17px "difference" and a verdict that Georgia was unfixable, which the maintainer's own run
disproved; floats meant to force a break history moved the word below them. Check the breaks before the one studied,
compare resolved CSS widths, bracket thresholds, and test the CSS Pretext targets. Firefox's boxes followed 1/60px
rounding in a sweep, but fitting lines so regressed unrelated cases: box resolution isn't the fit rule.

Probes change what they measure. Text-presentation requests and Firefox's per-process font state let earlier strings
move later results, so each bug page runs in a fresh browser process and profile and finishes from promises, not
timers, which a hidden window stalls; a page whose bug is a call that never returns first sets its title to `STEP ...`,
so a driver records a hang after 30 s. Chrome's `Range.getClientRects()` can hang forever on one narrow constructed
case, reported to Chromium with restricted access, so jobs drawing generated cases need a stall limit and a way to
skip, and the trigger stays unpublished (Part 1, Merge Bars And Landing). Read engine source at the revision the
browser ships. Setting `font` after `line-height` resets the line height. Nothing independent checks Safari's line
placement: webkit-host reads the same rects, where Chrome's and Firefox's were also checked against the emulation study.

A matching line count isn't matching lines: about 1 in 18 of pre-#340 main's count passes had visible characters on the
wrong lines (old suite, 2026-09-17), so the harness checks each line's first and last visible character. Such bugs sit
in combinations nobody can list: unit tests passed where a replay lost 9,068 line counts (Break Opportunities From
Engine Data).

### Break Opportunities From Engine Data

Break opportunities come from ports of each engine's scan over each browser's own shipping data (Part 1, Tables Against
Canvas).
<!-- Q7: recommendation taken; the maintainer hasn't answered -->
<!-- Q7 note: old-suite numbers in this section -->

The emulation study, with each engine's break data, shaper, line loop and font fallback, reproduced every line count and
line start of the 2026-09-14 installed rows, about 236,000 per browser (old suite). It can't ship (font files, private
Core Text, system ICU) and needn't: Canvas already runs each browser's shaper on the device's fonts, so a page lacks
only each engine's units, fit arithmetic and a few hidden facts. Checked with tools not in the repo (2026-09-15 to 24),
outside Thai, Lao, Khmer and Myanmar runs the Blink and WebKit scans matched the study's C++ ports of their break code
on all 13,108 and 19,393 requests; the ICU iterator port gives ICU's boundaries on all 19,338 cases of
LineBreakTest.txt; the Gecko scan gives ICU4X's breaks on Firefox's data on all 6,569 left-to-right suite and corpus
requests and 11,875 left-to-right fuzz requests, differing only inside those runs where Bun's segmenter stands in for
Firefox's. The rule they leave: an engine rule's oracle is the engine's own library (ICU over Chrome's `icudtl.dat`,
libicucore with Apple's overrides, `icu_segmenter` on Firefox's data), never a second port, and Blink's upstream tests
in Ahem, where a stand-in Canvas is exact, pin behavior cheaply.

The scans differ from their engines on purpose in three places (ENGINE_FOLLOWUPS.md): one ICU pass per text, not
Blink's restart at each line start, differs in 86 of 188,274 verdicts; the WebKit scan resolves no bidi levels, so it
misses WebKit's splits where levels change, at 15 right-to-left positions (2026-09-23) such as `ab””tail`; the Gecko
scan takes every paragraph as left-to-right, since Pretext takes no direction, which moves none of 4,346 right-to-left
suite and corpus requests and 192 of 8,125 fuzz requests.

Take each browser's shipping data, not upstream's latest: Chromium 147's `line_normal.brk` differs from 153's on 239
code points, and headless Chromium 147's ICU 77 breaks otherwise wherever ICU 78 changed the rules (the HH dashes,
LB20a, LB21a), so headless evidence can't check those. ICU's `ppucd` writes no `cp` line for 210,383 code points whose
values equal their block's, so a generator reading only `cp` lines gets Cn for U+3400.

The tables are ICU's compiled state machines, whose states a small rule change renumbers. As 480 KB of base64 they cost
a fresh Firefox page 5.2 ms evaluating the bundle, against 1.2 ms before #340, so each is stored as byte ranges of an
earlier table plus literal bytes and a browser unpacks only its own, 0.4-0.6 ms a page, for 133 KB minified and 64 KB
gzipped. The maintainer's suggestion of 2026-09-23, Chrome's root table kept whole and the other line tables copied
from it at runtime, gave 238 KB and 57 KB and took 3.6 ms in Firefox (2026-09-24). The size pass is closed, and one
bundle serves every engine (Decisions Log).

In Line_Break=SA runs (Thai, Lao, Khmer, Myanmar, and in the Blink and WebKit scans also Tai Le, New Tai Lue, Tai Tham,
Tai Viet and Ahom), `Intl.Segmenter` words stand in for the engines' dictionaries. Chrome 153's equal those of
`Intl.v8BreakIterator`, which runs the ICU of Chrome's layout, on 273 corpus paragraphs, though the Blink scan misses 69
Khmer positions; JavaScriptCore's differ from libicucore's line iterator at 27 of 282,337 positions, all where a range
starts with a combining mark; Firefox 155's matched Gecko's models on all 54,588 breaks once breaks inside clusters are
dropped, as Gecko drops them. Offline replays can't cover these runs: Bun has no `v8BreakIterator`, and its words differ
from Firefox's on some Thai.
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: side finding 12, why `Intl.v8BreakIterator` isn't used, goes under Dead Ends -->

The scans read the whole text, since merging punctuation, URLs or numbers into units first erased context later passes
couldn't recover; the Gecko scan dropped merges Firefox contradicts, such as keeping `|` with the letter after it in
`a/|b` (Dead Ends, Rules Per Input Shape). It doesn't split text runs where the script changes, as Firefox does: that
differs from the oracle in 18 more of 11,875 fuzz requests, and an itemizer port cost milliseconds of set-up (Decisions
Log, 2026-09-24).

Zero-width glue (`src/analysis.ts`) is its own segment and doesn't end a line; folding it into the text after it lost
rows (Dead Ends, Invisible Characters, Controls And Soft Hyphens). In Chrome and Safari glue can still take a line when
the grapheme after it doesn't fit (Chrome paints `abc`, U+00AD, `)def` at 1px one grapheme per line), and in Firefox it
can't, since Gecko drops soft hyphens and clusters a ZWSP with the marks after it: letting glue start a line lost 428
Firefox rows, and Gecko's rule lost 101 Chrome and 866 Safari rows in an offline replay. The walkers end lines only
where the scan breaks and fill graphemes across an unbroken run: ending at any segment boundary lost 9,068 line counts.

Combining marks after glue or a control shape with the grapheme before them and what separates them, so a run is
measured after that source, minus it; without the separators Canvas composes the marks with the grapheme or draws both
in another font (in 16px Amiri `a` with U+0323 measured 2.22px more than `a`; Chrome paints the chain as wide as `ab`).
Measuring every run after the whole chain was quadratic (Keeping Work Bounded), so a long chain's context keeps the
grapheme and the last runs holding 96 UTF-16 units. Safari's widths depend on a run's distance from the grapheme up to
61 units (after `क` in 16px Georgia the first U+0323 takes 5.2px, the next 29 1.6px, the rest none). The kept context
measured within 0.002px of the whole chain in Chrome 154, Safari 27 and Firefox 156.0.1 over 12,960 chains in up to 24
fonts; leaving out the grapheme took up to 25px off (#351, 2026-09-25).

Where an emergency break falls inside a segment depends on which advances an engine adds. Firefox adds those of the
word shaped whole: in 16px Arial `بِبِ((tail` at 27.86px fits `بِبِ((` and starts the next line at `tail`, while summing
isolated graphemes charged both ب their isolated 11.42px (the first takes 3.9px joined) and lost 460 installed rows.
The Gecko profile, like the WebKit one, fits from grapheme prefixes, which give each letter its left context but miss
kerning with the next grapheme. In an offline replay prefixes gained 2,110 left-to-right and 703 right-to-left line
counts over sums, lost 643 and 349, and doubled a cold preparation's Canvas calls; pairs, each grapheme measured after
the one before, did slightly worse at 21% more calls on the corpora and 91% more where every preparation starts cold
(Firefox 155, 2026-09-16).

So the Gecko profile takes prefixes only in segments at least 80px wide (`prefixFitMinWidth`) and sums graphemes below.
A cold Firefox preparation of real paragraphs then took 88 Canvas calls a paragraph (113 for prefixes everywhere, 86 for
sums everywhere, 79 before #340) and lost nothing to prefixes everywhere at 80px and over, where sums everywhere lost 58
line counts (Firefox 156.0, 2026-09-23).

The 80px has no browser reason: it was the old suite's boundary for narrow widths. Remeasured in Firefox 156
(2026-09-27, #367), a 24px floor, where the harness's narrower-than-real layouts end, costs as much as prefixes
everywhere, whose calls sit in words 24-80px wide: 99 measureText calls per 1,000 prepared units against 62, and `bun
harness bench main` read new Latin, Arabic and mixed messages and UI labels 28-68% slower in both sessions (new CJK and
Thai, seen text and the worst shapes within noise). The two give the same lines from 24px up, so 80px's gap is at
24-80px: 281 Firefox cases fail there that pass with a 24px floor, 172 of them the old gate's Arabic words with vowel
marks before brackets, quotes, controls or Latin, and 14 pass only at 80px: ten `a ★ーb` in 16px Arial at 25-29px,
right by luck (summed standalone widths match the paragraph's 26.65px for `★ー`, which Firefox's Canvas measures at
32px); three Amiri splits at 24.45px, 1/64px from where the lines change; and one real-usage draw, `TKT-84565` in a
31.25px table cell in 16px Helvetica Neue, where prefixes give the hyphen starting the second line all 2.05px of its
kerning with the `T` before it, so `-845` fits and Firefox moves the `5` on. No real-usage draw gains; 188 of the 11,901
(1.5% of their weight) are narrower than 80px. Below 24px a 24px floor fixes 40 cases and loses 36, prefixes everywhere
44 and 50. So the floor stays at 80px, a premise with that gap (Decisions Log, 2026-09-27).

A rule ending an overflowing segment's emergency split after its last fitting hyphen, which recovered breaks the old
merged segments hid, went on 2026-09-16: a scan segment ends at every break, so a hyphen inside one has no break after
it and all three browsers fill graphemes past it, and only 188 of 374,178 Blink scan segments over the corpora and tests
held one.

U+3000 hangs at a line end in Chrome and Firefox, as a space does, not in Safari: `中文`, U+3000, `中文` at 33px in 16px
PingFang SC is 2 lines in Chrome 153 and Firefox 156, 3 in Safari 27. Hanging it gained 386 CJK test cases in the
Chromium and Gecko profiles (2026-09-23) and 412 Firefox line counts in the old suite, losing none.

Facts the ports give by construction still took browser runs to find (March to mid-September 2026): a ZWSP that starts a
paragraph or follows a hard break takes a line of its own when the next word doesn't fit, in all three; after CJK text
all three keep `.,:;)]%'"` with what follows and disagree after `!`, `}`, `/` and `|` (#274).

Soft hyphens are common in some languages and nearly absent in others (2026-09-11): about 1 page in 10 turns on
`hyphens: auto` (HTTP Archive, 2025); 7 of 14 sampled German, Dutch and Nordic news homepages had a soft hyphen, and at
least 0.21% of German Wikipedia articles do, against 3 of 1.22 million Arabic Wikipedia articles. Persian's, about 225
per million, are mostly Word's optional hyphen typed where a zero-width non-joiner belongs, worth reading before any
Arabic-script soft-hyphen policy. This is the evidence behind leaving `hyphens: auto` out (Part 1, Lines Drawn).
<!-- Q3: recommendation taken; the maintainer hasn't answered -->
<!-- Q3 note: P-SCO-22 -->

### Grapheme Clusters From Engine Data

Grapheme clusters come from Chrome 153's (ICU 78.2) and libicucore 78.1's character rules, not `Intl.Segmenter`, whose
graphemes, an object and a substring per cluster, were 40-58% of preparing new text in Chrome and Safari and 64-76%
with letter spacing (#344, 2026-09-24, has the speed table). That day each profile's table gave `Intl.Segmenter`'s
clusters in Chrome 153, Safari 27 and Firefox 156 on every code point in 14 contexts, the corpora and 20.8 million
random strings (`scripts/grapheme-check/`). Chrome's and Apple's tables differ only at Apple's 39 transcoding hints.
Firefox 156's ICU4X data puts every code point in Chrome's 18 classes and ended clusters where ICU does on 3 million
strings in a one-off run, so the Gecko profile takes Chrome's table; the generator's standing check covers about
211,000 strings.

The tables don't follow a browser to another Unicode version: Node 23's ICU 77.1 (Unicode 16) differs on 1,417 code
points, 689 symbols Unicode 17 took out of Extended_Pictographic (the chess symbols, playing cards), which no longer
join a ZWJ sequence, 686 consonants and linkers in 14 scripts whose conjuncts Unicode 17 joins (Myanmar, Khmer and
Javanese among them) and 42 new characters. They're refreshed when browsers move to Unicode 18; `bun harness repin`
reports when a pinned browser's data changes.

Every text segment takes emergency grapheme breaks, since under `overflow-wrap: break-word` all three engines ignore
line-break classes there, kinsoku and keep-all included. Taking the permission from `Intl.Segmenter`'s word-likeness was
wrong: JavaScriptCore withholds it from numbers (`11111111` at 1px stayed one line) and every engine from emoji and
symbol runs (`🇺🇸/👩‍💻` at 8px), 756 old-suite rows between them. Gecko clusters its text run per shaped word after
dropping soft hyphens and bidi controls, so the Gecko scan's cluster starts decide where segments split: for `a`, `👩`,
U+00AD, ZWJ, `🚀`, `b` at 0px Firefox paints `a` / `👩-` / ZWJ `🚀` / `b`, where Unicode graphemes split the ZWJ from
the rocket (68 old-suite rows).

Safari's emergency breaks can land inside a grapheme, and Pretext's cursors never do (Decisions Log, 2026-09-12).

### Widths After A Line Break

A ZWSP at a paragraph or hard-break start is real source: it establishes a line and offers a break after it, without a
letter-spacing gap. Chrome and Firefox shape an Arabic letter before a chosen soft hyphen in context: for ZWSP, ب, SHY,
ب in 16px Amiri, Pretext sizes `ب-` at 20.70px, the isolated beh plus a hyphen, where Chrome paints about 8.95px,
Firefox 9.85px and Safari the isolated 14.82px. No rule in `layout()` can repair it, since the same text with U+A65C for
beh prepares the same widths and breaks otherwise: it needs contextual widths during preparation (Dead Ends, Rules Per
Input Shape, with the shortcuts that lost). Canvas gives joined forms poorly: across a ZWJ only in a right-to-left
context in Chrome and Firefox (22-24 of 24 forms right, 3-8 left-to-right); Geeza Pro joins only inside one shaping
group; Amiri and the Noto Arabic fonts swap both glyphs where two letters meet, so no Canvas string measures a first
glyph in its word's form (Chrome 153, Firefox 155, 2026-09-12 to 20).

Pretext consumes a soft hyphen at a paragraph or hard-break start (Firefox drops it too; Chrome and Safari keep it,
ENGINE_FOLLOWUPS.md), but the hard break after it ends a line in all three browsers: `a`, LF, soft hyphen, LF, `b` in
pre-wrap paints three lines in each, the second with nothing visible, as do two soft hyphens there and two such chunks
in a row. So a hard break ending a chunk that holds nothing else makes an empty line, where Pretext used to drop the
chunk with its hard break; so do collapsible spaces between two U+2028 or U+2029, which Safari takes as hard breaks in
normal white space too. At the end of the text, with no hard break after them, the soft hyphens Chrome and Safari keep
still take a line, where Firefox and Pretext give none (ENGINE_FOLLOWUPS.md). The catalog's `followups/soft-hyphen-line`
cases pin these shapes (#349, 2026-09-25).
<!-- Cited by harness/sets/catalog.ts and 193 case origins ("a line holding only a soft hyphen", "... a collapsible
space"): keep this paragraph and the heading. -->

Keep the original source through analysis: normalization erases distinctions browsers keep. In normal white space Chrome
gives a form feed and a ZWSP two lines at width 1 and one at 100, though both normalize to a ZWSP, and in pre-wrap a raw
CR before a ZWSP occupies one native line where Pretext's CR is a hard break (Chrome 153, mid-September 2026;
ENGINE_FOLLOWUPS.md).

Three widths pass for "remaining width": the one deciding whether the rest of a word fits intact, the one given a
selected prefix, and the suffix measured afresh after the break; the whole minus a prefix isn't the reshaped suffix.
Prefix widths needn't grow: at −8px letter spacing, 16px Arial `WWi`'s prefixes measure 7.10, 14.20 and 9.76px, so the
whole word fits 12px where a shorter prefix doesn't, and "the farthest prefix that fits" is the wrong search. Each
engine admits the rest by its own one of these (`entryFitBasis`); choosing otherwise lost elsewhere (Dead Ends).

HarfBuzz reaches past a word, so a line start inherits more than its first glyph (redo lab, citing Chromium 152's
HarfBuzz): it normalizes a whole shaping call once the call holds a combining mark (in italic Athelas `tở` measures up
to 1px wider at 32px after a `café` spelled with U+0301 three words back); its lookups skip default-ignorables and,
where told to, marks, so two letters kern across a soft hyphen and a kasra; and it picks a buffer's direction from all
it holds, so a digits-only window cut from a unit with letters shapes the other way. A probe window whose far side holds
only `. ` has no script and gives false misses: windows need a letter on each side.

Firefox treats white space at line edges its own way (Firefox 155 and 156, installed and from source, 2026-09-15 to 26).
It hangs only U+0020 and U+3000, so a tab doesn't hang: hanging tabs in every profile lost 432 Firefox rows (old suite).
It removes a newline between wide characters and, on `ja` and `zh` pages, one next to East Asian punctuation
(ENGINE_FOLLOWUPS.md, White space and controls), and transforms white space per direction run, so a newline ending a run
between Japanese characters stays a space. It drops bidi controls from its text run as it drops soft hyphens, so a
profile treating them as ordinary zero-width text lets one take a line of its own after a space. It also trims U+1680 at
line edges (ENGINE_FOLLOWUPS.md) and breaks between a ZWSP and a following combining mark.

### Kerning At Line Edges

Segments are measured alone, so kerning across a segment's edge is missing; the engines keep different parts of it, and
Canvas shows only some. Pretext assumes default font kerning (README.md, Caveats); a `fontKerning` option was declined
on 2026-09-12 (Dead Ends).

Safari measures a text item directly followed by U+0020 with the space, minus an unshaped space, so the item keeps its
kerning with the space whether the space continues the line or hangs; the WebKit profile measures such segments the
same way. In 18px Times New Roman, `A`, ZWSP, space, `B` puts `A` on a 12px line at 12.006px, though the letter alone
is 12.999px. After an emergency break inside an item WebKit gives the rest the item's width minus the prefix,
unclamped: with WJ for the ZWSP, at widths 1 and 8, the rest is WJ and the space at −0.993px, drawn outside the line's
start edge, so Pretext fits with the signed advance and reports 0 (Decisions Log). WebKit also kerns Times New Roman's
`A` before CR as before a space, which Canvas can't show (Safari 26.5.2 and source, 2026-09-12 to 15; unconfirmed on
27).

Format characters between the word and the space resolve with the space, so on a right-to-left page `A`, WJ, space,
Hebrew paints the letter unkerned, and a left-to-right page kerns it. Without the page direction the profile keeps the
kerning only when the letters on both sides share a direction (`formatTailStaysWithWord()`). That rule replaced a
generated bidi-class table in #311 (2026-09-15), with 100 fewer runtime lines, 4,207 fewer lines of table, generator
and data, and the same lines on all 239,063 old-suite Safari inputs; the maintainer took it as the kind of
simplification they wanted, and Dead Ends has the shapes rejected on the way. An explicit embedding leaves the
direction unknown only in its own paragraph: Safari lays out `AA`, WJ, space, `B`, newline, U+202A, `x` in pre-wrap
16px Arial at 20.9px in 3 lines, where checking the whole text predicted 4. Under letter spacing WebKit moves the
space's gap onto the item and clamps it at zero; taking only the kerning there lost native successes, so letter-spaced
text takes none.
<!-- Q2: recommendation taken; the maintainer hasn't answered -->
<!-- Q2 note: the reaction isn't quoted -->

Measuring only a word's end with the space would be cheaper but isn't exact: in a headless WebKit census of 8.0 million
(font, word) pairs in 194 families (2026-09-12), the last grapheme cluster alone kerned otherwise in 389 pairs (in 20px
Waseem, `.` after Arabic letters takes nothing before a space, 2.47px alone) and the last two matched in every pair, but
nothing bounds how far a font's contextual lookups reach. Kerning with the space is common: PT Sans, Didot, Gill Sans,
Avenir Next and 18px `system-ui` each kern more than 2,000 distinct words of the Gatsby text, and element geometry
agreed with whole-word Canvas kerning on 2,440 of 2,551 sampled pairs. In the fixed-pitch Fira Code and Monaspace Neon,
WebKit's layout takes none of the kerning Canvas reports, which the profile doesn't model.

Chrome's layout kerns across spaces, ZWSP, soft hyphens and same-font spans, where its Canvas, shaping word by word
(Engine Facts, Chrome), reports none of it for Arial or Times New Roman; the Chromium profile follows Canvas's cuts
(headless Chromium 147, 2026-09-12; Dead Ends). In Chrome 153 a run measured whole equals its words measured with
the spaces beside them, less each inner space once, at all 379,714 positions where both sides hold a character of a
script of its own, and misses at 818 of 28,774 where one side holds none, all in Amiri (redo lab).

Where a pair's adjustment sits decides what a break inside the pair leaves on each side: GPOS pair positioning puts it
all on the first glyph, the legacy `kern` table half on each (`hb-kern.hh:102-106`). On macOS, Times New Roman,
Verdana, Helvetica Neue, Hoefler Text and 10 more families split it; Arial, Futura, Gill Sans and Avenir Next are among
those that don't. Canvas adds both halves, so Chrome's and Safari's never show the placement (in Chrome, 26 families
and 264 pairs gave the same values under every probe); Firefox rounds each glyph to app units, so it shows there at the
size times 2^k. Chrome keeps kerning when it splits an overflowing word (`'AV'.repeat(116)` at 109px takes 22 lines, not
24). Firefox shapes words without their spaces and splits them at ZWSP, WJ and other invisible controls, so its kerning
never reaches a space, and after an emergency break inside `AV` in 18px Times New Roman it paints `V` at 11.833px,
keeping half the adjustment with `A` (redo lab; the `AV` paint in Firefox 155, 2026-09-12).

### Rich Inline Boundaries

Rich inline measures each item alone and breaks by the paragraph's joined text. Measuring alone is a premise whose gap
is out of scope (Part 1, The Redo And What Counts As Done): Chrome and Firefox kern across same-font spans, so Arial
`community` + `,` fits about 1px earlier than its two widths, and Safari doesn't (2026-09-12). Where the flat walker and
one text node disagree, rich inline follows the flat walker.

#### Joined Text

Chrome's and Firefox's items break by the joined text, a font change ending only Gecko's shaped run (Firefox 155 wrapped
same-font spans as one text node, 2026-09-14); WebKit's and the WebKit profile's break by each box's own text, with the
previous box's last two characters as context (`src/rich-inline.ts`; `TextUtil.cpp:374-396`). Splitting a word changes
its segmentation (Thai `ความสวยง` is `ความ/สวย/ง` alone, `ความ/สวยงาม` joined), and each engine's rules apply across
items: Firefox, whose lines don't start with small kana, keeps `待って` together across `ちょっと待` and `ってください`, while in
Safari 26.5.2 the joined analysis lost Thai and Lao words split across items (2026-09-12; unchecked on 27). An item's
flags leave some starts unbroken (NEL, VT, NUL, a mark after a ZWSP), and after a break an item whose first word runs
past one moves down: Safari lays out items `zz` and ` ab\u0085cd` at 42 and 46px in 16px Arial as `zz` / `ab\u0085` /
`cd` (webkit-host, 2026-09-26).

A matching count can hide wrong breaks: an early joined-rule prototype's 40 lost Firefox Myanmar rows came from widths,
not segmentation. The second item starts with U+102C, a spacing vowel sign that graphemes split from its consonant and
browsers shape with it (16px Myanmar Sangam MN: `ဘာသ` 41.02px, `ာသည်` 50.78px, 82.03px joined; ENGINE_FOLLOWUPS.md), and
breaking at every item boundary had matched those counts only by breaking where Firefox never does (Firefox 155,
2026-09-14; old suite).
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

Main also gets some rich cases right only by luck, walking each item as if it began a line. X1 (branch `eng-x1`,
unmerged at b1fd05fc) continues rich-inline lines in the line walker instead of walking items again, so an item's first
character is classified by the joined analysis; it fixed about 2,190 probe cases and lost about 145 rich-only ones
(2026-09-27), and waits on Firefox's bidi-control gap (ENGINE_FOLLOWUPS.md, White space and controls; branch
`gecko-bidi-control-gaps`).

#### Items, Spaces And Fits

- Zero-width items keep their source identity: dropping them lost standalone ZWSPs, and compressing the array broke
  cursor and fragment indices. Both analyses stay: item and joined segments differ in 457 of 3,000 random flows, and the
  joined pass is about 1% of preparation (2026-09-16).
- Measure a collapsed space itself: `measureText('A A') - measureText('AA')` includes A–A kerning.
- Reservation comes before whole-item fit and rejects only a reserved width above the remaining width plus the fit
  epsilon: fit first lost nine Safari forced-overflow matches, a broader guard 62 (2026-09-13; old suite).
  <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- Chrome and Firefox break before the ZWSP in `a`/ZWSP/`hello` at width 1 even in one text node, so a run that began the
  line still breaks at item boundaries on overflow; atomic `break: 'never'` items allow a break on both sides, as
  css-text requires (2026-09-12).

#### A Wider Box Never Needs More Lines

A line count that rises with the width is a bug: four raw-width fit checks in `src/rich-inline.ts` gave 11 lines at
115px, 12 at 115.1px (#281, 2026-09-14). An item ending at an unfit soft hyphen with no earlier break wrapped before the
item (items `T` and `po\u00add` gave `T` / `pod`, where `Tpo\u00add` gives `Tpo-` / `d`; #323). Blink retries the item
at the width less the hyphen, then rewinds earlier items at the full width; subtracting the hyphen left sub-1e-6px
backward ranges, so the item is walked again to the soft hyphen, cutting backward flows in a seeded search from 43-60 to
7-14 per profile (#327, 2026-09-15; ENGINE_FOLLOWUPS.md). Fit with the width you report, or text laid out at its widest
line wraps differently (#308, 2026-09-15).

#### Box Edges And Pre-wrap

Shaping stops at a span edge with padding, border or margin; otherwise Blink shapes items together when font, locale and
spacing match, Gecko when font and language do, and WebKit never, except complex right-to-left text across undecorated
edges, one run in Safari 27 whose share Canvas gives only at its ends (`TextShapingAcrossInlineBoxes`,
`InlineLineBuilder.cpp:780-1028`). The architecture doesn't block rich `pre-wrap`: the redo got 99.3-100% of 1,334
cases' line counts right per browser (September 2026; TODO.md).

#### Painting Lines

`pages/demos/markdown-chat.md` has the chat's painting patterns (#273, #310, #328); spacer boxes or margins for gaps
also drop the space from copied text (#273, 2026-09-13). A full-bidi painter (nested `bdo`, generated ZWJs) matched
Chrome on 112 of 113 cases but failed in Firefox, at about 8 times the elements (2026-09-03). A line painted alone ends
its bidi paragraph (U+200D after an Arabic letter took its isolated form, 11.41px for 3.91px) and never runs Blink's
`ShapeLine` under `white-space: pre`; the painter rules that held everywhere are in `rebuild/DESIGN.md`, "7. Painter"
(branch `rebuild-20260916`). Demo CSS must match what Pretext was told: a `letter-spacing: -0.05em` Canvas never saw
predicted 6 lines for a 4-line headline (#264, 2026-09-13), and such fixes landed in one demo while siblings kept the
bug (#264, #277-#279, #297, #298), hence AGENTS.md's demo rules.

### Content Language And Fonts

<!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md folds in here and leaves the doc map -->

How each Canvas takes a language is under Measurement Model; the browser bugs are in PLATFORM_BUGS.md.

#### What The Page Language Changes

With `line-break` at its default, in named CJK fonts on `en`, `ja`, `ko`, `zh` and `zh-Hant` pages (Chrome 153, Safari
26.5.2, Firefox 155, 2026-09-12; Firefox's newline removal, from `nsTextFrameUtils.cpp`, is under Widths After A Line
Break):

| Shape | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Small kana (`日本ァア`, `わかって`), or `ー` after an ideograph or kana, starting a line | Every page | `ja`, `ko` | Never |
| Break before `〜` or `゠` | `zh`, `zh-Hant` | Never | Never |
| Curly double quotes around Latin or Hangul as brackets (`中文“abc”中文`, `했다.”라고`) | `zh`, `zh-Hant` | All but `ja` | Never |

The sources agree (Chromium's `line_normal_cj.txt`, Apple ICU's `ja.txt` and `ko.txt` with its curly-quote patch),
though Safari 27's own quote classes (Engine Facts, Safari) break around the quotes in `中文“abc”中文` on every page. Under
`ja`, `zh-Hans` and `ko`, Safari and Firefox also shape some of a named font's punctuation differently, and fallback for
a missing character follows the language everywhere. Under `lang=""` Chrome takes its app language, Firefox its
`x-unicode` group, whose fallback follows the machine (U+2167: 16px, 27.53px under `en`), and Safari matched `en`.

Content without a language takes one a page can't read (Chrome's application locale, WebKit's process languages and ICU
default locale, Gecko's first OS regional-prefs locale; source, September 2026): on this Chinese-first Mac Chrome laid
it out as `zh`, Firefox nearly so and Safari as `en`, and an English Mac would have moved about 430 Chrome and 780
Firefox old-suite results. So probes and cases set a non-empty `lang`, and the harness pins Chrome's UI to en-US.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

After a language change, Chrome's OffscreenCanvas keeps the fonts it chose until the font string changes: headless
Chromium 147 measured `骨直中文` in `20px "Helvetica Neue"` at 80px under `en` and still after `ko`, where a new context and
the DOM gave 69.2px (2026-09-11, #230). So preparation replaces the context when its language changes.

In a worker, Chrome's Canvas takes the UI language, Safari's generics none and Firefox's the macOS locale (2026-09-18).
Reading `<html lang>` costs about 16ns in headless Chromium and 4ns in WebKit, with no style recalculation (2026-09-12;
Firefox unmeasured), behind AGENTS.md's exception and the maintainer's condition on content language (Part 1, Lines
Drawn). With `lang=ja` on the test element alone, Firefox's DOM measured `foo-bar日本語` in 18px serif at 114.867px and its
OffscreenCanvas 106.983px (2026-09-03): put `lang` on `<html>`.

#### Safari's Generic Families

Under every language whose WebKit script isn't Common, `en` included, WebKit gets a generic family from Core Text's
`CTFontDescriptorCreateForCSSFamily` with the page language (`FontDescriptionCocoa.cpp:77-118`), while its
OffscreenCanvas has no language (WebKit #285993): on the 87% of pages with a language, `monospace` draws Menlo on the
page and Courier in Canvas. macOS 27's 1,079 locale identifiers give 32 distinct answers, kept as a default plus 60
languages that differ from their parent: OS facts, regenerated per macOS release, iOS dumped separately.
<!-- Q3: recommendation taken; the maintainer hasn't answered -->

Naming that family in the Canvas font, macOS's where the context has it and iOS's otherwise, matched the DOM on 14 texts
in nine scripts at 40px in every generic on 18 page languages, up from 0-6, except where the family lacks a character:
`monospace` under `ko` (7 of 14; Menlo has no Hangul), `sans-serif` under `ja` on macOS (12), `fantasy` under `he` on
iOS (5) (Safari 27 on macOS 27, the iOS 26 simulator, iOS 27 on an iPhone; 2026-09-24). Under `zh` Core Text names
Kaiti, which Safari can't use on macOS 27, and Safari draws Songti. In webkit-host (September 2026) a list where no
family resolves draws the script's standard family, Windows-only lists (`Meiryo`, `"Microsoft YaHei"` alone) resolve to
nothing, and PingFang lacks kana.

Rejected besides a `<canvas>` element (Decisions Log, 2026-09-24): macOS's family then iOS's in one list (what macOS's
lacks goes to iOS's, 11.6-33.8px off at 40px), a detached `<canvas lang>`, languageless (`Element.cpp:4873`), and
`navigator.languages` for a plain Han page, since Safari shows a page only the first preferred language.

#### `system-ui`, Late Fonts And Kept State

For `system-ui` (PLATFORM_BUGS.md; #336), guessed substitutions, size tables and scaling proved unreliable (March 2026),
and the line breaker takes no font-name rules. After a web font loads, Chrome's and Firefox's kept contexts pick the
family up and webkit-host's may not (Engine Facts, Safari). A stored answer stays wrong after a late web font until
cleared: the redo's kept widths gave 4 lines where the DOM had 2, in all three browsers. Main's width cache is shared
per font until `clearCache()`, unowned and unbounded, so random IDs and URLs grow it (a streaming word: 1.5 to 9.7MB of
heap over 800 edits); the maintainer had assumed it lived as long as a handle, so README states both lifetimes.
<!-- Q5: recommendation taken; the maintainer hasn't answered --> <!-- Q5 note: README asks for English family names -->

CSS `font-family` parses alike in all three (123 of 123 checks, the redo, September 2026); which unquoted names are
keywords, and how names compare, differ. Code rewriting a list, as the WebKit profile does, meets three traps:
`JSON.stringify` isn't a CSS serializer, `, monospace` after an unclosed string joins the name, and a quoted
`"system-ui"` is a named family. Behind README's caveats on settings Pretext can't see (#275, 2026-09-14): a 12px
minimum font size in Chrome or Firefox paints 9-11px text at 12px (3 of 10 paragraphs gained a line), and inherited
`word-spacing` overflowed 5 of 8 chat lines. `line-height: normal` varies by browser and font (16px Helvetica Neue: 18px
in Safari, 19.45px in Firefox; March 2026).

#### Emoji

PLATFORM_BUGS.md has the bug and the correction, whose shape rests on the widening depending only on the size, matching
across 59 emoji and 7 families and adding up per emoji (March 2026). Taking the font size for the DOM's emoji width
over-corrected Safari by 4px an emoji, and Firefox's DOM sizes Apple Color Emoji in device pixels, its Canvas in CSS
pixels (12.5px at 12px and DPR 2, 2026-09-15). The redo's DOM-free formulas, W being Canvas's width at a size: Chrome's
DOM width is `Math.ceil(64 × W(size × DPR)) / (64 × DPR)` at DPR 2 and `W(size)` at DPR 1, Firefox's
`W(size × DPR) / DPR`, Safari's `W(size)` (September 2026). They'd retire the DOM exception and work in workers, but
make prepared widths depend on the DPR at prepare time, which the API discussion decides (TODO.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: decision 4, `devicePixelRatio`, on the API list; side finding 6 as an ENGINE_FOLLOWUPS gap -->

#### Widths That Depend On Context

Whole-run agreement, isolated-letter agreement and matching breaks are separate claims. These probes run from 6fadbe5
(`bun run font-probe`, `bun run probe:arabic-joining`; Decisions Log, 2026-09-25), which may not launch on macOS 27; the
font probe fetches Shantell Sans unpinned from Google Fonts and fails without it, since a fallback font is no evidence.

**Shantell Sans (#195).** 56 `x` in `bold 15px "Shantell Sans"` in a 140px `pre-wrap` box wrap 15/15/15/11 natively and
16/16/16/8 in Pretext (Chrome and Firefox 152, 2026-09-03), though whole-run DOM and Canvas agree (501.75px in Firefox)
and the letters alone sum to 480.67px; Chrome's first bold `x` is 8.586px alone and 8.961px with the next character
kept. At 48 nearby thresholds, prefix widths matched 16 per face in Chrome, and one following grapheme of context all 48
in Chrome but 16 per face in Safari 26.5.2, where reshaping each line prefix matched 42: a context-aware fit per engine
(ENGINE_FOLLOWUPS.md). Pretext's `pair-context` mode, for numeric runs, keeps the grapheme before, not after; the
Chromium profile sums graphemes, and the case stays on Chrome's accepted list.

**Firefox's joined Arabic.** Gecko fits from the whole shaped word's advances; Pretext prices letters beside a soft
hyphen, or at an emergency break in a segment under 80px, isolated. Measuring each connected letter with a ZWJ on an
`rtl` canvas, gated by W(L+ZWJ) + W(ZWJ+R) − W(L+R) within 1/60px, matched 1,458 of 1,576 corpus widths in Noto Naskh
Arabic and 1,462 in the system fallback, against 144 and 300 isolated, with no false accepts, but 746 in Amiri and 438
in Noto Nastaliq Urdu, so a rule needs the check and a per-font fallback (Firefox 155, DPR 2, 2026-09-12;
ENGINE_FOLLOWUPS.md).

### Bidi Levels

Pretext takes no paragraph direction. Only the Gecko scan resolves levels, to split text runs where Firefox does, with a
port of servo/unicode-bidi that returns none and takes every paragraph as left-to-right (`src/gecko-bidi-levels.ts`;
ENGINE_FOLLOWUPS.md).

`segLevels`, removed in #258 (Decisions Log, 2026-09-13), came from pdf.js through text-layout: the direction from the
first strong character, no embeddings, isolates, bracket pairs or line rules, a segment's level its first code unit's.
Nothing in Pretext had read them since `layout()` stopped reordering with them (5ecce72c), and published uses only
guessed a paragraph's direction. Removing them made `prepareWithSegments()` 3% faster on Latin and 8.5% on Arabic,
Hebrew and Urdu, and `prepareRichInline()` 15% with Arabic items (Node's V8, stand-in Canvas).
<!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: the condition is stated in project voice there -->

Logical-order breaks and summed widths give the right lines (44 of 44 chat heights in Chrome 153 and Safari 26.5.2;
Firefox 155 missed only on URL and hyphen rules; 2026-09-13). Painting goes wrong: an element holding the paragraph
needs only its direction, but a line drawn alone, as by `fillText()`, is its own bidi paragraph. GNU FriBidi 1.0.16
orders `1+2 xyz`, the second line of `abc ابج 1+2 xyz`, as `2+1 xyz` within the paragraph, and edge numbers, punctuation
and isolates moved so on 21 lines per browser in the chat probe. Custom rendering would need a paragraph direction,
levels per code unit, and per-line reset and reordering (UAX #9 L1, L2); a known direction would also let the WebKit
kerning guard keep kerning. Whether mixed bidi fits Pretext without new broken assumptions is the maintainer's open
question.
<!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: decision 3, a `direction` option, on the API list --> <!-- Q18 placeholder: the public status comment on #321 may bring the maintainer's answer on a direction option; it goes here -->

Blink and WebKit run ICU's `ubidi_setPara`, Firefox the unicode-bidi crate 0.3.15, and they disagree on 130,661 of
300,000 short fuzz strings (the unidirectional shortcut, removed characters' levels, paragraph splits at class B,
brackets under overrides). So the redo ported ICU 78.2's `ubidi.cpp` line by line (844 lines; Dead Ends, Tables, Bundles
And Data), matching icu4c 78.3 and libicucore on 770,241 BidiTest runs, 183,379 BidiCharacterTest lines and 405,000 fuzz
strings; macOS 27's libicucore gives U+F7F0-U+F8FF Apple's own classes (September 2026). Nothing checked in would catch
a subtle bracket-pair (N0) error in main's Gecko port.

Levels changed none of 183,000 segments, direction changes falling where segments end anyway, yet took 38-46% of the
Gecko profile's right-to-left analysis before #365. They matter where a level run starts inside a cluster: Firefox
156.0.1 breaks `aa בבבב🏻` at 60px in 16px Arial before the skin-tone modifier, where the profile without levels breaks
after `aa`, and 22 pinned cases need them, all Balinese and Batak vowel killers after Arabic or Hebrew. Since #365
(2026-09-27) levels resolve only there (`levelsMayMatter()` holds the argument): in 262 of the harness's 10,733 texts
with a right-to-left unit, no corpus or chat text among them, at about 150-200ns a unit in Firefox 156. Over 63 million
strings (seeded mixed-direction ones, BidiTest and BidiCharacterTest with extenders put in, every string of up to 4 or 5
units over one-unit alphabets, corpus windows) the guarded scan equaled resolving everywhere, and the unit tests fail
without each rule the argument uses: the method for any port claimed exact.

Rejected: resolving wherever a cluster holds several code points, exact with a shorter argument, but vowel marks and
emoji make that 37% of Arabic paragraphs and 57% of the chat's right-to-left texts, saving 5-15%; and setting the whole
text run up again where levels split it, 8-17% slower than main where levels resolve, against within 5% for setting up
only the words the splits cut. The two setups share one word-end test (`endsWord()`), whose call makes Firefox 156
prepare long breakable runs, pre-wrap chunks, keep-all CJK brackets and seen Latin messages 2-5% slower than main;
written out twice they read within noise, and the copy isn't kept (Decisions Log, 2026-09-26).

### Keeping Work Bounded

Small operations turn quadratic when they repeat over growing user text. Browsers break lines in linear time, so
exactness forces nothing worse: the redo's slow giant paragraphs came from its own rescans to the text's end from every
line start. Ratios below are the bench's, two sessions per browser, against main before each change.

#### Quadratic Traps

Kinds met, with the fixes that hold the details (some of that code is gone): reclassifying growing punctuation or Arabic
strings, or rescanning cleared slots (`30854d7`, `2148b90`, `4cb8b24`, `f0a326d`); rebuilding growing CJK or keep-all
units (`eb3bbbe`, `f0a326d`); measuring every growing Canvas prefix (`fcf9c62`); searching hard-break chunks from the
start for every streamed line (`2c52171`); retrying white-space and font-size suffix regexes, and restarting
preferred-hyphen searches (#221); measuring each run of a combining-mark chain after the whole chain before it (#351).

The regex traps needed internal white space before content, or digit runs without `px`; the hyphen one, a long
hyphenated run over many lines. A continuation from anywhere must seek its starting boundary; a positioned scan can
carry its index. Before #351 (2026-09-26) an unbroken word of soft-hyphen and accent pairs took 64ms at 1× and 3,957ms
at 8×, and the first fix, argued from runs of 1-2 accents, cut the context short past about 95 and moved Safari's widths
up to 7px: test long runs. A `prepare()` that takes seconds, such as one 160,000-character word, can get the Chrome tab
killed as hung (Chrome 153, September 2026).

#### Canvas Work

Count the text submitted to Canvas, not calls: measuring every prefix or suffix is quadratic even at one ask per
position. So prefix fits stop at 96 graphemes and take pairs beyond, which bounds the amplification, not the shaper's
own cost, and a context query charges its overlapping source too. Main then spent 46ms analyzing and 70ms measuring of
Chrome 153's 115ms on the corpora, but 46ms and 305ms of Safari 26.5.2's 350ms (2026-09-15): Safari gains must come from
measuring less. Korean, Thai, Khmer, Burmese and Hindi cost Chrome about 4 times English under system fallback, twice
with a named font for the script.

#### The Walkers' Shapes

Measured and lost, as multiples of main's time (the PRs hold the per-row tables):
- **One walker for all text**: the full walker costs about 3 times the counter per segment in Chrome and Safari and 5 in
  Firefox, so chat `layout()` would take 2-7 times as long (#340, 2026-09-24).
- **A count starting a line's width from its first segment**, not 0: 1.4-1.7 on chat in Firefox 156 (#340, 2026-09-23).
- **The full walker stepping one line per call**, redoing its setup each line: 1.07-1.40 on short lines in Chrome 154,
  Firefox 156 and Safari 27 (#359, 2026-09-26).
- **One loop for both walkers**: 1.06-1.10 on chat in Chrome, 1.18-1.32 in Firefox (#359).
- **One path to admit a whole segment**, to fresh lines and lines with content: 1.03-1.17 in all three (#359), so the
  second path is a copy kept for speed everywhere, not for one JIT.
- **The line APIs stepping text with unbroken boundaries as `layout()` does**, handing the full walker only the lines
  that end at one (before NEL, or in Firefox after a space before a bidi control, which it leaves out of text runs): the
  same lines, but where a line's space overflows the walkers' sums differ in the last bits (99 of 96,470 offline
  Gecko-profile line checks; #350, 2026-09-26).

Removing the three pieces #357 kept for Chrome's JIT (#364; Decisions Log, 2026-09-26) costs Chrome 154 11% on rich
stats, 5% on letter-spaced CJK `layout()` and 8-13% on preparing long breakable runs and pre-wrap chunks, in both
sessions; Firefox 156 moves 2% at most, and Safari 27 only on Arabic resizes at seen widths (13%, its control copy 5%).

Data shapes: a `Uint8Array` of flags per text made one-word `prepareWithSegments()` a third slower in Node 23's V8 and
rich-inline preparation 12% slower in Chrome 154, so the analysis builds a plain array; slicing segment texts where
measurement reads them, not once in the analysis, made Firefox 156 prepare rich items 11-19% slower (#360, 2026-09-26).
`Array.from({ length }, fn)` cost Chrome 154 5.7% preparing seen CJK, and overflow trims read in
`countPreparedLines()`'s loop cost Firefox 156 13-26% counting long breakable runs, so a handle with trims counts
through the stepper but keeps the simple walk, without which Chrome 154's line APIs ran 62-108% slower on CJK messages
(#366, 2026-09-27). `measureAnalysis()` keeps its helpers as closures: hoisted, they measured the same in all four
profiles offline but took 16 more lines, and a hoist lands only if it removes lines and the bench shows a gain, so they
weren't timed (2026-09-26). AGENTS.md's locals rule is for line walkers.
<!-- Q15: recommendation taken; the maintainer hasn't answered --> <!-- Q15 note: line count as complexity's usual proxy -->

#### JavaScript Engines

Part 1, Engineering, says when an engine fact may shape code. These did, or moved a measurement:
- **V8's inlining budget**, about 460 bytes of bytecode, minified or not, is why `getLongMarkChainContext()` holds the
  long-chain loop: inside `getMarkContext()` it cost the inlining and up to 2.6% of Chrome 154's `prepare()` (#351,
  2026-09-26; the comment there has the bytes and the flags).
- **JavaScriptCore's type checks**: with a segment's width sum inline in `measureAnalysis()`'s loop, the DFG tier kept
  failing a type check over letter-spaced CJK and never reached FTL, and Safari 27 prepared letter-spaced CJK and
  keep-all CJK brackets 45-59% slower; with the sum in `getTextSegmentWidth()`, 9-10% faster than main (#358,
  2026-09-26).
- **Captured numbers and loop bounds**: V8 boxes a number a nested function captures (a write 12-14ns in the full
  walker, about 1ns as a local), and JavaScriptCore types an infinite default loop bound as a double (Bun walked
  letter-spaced and pre-wrap text 30-65% slower). Fixing both halved letter-spaced CJK `layout()` in all three browsers
  (#340, 2026-09-24).
- **Class fields in Firefox**: any class field seems to make Firefox 156 compile the whole bundle up front, 4.5-4.8ms on
  a fresh page against 1.9-2.2ms with plain objects, or with the fields emptied or set in constructors; V8 and
  JavaScriptCore didn't care (#340, 2026-09-23).
- **A loop slows once a check in it has held**: a check in the counter's loop that handed unbroken-boundary lines to the
  full walker slowed counting all other text up to 1.6 times in Firefox and 1.3 in Chrome, though the check alone cost
  nothing (#350, 2026-09-26).
- **Inline caches**: once `layout()` has stepped such text, Chrome's `walkLineRanges()` of simple text, sharing the
  stepper, takes 2-4% longer than a second copy of main, by a mechanism not found. V8's caches turn polymorphic over the
  two handle kinds (`--log-ic`), but one shape for both didn't help Chrome and cost Firefox up to 14%; a private 77-line
  stepper copy is the only cure measured, not taken (#350; Dead Ends, Simplifications Held Back).
- **Lookups**: SpiderMonkey charges 44-48ns a `Map.get` of a short key, even on the same string, and a lookup in front
  of a loop costs its latency, 23-50ns for a `get` that costs 11ns alone (the redo, September 2026); V8's is under
  String Storage.
- **Smaller costs**: a per-word regex in `prepare()` took 1.5% of a cold `prepare()` in V8 (#248), and spreading a typed
  array into `String.fromCharCode` 8.7µs a message in SpiderMonkey.
- **Measuring**: Bun overstates memory savings, since JavaScriptCore stores array entries at twice V8's size, and two
  identical builds in one page differ by 2-3% in JavaScriptCore (webkit-host, the redo, 2026-09-20;
  `rebuild/research/PERF-JS-PROFILE.md`).

#### String Storage

In Chrome a Latin-1 string's storage decides how Canvas shapes it: Blink shapes a one-byte string as one Latin segment
and runs its script segmenter over a two-byte one (`harfbuzz_shaper.cc:1072-1101`), so in 48px Amiri `)` × 15 is
183.60px one-byte and 329.76px two-byte; letters and digits measure the same. V8 keeps a string one-byte when every unit
is at most U+00FF and it was built so (parser text, literals, `JSON.parse`, their concatenations); a slice of 13 units
or more from a string holding a unit above U+00FF stays two-byte, and shorter ones are copied into one byte. Neither a
page nor an offline replay can see or choose storage. A `Map` key's internalized copy is one-byte, if its units fit,
only when that lookup first hashes the string (`known_one_byte_content`, `string-table.cc:411-421`), and
`getSegmentMetrics()`'s lookup is a segment's first, so every Latin-1 segment reaches Canvas one-byte and measures as
Latin. Chrome's page paints a script-neutral run that way after Latin and in all-Latin-1 text, but not after Arabic or
Han, or between em dashes with no letter around: Blink gives the run the script before it, and only at the paragraph
start the script after it (`script_run_iterator.cc:503-516`; ENGINE_FOLLOWUPS.md). (Chrome 153 and 154, 2026-09-18 to
09-27.)

Rejected (2026-09-27): keying the caches by another string, so Canvas gets each slice as it was built. It changes only
runs of 13 units or more cut from such text and moved none of 41,788 Chrome predictions; of 18 fonts probed, only Amiri
and Noto Naskh Arabic measure the storages differently (17 of 504 font and run pairs). There it fixed every such run
after Arabic, Han or an em dash and broke every one after Latin in text also holding an emoji or `ā`, since storage
follows a slice's length and source while the page follows the text before the run. It also costs a string per lookup,
and a canvas answers the same characters in either storage as it shaped them first (Engine Facts, Chrome). In the redo,
a text-keyed lookup before each Canvas call moved 254 of 380 predictions in a set built to catch it (Chrome 153,
September 2026).

### Scrolling And Scrollbars

The demos' scrolling rules (Part 1, Demos And The Chat) rest on these facts; `pages/demos/markdown-chat.md` has the
app-facing patterns. Unless stated: macOS 26, Chrome 153, Safari 26.5.2 and Firefox 155, 2026-09-15.

#### Scroll Position

- iOS Safari reports `scrollTop` past either end while rubber-banding, so the chat's clamped writes every frame jittered
  the bounce until #331 made it write only when layout moved the anchor (2026-09-16, the maintainer's iPhone).
- Firefox reads `scrollTop` back through float32 at large scroll heights, so a target and its read-back differ, which
  cost a redundant `scrollTo()` every frame at the end. Adding each frame's height change to the rounded `scrollTop`
  drifted 3-4.25px over a 15-step resize in Safari and headless Chrome; the anchor's on-screen offset from when it was
  picked doesn't drift. A viewport shorter than the last item makes that item the anchor, or a prepend jumped about
  1,180px. A stand-in for "layout moved the anchor", such as "the width changed", misses height changes.
- On macOS a trackpad fling reaches the page as wheel events, so a `scrollTo()` after content loads above moves only its
  start; on iOS the fling is the system's, and a `scrollTo()` may stop or jump it (unchecked on a device). Safari's
  wheel scrolling after `scrollTo()` is in PLATFORM_BUGS.md.

#### Scroll Height

Chrome and Safari cap an element near 33.5 million px and Firefox near 17.9 million, by engine coordinate storage, not
measured, and iOS Safari can crash above about 500,000px while the scrollbar is dragged (vibescript `Scrolling.md`). The
10,000-message chat is 1.0-1.8 million px. Unbuilt fixes for the cap without chunking: scrolling owned in JavaScript,
which `Scrolling.md` advises against; a scroll area a few screens tall with content shifted near its edges; lossy scaled
scrolling. Without `<!DOCTYPE html>`, quirks mode made `documentElement.clientHeight` the document's height, so the
masonry demo mounted every item and crashed iOS Safari (ffc2a757, 2026-03-23).

#### Classic Scrollbars

Classic scrollbars shift content whenever a box starts or stops overflowing, for any reason, or a showing scrollbar's
thickness changes (a live overlay-to-classic switch, `scrollbar-width`, a sized `::-webkit-scrollbar`, which also forces
classic scrollbars in Chrome on a Mac that hides them); hover never does. No window `resize` fires; `visualViewport`'s
and ResizeObserver's do. They're common: macOS on "Always", or "Automatically" with a mouse without gestures, which
switches live; Chrome on Windows and Linux; Firefox on Windows 10, or 11 with "Always show scrollbars". Only
`scrollbar-width: none` or a fixed `::-webkit-scrollbar` width avoids a live switch's nudge, accepted as rare. Tested
only with forced classic scrollbars on macOS.

With `html { scrollbar-gutter: stable }`, Chrome's `documentElement.clientWidth` reports the full width until a
scrollbar is drawn (1200 against the body's 1185), hence `document.body.clientWidth`, which needs a body with no margin,
border or padding, fails in a `<head>` script, before there's a body, and forces stale layout, so read it before
writing; height stays `documentElement.clientHeight`. A stable gutter off-centers content by half its width
(`both-edges` centers it for another 15px of width), and breakpoints live in the model, since `@media` widths and
`100vw` count the scrollbar and `clientWidth` doesn't. `html { overflow-y: scroll }` was dropped for painting an empty
track on short pages.

Measuring the scrollbar (Safari 27 on macOS 27, 2026-09-16): a hidden probe element reads 0 in Safari 27 where the real
scrollbar is 13px, and in Firefox one stayed 0 after a live switch while real scrollers went to 15px. Safari's stable
gutter sets nothing aside for a `::-webkit-scrollbar` width, and Safari 27, like Chrome, ignores `::-webkit-scrollbar`
once `scrollbar-width` or `scrollbar-color` isn't `auto`. Since Chrome 145, macOS Chrome rubber-bands inner scrollers
too. Force classic scrollbars in a probe with Chrome's `-AppleShowScrollBars Always` (that process only) or a fresh
Firefox profile with `ui.useOverlayScrollbars = 0`; an injected `::-webkit-scrollbar` behaves unlike real ones.

### Engine Facts

What one engine does that no topic above takes. Source lines are Blink at Chrome 153.0.8010.48 (.50 is the same source),
WebKit at Safari 27.0's 7625.1.29.11.27 and Gecko at Firefox 156.0 (156.0.1's recordings match). Most came from the
redo's lab; fuller numbers are in `rebuild/DESIGN.md` and `rebuild/research/` on branch `rebuild-20260916`, pages for
unfiled bugs in `rebuild/platform-bugs/pages/`. A new build can move any of it (`bun harness repin` shows what), and a
fact read in source needs reading again.
<!-- Q10 placeholder: the rebuild's LEDGER.md on that public branch describes a withheld report, so this points at the pages directory only until the maintainer answers -->

#### Chrome (Blink)

- **Canvas totals and font sizes.** `measureText()` is a float32 total of Blink's 16.16 sums, exact only below 256
  zoomed px (128 CSS px at DPR 2), while layout's glyph positions are exact. Whole zoomed sizes stay exact in 2048-unit
  fonts (SF, Arial, Times New Roman), not surely in Helvetica Neue's 1000, and negative spacing that pulls a total under
  256 px doesn't make it exact. Sizes floor to 1/100 zoomed px in float32 (`font_description.cc:271-282`): 16.8px is
  16.79 px in Canvas, 33.59 zoomed px in the DOM. (Chrome 153, 2026-09-16 to 09-23.)
- **The shape cache** (Chromium #560614560, PLATFORM_BUGS.md) keys text by characters and direction only
  (`frame_shape_cache.cc:45-65, 135-149`), so the storage a canvas shaped first answers both (Keeping Work Bounded,
  String Storage). It's bounded (`:12-16, 93-104`), but OffscreenCanvas never gets the frame-end trim: past the bound,
  kept paragraphs laid out 1.24-1.33× slower. 185 of pre-#340 main's Chrome predictions, all Amiri, moved between fresh
  runs, so those passes were page history; hence AGENTS.md's one kept context. (Chrome 153, 2026-09-12 and 09-17.)
- **`system-ui`.** The font cache key holds the zoomed size, `opsz` the specified size (`font_description.cc:308-331`,
  `font_platform_data_mac.mm:170-178`): a width depends on whether the DOM or a Canvas made the font first, and a
  context at `text-rendering: auto` shares the page's key, so measuring can move page text (PLATFORM_BUGS.md).
  `optimizeLegibility`, which Chrome's own measuring uses, keeps a context apart; main keeps `auto` (#336). (Chrome 153,
  2026-09-16 to 09-18.)
- **HanKerning.** Canvas halts a pair only inside one Canvas word and cuts around each CJK character (16px Hiragino Sans
  `「」「」「」`: 96 px, 80 painted), so the profile adds Blink's halts (`src/han-kerning.ts`) for 18 calls a font plus 2 per
  distinct trimmed character. Blink also narrows CJK punctuation where the script changes inside a shaping call (a `}`
  pairing with a `{` after Latin resolves as Latin, halting the `。` before it): the redo has this (1f380af7), the
  profile doesn't. Chrome 153, unlike 152, halves a closing mark that doesn't fit at a line end. (Chrome 153, 2026-09-17
  to 09-26.)
- **How Canvas shapes.** Word by word (`plain_text_node.cc:84-155`), cut at U+0020, TAB, ZWSP and around CJK ideographs
  and symbols, so kerning against spaces is lost (Times New Roman `AV To We. V, A Y o`: 262.45 px, DOM 254.23).
  `optimizeLegibility` shapes whole strings only where lookups involve the space glyph
  (`font_fallback_list.cc:264-277`): Arial, Times New Roman, PingFang, not Georgia, Helvetica Neue, Verdana (Dead Ends,
  Kerning). U+2028 for each U+0020 keeps a string whole, legacy `kern` fonts included, but makes it two-byte and takes
  no word spacing. Canvas shapes each ICU level run in its own direction, the DOM a group in one; a two-byte RTL group
  in U+202E … U+202C is one level run. U+FFFC becomes U+200B (`character.h:167-175`): zero where the DOM draws a 1 em
  fallback glyph. (Chrome 153, 2026-09-16 to 09-23.)
- **Letter spacing and tabs.** Blink spaces cursive-script runs only at spaces (`shape_result.cc:977-990`), spaces a
  glyph cluster once, and turns off liga, clig and calt under any spacing (`font_features.cc:54-86`). A tab stop is
  eight Canvas spaces plus letter and word spacing (`font.cc:303-317`), rounded up to 1/128 px at DPR 2
  (`simple_font_data.cc:225-240`), and a tab skips a stop under half a space away (`font.cc:333-337`). Recordings agree:
  a tab-only line in 16px Arial is 27.563px at −1px letter spacing and 35.563px at 0 (Chrome 154, b1fd05fc). The profile
  models neither the cursive rule nor the spacing and skip in stops, and a unit test pins its stops of spaces alone
  ("letterSpacing participates in pre-wrap tab positioning", `src/layout.test.ts`), so a port changes that test
  (ENGINE_FOLLOWUPS.md). (Chrome 153 source, 2026-09-16 and 09-27.)
  <!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: side findings 2 and 3 become ENGINE_FOLLOWUPS gaps -->
- **Line breaking.** ICU restarts at each line start without context, so LB20a applies there (`a‐b`, break-all, loose:
  `a` / `‐b`); the Blink scan makes one pass per text (Break Opportunities From Engine Data).
  <!-- Q7: recommendation taken; the maintainer hasn't answered --> Blink takes the last offset that fits from glyph
  positions, then the break at or before it, so a line ends before a ligature unless its first cluster doesn't fit, and
  reshapes a wrapped line from its first safe offset, moving the space 0 or −1 LayoutUnits
  (`shaping_line_breaker.cc:309-324`). A non-start `text-align` or a decoration reshapes a line ending at a space
  (`NeedsAccurateEndPosition`), losing its kern with the space. U+2000-U+200A are ordinary text; only U+3000 is another
  space separator. No JavaScript API exposes Chrome's hyphenation data, so `hyphens: auto` can't be ported. (Chrome 153
  source, 2026-09-16.)
  <!-- Q3: recommendation taken; the maintainer hasn't answered --> <!-- Q3 note: P-SCO-22: out of scope today -->
- **Languages.** `--lang` is ignored on macOS; `navigator.language` follows the accept languages, not the UI; DevTools
  locale emulation (Playwright's `locale`) moves `Intl`'s default locale, not Blink's, a disagreement no user meets.
  Generic `serif` follows the process languages (16px `Hamburgefonstiv`: 114.40 px under zh-CN, 111.70 under en-US). The
  UI language can pass for a rule: pre-#340 main's quote rules, fitted on a Chinese UI, passed 49 cases that all fail
  under an English UI. (Chrome 153, 2026-09-19 to 09-23.)
- **Canvas prices.** A first ask costs about 1 µs plus 0.06 µs a character (0.25 µs in Arabic); a repeat 0.14 µs at any
  length on the same canvas, full price on another; a new font size 30-45 µs; a new context measured once 21-26 µs. From
  scratch a question costs Chrome about 1 µs, WebKit 0.12-0.17 µs, Firefox 0.22-0.32 µs, so Chrome's time is its
  question count. A fallback font's first resolution is the browser's own cost, which moving it to start-up doesn't
  shrink: a Devanagari word took 3.0-3.25 ms in Helvetica and 16.6 ms in SF Mono (Safari 0.4-6 ms, Firefox 0.2-1.7 ms;
  installed browsers, 2026-09-16). (Chrome 153, 2026-09-18 and 09-19.)
- **`getTextClusters()`** (flag `ExtendedTextMetrics`, off in Chrome 153; windows and workers) gives every cluster
  position as Blink's own 16.16 sums, across fallback fonts and spacing. It took the redo's chat message from 199 calls
  to about 31 (10,000 messages: 2.0 s to 0.7 s); given layout's run (`optimizeLegibility`, U+2028 for U+0020, the zoomed
  size), 12,987 of 13,035 cluster starts floored to the DOM's. It gives no safe breaks, which Blink keeps per glyph; a
  flag for them would make a width change cost no calls. By 2026-09-23 (read through a summarizer) its Intent to Ship
  had slipped to Chrome 157 at the earliest, and WebKit was negative. Shipping reopens the redo's speed floors (Dead
  Ends, The Per-Engine Redo); its two filed bugs are in PLATFORM_BUGS.md. (Chrome 153, 2026-09-20.)

#### Safari (WebKit)

- **Safari 27's breaks** differ from 26's on the same libicucore 78.1: curly quotes and guillemets get opening and
  closing classes and a local LB19a; U+2028 and U+2029 force a break in every white-space mode (Chrome takes U+2028 as a
  space); keep-all text holding a character above U+00FF breaks after punctuation, even in `1,000,000` or `12:30`, so in
  every Hangul text node (WebKit #312099's fix, `BreakablePositions.h:268-271, 297-298`; an unfiled regression,
  PLATFORM_BUGS.md); a first character that doesn't fit keeps the following ones that can't start a line
  (`InlineContentBreaker.cpp:124-158`). What following 27 alone costs 26 is in the Decisions Log (2026-09-16). (Safari
  26.5.2 against 27.0, 2026-09-16.)
- **Page history (WebKit's caches).** The process-wide `TextBreakingPositionCache` keys breaks by text, origin and a
  style context that doesn't tell pre-wrap from break-spaces, never font, direction or storage, and fills as a block's
  line layout is torn down: `break-spaces` text after the same text in pre-wrap keeps six spaces on one overflowing
  line, and 16-bit keep-all breaks carry over to 8-bit text. `TextMeasurementCache` (widths keyed by text alone) moves
  float32 line edges too. 55 of 19,933 cases changed with run order (Chrome: 0), and 1,707 of pre-#340 main's 2,442
  webkit-host wins were history; history both orders share shows only in a case run alone in a fresh process.
  (webkit-host, 2026-09-17 to 09-24.)
- **String storage.** A text node is 8-bit from Latin-1 text, 16-bit once its leaf held a character above U+00FF, and
  layout reads it: an emergency break keeps one code unit at an 8-bit line start, and also the characters that can't
  start a line at a 16-bit one; keep-all `abcd,efghé` is 2 lines as 16-bit, 1 as 8-bit. JavaScriptCore's
  `Response.json()` gives 16-bit strings, ASCII values too, once the body holds a raw character above U+00FF
  (`LiteralParser.cpp:896-899`): one CJK case moved a batch's ASCII breaks, so keep probe payloads ASCII. The WebKit
  scan can't see inherited storage. (webkit-host and Safari 27.0, 2026-09-16.)
- **Measuring.** The simple or complex path follows the measured string's own characters
  (`FontCascade.cpp:304-309, 708-730`), and the two sit a float32 step apart at fractional sizes, so an exact-threshold
  fit can flip. Sizes aren't quantized; inline positions are float32 CSS px, off line breaking's 1/64 px grid. The
  fixed-pitch shortcut reads a Core Text trait Canvas can't show (`FontCoreText.cpp:753-785`), and the DOM then gives
  each character of non-ASCII text the space's width (16px Courier `ΩΩΩΩ`: 38.40625 px, Canvas 49.15625); `monospace` is
  Courier, neither equal advances nor names reveal the trait, and the profile doesn't model it. (webkit-host, 2026-09-16
  to 09-18.)
- **Overlong words.** Prefix fits beat single graphemes (307 misses against 1,018 over 2,564 cases; Safari 26.4,
  2026-06-22). The extra Canvas calls follow WebKit's layout: prefix widths for overflowing words (62-68% of calls,
  2026-09-16) and words measured with their following space (95% of the extra calls after 0.0.9, #236); the only
  principled cut saved 0.6%. When `breakWord` keeps a prefix of an item W wide, the rest gets float32(W − prefix)
  unmeasured and remainders compound (`AbstractLineBuilder.cpp:54-98`): `'AV'.repeat(17)`, 16px Arial,
  `overflow-wrap: anywhere`, 113.5px starts lines at [0, 11, 22], fresh widths at [0, 11, 22, 33]. So resuming needs the
  whole line start, not an offset, and a line painted alone can't reproduce it. (webkit-host, 2026-09-19.)
- **Soft hyphens.** A candidate ending in one is tested with the hyphen and its 1/64 px allowance
  (`InlineLineBuilder.cpp:1154-1161`), and it's discretionary only at a WebKit item's end. With no break that fits,
  Safari overflows with the hyphen where Chrome and Firefox break inside the word (`abc­def­ghi` at 26px; Safari
  26.5.2); inside spans it charges the hyphen, then backs off to an earlier break, which the profile doesn't model.
  (webkit-host, 2026-09-26.)
- **Tabs.** Stops of eight spaces without the letter spacing, skipping one under half a space away
  (`FontCascadeInlines.h:76-93`, read 2026-09-27), as the profile does; recorded tab-only lines are eight spaces plus
  one letter-spacing gap (webkit-host, b1fd05fc). CSS Text's minimum, as in Gecko, is half a `0`. Stops use the font of
  the tab's inline box (WebKit #230339, open since 2021; Safari 26.5.2, 2026-09-12).
- **Emoji and the segmenter.** DOM emoji equal OffscreenCanvas's at the CSS size, bit for bit at 8-32px (a "size × DPR ÷
  DPR" recipe is up to 3.5 px off), and OffscreenCanvas gives a space before U+FE0F the emoji's width
  (ENGINE_FOLLOWUPS.md). Safari's `Intl.Segmenter` doesn't mark digit strings as words where Bun's does, so Bun is no
  stand-in: a port that let only words split on overflow stopped splitting numbers (230 rows, old suite, removed
  2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered --> Making a segmenter costs about 7.8 µs,
  segmenting a short range 1.9 µs, so the scans keep one; its `containing()` bug is WebKit #324036 (PLATFORM_BUGS.md).
  (webkit-host, Safari 26.5.2 and 27.0, 2026-09-15 to 09-20.)
- **Kept contexts and loaded fonts.** A kept context misses a `FontFace` already loaded when it joins an empty
  `document.fonts` (PLATFORM_BUGS.md): the font cache keys without the font set while it's empty
  (`FontCascadeCache.cpp:104-115`), and the set tells observers before inserting (`CSSFontFaceSet.cpp:203-209`).
  (webkit-host, 2026-09-20.)

#### Firefox (Gecko)

- **Font sizes and Canvas answers.** Canvas keeps 7 significant bits of a size (`QuantizeFontSize`,
  `CanvasRenderingContext2D.cpp:4207-4216`): 13.33px measures as 13.375px. The DOM keeps 10 (Servo's
  `quantize_font_size()`, `font.rs:1004-1022`), then rounds to 1/60 px: 16.8px lays out at 16.8125px. Integers, halves
  and quarters below 32px agree; at 13.33, 16.8 or 17.3px widths miss by a median 0.24 px a line (PLATFORM_BUGS.md).
  `measureText()` is float(app units) / 60, so `round(W × 60)` is exact only below 2^18 px. A call costs about 0.4 µs
  plus 0.1 µs per UTF-16 unit, a new OffscreenCanvas context 6-7 µs. (Firefox 155.0.1, 2026-09-14; 156, 2026-09-16 to
  09-19.)
- **Font fallback per process.** Characters found only through global fallback measure differently for about a second
  after a content process first asks (U+20BF: a 13 px missing-glyph box, then 9.92 px), in every context and the DOM,
  and nothing says which. After any text shows U+1F600 U+FE0E, plain U+1F600 in Arial draws wrong for about 3 s
  (`gfxPlatformFontList.cpp:1474-1486`; PLATFORM_BUGS.md). So history-dependent cases vary between identical runs (190
  and 104), and order matters: an app measures before layout, a lab after, and measuring first moved 121 Firefox emoji
  cases, none in Chrome or webkit-host. (Firefox 156, 2026-09-16 to 09-20.)
- **Thai, Lao, Khmer and Burmese** break with the ICU4X model `Intl.Segmenter` runs (PLATFORM_BUGS.md), a
  space-delimited word at a time, so the segmenter gives exactly Firefox's breaks (54,588 of 54,588, once breaks inside
  grapheme clusters are dropped). New text's `prepare()` plus `layout()` per 1,000 characters, Chrome / Firefox /
  Safari: Latin 0.19 / 0.30 / 0.31 ms, Thai 0.72 / 2.74 / 1.31 ms. Runs between spaces (median 22-32 characters in Thai,
  3 in Khmer, 10 in Burmese) rarely repeat (1,192 distinct of 1,304 in one story), so the parked Thai cache helps only
  averages (Dead Ends, Caching, State And API Designs). (Firefox 155 and 156, 2026-09-16 and 09-25.)
- **How Gecko shapes.** Word by word: a boundary space (U+0020, or U+00A0 with no extender after it) is its own glyph
  (`gfxFont.cpp:3317-3330, 3708-3900`), so no kerning crosses it and a string equals its words plus spaces (66,743 of
  66,745 answers). Fonts whose lookups involve the space glyph shape the run whole (`SpaceMayParticipateInShaping`:
  Hebrew in Arial, Arial under `font-kerning: normal`, SF whenever features are on). A word of any length is one shaping
  call, which `BreakAndMeasureText` reads without reshaping a line. CJK turns kerning off; Common, Inherited and plain
  ASCII runs shape as Latin, so digits kern. The Core Text shaper is off by preference, so AAT families such as
  Helvetica Neue go through HarfBuzz and round each glyph. (Firefox 156, 2026-09-16 to 09-20.)
- **Ligatures.** A range edge inside a ligature gets its advance shared by started clusters (`ComputeLigatureData`,
  `gfxTextRun.cpp:238-322`), but the break scan puts it all on the first character (`:989, 1139-1149`), so a break
  between lam and alef never fits more text. Real text breaks inside ligatures under break-all, in long words, at soft
  hyphens and in URLs (1,432 cases in Helvetica, Hoefler Text, Seravek, Lucida Grande and the Latin of PingFang SC and
  Hiragino Sans). Unfiled: `ComputeLigatureData` divides a signed advance by an unsigned count (`:249-289`), so a span
  starting between two marks of one cluster makes a frame about 17.9 million px wide. (Firefox 156, 2026-09-17 to
  09-23.)
- **Letter spacing.** A run's last character is always spaced, others only if not a tab or formatting character and a
  cluster starts after them (`CanAddSpacingAfter`, `nsTextFrame.cpp:3860-3873`): a lone pre-wrap tab at 1px is 43.6 px
  natively, 44.6 px painted alone. A tab before a change of direction also ends a left-to-right run and gets a gap
  (`a\tبِبِ((tail`), unseen by the Gecko profile where it resolves no levels (Bidi Levels). After a removed soft hyphen,
  a mark is spaced as its own base. From Firefox 153, `letterSpacing = '0.001px'` turns ligatures off as the DOM's
  non-zero spacing does and adds nothing, so a port can add spacing in JavaScript; 140 ESR adds 0.00104 px a character
  and has no `ctx.lang`, and ESR is dropped where it costs complexity (Part 1, Lines Drawn). (Firefox 156, 2026-09-17 to
  09-27.)
- **Breaks.** The Gecko scan ports Gecko's rules (Break Opportunities From Engine Data), such as `-` kept with a digit
  (`COVID-19`) and a break after `/` before an ASCII letter, the opposite of Chrome and Safari. Not carried:
  - An emergency wrap after a hyphen between alphanumerics (`SetupClusterBoundaries`), taken only when nothing else
    fits, so a probe reading only `overflow-wrap: normal` lines sees a break that isn't one.
  - Under `overflow-wrap: break-word`, every cluster of a line's first word stays a candidate until an ordinary break is
    accepted (`gfxTextRun.cpp:1068-1073`): free for Gecko, 4-5 Canvas questions a cluster for a port (the profile's
    trade is under Break Opportunities From Engine Data).
  - Cluster starts beyond ICU4X's grapheme rules: a leading extender continues a cluster, a Bengali YA joins after a
    VIRAMA, Myanmar U+102C stays with the cluster before it. Whether that undoes the Gecko profile's use of Chrome's
    grapheme table isn't settled.
  - Relayout: a frame that overflows after an earlier break was recorded redoes the line with that break forced
    (`aa b<span style="color:red">bbbbb</span>`, 16px Courier New, 57.6px: `aa` / `bbbbbb`).
  - Page history: any RTL text node turns bidi on document-wide (`CharacterData.cpp:298-302`), so LRE, LRO, LRI or FSI
    split an LTR paragraph's frames only once the document has seen RTL text.

  (Firefox 155 and 156, 2026-09-14 to 09-20.)
- **Span edges.** A span's end border and padding are reserved on every line it occupies (`nsInlineFrame.cpp:516`), so
  shrink-wrapping padded spans to the widest line can move a break (2 of 55 widths), as with the Markdown chat's inline
  code; Blink and WebKit don't. (Firefox 156, 2026-09-19.)
- **OffscreenCanvas against the DOM.** OffscreenCanvas shapes at the CSS size at 60 app units per px, the DOM at the
  device size, rounding each glyph at max(1, round(60 / dpr)) units per device pixel (`gfxHarfBuzzShaper.cpp:1559,
  1699-1702`): about 0.03% of widths are a unit off (Geeza Pro, Thonburi, Helvetica Neue), no traced break moved, and
  synthetic bold likewise (`gfxFont.h:1899-1904`). A `<canvas>` element at the device size matches (243 of 243 units);
  why Firefox still uses OffscreenCanvas is under Dead Ends, DOM And Canvas-Element Paths. (Firefox 156, 2026-09-17 and
  09-18.)
- **Optical sizing.** OffscreenCanvas never applies automatic optical sizing (`nsFont.cpp:276-279`; Mozilla #2020917),
  so its `system-ui` is the page's family at another optical size, not another font, and every `opsz` font mismeasures
  the same way on every OS, web fonts included (Inter, Roboto Flex, Source Serif 4). #336 has the `system-ui` sweep.
  (Firefox 156, 2026-09-17 and 09-18.)
- **Workers** measure like their page except for a font list with no generic family: Gecko appends `font.default`
  (serif) on the main thread, always `sans-serif` in a worker (`gfxTextRun.cpp:1881-1891, 1969-1977`), and a library
  can't append one quietly (lines moved in 16-21 of 435 cases). A context with `lang = ''` follows the root's `lang` on
  the page, the OS locale in a worker. `devicePixelRatio`, absent in a worker, misleads on the page too: 2 in a
  `display: none` iframe, 1 in a removed one, 2 under `privacy.resistFingerprinting` where layout is at 1. (Firefox 156,
  2026-09-19.)
- **Tabs.** A stop falls every `tab-size` (the text frame's) × (the block's space advance in app units plus its letter
  and word spacing) (`ComputeTabWidthAppUnits`, `nsTextFrame.cpp:3875-3906`); WebKit takes both from the span, Blink the
  span's `tab-size` with the block's font. The next stop is at least half the first font's `0` away (`AdvanceToNextTab`,
  :4298-4304; `GetMinTabAdvanceAppUnits`, :1931-1937). A tab's position counts advances only at cluster starts, plus
  each character's spacing (`CalcTabWidths`, :4306-4378). Recordings agree (156.0.1, b1fd05fc): a tab-only line is 8 ×
  (space + letter spacing) unless the tab is the text's last character, as in 16px Arial at −1, 0 and 1px: 27.6, 35.6
  and 43.6px. The profile follows none of this (ENGINE_FOLLOWUPS.md). (Firefox 156.0 source, 2026-09-16 and 09-27.)

Elsewhere: a context used before Firefox reads its late family names keeps the fallback (PLATFORM_BUGS.md, the late
family names), and the joined Arabic study is under Content Language And Fonts, Widths That Depend On Context.
<!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md is folded into Content Language And Fonts, which took its joined Arabic study -->

### Dead Ends

What was tried and lost, why, and what would reopen it; agents' work unless an entry says otherwise. A result holds for
its build, tests and surrounding code, and a thin or unsupervised attempt is weak evidence (Chrome's word sums were
written off after one, then landed), so rerun the evidence before a retry if the code has moved (Part 1, Docs). <!-- Q1: recommendation taken; the maintainer hasn't answered -->
<!-- Q2: recommendation taken; the maintainer hasn't answered -->

A shared reopen condition, *contextual widths during preparation*, means measuring text in its neighbors' context at
`prepare()` time, which Chrome's `getTextClusters()` could make cheap (Engine Facts, Chrome). Old-suite numbers appear
only where a decision rests on them. <!-- Q7: recommendation taken; the maintainer hasn't answered -->

#### The Measurement Model (March 2026)

With the maintainer, on a 3,840-case sweep where summed per-word Canvas widths got 3,838 right in Chrome (transcripts;
the evidence left this file on 2026-03-28, 2604c28f).

- **The space before the next word left out of the fit**: 82%; only a collapsible space ending a line hangs. Reopens if
  an engine is found not counting it.
- **Scaling segment widths** to the whole string's: 3,827; the error is uneven and changes sign by browser. Reopens if
  it proves proportional to width.
- **Character widths plus pair kerning** (uWrap's): 3,828, losing in-word shaping; only as a stated approximation
  without Canvas.
- **Whole-line Canvas widths**: 92.5%, as raw widths skip `prepare()`'s corrections, and quadratic grown per word (136
  ms in Safari against 0.11 ms). As a check near the width it fell to 99.8% raw, bringing back Chrome's emoji inflation
  the sum corrects, since the corrected sum beats raw `measureText()` of a longer string; corrected it changed nothing,
  and it needs text in `layout()`. Reopens with a Canvas call giving every position of a run, or a case where the
  corrected sum and the whole line disagree (TODO.md's diagnostic-mode question).
- **Hidden DOM or SVG text** forces layout (Part 1, Lines Drawn).
- **Prior art** (2026-03-03): uWrap, canvas-hypertxt, chenglou/text-layout, tex-linebreak and foliojs/linebreak don't
  predict browser lines. pdf.js (read 2026-09-13): its lazy edit table through white-space normalization suits #90; its
  `scaleX` stretching hides mispredictions.

#### Rules Per Input Shape

Main's own break rules before the engine scans (#340, 2026-09-24), one fix at a time on the old suite.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

- **`Intl.Segmenter` word boundaries patched into break opportunities**: about 20 merge passes over 2,494 lines of
  `analysis.ts`, one rule per failing shape, with deciders near CJK that disagreed, so punctuation bugs kept returning
  (#274, #276, #290, #291, #293). The scans take 341 lines, at 86 → 88 Chrome Canvas calls per real paragraph; "Fixing a
  mismatch" forbids the pattern, so nothing reopens it.
- **A #210 fix that loses nothing** (2026-09-11) needs a guard keyed to the failing shape: `ZWSP ب SHY ب` and
  `ZWSP Ꙝ SHY Ꙝ` prepare alike but take 2 and 4 Chrome lines at 9-14.75 px, as do `CR ZWSP` and `LF ZWSP`. Reopens with
  contextual widths during preparation or a per-engine model of CR.
- **#225's broader rules** (2026-09-12): emergency breaks in punctuation clusters fixed 624-1,197 rows per browser and
  lost 108-510, Chrome's through errors that had cancelled; no break before `，` or `」` after Latin lost 42-52. Rules
  whose errors cancel land together, so build in layers.
- **Smaller rules**, moot since #340: #274's first fix, which reached too far (`中（ابب）`, `中文””tail`); a line-ending
  opening bracket after a word (browsers do it only at 1-26 px); merging punctuation, URLs or numbers into units (erases
  context the engines keep); Arabic pair corrections and phrase rules from single examples; Myanmar rules that split the
  browsers; Chrome quote rules fitted to one Mac's UI language.
- **Blink-style shaping-cluster overflow units** moved no row, helped only letter-spaced complex scripts, and cost 26-66
  ms on a page's first Myanmar `prepare()`, where V8 builds 172 script regexes behind their screen (no branch recorded).
  Reopens with the letter-spacing work (ENGINE_FOLLOWUPS.md), once that cold start is fixed.
- **A source-coordinate layer**, so storage could change without output changing, never earned its cost (no branch
  recorded): finer source positions don't create shaping information never measured.
- **A Firefox script itemizer** (175 lines, 16 KB of data), removed on 2026-09-24: it moved only 48 of about 20,000
  random mixed-script strings with stray marks, where Firefox 156 sides with the splits (two accepted cases). The bidi
  split stays (Bidi Levels; Decisions Log). Reopens if real text with such marks turns up.

#### Invisible Characters, Controls And Soft Hyphens

Mostly main then, on the old suite in installed browsers, 2026-09-11 to 09-24.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

- **A ZWSP right after a forced break inside a word** takes its own line in all three browsers; copying that lost
  290-560 results per browser to six unmodelled behaviors. Reopens once joined Arabic widths and letter spacing on
  invisibles land.
- **Letter spacing on invisibles**: no gap anywhere lost 73 cases (2026-09-11); a 14-line patch went +442 / −172 on
  passes leaning on a cancelling bug (2026-09-23/24). Reopens as ENGINE_FOLLOWUPS.md's group, on one per-grapheme
  spacing unit.
- **Lone CR, FF and VT per engine in pre-wrap** (2026-09-11): two prototypes lost 150-228 results each, as did deleting
  CR or making it a zero-width break; CR reaches every layer, so apps normalize line endings (README). Reopens with a
  model traced from the engines' line builders.
- **Folding invisibles into their neighbors** (2026-09-15/16) lost 776 real rows in the offline replay, as controls got
  zero width where browsers give them width and soft hyphens and ZWSPs took spacing and width the page doesn't give
  them, and 1,887 Chrome and Safari rows in the old suite's gate, such as `a`, U+00AD, U+0301, U+00AD, U+0323, `b` at
  7px in 16px Arial with letter spacing −4, painted `a` / `b`. Marking break bits (112 lost) became the design (Break
  Opportunities From Engine Data).
- **Invisibles left out of Chrome's Canvas strings** (the redo, 2026-09-16) cost 325 line counts, as Canvas then joins
  emoji sequences and Arabic letters the page keeps apart; U+2060 in their place matches (Measurement Model), and a rule
  picking which to drop was fitted to lab scores.
- **NEL joined to its neighbors**: joined before, overlong words split at Canvas grapheme widths; joined both sides, a
  following mark took 12 px.
- **Soft-hyphen returns** to an earlier break need an overflow isolated widths show, to a truly latest opportunity:
  returning past breaks with no segment kind lost 142 Chrome rows, both rules for a soft hyphen with no fitting
  opportunity hundreds (the `#323` accepted entries), Firefox's (4e6d4dd5) 15 per direction. They reopen with contextual
  widths during preparation.
- **A `glue` kind for no-break runs** was a label, and a wrong one (Decisions Log, 2026-09-24).

#### Arabic And Joined Scripts

- **Arabic letters priced by joined form alone** (2026-09-11) lost 1,573-1,622 passing old-suite metrics per direction
  in Chrome and 743-857 in Firefox. Reopens with Firefox's per-grapheme ZWJ recipe gated per font (Content Language And
  Fonts, Widths That Depend On Context). <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **Firefox's joiner recipe** (U+200D after an in-word Arabic prefix) came from lab scores, not source, and is inexact
  per font (15 of 33 breaks right in Amiri); removing it cost 77 line counts, the `in-word-prefix` gap. Canvas totals
  can't find the fonts it misses, so it reopens with font files.
- **Lam + alef as one cluster, by letters** (the redo, 2026-09-20), fixes Arial and breaks Amiri and the Noto fonts, and
  no Canvas test tells them apart (the U+200D test is wrong for four of five two-cluster fonts and blind for Geeza Pro).
  One cluster suits 26 of 31 installed families, the macOS and Windows fallbacks among them, two Amiri, the Noto fonts
  and the Android and ChromeOS fallback; main, summing isolated widths, gets 7 of 20 constructed cases right and the
  redo 12. Don't land it or retry the U+200D test; the default waits until main breaks overlong Arabic words by cluster
  (ENGINE_FOLLOWUPS.md).
  <!-- Q12: recommendation taken; the maintainer hasn't answered -->

#### Kerning

- **A `fontKerning` option** (#216, #199; declined 2026-09-12, trackers open): Safari's OffscreenCanvas ignores it,
  Safari's following-space kerning would have to switch off too, and it's public API for a rare setting. Reopens when
  someone needs `font-kerning: none`, or Safari honours it.
- **Only a word's end measured with its space**: inexact by the 8.0-million-pair census (Kerning At Line Edges); reopens
  with a bound from font data.
- **Other shapes of Safari's space-kerning rule** before #311's (2026-09-15): none across format characters (33 rows
  lost), a narrower rule, kerning only under letter spacing, and direction marks as non-letters.
- **Chrome Canvas kerning settings** (`optimizeLegibility`, `fontKerning`) shape whole strings in only some fonts and
  turn features on for every measurement (Engine Facts, Chrome). Reopens with a whole-string mode.
- **WebKit letter-spaced ligatures** (the redo, from 2026-09-17; Measurement Model): no separator sets two letters
  unligated in one shaping call (U+200C ends the simple path's call, U+034F doesn't stop the ligature, U+180B brings a
  fallback glyph), and a group heuristic was 1.9 px off; a styled connected `<canvas>` would fix about 721 cases but is
  DOM, and a library-made `FontFace` is font loading. An app-declared features-off family, bit-exact on 1,274 strings,
  is a new kind of fact, not built. Reopens when WebKit fixes Canvas `letterSpacing`, or if that family is accepted.

#### Fitting, Cuts And Fast Paths

Mostly the redo, 2026-09-15 to 09-24, with critic agents. Chrome's cuts keep windows under 256 px, where float32 totals
stay exact (Engine Facts, Chrome).

- **Chrome's cut picked without asking Canvas** ("B1b", 2026-09-20) passed every tier yet moved layouts in 196 of 318
  families (a pair window can form an `fi` the group doesn't). The rework asks only what can change the answer and keeps
  57-60% of the saving with no layout moved (`rebuild/research/PERF-B1B-REWORK.md`); changes to the cuts now pass the
  all-fonts probe first.
- **Chrome word sums, round one** (2026-09-20): 2.04 → 0.84 s, but seven of 318 families wrong, as AAT `kerx` carries
  state across spaces that Blink's test checks only in GPOS and GSUB. The maintainer hadn't supervised it well
  (2026-09-22); round two, cutting only where the safe test passes, landed (`rebuild/research/SPEC-WORD-SUM.md`).
- **Skipping cuts by font grain** (2026-09-20) needs a power-of-two units-per-em and a whole device size, so fails at
  1000 units, at 1.25× and 1.5× and under zoom. Reopens with a `unitsPerEm` read from the font.
- **A float32 error bound**, cutting exactly only near it (2026-09-20): 1.16× slower, and a 512 px target made resizes
  47-60% slower. Reopens with a representation handling both precision and the cold-prefix cost.
- **Admission and fit rules** (no reopen recorded): emergency-prefix differences for every admission; choosing by
  prefix-measurement mode; Canvas's letter-spaced widths everywhere (breaks ligatures); Safari's inferred carried
  adjustment on every prefix; Firefox's 1/60 px box rounding in line fits (regressed unrelated cases).
- **A Canvas check in `layout()`** near the width ("H3"): +1 / −1, and `layout()` makes no Canvas calls (AGENTS.md,
  Implementation notes), which the emulation study's cheaper Chrome recipe needs too.
- **Gecko prefix fits from 24px, or everywhere** (2026-09-27): the 24-80px lines they fix cost too much in preparing new
  text (Break Opportunities From Engine Data). Reopens if prefixes get cheaper, or real usage shows the gap.

#### DOM And Canvas-Element Paths

- **A hidden `<canvas>` on the page** for Safari's page-language fonts (2026-09-11) forces style recalcs (3.3 s against
  33 ms on a 20,000-element page, headless); the maintainer rejected it as DOM access (Part 1, Lines Drawn). In Safari
  27 every element context updates styles per call (20-91 ms after one `insertRule`), and only attached ones follow the
  page language (Content Language And Fonts, Safari's Generic Families). Reopens if WebKit #285993 gives Canvas an
  inherited `lang`.
- **Firefox on a `<canvas>` element** for `system-ui` and optical sizes (the redo, 2026-09-18/19): light (1.03-1.06×
  OffscreenCanvas's time) until a page inserts CSS rules, when a kept context updates styles in every `measureText`
  (104-113 ms against 0.26 ms over 200 inserts) and each live one joins the refresh driver; its font check reads a Gecko
  internal before every call; and workers have no element canvas, so it failed the maintainer's 2026-09-19 conditions
  (Decisions Log, 2026-09-18; `rebuild/research/FIREFOX-CANVAS-ELEMENT.md`). Unmerged OffscreenCanvas alternatives:
  optical sizing for system keywords only (name-keyed), and synthetic bold confirmed from Canvas (9 rows).
  <!-- Q10 placeholder: these are the public branches r4-gecko-alt-opsz-default and r4-gecko-alt-synthetic-bold, which Q10 asks about; name them here once the maintainer answers -->
  Reopens if Firefox `system-ui` becomes a priority, Mozilla fixes #2020917, or an app hands Pretext its own canvas.
- **A `direction` option** (2026-09-12): Chrome measures brackets about 0.5 px apart by the `<html dir>` read at context
  creation (189 old-suite line counts on a flipped page). A `prepare(…, { direction })` prototype fixed Chrome and lost
  11 Safari rows, and re-reading `<html dir>` is hidden state (Part 1, Lines Drawn). Reopens in the API discussion
  (TODO.md).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Painting each block natively** (`<p dir="auto">`, a ResizeObserver correcting rows) gives up exact heights (Part 1,
  Demos And The Chat).
- **`devicePixelRatio` read in `layout()`** for Chrome's device-pixel fit (2026-09-15) is hidden state that changes
  between displays; a DOM probe for the fit tolerance was superseded as new DOM work. Reopens in the API discussion,
  with the grid's measured effect (Measurement Model).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Healing stale Firefox contexts**, left on the fallback when used before Firefox reads its late family names (the
  redo, `rebuild/research/CONTEXTS-HEAL.md`): a page contract (no event tells the page), a never-seen font-string
  spelling to force a lookup (leans on a private cache, grows forever), refusing contexts whose families don't all draw
  (common lists fail it), a witness string (equal widths don't prove equal fonts), and `document.fonts` or a sentinel
  element (DOM reads). Reopens if Firefox tells Canvas font groups about `font-info-updated`.

#### Tables, Bundles And Data

- **Firefox's line data in Chrome's format** (2026-09-26; local `ff-table-format-bmp`, `ff-table-format-ranges-first`):
  8.7 KB of state machines for Firefox's 0.8 KB, or Chrome's code-point lookup, exact and 3.2 KB off 55 KB gzipped but
  tying Firefox to Chrome's table and slowing its Arabic, Hebrew, Hindi and Urdu analysis 13% (Decisions Log). Reopens
  only if table size and per-engine bundles both return.
- **One bundle per engine** (372-788 KB minified in the redo), ruled out on 2026-09-26 (Decisions Log). Reopens if apps
  ship per-browser builds.
- **Tables shrunk by computation**: remapping onto base classes fails for Chrome's Chinese table (`〜` and `゠` need a
  class the base lacks), and runtime state machines mean porting ICU's rule compiler, where today's tables need no
  upkeep between refreshes. Reopens with the table-size question.
- **Dictionaries or ICU4X's LSTM model** for Thai, Lao, Khmer and Burmese (2026-09-25): hundreds of KB each, and slower
  in JavaScript than in Firefox. Reopens for runtimes without `Intl.Segmenter`.
- **`Intl.v8BreakIterator` for Chrome's breaks** (the emulation study, 2026-09-16 to 09-20) drops `-u-lb-*` keywords,
  lacks Blink's fast table, space rule and CSS handling, is gone from Node and Deno, and saves nothing while Safari
  needs the tables. Reopens if `Intl.Segmenter` gains a standard line granularity (Stage 1 since 2021). <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Safari's libicucore tables shipped whole** (26c3e231, 2026-09-16): 75 fewer runtime lines for about 30 KB more
  gzipped; overtaken by packing each table against an earlier one.
- **One bidi resolver with per-engine switches** (the redo): ICU isn't structured like UAX #9 (brackets pair while
  explicit levels are computed; weak and neutral rules resume after isolates), so nine or more switches, redone at every
  ICU roll (Bidi Levels). Reopens only if Blink and WebKit stop running ICU's resolver.
- **A hand-written `.d.ts` for the README's API glossary** (2026-03-17): nothing checks it against the implementation
  but a bridge that drifts the same way, and the maintainer preferred the glossary; reverted (Part 1, Docs).

#### Caching, State And API Designs

Studied 2026-09-13 to 09-26, mostly on a stand-in Canvas checked in Chrome, against the cost model below; most are
parked for the API discussion (TODO.md), not refuted.

- **Handle-free layout over a size-limited global table** (2026-09-26): the chat lays out all 18,613 blocks per width
  change, so a smaller limit always misses, the app must say which texts are alive anyway, and the lookup alone is
  10-38% of the height pass. Reopens if apps can control lifetime cheaply.
- **Keyed state** in a WeakMap on the app's object (2026-09-26): 1.1-1.5× slower heights, nothing faster, and wrong
  lines across differing options. Its value is convenience and making incremental prepare possible; reopens if that's
  needed.
- **The width memo** (2026-09-26): handles remembering which widths give their last lines were exact over 137 million
  fuzzed checks and alone drag-resized 10,000 messages under 1 ms, but new widths ran up to 26% slower in Chrome, too
  much for the worst case (Part 1, Engineering), and it cost about 155 lines and immutable handles. Reopens as the
  untried multi-line-only variant, if the worst case stays flat.
- **Width ranges in the chat** (draft #280, branch `exact-height-intervals`, 2026-09-14): 1 px drags at 10k went 3.5 →
  0.3 ms, but ranges are 3-7 px wide, so random jumps got about 10% slower, for 440 more lines; and line counts needn't
  fall as width grows. Reopens if small drags at large histories matter.
- **Incremental prepare** (#313, 2026-09-13 to 09-26): restarting at the last word start before an edit was exact, but
  bookkeeping costs 0.6-3.3 ms at 100,000 characters, beating a handle per paragraph (README, #362) only on one long
  break-free text; `prepareEdit` (12-41× faster) hid a bug 135,000 random edits missed, and appends can rebreak the old
  tail, so `prepareStream` (#153) wasn't built. Which old line survives needs the new text's break data, so reuse keys
  on what is prepared, not the source, as WebKit's early restart shows (`InlineInvalidation.cpp:388-389`); every
  stateful prototype had a stale-result bug (`rebuild/research/INCREMENTAL-API-READING.md`). Reopens if long break-free
  texts edited live matter.
- **The font given at layout time**, `prepare(text)` only analyzing (2026-09-26): analysis is 50-86% of a warm
  `prepare()`, so one text in two fonts saves about 30%, per-call matching uncosted. The maintainer found it
  interesting; parked.
- **A Firefox Thai cache** (local `thai-words`, 7f9edacc, 2026-09-24) of word boundaries per run between spaces: 10-15×
  faster on text seen before, nothing on new text (Engine Facts, Firefox). Reopens with the question of who bounds
  remembered data.
- **Truly stateless layout**, content, style and width in and lines out (the redo, 2026-09-18 to 09-20): 60 fps over
  10,000 messages allows 1.6 µs each, less than a first-time Canvas call, and a pass from scratch took 340-500 ms in
  Chrome against main's 168 ms. First sight of text is the cost and no store fixes it: a content-keyed store matched
  handles at over twice the memory and never shrank. An agent's unruled view: resize, not from-scratch cost, decides it.
  Reopens if from-scratch layout gets much cheaper (`rebuild/research/IDEMPOTENT-API.md`).
- **Eviction rules for a hidden store** (the redo): young-doubles-old turnover (a plan the maintainer had accepted)
  dropped live entries when the working set doubled in a pass; release per pass rebuilt everything when a view laid out
  only visible rows; pass ends inferred from task timing broke across tasks. Two generations turned over at an explicit
  `endPass()` stayed clean but need a shrink rule.
- **A width store per Canvas context** (the redo, 2026-09-20): 5-8% from scratch in Chrome, whose canvas answers repeats
  in 0.14 µs, while stored answers go stale after a late web font in every engine and Chrome's lookup changes string
  storage (Keeping Work Bounded, String Storage); Chrome's next gain has to come from fewer questions. Reopens for a
  stateful API with an invalidation contract, in Gecko and WebKit only (`rebuild/research/PERF-CONTEXT-STORE.md`).
- **Other API ideas**: every in-word position measured in `prepare()` (about 2.4× Blink's cold calls; maybe an idle-time
  call); no handle (prepare is about 10× a warm break pass); reused rich items (about 3 a paragraph); a JSON guard on
  handles; a public diagnostics prepare.
- **The cost model** (main then, Chrome 154, 2026-09-26): 20 live fields take 28-270 µs an event, a handle per paragraph
  of a long document 85-300 µs a keystroke, a warm short `prepare()` about 5 µs, and streaming Latin stays under 1 ms to
  about 24,000 characters. Only a 100,000-character text with no breaks is a problem (4.2 ms Latin, 14 ms CJK or Thai);
  no sharing removes cold work (first paint, a new font size, Thai in Firefox), so order it or use a worker. An app's
  Knuth-Plass breaker works over the line-filling API: a fill at width 0 under `overflow-wrap: normal` lists the
  opportunities, and a width halfway between two candidates ends the line at the chosen one (735 of 735 on the
  stand-in).

#### The Markdown Chat At Scale

- **A chunked history window** (draft #312, 2026-09-15), preparing chunks on demand: exact frames, 100k resizes under
  1.7 ms, 42 MB instead of 402, but a scrollbar over loaded chunks only that jumped at each load, which the maintainer
  tried and rejected (Part 1, Demos And The Chat). A chunk-loading frame prepares new messages (5-10 ms), so a window
  wins only above about 100 × the messages per load. Kept open as an iPhone crashes at 100k on main but not on #312;
  reopens with a correct full-history scrollbar.
- **Window heuristics** (2026-09-14): pinned end chunks, separate load and unload thresholds, far-jump swaps and
  prefetch assume jumps aren't smooth scrolls (Part 1, Engineering). Also rejected: skipping one-line blocks (the worst
  frame is narrow); spreading a resize over frames (5-8 frames of wrong scrollbar); layout in web workers (10-12 ms, but
  the most code, 1-2 GB, inexact emoji); estimated heights, lazy preparation, first-view correction, layout after the
  resize stops, scaled scroll ranges and rounded widths (pops, gaps, a bad thumb); DOM pooling (about 20 rows show).
- **A handle without segment text** (2026-09-14) saves 1-2 of about 81.5 MiB for 10k messages in Chrome, 38 of them the
  canvas's, for more code and a language-change hazard. Reopens if memory matters, canvas cache first.
- **Memory cuts at 100k** (2026-09-16, stand-in Canvas; local `chat-100k-levers` off pre-#340 main): prepared texts held
  76-79% of retained heap, and three exact cuts (lazy preferred breaks, no grapheme counts without letter spacing,
  arrays trimmed to length) took 27-28% off with identical heights and Canvas calls. Preferred breaks have since left
  main. Reopens if memory at 100k matters; measure today's handles first.
- **One analysis for rich inline**: the joined pass is about 1% of prepare and carries the per-item cursors (Rich Inline
  Boundaries), and Safari's extra calls are prefix fits WebKit needs.
- **The chat's scale** (2026-09-14 to 09-16, stand-in Canvas, before #338, #340 and #344; remeasure before relying on
  it): 46-100 µs to prepare a message the first time, 0.4-0.7 µs to lay it out, 43-59 ms median to resize 100,000, so 10
  ms fits about 13,000-15,000. A pixel position needs every height above it at the current width, so a thumb over
  unloaded history can't stay exact after a resize, and the maintainer found nothing else to skip exactly (2026-09-15).
  #286's typed-array heights won by building less per message (major-GC frames 53 → 0). The demo's 10,000 messages are
  distinct, as 44 recycled ones let a warm width cache hide the cost.

#### Simplifications Held Back

- **Walker and admission-path shapes** (Keeping Work Bounded, The Walkers' Shapes and JavaScript Engines, have them with
  numbers) each lost speed in more than one engine or added too much code; only the one-line walker's line-text cleanup
  landed (2026-09-26), and the maintainer rejected a private stepper copy as duplication for a small JIT gain
  (2026-09-25). They reopen when the full walker's cost per segment nears the counter's.
- **Removing the prefix-measurement cache**: 79% more cold Canvas calls.
- **A growing bracket, then bisection, in the line counter** (the redo): 59% faster than a global binary search at
  narrow widths, 17% slower at wide ones; one counter was kept.
- **Upstream patches for engine hot spots** (2026-09-20; `TextMetrics::Update`'s ink bounds, per-call bidi and
  itemization, the font setter): drafted, never posted; to file with the end-of-project bugs (ENGINE_FOLLOWUPS.md).

#### The Per-Engine Redo

The redo ported each engine's line breaking exactly over Canvas and fed the hybrid (#340) and the relaxed stance (Part
1, The Redo And What Counts As Done); "main" here is pre-#340 main.

- **Main's prepare speed from an exact port** (Amdahl floors, 2026-09-22): new Latin text took 5.4× main's time in
  Chrome, 2.7× in Firefox and 0.64× in Safari. Chrome's Canvas alone floored at 2.0-4.6×, mostly from the 256 px cut
  search, Firefox paid about four calls a character for advances it reads for free, and a first layout at a new width
  cost 79-220×. Reopens with other questions, or Chrome shipping `getTextClusters()`.
- **Main's design copied into the redo**, preparing everything and laying out by arithmetic, got worse: the port's
  answers depend on where lines end, so each width asks 1,000-4,000 new questions per 120 messages, where main assumes
  widths add up. Reopens with a Canvas call giving every position of a run.
- **Words first, landed under named gaps** (2026-09-23 to 09-25), relaxing the no-loss rule: +2,780 / −28 line counts
  over 23.2 million stress layouts, each loss one font at unusual settings, none on 751,000 real-text layouts, and
  1.3-1.7× faster; main still prepared and counted 4-15× faster.
- **Rejected inside the redo**: Chrome words first split between CJK characters (failed all-fonts); summing CJK in
  Firefox (no line moved, 36-76% more Japanese calls); font checks once per page (stale after a late web font); Firefox
  contexts shared across paragraphs (late family names); the Gecko lazy plain scan (6-7% for the most intricate code,
  and a hole at 22 of 901 widths); clamping joined-letter positions that run backwards (fixed none of 10); words-first
  window and Euphemia variants (local `bwf-fix-alt-vz2`, `-vz3`, `-vz5`, `bwfl-eu`); rules by lab score or font name
  (removal cost 559 Chrome line counts, won back with explicit facts); per-font tables; a compiled ligature grammar
  (56-74% slower).
- **Owned rendering**, painting fixed fragments instead of browser-laid lines, was rejected before timing: narrow Latin
  and Arabic words overflow and valid rich style boundaries were refused. Reopens only with a probe that first
  establishes the required behavior.
- **Core Text in JavaScript**, the maintainer's first idea for the redo (2026-09-16), needs font bytes a page lacks for
  `16px -apple-system`, and Safari's Canvas already runs Core Text. HarfBuzz in WASM over the app's web fonts reached
  about 13.4% of old-suite rows and needs a 162 KB custom build, fonts loaded first and system fallback; the maintainer
  ruled it out (Part 1, Lines Drawn), and HarfBuzz and `text-shaper` probes didn't reproduce browsers. Reopens if pages
  can read system font bytes.
- **Firefox's skin-tone widths through the DOM** (2026-09-26): unneeded, as the Canvas corrections missed only a
  modifier right after a letter.
- **What the redo taught main** (2026-09-18 to 09-20, Chrome 153): keep one long-lived context and one font answer per
  font (per-paragraph contexts were 43% of Chrome's from-scratch time, and WebKit resolves the font per new context); a
  string memo used as data flow hid which calls were needed and caused the string-storage bug; 15-50% of calls decided
  no line, so diagnostics run on request. Canvas gives totals while Blink breaks inside shaped runs, so Chrome is the
  slow engine for a Canvas port (about 320 questions a message, WebKit 41).

#### Test And Harness Designs

- **The old wrapping suite**, replaced wholesale (#341; removed 2026-09-25): harness/README.md, "Why the old suite
  went", has why.
- **Scoring the hyphen drawn at a soft-hyphen break** from painted boxes found 93-358 mismatches per browser, left to
  `layout.test.ts`; system fonts served as web fonts changed Safari's results (no date or numbers kept). Reopens with a
  way to see the drawn hyphen (harness/README.md, Bounds and blind spots).
- **Old-suite proposals the new pass rule made moot** (2026-09-17): not counting rows main already failed as lost, and
  recording line placement for the grid and corpora.
  <!-- Q14 placeholder: whether `bun harness repin` samples before recording everything; if sampling is tried and rejected, its entry goes here -->

### Evaluation Traps

Ways evaluations fooled capable agents here, each with the case that showed it; most left a rule the harness enforces.

#### Counting And Attribution

- **A matching line count isn't matching lines** (Reading Browser Output), and a pass can be two errors cancelling:
  rules whose errors cancel land together.
- **Attributing lost rows.** Checking main only at the first break a branch misses overcounted true losses tenfold:
  check all of main's line starts, mapped through white-space normalization. One library's fresh set triples differed
  by up to 9.8 failures per 10,000, so rerun the old library on new cases before calling a small drop. Frozen references
  go stale silently (351 Chrome predictions, from an intended swap of two checks): bisect first.
- **An oracle can copy the library's mistake.** The old harness made a newline beside a ZWSP a space, as Pretext did
  and Chrome and Firefox don't, so the fix read as 12 losses per direction; 106 Firefox rows likewise, at newlines
  between East Asian characters. Check the oracle's normalization first.
- **Passing the oracle isn't enough.** The cleanest of three keep-all versions passed every oracle case and failed
  `foo。bar日本語` under the Safari profile; a 29-line partial rule matched every suite row and got three shapes wrong by
  Firefox's source. Test the behavior class under every profile with an attack set, claim only "no measured loss", and
  probe what the source predicts.
- **Fast paths differ where the corpus is thin.** Three mutants of one compound condition passed its owner's tests, and
  a seeded adversarial generator's first run caught a wrong Gecko word-scan condition. Gate one with seeded adversarial
  cases, a checked mode that throws where the two paths differ, and a mutant per condition. An incremental path must
  equal the from-scratch one: text split at forced breaks against the whole found #269-#272 (harness/invariants.ts has
  the other self-checks).

#### Gaps, Warnings And Held-Out Sets

- **A cause that fires almost everywhere explains nothing.** A Firefox flag in the redo's ledgers fired on 91-96% of
  cases, passes included; gaps reported per paragraph hid 84 real bugs. A cause explains a failure only where it touches
  the differing text (lift, its share of failing lines over its share of passing ones, below 2 locates nothing), and a
  gap is reported at the offset that decided the line. Narrowing gaps moved errors into claimed values (2,030 passes
  held wrong "exact" values); widening them meets "every failure carries a named gap". Any confidence or warning API
  inherits this.
- **Page history passes for causes and for passes.** Firefox's `page-history` label named 0 of 220 history-dependent
  cases in forward order and 220 in reverse, and unstable cases frozen as passes become false regressions
  (harness/README.md, Accepted and varying lists; Engine Facts, Safari).
- **Held-out sets often aren't.** The emulation study's reused its development fonts and corpora and set Chrome after
  seeing its misses; the redo's came from families it was tuned on, and its generator pools ran dry while the log said
  nothing was reused. Seal one before tuning and open it once, since a look makes it development; draw fresh sets from
  new generators each round (four cheap ones, 10,319 cases, found two classes 80,000 reused cases hadn't); report
  accuracy per kind of case, since easy generated kinds flattered pooled numbers.
- **"No font facts" runs still had inputs**: the exact build, its languages, a facts table from lab tooling on the same
  Mac. Without them about 10% of values are claimed as predicted, so exact-value regressions show only as more limited
  values, unseen by a ledger with no "passes with a wrong predicted value" status (planted ones moved no pass to fail).
- **Real text in default CSS isn't real use.** The redo audit's first cuts lost nothing on real-text sets yet broke
  lines under soft hyphens, `break-all`, `overflow-wrap` and Windows-only font lists (`Meiryo` alone, 988 wrong). The
  sets missed served web fonts (88% of mobile pages), Android and Windows, user-written chat and app settings, hence the
  weighted sample (harness/README.md, Two kinds of set), which still has no tabs or blank lines. Books lack URLs,
  numbers, emoji sequences, NBSPs and discretionary breaks.

#### Tests And Gates

- **Tests blind to the path apps run.** A lab that always inspects never runs the plain path: a planted fit change on
  plain paragraphs passed offline replay, blind to alignment too, on 134,130 Chrome cases and the usual browser tier.
  A test that restates the rule or reimplements the algorithm checks nothing (March's `bun test` ran a simplified
  copy), `skipIf` on files outside the repo passes silently, `bun test` runs only the Blink profile, and walkers written
  apart drift unless a test makes them agree.
- **Planted defects found harness false greens**: a negative or null width hid an omitted glyph, identical missing rect
  lists certified all six jobs, and a run missing expected cases, even an empty one, passed. So geometry and the
  observer's population are validated before scoring, net gains never offset a loss, and unobserved never passes.
- **Evaluators certifying their own runs.** One replaced the saved results with its own and skipped the environment
  check, locking real losses into the baseline; another committed baselines before review. New results are staged and
  adopted after an independent check. Canonicalize diagnostic output before freezing it: two good fixes were reverted
  because 4 of 67,065 rows regrouped.
- **A case whose page layout contradicts its declaration counts neither way**: of 22 found, 8 passed by accident (floats
  wider than the block). Thresholds come from the browser's unwrapped geometry, never from the library under test.
- **Catalog growth leaks**: every family keeps a case, so a variant per family passes the dedupe, whose classes are
  coarser than behavior, and nothing old drops out (harness/README.md, How cases grow, has #366's numbers and the rule).
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Main's "facts" can be inherited opinions**: of 159,163 Chrome "visible pass" labels pre-#340 main carried, 678 were
  refuted and 842 inconclusive. Triage its passes by observation alone, as facts, accidents or opinions: admit browser
  behavior, never main's code. Its unit tests still hold facts the redo's lab never saw
  (`rebuild/research/MAIN-FACTS-ANALYSIS.md`).
- **A README claim checked offline only** (2026-09-26): splitting pre-wrap text at `\n`, each empty paragraph a line,
  matched a stand-in Canvas on 588 of 592 cases and failed about 190 of 10,087 browser comparisons (a form feed before a
  line feed, the empty text, Chrome's CJK closing marks); splitting after each `\n` (#362) matched 10,083-10,087.
- **Finding repeated work.** Reading finds call sites, not how often each fires, and two predictions from reading were
  wrong; a per-call-site tally from stack traces over a deterministic replay ranked the repeats (the redo, 2026-09-18).
  Then one fresh-eyes read of the library against engineering.md reports complexity, before profiling adds some back.

#### Agents' Reports

- **Check an agent's account of its rule-keeping against its logs.** In the redo one broke a foreground rule under an
  exception it granted itself and its report denied it; one said nothing ran while its watchdog did; a pre-push scrub
  for local paths only let private material reach a public branch; subagents re-ran a failed browser job before
  diagnosing it. Reports overclaim ("cold within 1.5-3× of main" where a measured point was 149×; "every gate at exit 0"
  where one exited 3): a critic checks every number against its source before it becomes a reference, and reviewers
  can be surer than their evidence.
- **Credit and voice.** #321's decision 8 (Chrome's Chinese line table), an agent's recommendation, was written up as
  accepted though never answered. A message in an agent thread may come from another agent, and an agent's doc can put
  its own line in the maintainer's mouth (Part 1, Docs). A "30% floor" of free memory was 2-3% by the watchdog log.
- **Terse acknowledgements are ambiguous.** A one-letter reply approving the chat's painter for rich-note was relayed as
  choosing the old painter, which became bug #296: confirm what a short reply approves. Re-verify a recorded
  prerequisite before planning around it: Firefox's styled-piece breaks needed one engine setting, not the model of its
  segmentation ENGINE_FOLLOWUPS.md named.
- **Answering before a sweep has targeted the question** (2026-09-18): asked whether Firefox's `<canvas>` element was
  "roughly the last architectural blocker" for `system-ui` (the maintainer's words), the answer rested on rows seen so
  far; its style-flush and memory costs surfaced only under targeted probes (Dead Ends, DOM And Canvas-Element Paths).

#### Timing

`bun harness bench` builds these in (harness/README.md, Bench); the numbers are why.

- **A loaded machine was wrong by up to 50 times** (the redo, 2026-09-18 to 09-22): webkit-host took 11.7 s for 10,000
  messages loaded against 0.235 s quiet, and pre-#340 main's Chrome cold prepare, quoted for a day as 0.72 s against
  0.31-0.37 s, made the redo look 1.5-3× main instead of about 13×. A browser lock isn't a quiet machine (a fixed
  arithmetic probe ran 60.7 ms before one run, 29.1 ms after): record the load, and take loaded runs as upper bounds.
- **Same-document ratios** survive machine-wide slowdowns: sessions drifted 5-19% apart (2026-09-25), and timed apart,
  Safari's hybrid read 0.6, 0.3 and 0.7× main for a real 0.82, 0.52 and 0.99× (2026-09-23/24). In a fixed order a
  variant inherited the leftover work of the one before (18.7× for a real 13.4×), hence the shuffle; 5 ms samples
  inflated Chrome's replay floors 40-75% and let 55-160 ms GC pauses decide medians, hence samples of at least 20 ms.
- **Focus.** Using the Mac failed all six Safari attempts; light concurrent work, or the bench window opening on
  another screen, moved Safari's `prepare()` 1-2 ms of 11. An app's embedded Chromium pane isn't installed Chrome, and
  its numbers count for nothing.
- **Headless Chrome isn't installed Chrome.** With `deviceScaleFactor: 2` it most likely lays out at zoom 1 while
  reporting DPR 2, as its measurements show, and headless Chrome 153 crashed or hung on one input installed Chrome
  handled (reported privately; Part 1, Merge Bars And Landing).

#### Checking Demos

What worked (2026-09-14 to 09-17): main and the branch from `git archive` in one browser session with one probe; headed
installed browsers at DPR 2 with both scrollbar kinds; painted width within about 0.5 px of the model; width sweeps at
breakpoint edges and in sub-pixel steps; stateful sequences over snapshots; a stand-in-Canvas "screen" diffed byte for
byte to prove a refactor changes nothing. To check code against a spec, make each rule a yes-or-no question about one
place in the code, answered by the smallest runtime observation (a per-frame read and write log matching
`^R*W*S?R?$`). Viewport emulation can hide a one-frame lag; resize a real window or iframe.

## Part 3: Decisions Log

Decisions the maintainer made or accepted whose reasons the code doesn't show, by date; code comments that cite this
log mark where one applies. Before reversing one, check whether its reason still holds and record the new decision here
with its date; an entry that replaces another says so and keeps its reason.

- **2026-09-12: reported widths are never negative.** A line's advance can be: Safari 26.5.2 measures a word with its
  following space, which can kern, so a line of only an invisible character and that space summed to about −1px, and
  main reported −9 for `iii` at letter spacing −5. Nothing visible is there, so reported widths clamp at 0 (#236) while
  line breaking keeps the signed advance. A negative `maxWidth`, which CSS never produces, lays out as 0 (#272).
- **2026-09-12: cursors never split a grapheme, even where Safari's lines do.** In a box too narrow for a word, Safari
  can end a line inside a multi-code-point grapheme, as WebKit steps an overflowing word by code point on its simple
  font path (Safari 26.5.2 and WebKit's source; unchecked on 27). Pretext keeps graphemes whole, as its API promises;
  the maintainer accepted the mismatch on condition that it's written down where it can be traced.
- **2026-09-13: no per-segment bidi levels.** `segLevels`, one level per segment from a simplified resolver, could
  never give visual order and had gone unread since 2026-03-04 (Bidi Levels, #258). The maintainer let it go as long as
  nothing Pretext means to render, such as mixed bidi, needs it back: mixed-direction text breaks right in logical
  order, and only painting a line without its paragraph's bidi context goes wrong.
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **2026-09-16: the WebKit profile follows Safari 27 only.** Safari 26, on macOS and iOS 26, breaks differently around
  curly quotes, guillemets, keep-all punctuation, U+2028 and U+2029, and an overflowing first character; following 27
  cost it about 2,900 left-to-right and 1,150 right-to-left line counts, mostly at widths narrower than one character
  (old suite, removed 2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered --> A profile can't
  tell the two apart: only Safari's own user agent names a version, not the other WebKit browsers on iPhone and iPad.
- **2026-09-18: Firefox measures on an OffscreenCanvas, as the other engines do.** A `<canvas>` element's context would
  get `system-ui` and optical-size variable fonts right, but forces style updates once a page inserts a CSS rule, and
  workers have none (Dead Ends, DOM And Canvas-Element Paths). On 2026-09-19 the maintainer allowed it only if it proved
  light and worked in workers, which it didn't. If ever taken, Firefox switches wholly, not only for `system-ui`.
- **2026-09-23: each engine's own tables and scans find break opportunities**, in place of Pretext's rules and the UAX
  #14 table. The maintainer accepted the bundle growth, about 30 KB gzipped then, for much faster analysis, and left for
  the end of the project whether the tables could shrink or give way to cheap computation (closed 2026-09-26, below).
- **2026-09-23: premises nobody has falsified may be taken for speed.** The maintainer relaxed the correctness-first
  stance of the rebuild's start: as a last resort, ad hoc heuristics go first, then requirements no real text exercises
  (Part 1, The Correctness Stance). Examples: text with invisible characters stays on the simple walkers, within 10⁻⁹px
  of the full walker's widths, and Firefox's script-run splits below.
- **2026-09-23: the Blink scan uses Chromium's Chinese line table**, `line_normal_cj.brk`, on `zh` pages and on pages
  without a language under a Chinese UI, as Chrome does (Content Language And Fonts has what it changes). #321's
  decision 8 advised recording the gap instead; the hybrid kept the table as the assistant's default, 46 cases for
  8.6 KB gzipped and 16 lines (Chrome 153). Never answered on its own, it's covered by the maintainer's acceptance of
  the tables' bundle that day.
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **2026-09-23: a new harness replaces the old suite, and what must not regress is decided afresh**, since main's tests
  were old: the engine tables (#340), the harness (#341), then the suite's removal (#348) (harness/README.md, "Why the
  old suite went").
- **2026-09-24: no must-pass tier.** Every repeatable case is pinned alike, so a hard trade-off in the heuristics is
  marked case by case on the accepted list, not forbidden by a tier.
- **2026-09-24: the Gecko scan doesn't split text runs where the script changes**, as Firefox's script itemizer does.
  Rejected on 2026-09-16 for parity, it was approved under the relaxed stance: only mixed-script fuzz strings with a
  stray mark moved, no old-suite or corpus text (Dead Ends, Rules Per Input Shape).
- **2026-09-24: there is no `glue` kind.** Runs of only no-break characters (NBSP, U+2007, U+202F, word joiner, U+FEFF)
  are text and take emergency breaks where browsers do; the scans already decide their breaks, so the kind was only a
  label, unlike zero-width glue (Break Opportunities From Engine Data). It lost two old-suite Chrome cases in Courier
  New at letter spacing 1, as Chrome paints no letter-spacing gap after U+202F (ENGINE_FOLLOWUPS.md).
  <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **2026-09-24: Pretext finds grapheme clusters itself, fixed to Unicode 17**, from Chrome 153's and libicucore 78.1's
  ICU character rules, which Firefox 156's ICU4X data matches, not `Intl.Segmenter`, whose graphemes were the largest
  part of preparing new text in Chrome and Safari. The rules don't follow a browser to another Unicode version, so
  they're refreshed with the line tables when browsers move to Unicode 18 (Grapheme Clusters From Engine Data).
- **2026-09-24: Safari's generic families come from a generated Core Text table**, not a `<canvas>` element, whose
  context forces style updates and follows the page language only when attached (Dead Ends, DOM And Canvas-Element
  Paths; PLATFORM_BUGS.md), which the maintainer rejected as DOM access on 2026-09-12.
- **2026-09-24: the full walker got engineering, not heuristics**: data layout, fewer allocations, smaller
  representations and plain indexed code, as the maintainer asked, not new shortcuts. It still costs three to five
  times the counter per segment, so one walker for all text was rejected (Keeping Work Bounded).
- **2026-09-25: a prepared handle needn't survive a JSON round trip.** Its per-segment flags are a `Uint8Array`, which
  `JSON.stringify()` turns into an object without a `length`, so the line walkers never finish on a JSON copy;
  `structuredClone()` and `postMessage()` copies work, and README calls the handle opaque. Cursors and ranges are plain
  JSON and resume the same from a copy.
- **2026-09-25: the old wrapping suite, its snapshots, its diagnostic tools and the benchmark page are gone**; accuracy
  and speed claims rest where AGENTS.md says. The benchmark page went once the bench's floors called a known change
  (harness/README.md, Bench), and what the harness took from the old suite stays frozen, since its generator went too.
- **2026-09-25: the npm package doesn't ship the demos (#342)**; README sends agents to the repo's. Shipping them
  runnable took the tarball from 238 kB to 620 kB, needed a Bun-only server script and shipped again content whose
  licenses aren't recorded; that version is parked as closed PR #343, in case this changes.
- **2026-09-26: `setLocale()` sets the language again** (#356), the one preparation reads in place of `<html lang>` for
  its break rules and measurement context, and still clears the caches: only so can a worker, which has no
  `<html lang>`, get the page's language. An empty locale is a page's without a language, and a call with none reads
  `<html lang>` again. Contexts with a `lang`, in Chrome and Firefox, take it too; `bun harness equal` moved no case.
  This replaces the 2026-09-24 decision to have it only clear the caches, taken because no locale changes the Thai,
  Lao, Khmer and Myanmar word boundaries Pretext reads (20 locales, V8 and JavaScriptCore). An element's own `lang`
  waits for the end of the project.
- **2026-09-26: engines Pretext doesn't recognize take Blink's whole profile** (#356), as the docs already said, and are
  owed what Part 1, Lines Drawn, says. Only unrecognized user agents moved, such as Samsung TV web views.
- **2026-09-26: cater to the worst case, and allow it a slight regression for a real gain**, replacing the assistant's
  stricter reading that day, that the worst case can't get worse (Part 1, Engineering, has the maintainer's words). 26%
  isn't slight, so the width memo stays parked (Dead Ends, Caching, State And API Designs).
- **2026-09-26: no dead code for one JIT.** Dead or redundant code kept only because one JIT runs it faster is removed,
  whatever the regression, which is noted: code written plainly wouldn't reproduce the effect (Engineering). A loop's
  first pass peeled before the loop counts, since the loop repeats it. Live code split apart or placed for a JIT isn't
  dead and stays, such as `getLongMarkChainContext()` (#351) and `getTextSegmentWidth()` (#358). Removing what #357 had
  kept costs Chrome 154 up to 13% (Keeping Work Bounded); removing `countPreparedLines()`'s leading-space skip, a loop
  that never runs, kept on 2026-09-24 for Firefox, costs Firefox 156 3 to 7% on resizing Latin chat messages to new
  widths (#364). Nor is a rule written out twice for one JIT: the Gecko scan's two text-run setups share one word-end
  test, whose call makes Firefox 156 prepare four kinds of row 2 to 5% slower than two copies would (#365; Bidi Levels
  has the rows). The maintainer took that as a good trade on 2026-09-27.
- **2026-09-26: one bundle serves every engine.** An app can't import a bundle made for one browser, since its users run
  them all, and fetching one engine's tables at runtime would make the first `prepare()` asynchronous, so every browser
  downloads every engine's tables.
- **2026-09-26: the break tables stay as they are**, closing the check the 2026-09-23 entry left for the end. The one
  alternative the maintainer would weigh, Firefox's line data in Chrome's format if it wasn't a maintenance burden,
  wasn't worth it (Dead Ends, Tables, Bundles And Data). It reopens only if table size and per-engine bundles both
  return.
- **2026-09-27: the Gecko profile keeps its 80px floor for prefix fits, as a premise.** Prefixes model Firefox's
  whole-word advances better than standalone graphemes, and the floor has no browser reason, but a lower floor fixed
  adversarial cases at 24-80px while making Firefox prepare new Latin, Arabic and mixed text much slower, and lost the
  one real-usage draw that moves. Words narrower than 80px keep summing standalone graphemes where lines narrower than
  80px split them (Break Opportunities From Engine Data has the numbers).
