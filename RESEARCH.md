# Research Log

Why Pretext is the way it is. Part 1 is the intent: the lines drawn, the merge bars and the stances behind them.
Part 2 is the evidence: measured facts, traps and dead ends, each with its browser build, its date and what would
reopen it. Part 3 is the Decisions Log. Quoted text is the maintainer's exact words, typos kept, dated in Pacific
time; the rest is the project's wording. "Pre-#340 main" is 6d1d2106, before the engine ports; "the hybrid" is main
since #340; "the redo" is the per-engine rebuild on branch `rebuild-20260916`.
<!-- Q2: recommendation taken; the maintainer hasn't answered -->

## Part 1: Intent

<!-- Q1: recommendation taken; the maintainer hasn't answered -->

### Why The Intent Is Written Down

The maintainer skims fixes that stay inside the lines drawn and trusts the agent's judgement there, so the lines are
written down. A reason the code doesn't show gets reverted by the next agent who doesn't know it, so it goes in a
comment at the code site, a written reason on the accepted list, or the Decisions Log. Each entry below is the
statement that stands, and says what it replaced.

### What Pretext Is For

- **Measurements out, without the DOM.** `thoughts.md` gives the maintainer's reasons.
- **The browser paints; the rest is open.** The maintainer (2026-09-15): "The only real requirement for pretext is
  that it reuses DOM font rendering. The rest is free-for-all".
- **Many `prepare()` calls.** The maintainer (2026-09-12): "the major use-case of pretext isn't in its flashy demos,
  but in measuring text so that text can unblock userland js layout measurement. Notably, virtualization of lots of
  rows". So preparing new text counts as much as `layout()`, and cost is judged per text box times the boxes on a
  page, CJK-heavy pages included.
- **The browser's own lines.** Correct means each browser's breaks, line count and widths, not an ideal of Pretext's
  own such as balanced lines. Copying them sizes text the browser wraps itself, such as a textarea, ahead of time, and
  makes owning layout nearly free.
- **Exact heights.** Find an exact fast method before a clever lossy one that callers then patch: the range APIs came
  from finding that the cost was garbage collection and string allocation.
- **No batching again.** The maintainer (2026-09-18): "the whole point of pretext is to avoid dom read/write
  interleaving from expensive dom measurement of text", so no API should bring batching back, though it isn't a hard
  rule. Callers get the lines to lay out themselves, not just a height.

### Lines Drawn

Inside these, fixes land on judgement; outside them, ask the maintainer first.

- **No DOM.** `prepare()` and `layout()` read no DOM or computed style and force no style or layout: a style recalc
  triggers reflow, which defeats the purpose. A fix that needs it is presented as rejected and the browser's limit
  documented. AGENTS.md lists the exceptions; the emoji span is read once per font, never per text box.
- **Canvas widths only.** No font files, the app's own included, no glyph pixels, language detection or font loading:
  the input is a font declaration. Per-font facts an app would supply stay explorations, and font information enters
  only as general facts baked in, as a last resort. Only APIs all three browsers have.
- **No observers.** Reading `<html dir>` in every `prepare()` was dropped as hidden state that goes stale, which argues
  against reading `devicePixelRatio` in `layout()` too. Content language comes from the page, provided `prepare()` and
  `layout()` do nothing new and expensive in the browser without careful thought.
- **Browsers.** The major engines and their mainstream variants, Edge as Blink; a fringe browser gets a rule only when
  the fix is extremely cheap and shared. A modeled engine is never refused or shown nothing: detect the engine, not the
  brand. Unrecognized engines take Blink's profile, and runtimes such as React Native need only no crash and nothing
  catastrophically worse than pre-#340 main. Firefox ESR, old browsers and quirks mode get nothing that costs
  complexity; Windows is untested; the WebKit profile follows Safari 27 only (Decisions Log).
- **Where fixes stop.** Keep fixing common app text (Latin, CJK, Arabic, Hebrew, emoji, chat punctuation, URLs), rich
  inline, the documented CSS and the major browsers; rare Unicode, such as NEL or controls, only when cheap and
  lossless. Document rather than chase browser bugs, effects Canvas can't see and shapes only fuzzing makes. Speed may
  regress a bit for a fix that matters. Accuracy under 80 px counts for little, and a behaviour narrower than 24 px
  that the library doesn't model may be accepted as narrower than real layouts.
- **Out of scope, punted or parked.** Server-side measurement and other backends, such as React Native's. Mixed font
  sizes in a paragraph: Pretext gives widths and breaks, not line heights. `hyphens: auto` and `overflow-wrap: normal`
  (hyphenation stays on TODO.md as a possible feature). A `fontKerning` option: README assumes default kerning.
  `system-ui` (issue #336 says what support would take). Source offsets (#90) and carets (#198) for editing.
  <!-- Q4: recommendation taken; the maintainer hasn't answered --> <!-- Q4 note: README drops "soon" before "server-side" -->
  <!-- Q3: recommendation taken for hyphens; the maintainer hasn't answered -->
- **Userland.** Stricter editorial whole-word handling, never a changed default: an overlong word breaks at grapheme
  boundaries, as `overflow-wrap: break-word` does. Scroll anchoring and overscan. The rich-inline API stays public, and
  an engine swap keeps every demo's result possible, not necessarily through the same APIs.
  <!-- Q3: recommendation taken for whole-word handling; the maintainer hasn't answered -->
- **Closed PRs.** Those closed against these lines (2026-09-12) include rem and em sizes (#109, a computed-style read)
  and a localhost-only `bun start` (#114: it binds the LAN on purpose, so phones reach the demos).

### The Correctness Stance

**The standing statement (2026-09-23).** A premise nobody has falsified in real fonts may be taken for speed, as a
documented default with a named gap. As a last resort correctness gives way: ad hoc rules go first, then petty
requirements no real text exercises, with their cost stated. CJK stays well supported. The maintainer: "Heck we might
need to strip even more from the correctness as a last perf resort (ad hoc stuff go away first)" and "we do try to
support cjk well at the very least". It replaced three earlier statements: fix measurement errors before optimizing
(2026-03-03), correctness first in the rebuild (2026-09-16), and don't be religious about correctness (2026-09-18).
Not optimizing prematurely, and taking the rebuild's facts back to main, still stand.

- **"Fixing a mismatch"** in AGENTS.md is the method. Its reasons: rules come from engine source and facts from
  browsers, none chosen by a score or keyed on names; an insight that generalizes beats special-casing a browser; no
  shortcut that makes an early version look good may erode its structure later. It replaced the maintainer's own line
  against monkey-patching (2026-04-15), which they deleted in #363; its second point carries that intent.
- **The redo as north star.** After the hybrid, the maintainer (2026-09-26) asked for guidelines "so that we don't veer
  too much back into old main's heuristics territories", with the redo as "a north star on how to correctly fix things
  and how to approximate them principally". Main interpolates between pre-#340 main and the redo, and never
  extrapolates past them.
- **No tolerances.** A gap between Canvas and the DOM is handled on purpose or named, never hidden in a tolerance: each
  engine's fit arithmetic is exact in its own units. Main's 0.005 px `lineFitEpsilon` in the Blink and Gecko profiles
  is an open gap (ENGINE_FOLLOWUPS.md).
- **Per-engine rules.** A rule traced in an engine's source may be on for one profile and off for another only when the
  off engine's losses are attributed to a named missing model, with the off value explicit in the profile.
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Replacing main** meant no loss on triaged objective facts and every use case main's API serves, not every case main
  passed, which would copy its accidents (2026-09-17). The maintainer merged the hybrid as "roughly a superset of main
  barring edge-casey tests" (2026-09-23), and that's the bar for any later swap. Where the older design is faster
  covering the same things, it did something right: take that back unless it doesn't fit.
- **Sums.** Summing words must not become pre-#340 main's road, a sum patched with corrections tuned until tests pass:
  sum only where that provably equals the engine's answer, with the exact port as fallback and judge.
- **Assumptions.** Hunt your own and test them: the biggest early Safari win came from dropping one, that an emoji's
  DOM width equals the font size. Corrections are measured from the running browser, never hard-coded. A proof that a
  fix is impossible under the current model is a definitive answer.

### The Redo And What Counts As Done

The per-engine rebuild, "the redo" (`rebuild/` on branch `rebuild-20260916`), is an unshipped, correctness-first
reference for plain text: one port per engine, with Canvas `measureText` its only measurement. The maintainer closed it
on 2026-09-26, with upkeep only: re-pin, sync main, adopt browser APIs that can replace a Canvas measurement. They asked
twice for its philosophy to be written down; the full text is `rebuild/README.md`, "Lines drawn" (1f380af7). In short:
- Correctness comes ahead of speed and simplicity.
- No right line is traded away silently: every lost line is traced and classed before a change is accepted. Losses
  aren't banned outright. Some can't be seen from Canvas: Zapfino's shaping data moves Chrome's breaks without moving
  any width, a named limitation with no code keyed on the font. And main gets some lines right only by rounding luck,
  which aren't losses to chase. A remaining difference is allowed only when explained and named.
- It stops when every remaining difference is a named gap with a cause, a made-up or variation-extreme font, or
  narrower than 24 px, with none unexplained; when it's a superset of main in all three engines; and when the speed
  recipes end with Blink's words first and the cut predictor.
- A speed premise holds only where no installed font, at any settings CSS can ask for, breaks it in the pinned
  browser. Where one does, the premise is bounded, by zoomed size, a font property Canvas can check or the text a source
  shows it failing on, and the exact recipe runs there. No gap is keyed on a font's name.
- Correctness first, not completionism: what would need the DOM or a new feature is a named exception, not a goal.
- Plain text only. Rich inline done correctly, with kerning between sibling spans, is "a big quest for another time"
  (the maintainer, 2026-09-26).

Where the redo gets a plain-text case right, main ports its rule ("Fixing a mismatch").
<!-- Q11 placeholder: four rebuild documents quote paraphrases as the maintainer's words. This summary quotes only
principles.md, so their answer changes nothing here. -->

### Tests And Losses

- **A lost pass may be an accident or a bad test.** The maintainer (2026-09-12): "whenever things regress we don't just
  go "regress is bad" but instead we check whether we've been overly inclusive of bad tests/accidents in the past." It
  came from #210, whose fix was blocked by passes that were wrong tests. A lost case is a true loss, an accident (two
  errors that cancelled) or a wrong test or oracle; the last two are accepted with the evidence written up, and true
  losses are the maintainer's call. #210 gained 1,814 results and lost 106, each traced to an existing mismatch (old
  suite, removed 2026-09-25).
  <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **A pass rate means little without the importance of its cases**: easy cases can drown out hard ones. So the harness
  has two kinds of set: a use-weighted real-usage sample (how often does a user see a wrong line?) and a generated
  behaviour catalog, deduplicated by browser behaviour (which behaviours do we model?). Broad generated combinations are
  fine while they're fast.
- **What mustn't regress was decided afresh** when the old harness went (#341, #348). There's no must-pass tier
  (Decisions Log, 2026-09-24). The gate protects the new engine's passes, not main's accidental ones, and CJK failures
  block like any other. Failures are recorded too, so a rewrite that quietly moves an out-of-scope result shows up.
- **Cases grow** by behaviour, not by repro, under the rules in harness/README.md, "How cases grow", without piling up
  into pre-#340 main's repro per bug. A repro's exact string may drop out when the sets are made again, since the sets
  are probabilistic. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **"No change"** for a cleanup means no change by every tool (`bun harness equal main` and its offline replay, `check`,
  `gate`, the invariants, the bench's floors), running old and new on the same inputs rather than arguing from reading.
  Exhaustive replays suit typography, where bugs sit in combinations nobody can list.
- **The browsers will have moved** each time the maintainer comes back, so repin before trusting any check. Don't redo
  expensive recordings only to confirm nothing changed: sample first (said of the redo's scans).
  <!-- Q14 placeholder: whether main's `bun harness repin` samples first. The answer goes here and in harness/README.md
  "Browsers and pins". -->
- Behaviour is checked in installed browsers; headless replays are hypotheses. Every README claim is true of the
  algorithm and confirmed in real browsers.

### Engineering

- **Tiny.** Remove, by ablation, complexity and state that cost no accuracy or speed, and don't overbuild. Complexity
  is what's kept down, with line count its usual proxy (2026-09-15); bundle bytes aren't tight, but aren't saved with
  hacks either. Per-engine code that barely interacts counts for less than its lines, and while correctness is still
  being established, line count waits (said of the redo, 2026-09-18).
  <!-- Q15: recommendation taken; the maintainer hasn't answered -->
- **Simplifications.** One with the same results is exactly what's wanted. After an architecture change, remove the
  logic it made redundant, saying what now gives the same answer. A simplification changes no observable behaviour and
  adds no optimization machinery; removing public API or changing line breaks goes to the maintainer. A small deletion
  that loses coverage becomes a PR opened and closed at once, for the history (#343). Dead code is deleted, never
  silenced; no stale scripts or temporary tooling; rules against a class of bug stay light.
- **Order of work.** Correctness with tests that signal real regressions, then simpler data structures and flow, then
  profiling and optimization, the API last. Engineering (data layout, typed arrays, no allocation) comes before
  algorithms. Engine work is picked by demand, not by sweeping ENGINE_FOLLOWUPS.md. Bound a design's best case before
  investing further: the Amdahl bound of 2026-09-22 showed the redo couldn't match main at preparing new text in Chrome
  or Firefox, which led to the hybrid (Dead Ends). Speed work has no fixed stop threshold.
- **Plain code.** Plain objects with fixed shapes, not classes. The maintainer prefers indexed `for` loops to
  `for...of`, `.forEach` and allocating `.map` chains in new code. Their principles are `docs/engineering.md` and
  `ui.md` in their `vibescript` repository: data first, one source of truth, per-browser differences in one place, no
  caches unless measured, no defensive code. Their AGENTS.md line asking for a pass over all the files after each
  feature, for simplifications but no change for its own sake (2026-04-15), went out on 2026-09-05 with no reason
  recorded, and returns as one line. <!-- Q17: recommendation taken; the maintainer hasn't answered -->
- **Worst case.** Cater to it over the common path, meaning compute per frame, not only GC pauses, and prefer changes
  that improve it for every input over tuning to a guessed distribution. The maintainer (2026-09-26): "I think we've
  gained enough perf that regressing worst-case a slight bit can be accepted; the general advice is more that we should
  cater to worst-case, not that worst-case can't regress ever." And of one proposal: "yeah 26% is a bit intense." That
  replaced the assistant's rule of the same day that the worst case can't get worse. Layout stays on the main thread,
  with workers a last resort.
- **JIT tuning**, in every change. The soft line (2026-09-25): don't optimize against JIT behaviour that depends on the
  browser, its version or the machine. The hard line, the maintainer (2026-09-26): "we're not gonna cater to JIT magic
  like that, that'd be my line. Keeping dead code to please JIT is something accidental and not reproducible if we wrote
  the code clean". Such code goes whatever the regression, with its cost noted; that reversed the 2026-09-24 decision to
  keep `countPreparedLines()`'s leading-space skip (#364). No duplicated code for a small JIT gain; a small split of
  live code is fine if it reads as ordinary code and a comment says why. Report a speed fix's cost in lines beside its
  gain, and what a percentage is of.
- **The precedent**, #365 (2026-09-27): Firefox's bidi guard made Firefox 156.0.1 prepare 15-32% faster on the
  right-to-left rows and a few left-to-right rows a few percent slower, from one shared helper its JIT doesn't inline.
  Writing the rule out twice read within noise, so the helper stayed, and the maintainer called it a good trade.

### Caching And API Design

- **Caching is a cost.** The maintainer (2026-09-18): "Caching sucks and main pretext reached for it in the form of
  prepare + layout out of lack of choice back then" and "The best-case scenario is that we don't need it (this'd be a
  huge userland unlock)." Invisible acceleration that can't go stale or leak is welcome; handles the app must carry
  hurt, worst when one text needs a prepare per font size. That never meant no caches: ablate them, profile, and put
  back those that earn it. What lives one frame or call is data flow, not a cache, and an eviction cap must surely
  exceed what a page sends.
- **Two lifetimes.** The shared width cache holds facts of one font and one segment's own characters; the prepared
  handle holds facts of the whole text. More global caching would explode. Name both wherever caching comes up: the
  maintainer had forgotten the shared one. Handles going stale when the page language changes is disliked but accepted,
  since line breaking needs the language.
- **The API is open, and loved.** The prepare/layout split was a sweet spot and may not be now, but its direction is
  loved, and alternatives are additions to talk through. Idempotent layout without handles stays interesting if lifetime
  can be controlled; a study of it recommends keeping handles (Dead Ends). Immediate mode: nothing relies on object
  identity. Changing text should be cheap to prepare again (#313). A 2 s bar for 10,000 rich messages (2026-09-18) was
  withdrawn as unsubstantiated.
- **Design from shared structure.** Once plain speed engineering is exhausted, find what calls share and skip
  recomputing it, from a cost model first. Demos aren't usage data. The maintainer (2026-09-26): "They're examplary
  technical edges for folks to interpolate their own usages from." Don't overfit to today's uses.
- **Holds.** Exports stayed exact while engine work landed. The API discussion is the end-of-project item, with
  issue #321's `direction` option and `devicePixelRatio` in `layout()` on its list, and no release comes before it. One bundle
  serves every engine (Decisions Log, 2026-09-26).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **The rich surface** stays split between stats and range helpers and materializing ones, with one decision algorithm
  behind batch walks and one-line steps. Speed work for rich text and manual layout belongs in the range and cursor
  APIs. `getTextClusters()` is wanted once it ships, but can't be waited on: it doesn't help Firefox.

### Tables Against Canvas

- **Neither comes first.** A table that isn't per-font data can beat a Canvas recipe when its lookups can be enumerated
  roughly exhaustively (2026-09-19; it replaced the assistant's fixed order). Choose by what the fact depends on:
  engine or Unicode data goes in a table pinned to the engine's build; a font fact is asked of Canvas at runtime, never
  kept per font; OS facts case by case, such as Safari's small Core Text table of generic families.
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Size.** Generated data beats hand-written lists or hacks below a size threshold. The engines' tables replaced
  Pretext's rules, their growth accepted because they made analysis much faster, and the size check promised for the end
  is closed (Decisions Log, 2026-09-23 and 2026-09-26). That acceptance covers Chromium's Chinese line table, which
  issue #321 had advised against.
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Refreshing** is by hand from checked-in engine files, never a build step, taking each browser's own shipping copy.
  The engine files and the 30 MB catalog stay checked in, so nothing needs downloading.
- **`\p{…}`** follows the JavaScript engine's Unicode tables, not layout's, so the redo takes no engine decision from
  it. Main does: its scans read letters, marks, punctuation, emoji and more through it (`hasProperty()`).
- **`Intl.Segmenter`** answers only word boundaries in Thai, Lao, Khmer, Myanmar and the other Southeast Asian runs,
  because there it runs the browser's own dictionary or model: Pretext needs the browser's split, not the right one.
  ICU4X's model instead would cost hundreds of KB and run slower; only a runtime without `Intl.Segmenter` reopens it.
  Firefox's slow Thai segmentation is its own trade for download size, so no bug was filed.

### Demos And The Chat

- **Pretext's numbers.** Demos show Pretext's APIs: no CSS sizes reverse-engineered in JS, no DOM reads, no hard-coded
  line counts, placement from Pretext rather than quiet CSS flow. They never correct what Pretext reports: fix the
  library, or have it expose the fact. <!-- Q16 placeholder: whether the bubbles demo places each bubble from Pretext's
  heights or keeps flex and says only its widths come from Pretext. The answer goes here. -->
- **Immediate mode.** With Pretext owning layout and virtualization, on-screen rects stay around two digits, so
  rebuilding each frame is fine. Pooling ties state to an eviction policy; reusing a node and keeping its state are
  separate. No ResizeObserver or other event-like control flow: if Pretext owns the breaks, nothing needs observing.
  Read vibescript's `ui.md` before proposing UI architecture.
- **The Markdown chat** takes the worst case first, resize and random scroll seek, with exact methods first; every lossy
  height method was worse. Its scrollbar has the correct full-history size, capped only by what the browser can handle,
  a cap it doesn't reach at 10,000 messages (Scrolling And Scrollbars). It assumes fonts loaded up front and every
  embed size known.
- **Scrolling** follows vibescript's `Scrolling.md` by construction, assuming as little as possible about `scrollTop`:
  scroll only when this frame's layout moved the anchor, never clamp, keep the value read back, never detect a case
  such as rubber-banding to patch it. The macOS and iOS overlay scrollbar comes first, and a scrollbar appearing never
  nudges content.
- **Exemplary.** The chat teaches the important patterns with no noise, so developers pick a subset rather than
  extrapolate; its guide stays short. Its techniques move to the other rich demo only if strictly better.
- **Not in the package** (Decisions Log, 2026-09-25), which replaced the maintainer's wish, earlier that day, to keep
  them runnable from the package.
- When a demo looks wrong, first find whether the library or the demo is at fault, and look in a real browser at
  several widths. A layout fix's commit message names the bug and explains the fix.

### Docs

- **The criterion (2026-09-27).** The maintainer: "trust that the future agent is at least as smart as you so you don't
  need to document the obvious stuff they can discover" and "I'd document all the philosophies we've talked about,
  because the smart model would still want to know our intent (and can abide by it). And the various traps that
  smartness doesn't necessarily solve, such as dead ends". They accepted three refinements the same morning:
  discoverable means cheap to discover, so facts that take hours of browser runs stay; every measured fact and dead end
  carries its date, browser build and what would reopen it; AGENTS.md may hold one screen of pipeline map. README
  carries no per-browser accuracy or speed.
- **Dead ends stay open to question.** The maintainer (2026-03-03): "document but don't be too stern. I want future
  attempts to be able to question this". Say what was tried, how deep, by whom and whether anyone checked it, and what
  would reopen it; never "impossible". A thin, unsupervised attempt is weak evidence: Chrome's word sums were written
  off after one, then reopened and landed.
- **README** gets extra care as the one user-facing doc: illustrative and to the point, only caveats app developers act
  on, its API glossary kept (JSDoc in its place was tried and reverted), examples correct on their own and ordered
  simple to complex, every term defined, nothing changed that wasn't asked for.
- **Voice.** Keep each document's tone unless it's wrong; `thoughts.md` is the maintainer's own voice. Short, with the
  nuances kept. A rewrite keeps technical meaning and opinions, and loses pseudo-jargon, common words in uncommon senses,
  vague pronouns and slogans, but not words that carry meaning, such as "regression". Concrete cases over a general
  warning.
- **What goes in.** Numbers that go stale are pointed to, not copied. A fresh agent gets objective facts, not designs
  that fence it in. A cleanup removes only what's provably stale, and docs another model wrote are checked for accuracy
  and for fitting what was done. The changelog and doc-sync rules are the maintainer's own AGENTS.md lines, kept word
  for word.
- **Ledgers and quotes.** Decisions happen in chat, and the maintainer rarely reads TODO.md or ENGINE_FOLLOWUPS.md, so a
  decision answered in chat leaves their open lists. Work depth-first, tracking every punted item with what would
  reopen it. Every quote names its speaker and is checked against its source; text the maintainer forwarded from
  another agent isn't their view.

### Merge Bars And Landing

- **The standing bar (2026-09-26).** The maintainer: "Anything that's basically pareto optimal in terms of correctness
  perf and decent simplicity within known goals are basically good merge." A change that trades one against another
  goes to the maintainer with numbers, and they may waive one named cost to judge it.
- **Eager, not reckless.** Try fixes eagerly, long-standing gaps included, but hold back one that doesn't make sense
  even when validation passes: losses nobody can attribute, complexity out of proportion, special-case hacks.
  Worst-case fixes to a change go in the same PR. Close an issue only when it's solved on main, and a superseded
  community PR with thanks.
- **Browser bugs** are filed and recorded in PLATFORM_BUGS.md: comment on an existing report with a repro rather than
  file a duplicate, in plain words, with a small standalone repro only when it's deserved; the maintainer submits. The
  collected candidates are filed at the end of the project.
- **Public posts** go out only at the maintainer's word, once verified, and sound like them: casual, details kept, no
  report phrasing or demands, in the contributor's language. Public issues and branches carry no private details. A
  feature too hard for now is parked in an issue with the findings and what support would take. A stale public issue
  gets a new comment and a one-line status at the top. <!-- Q18 placeholder: the status comment on #321 waits for the
  maintainer's word. -->
- **A crash or hang** found while probing stays out of public issues, branches and docs until triaged; the Chrome hang
  went in as a restricted security report. <!-- Q10 placeholder: whether the rebuild's public refs that still hold its
  page get cleaned; the answer changes refs, not this line. -->
- **License notices** for the ported engine code and data are deferred.

## Part 2: Evidence

<!-- Q1: recommendation taken; the maintainer hasn't answered -->

Measured facts, traps and dead ends, by topic and then by engine. Each fact names the build and date it was measured on,
or the engine source it was read from. Unless it says otherwise, it was measured on the maintainer's Mac (Apple
silicon, device pixel ratio 2, and a Chinese-first OS language list, which changes results: Content Language And
Fonts), in the installed browsers of its date: Chrome 153 until 2026-09-25, then 154.0.8037.57; Firefox 155 until about
2026-09-17, then 156.0 and 156.0.1; Safari 26.5.2 on macOS 26 until 2026-09-16, then Safari 27.0 on macOS 27. A fact
seen only in Safari 26.5.2 is unconfirmed on Safari 27, which the WebKit profile follows. Dates are Pacific.

Some evidence comes from tools outside the repo or gone from it. *Old suite* numbers come from `tests/wrapping`, removed
2026-09-25, including its "installed gate" and "suite rows"; they can't be rerun at main (the suite runs from 6fadbe5)
and stay only where they carry a decision. *Main then* is main on a fact's date. An *offline replay* ran Pretext under
Bun over recorded Canvas answers against recorded browser rows: it detects change but isn't an oracle, and it can't see
string storage, painting or dictionary text. A *stand-in Canvas* is a numeric one in Bun or Node; like a replay, it
measures Pretext's own work, not a browser's (Evaluation Traps). The *redo lab* is the per-engine rebuild's harness on
branch `rebuild-20260916` (2026-09-16 to 26, many agents with critic agents and the maintainer steering), which keeps
its own scores in `rebuild/research/`; its measurements of browsers, in Chrome 153, Firefox 156 and webkit-host unless a
fact says otherwise, are repeated here. The *emulation study* (2026-09-15 to 20, summarized in issue #321) ran each
engine's own break and shaping code offline.
<!-- Q11 placeholder: the rebuild branch's docs quote paraphrases as the maintainer's words; the answer changes that branch, not these pointers -->
<!-- Q18 placeholder: no status comment on #321 yet; link it here if one is posted -->
<!-- Q7: recommendation taken; the maintainer hasn't answered -->
<!-- Q7 note: Every "old suite" label below depends on it -->

### Measurement Model

Pretext's premise: a segment's width is what Canvas measures for it alone, a line's width is the sum of its segments',
and each engine's known differences from that sum are corrected in its profile (Part 1, The Correctness Stance). The sum
misses context across a segment's edge, which Kerning At Line Edges, Widths After A Line Break and Rich Inline
Boundaries cover. Whole-line measurement during layout, uniform scaling, a pair-kerning table and hidden DOM or SVG text
lost (Dead Ends).

Canvas and the pages disagree on controls. Every Canvas measures U+0009-U+000D as spaces, and Firefox's also
U+001C-U+001F, NEL and U+2029, with hexboxes for other C0 controls. Chrome's page gives 1,185 of 1,429 controls an
advance (NEL 16px in 16px fonts); Safari's gives CR its glyph's advance on the simple text path and none on the complex
one, and other controls the `.notdef` advance; Firefox's gives CR, FF, VT, hidden C0 and C1 controls, DEL, U+2028 and
U+2029 none (Chrome 153, Safari 26.5.2 and 27, Firefox 155 and 156, 2026-09-16 and 17). The HTML parser turns CR into
LF, so a probe sets a CR from script.

Chrome's Canvas turns SHY, ZWSP, LRM, RLM, U+202A-U+202E and U+FEFF into U+200B, which ends a Canvas word, where its
page shapes through them (`plain_text_node.cc:47-62`, on purpose). Leaving a soft hyphen out is wrong too: 2,356 words
in 168 of 399 families, whose `morx` or `kerx` machines see its glyph, measure otherwise without it, and U+2060 in its
place gives the page's width on all of them (redo lab, 2026-09-17). After that U+200B a nonspacing mark can measure as a
dotted circle (8px in Georgia), while Chrome's page gave such marks no width in about 20,000 observations (old suite,
removed 2026-09-25), so the Chromium profile gives them none. Safari's Canvas and page keep the soft hyphen, and a mark
after it takes its fallback font's advance in both.

A chosen soft hyphen paints U+2010 if the primary font maps it, else `-`, and Canvas can't tell which, since fallback
supplies U+2010; measuring under two fallbacks whose U+2010 differ can (36 of 36 families, redo lab). In Geeza Pro,
which maps none, Chrome's page draws a 9.69px hyphen where Canvas gives `‐` 5.33px. Chrome and Firefox shape the hyphen
without letter spacing, and Safari spaces it. Pretext measures `-` everywhere (ENGINE_FOLLOWUPS.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: side finding 9 becomes an ENGINE_FOLLOWUPS gap -->

Safari's page turns off `liga`, `clig`, `dlig` and `hlig` under any non-zero letter spacing, even 0.001px, and its
Canvas `letterSpacing` doesn't: 32px Hoefler Text `ffi fl` at 0.001px is 54.403px in Canvas and 57.414px in the page
(WebKit #283408 added Canvas letter spacing without #176215's fix; webkit-host and Safari 27, 2026-09-16 to 19).
Chrome's Canvas and page agree. Pretext's model, the unspaced width plus the spacing per grapheme after the first, is
2-3px off Safari in Amiri, Hoefler Text and Futura, and no Canvas string gets two letters unligated into one Safari
shaping call (1,596 strings in 15 fonts; Dead Ends has what else was tried). WebKit fixing Canvas `letterSpacing` would
make it exact.

Contexts read language their own ways (Content Language And Fonts), and Safari's has no `lang`, `fontKerning` or
`textRendering` (WebKit #285993). An attribute the browser lacks doesn't fail when set: it becomes a plain JavaScript
property and the recipe silently measures another way, so check each non-default attribute with two contexts, and letter
spacing over one letter repeated 16 times, since a Canvas that rounds a fractional total shows nothing on one or two.
The same text on the same context returns the same bits in all three (0 of 2.17 million repeats differed in Chrome 153),
except where Firefox's per-process fallback state moves it (Engine Facts, Firefox).

A connected `<canvas>` isn't neutral. Chrome's keeps its element's CSS letter and word spacing, times the device pixel
ratio, which `letterSpacing = '0px'` doesn't clear; Safari's copies the element's font and forces style updates;
Firefox's holds the page's advances but needs `document`, while its OffscreenCanvas shapes at the CSS size and never
applies optical sizing. A context can't be cloned or transferred, so a prepared paragraph can't cross to a worker
(`DataCloneError`) and a worker makes its own (redo lab).

Each engine fits in its own units. Chrome rounds each item up to 1/64 of a device pixel, truncates the available width,
and fits while the position is at most that plus one unit (`line_breaker.h:307-317`), so at a device pixel ratio of 2
its grid is 1/128 CSS px. Safari sums float32 CSS px, an item followed by a space measured with it minus the space, and
fits against the width truncated to 1/64 px plus 1/64 px, never reading the device pixel ratio
(`InlineLineBuilder.cpp:1172-1183`, webkit-7625.1.29.11.27); the emulation study reproduced Core Text's widths this way
on all but 17 of 2.6 million items (Safari 26.5.2). Firefox fits in integer app units, 60 per px, rounded per glyph:
`aaaa bbbb` in 16px Courier New is one line at 86.4px and two at 86.38px. 4,844 of pre-#340 main's 6,844 Chrome width
failures missed by one 1/128 px unit (old suite). The WebKit profile fits with WebKit's own 1/64 px, and the Blink and
Gecko profiles with 0.005px, no engine's arithmetic; Chrome's grid needs a device pixel ratio `layout()` doesn't read
(ENGINE_FOLLOWUPS.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: decision 4, `devicePixelRatio` in `layout()`, goes to the API discussion -->

Emergency breaks follow each engine's loop: Chrome lays the line out again with a break allowed between any two
graphemes (`line_breaker.cc:4258-4330`), Firefox takes a cluster start only while the line has no ordinary break
(`gfxTextRun.cpp:1068-1074`), and Safari searches prefixes in a fixed order and carries the rest unmeasured (Engine
Facts, Safari). They break only between the shaper's clusters, and a ligature merges its components', so Chrome and
Firefox never split lam from alef, or `ffi`, in a font that ligates them. Those clusters aren't grapheme clusters:
HarfBuzz joins marks, a ZWJ before a pictograph, emoji modifiers and tags to the cluster before them even across SHY,
ZWSP or U+2060 (`hb-ot-shape.cc:471-585`), so `a`, U+2060, U+0301, `b` stays on one line at width 0 in Chrome 153.

Canvas can't tell whether a font draws lam + alef as one cluster, so every default is a guess; Pretext sums isolated
widths (Dead Ends, Arabic And Joined Scripts).
<!-- Q12: recommendation taken; the maintainer hasn't answered -->
<!-- Q12 note: no change now; the table goes under Dead Ends -->

Widths don't compose simply. A string can be narrower than a window inside it, by up to 117 zoomed px in calligraphic
Arabic faces at 256px. Two sides that sum to the whole don't make an offset safe to break: HarfBuzz can flag it unsafe
with no width signature, as in Zapfino and Apple SD Gothic Neo, and Chrome then reshapes. A word's tail can be negative,
as in Mishafi (`حالاً` in Firefox). Euphemia UCAS kerns its space under `latn` alone, so a space Canvas shapes as Common
stays wide, alone among 393 families. In Chrome a stretch with no script of its own, such as ` , ` between Devanagari
words, measures up to 4.8 zoomed px off alone: measure it with the letter after it. A whole word agreeing with the page
says nothing about its prefixes (redo lab), and letters measured alone can be far from their word (Shantell Sans,
Content Language And Fonts).
<!-- Q6: recommendation taken; the maintainer hasn't answered -->
<!-- Q6 note: FONT_DIAGNOSTICS.md folds into Content Language And Fonts -->

Canvas can answer some font facts at runtime, in about 10 calls once per font per page: Arabic joining, from beh and
U+07FA alone and together (29 of 29 families, blind on fixed-pitch fonts), a font's own hyphen glyph, monospace, an
optical-size axis (not in Firefox's Canvas), and ligatures and coverage only partly. Which glyph carries a pair's
kerning can't be learned in Chrome or Safari. A wrong learned fact is worse than an unknown one, and a missing named
family can resolve to a system font, so dropping all font checks changes real lines (redo lab; the rule is in Part 1,
Tables Against Canvas).
<!-- Q3: recommendation taken; the maintainer hasn't answered -->
<!-- Q3 note: P-DAT-2 -->

No shipped `TextMetrics` (Chrome 153, Firefox 156, Safari 27's engine) has a per-character method by default: no
`getTextClusters()`, `getSelectionRects()` or advances array. Arabic joined across a soft hyphen, lam + alef and kerning
inside a word all wait on advances inside shaped text, so `getTextClusters()` shipping in Chrome would reopen them
(Engine Facts, Chrome).

### Reading Browser Output

DOM geometry is evidence to interpret, not a map from source to lines. Safari 26.5.2 could return a zero-width rect on
the previous line after a wrap (27.0 doesn't), and Chrome can give a letter after a soft hyphen rects on both lines and
copies the soft hyphen's box onto it, so "first rect" and "first positive rect" both misassign source. Range extents
aren't advances under kerning, letter spacing, bidi or invisible controls: Safari 26.5.2 split one NEL's advance 13 and
11px at 1px of spacing and 14 and 10px at 2px. Range can't show whether a soft hyphen is painted under keep-all (16px
Arial `a`, U+00AD, `b` at width 10 paints `a` / `b`, the hidden soft hyphen with a positive rect), and the harness can't
see the hyphen at a soft-hyphen break at all (harness/README.md). Take source offsets from segments and cursors, never
`line.text.length`, which can hold a hyphen the source doesn't.

A span per character or segment changes the breaks being observed. WebKit breaks inside an inline box from that box's
text, with only the previous box's last two characters as context: in Safari 27.0 on 2026-09-25, a span per grapheme
moved 275 of 1,336 of the harness's pre-wrap and URL-query cases, mostly under 24px at `?`, `=`, tabs and soft hyphens.
Spans change Thai, Lao, Khmer and Myanmar breaks in every browser, and produced March 2026's verdict that Thai was
unfixable. Read Range on the one text node, as the harness does.

Lines from rects have their own traps. Per-character `top`s scramble on bidi text, where `getClientRects()` on a Range
over the node gives a rect per line. Taking only positive-area rects misses a ZWJ or the letter after it on a second
line; vertical centres misplace tall fallback-font rects; the collapsed space after an inline box reports a zero-width
rect on the next line in WebKit and Blink; and `text-transform` (ß to SS) shifts Range offsets. A combining accent can
have no usable rect, but lines follow text order, so a character between two on one line is on that line; the harness
keeps that premise, which checked 5,018 to 13,358 more rows per browser with no false failures (old suite, removed
2026-09-25).

Each engine encodes rects its own way. Chrome floors a slice's start and ceils its end to its layout unit, so neighbours
overlap by one, and is exact to 1/128 px at a device pixel ratio of 2 but not at zoom 1.5 or 2.2. Safari gives one rect
per display box, snaps partial rects to whole px and splits a glyph's advance among its code points by UTF-16 units.
Firefox puts edges on app units, stored as `floor(a × 65536/60 + 0.5)/65536` in float32, with a cluster's advance on its
last code point. Rects drift from advance sums past about 16,000px, and summed per-grapheme widths overshoot at each
boundary, so take extents as edge differences (redo lab).

A diagnostic has to establish its own setup. In March 2026 a container's `white-space: pre` kept both test boxes from
wrapping and produced a 17px "difference" and a verdict that Georgia was unfixable, which the maintainer's own run
disproved. Floats meant to force a break history moved the word below them. Check the breaks before the one studied,
compare resolved CSS widths, bracket thresholds, and test the CSS Pretext targets. Firefox's boxes followed 1/60px
rounding in a sweep, but fitting lines that way regressed unrelated cases: box resolution isn't the fit rule.

Probes change what they measure. Text-presentation requests and Firefox's per-process font state let earlier strings
move later results, so each bug page runs in a fresh browser process and profile and finishes from promises, not timers,
which a hidden window stalls; a page whose bug is a call that never returns sets its title to `STEP ...` first, so a
driver records a hang after 30 s. Chrome's `Range.getClientRects()` can hang forever on one narrow constructed case,
reported to Chromium with restricted access, so a job drawing generated cases needs a stall limit and a way to skip, and
the trigger stays unpublished (Part 1, Merge Bars And Landing). Read engine source at the revision the browser ships:
two notes here once described WebKit's trunk. Setting `font` after `line-height` resets the line height. Nothing
independent checks Safari's line placement: webkit-host reads the same rects, while Chrome's and Firefox's were also
checked against the emulation study.

A matching line count doesn't mean matching lines: about 1 in 18 of pre-#340 main's count passes had visible characters
on the wrong lines (old suite, 2026-09-17). `(ب` SHY `ب)abc` at 5 px is `( | ب | ب) | a | b | c` in Safari and was `( |
ب- | ب | ) | a | b | c` in main. So the harness checks each line's first and last visible character. Such bugs sit in
combinations nobody can list: unit tests passed where a replay lost 9,068 line counts.

Timings are browser output too. One copy of the library can run slower than another copy of the same code for a whole
document: in the bench's calibration of HEAD against itself on 2026-09-26 (Chrome 154, Firefox 156.0.1, Safari 27.0,
three sessions each), Firefox's base copy took about twice as long as the other two on kept CJK handles in one session,
and Safari's 15-21% longer on keep-all brackets in two. So each document carries a control copy and a verdict needs
every session; harness/README.md's Bench section has the floors.

### Break Opportunities From Engine Data

Break opportunities come from ports of each engine's scan over each browser's own shipping data (Part 1, Tables Against
Canvas). This is how well the ports were checked, what they replaced and the traps on the way.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->
<!-- Q7 note: old-suite numbers in this section -->

The emulation study combined each engine's break data, shaper, line loop and font fallback, and reproduced every line
count and line start of the 2026-09-14 installed rows, about 236,000 per browser (old suite, removed 2026-09-25). It
can't ship, since it needs font files, private Core Text and system ICU, and it doesn't need to: Canvas already runs
each browser's shaper on the device's fonts, so a page lacks only each engine's units, fit arithmetic and a few hidden
facts. The TypeScript scans matched its C++ ports of the engines' break code with 0 differences over 13,108 Blink and
19,393 WebKit requests outside Thai, Lao, Khmer and Myanmar runs; the ICU iterator port gives ICU's boundaries on all
19,338 cases of LineBreakTest.txt; and the Gecko scan gives the Gecko oracle's breaks (ICU4X on Firefox's data) on all
6,569 left-to-right suite and corpus requests and all 11,875 left-to-right fuzz requests, differing only inside those
runs when Bun's segmenter stands in for Firefox's (2026-09-15 to 24). None of these tools is in the repo. The rule they
leave: an engine rule's oracle is the engine's own library, such as ICU over Chrome's `icudtl.dat`, libicucore with
Apple's overrides or `icu_segmenter` on Firefox's data, never a second port, and Blink's upstream tests in Ahem, where a
stand-in Canvas is exact, pin behaviour cheaply.

The scans differ from their engines on purpose in three places. One ICU pass per text, instead of Blink's restart at
each line start, differs in 86 of 188,274 verdicts. The WebKit scan resolves no bidi levels and so misses WebKit's
splits where levels change, at 15 right-to-left positions in the latest count (71 in an earlier one), such as
`ab””tail`. The Gecko scan takes every paragraph as left-to-right, since Pretext takes no direction: none of 4,346
right-to-left suite and corpus requests moves, and 192 of 8,125 fuzz requests do. ENGINE_FOLLOWUPS.md tracks all three.

Take each browser's own shipping data, not upstream's latest: Chromium 147's `line_normal.brk` differs from 153's on 239
code points, and headless Chromium 147's ICU 77 breaks otherwise wherever ICU 78 changed the rules (the HH dashes,
LB20a, LB21a), so headless evidence can't check those. ICU's `ppucd` writes no `cp` line for 210,383 code points whose
values equal their block's, so a generator reading only `cp` lines gets Cn for U+3400.

The tables are ICU's compiled state machines, and a small rule change renumbers the states. Unpacked as 480 KB of base64
they made a fresh Firefox page spend 5.2 ms evaluating the bundle, against 1.2 ms before #340, so each is stored as byte
ranges of an earlier table plus literal bytes, and a browser unpacks only its own, 0.4-0.6 ms a page. Packing per engine
gave 133 KB minified and 64 KB gzipped; keeping Chrome's root table whole and copying the other line tables from it at
runtime, the maintainer's suggestion of 2026-09-23, gave 238 KB and 57 KB and took 3.6 ms in Firefox (2026-09-24). The
size pass is closed, and one bundle serves every engine (Decisions Log).

In Line_Break=SA runs (Thai, Lao, Khmer and Myanmar, and in the Blink and WebKit scans also Tai Le, New Tai Lue, Tai
Tham, Tai Viet and Ahom), `Intl.Segmenter` words stand in for the engines' dictionaries. Chrome 153's words equal those
of `Intl.v8BreakIterator`, which runs the same ICU as Chrome's layout, on 273 corpus paragraphs, though the Blink scan
misses 69 Khmer positions; JavaScriptCore's differ from libicucore's line iterator on 27 of 282,337 positions, all where
a range starts with a combining mark; Firefox 155's matched Gecko's models on all 54,588 breaks once breaks inside
clusters are dropped, as Gecko drops them. Offline replays can't cover these runs: Bun has no `v8BreakIterator`, and its
words differ from Firefox's on some Thai.
<!-- Q18: recommendation taken; the maintainer hasn't answered -->
<!-- Q18 note: side finding 12, why `Intl.v8BreakIterator` isn't used, goes under Dead Ends -->

Merging punctuation, URLs or numbers into units before deciding breaks erased context later passes couldn't recover, so
the scans read the whole text; the Gecko scan replaced merges whose answers Firefox contradicts, such as keeping `|`
with the letter after it in `a/|b` (Dead Ends). It doesn't split text runs where the script changes, as Firefox does:
its breaks then differ from the oracle's in 18 more of 11,875 fuzz requests, and an itemizer port cost milliseconds of
set-up (Decisions Log, 2026-09-24). Remapping characters to the root table's classes can't stand in for Chrome's
`line_normal_cj.brk`, whose `〜` and `゠` belong to no class the rules name.

A ZWSP or soft hyphen with no break before the text after it is zero-width glue: its own zero-width segment, with no
letter spacing, that doesn't end a line. Folding it into that text lost 1,887 Chrome and Safari rows in the 2026-09-15
installed gate, such as `a`, U+00AD, U+0301, U+00AD, U+0323, `b` at 7px in 16px Arial with letter spacing −4, painted
`a` / `b`. In Chrome and Safari glue can still take a line when the grapheme after it doesn't fit (Chrome paints `abc`,
U+00AD, `)def` at 1px one grapheme per line); in Firefox it can't, since Gecko drops soft hyphens and clusters a ZWSP
with the marks after it. Letting glue start a line lost 428 Firefox rows, and Gecko's rule lost 101 Chrome and 866
Safari rows in an offline replay. The walkers end lines only where the scan breaks and fill graphemes across an unbroken
run: ending at any segment boundary lost 9,068 line counts, as in `a`, U+00AD, WJ, `b` at 0px.

Combining marks after glue or a control shape with the grapheme before them and what separates them, so a run is
measured after that source, minus the source; without the separators Canvas composes marks with the grapheme or draws
both in another font (`a` with U+0323 in 16px Amiri measured 2.22px more than `a`, where Chrome paints the chain as wide
as `ab`). Measuring every run after the whole chain was quadratic (Keeping Work Bounded), so past 96 UTF-16 units of
separators a run keeps the grapheme and the fewest of the chain's last runs holding 96 units. Safari's widths depend on
a run's distance from the grapheme up to 61 units (after `क` in 16px Georgia, the first U+0323 takes 5.2px, the next 29
take 1.6px, the rest none), and keeping only the last 96 units gave runs of 95 marks or more up to 7.1px too much. The
kept context measured within 0.002px of the whole chain in Chrome 154, Safari 27 and Firefox 156.0.1 over 12,960 chains
in up to 24 fonts, while leaving out the grapheme took up to 25px off (#351, 2026-09-25).

Where an emergency break falls inside a segment depends on the advances an engine adds up. Firefox adds the advances of
the word shaped whole: in 16px Arial `بِبِ((tail` at 27.86px fits `بِبِ((` and starts the next line at `tail`, while
summing isolated graphemes charged both ب their isolated 11.42px, where the first takes 3.9px joined, and lost 460
installed rows. The Gecko profile fits from grapheme prefixes, as the WebKit profile does, which give each letter its
left context but miss kerning with the next grapheme. In an offline replay prefixes gained 2,110 left-to-right and 703
right-to-left line counts over sums, lost 643 and 349, and doubled a cold preparation's Canvas calls; pairs, each
grapheme measured after the one before, did slightly worse at 21% more calls on the corpora and 91% more where every
preparation starts cold (Firefox 155, 2026-09-16).

So the Gecko profile takes prefixes only in segments at least 80px wide and sums graphemes in narrower ones, with letter
spacing forcing prefixes, numeric runs taking pairs, and pairs past 96 graphemes. A cold Firefox preparation of real
paragraphs then took 88 Canvas calls a paragraph, against 113 for prefixes everywhere, 86 for sums everywhere and 79
before #340, and lost nothing against prefixes everywhere at 80px and over, where sums everywhere lost 58 line counts,
such as `foo@bar.com：b` at 105px (Firefox 156.0, 2026-09-23).

The 80px has no browser reason: it was the old suite's boundary for narrow widths. Measured again with the harness in
Firefox 156 (2026-09-27), a 24px floor, where the harness's layouts narrower than real ones end, costs what prefixes
everywhere cost, since the prefixes' calls sit in words 24-80px wide. Either takes 99 measureText calls per 1,000
units while preparing where 80px takes 62 (with the 24px floor, 11,367 against 5,857 on the census and 434,843 against
278,106 on the real-usage draws), and `bun harness bench main` read new Latin, Arabic and mixed messages and UI labels
28-68% slower in both sessions; new CJK and Thai, seen text and the worst shapes read within noise. Lines at 24px and
wider move the same under both: 281 Firefox cases at 24-80px pass that fail with the floor, 172 of them the old gate's
Arabic words with vowel marks before brackets, quotes, controls or Latin, and 14 fail that pass. Ten of those are
`a ★ーb` in 16px Arial at 25-29px, where summed standalone widths (10.65px and 16px) match the paragraph's 26.65px for
`★ー` by luck, as Firefox's Canvas measures `★ー` at 32px; three are Amiri Arabic split at 24.45px, 1/64px from where
the lines change; and one is a real-usage draw, `TKT-84565` in a 31.25px table cell in 16px Helvetica Neue, where
prefixes give the hyphen that starts the second line all 2.05px of its kerning with the `T` before it, so `-845` fits
at 30.87px and Firefox moves the `5` on. No real-usage draw gains, and 188 of the 11,901 (1.5% of their weight) are
narrower than 80px. Below 24px, the 24px floor fixes 40 cases and loses 36, prefixes everywhere 44 and 50. So the floor
stays at 80px, a premise with that gap (Decisions Log, 2026-09-27).

An overflowing segment used to end its emergency split after its last hyphen that fit, which recovered breaks the old
merged segments hid. A scan segment ends at every break, so a hyphen inside one has no break after it and all three
browsers fill graphemes past it; only 188 of 374,178 Blink scan segments over the corpora and tests still held one, such
as `ה-16`, so the rule went (2026-09-16).

U+3000 hangs at a line end in Chrome and Firefox, as a space does, and not in Safari: `中文`, U+3000, `中文` at 33px in 16px
PingFang SC is 2 lines in Chrome 153 and Firefox 156 and 3 in Safari 27. Hanging it gained 386 CJK test cases in the
Chromium and Gecko profiles (2026-09-23), and 412 Firefox line counts in the old suite with none lost.

Facts the ports now give by construction still took browser runs to find (March to mid-September 2026): a ZWSP that
starts a paragraph or follows a hard break takes a line of its own when the next word doesn't fit, in all three; after
CJK text all three keep `.,:;)]%'"` with what follows and disagree after `!`, `}`, `/` and `|` (#274); and browsers end
a line with an opening bracket after a word only at 1-26px, where Pretext once did at 57-114px. Engine Facts has each
engine's own rules.

Soft hyphens are common in some languages and nearly absent in others (researched 2026-09-11). About 1 page in 10 turns
on `hyphens: auto` (HTTP Archive, 2025), 7 of 14 sampled German, Dutch and Nordic news homepages had a soft hyphen, and
at least 0.21% of German Wikipedia articles do, against 3 of 1.22 million Arabic Wikipedia articles; Persian's, about
225 per million, are mostly Word's optional hyphen typed where a zero-width non-joiner belongs, which is worth reading
before any Arabic-script soft-hyphen policy. This is the evidence behind leaving `hyphens: auto` out (Part 1, Lines
Drawn).
<!-- Q3: recommendation taken; the maintainer hasn't answered -->
<!-- Q3 note: P-SCO-22 -->

### Grapheme Clusters From Engine Data

Grapheme clusters come from Chrome 153's (ICU 78.2) and libicucore 78.1's character rules, not `Intl.Segmenter`, whose
graphemes were 40-58% of preparing new text in Chrome and Safari and 64-76% with letter spacing, since it builds an
object and a substring per cluster (#344, 2026-09-24, whose description has the speed table). In Chrome 153, Safari 27
and Firefox 156 that day, each profile's table gave `Intl.Segmenter`'s clusters on every code point in 14 contexts, on
the corpora, and on 20.8 million random strings, among them emoji sequences, new scripts, lone surrogates and clusters
up to 70,000 units long (`scripts/grapheme-check/`). Chrome's and Apple's tables differ only at Apple's 39 transcoding
hints. Firefox 156's ICU4X data puts every code point in Chrome's 18 classes and ended clusters where ICU does on 3
million strings in a one-off run, so the Gecko profile takes Chrome's table; the generator's standing check covers about
211,000 strings.

The tables don't follow a browser to another Unicode version. Node 23's ICU 77.1 (Unicode 16) differs on 1,417 code
points: 689 symbols Unicode 17 took out of Extended_Pictographic, such as the chess symbols and playing cards, which no
longer join a ZWJ sequence; 686 consonants and linkers in 14 scripts whose conjuncts Unicode 17 joins, Myanmar, Khmer
and Javanese among them; and 42 new characters. So the tables are refreshed when browsers move to Unicode 18; `bun
harness repin` reports when a pinned browser's data changes.

Every text segment takes emergency grapheme breaks, since under `overflow-wrap: break-word` all three engines ignore
line-break classes there, kinsoku and keep-all included. Taking the permission from `Intl.Segmenter`'s word-likeness was
wrong: JavaScriptCore withholds it from numbers (`11111111` at 1px stayed one line) and every engine from emoji and
symbol runs (`🇺🇸/👩‍💻` at 8px), 756 rows between them (old suite, removed 2026-09-25). Gecko clusters its text run per
shaped word after dropping soft hyphens and bidi controls, so the Gecko scan's cluster starts decide which segments
split: in `a`, `👩`, U+00AD, ZWJ, `🚀`, `b` at 0px Firefox paints `a` / `👩-` / ZWJ `🚀` / `b`, where Unicode graphemes
split the ZWJ from the rocket (68 old-suite rows).

Safari's emergency breaks can land inside a grapheme, and Pretext's cursors never do, an accepted mismatch that shows
only where a word doesn't fit its box (Decisions Log, 2026-09-12).

### Widths After A Line Break

A ZWSP at a paragraph or hard-break start is real source: it establishes a line and offers a break after it, without a
letter-spacing gap. Chrome and Firefox shape an Arabic letter before a chosen soft hyphen in context: for ZWSP, ب, SHY,
ب in 16px Amiri, Pretext sizes `ب-` at 20.70px, the isolated beh plus a hyphen, where Chrome paints about 8.95px,
Firefox 9.85px and Safari the isolated 14.82px. With U+A65C for beh the text prepares the same widths but needs other
native line counts, so no rule in `layout()` can repair the Arabic case: it needs contextual widths during preparation,
and the shortcuts tried lost elsewhere (Dead Ends). Canvas gives joined forms poorly: across a ZWJ it needs a
right-to-left context in Chrome and Firefox (22-24 of 24 forms right, against 3-8 left-to-right), Geeza Pro joins only
inside one shaping group, and Amiri and the Noto Arabic fonts swap both glyphs when two letters meet, so no Canvas
string measures a first glyph in its word's form (Chrome 153, Firefox 155, 2026-09-12 to 20).

Pretext consumes a soft hyphen at a paragraph or hard-break start (Firefox drops it too; Chrome and Safari keep it,
ENGINE_FOLLOWUPS.md), but the hard break after it ends a line in all three browsers: `a`, LF, soft hyphen, LF, `b` in
pre-wrap paints three lines in each, the second with nothing visible, and so do two soft hyphens there and two such
chunks in a row. So the line start takes a hard break that ends a chunk holding nothing else as an empty line, where
Pretext used to drop the chunk with its hard break. The same goes for collapsible spaces between two U+2028 or U+2029,
which Safari takes as hard breaks in normal white space too. At the end of the text, with no hard break after it, the
soft hyphens Chrome and Safari keep still take a line, where Firefox and Pretext give none (ENGINE_FOLLOWUPS.md). The
catalog's `followups/soft-hyphen-line` cases pin these shapes (#349, 2026-09-25).
<!-- Cited by harness/sets/catalog.ts and 193 case origins ("a line holding only a soft hyphen", "... a collapsible
space"): keep this paragraph and the heading. -->

Keep the original source through analysis, since normalization erases distinctions browsers keep: in normal white space
Chrome gives a form feed and a ZWSP two lines at width 1 and one at 100, though both normalize to a ZWSP, and in
pre-wrap a raw CR before a ZWSP occupies one native line where Pretext's CR is a hard break (Chrome 153, mid-September
2026; ENGINE_FOLLOWUPS.md).

Traces of source-built Chromium 152 and Playwright's WebKit 2272 (recorded 2026-09-08), which show those builds'
executed paths and not the installed binaries', separate source rules from widths. In 16px Amiri at 14.75px, a
left-to-right pre-wrap ZWSP, beh, SHY, beh gives WebKit four lines, empty, beh, hyphen, beh: WebKit leaves the soft
hyphen unconsumed where Pretext consumes it, counts the possible hyphen before overflow, and makes a soft hyphen
discretionary only at the end of its text item; a policy derived from that passed independent ICU checks but lost
browser successes around resumed geometry. Chromium keeps the whole right-to-left item across the ZWSP and soft hyphen,
reshapes the selected range with its surrounding source, adds a separately shaped left-to-right U+2010, and reshapes the
rest at the next line's start, so isolated-letter widths aren't equivalent observations.

Three quantities look like "remaining width": the width that decides whether the rest of a word fits intact, the width
given to a selected prefix, and the suffix measured afresh after the break. Subtracting a prefix from the whole doesn't
give the reshaped suffix. Prefix widths needn't grow: in 16px Arial at −8px letter spacing, `WWi`'s prefixes measure
7.10, 14.20 and 9.76px, so the whole word fits 12px where a shorter prefix doesn't, and "the farthest prefix that fits"
is the wrong search. Each engine admits the rest by its own one of these widths (`entryFitBasis`), and choosing
otherwise lost elsewhere (Dead Ends).

A fresh start changes shaping, not just spacing. Safari's Shantell Sans probes tell a suffix starting at a combining
acute from one starting at the word joiner before it (Safari 26; unconfirmed on 27): zero width is a measured value, not
proof that source is absent, and removing controls before measuring changes the experiment. Earlier breaks matter too:
in 24px Times New Roman, Safari forced `AVAVbc` through different first-line indents and gave the same remaining `bc`
three fit thresholds where Chrome kept one, and applying the inferred adjustment to every prefix failed a follow-up
(Safari 26, recorded by 2026-09-07; unconfirmed on 27). The copied source cursor can't encode such histories, so don't
hide continuation state in batch layout and rebuild it differently in the one-line API.

HarfBuzz reaches past a word, so a line start inherits more than its first glyph. It normalizes a whole shaping call
once the call holds a combining mark, so in italic Athelas `tở` measures up to 1px wider at 32px after a `café` spelled
with U+0301 three words back; its lookups skip default-ignorables and, where told to, marks, so two letters kern across
a soft hyphen and a kasra; and it picks a buffer's direction from all it holds, so a digits-only window cut from a unit
with letters shapes the other way. A probe window whose far side holds only `. ` has no script and gives false misses,
so windows need a letter on each side (redo lab, citing Chromium 152's HarfBuzz).

Firefox treats white space at line edges its own way (Firefox 155 and 156, installed and from source, 2026-09-15 to 26).
It hangs only U+0020 and U+3000, so a tab doesn't hang: hanging tabs in every profile lost 432 Firefox rows (old suite,
removed 2026-09-25), such as `abc`, TAB, `def` at 20px in 16px Arial with letter spacing −2, painted `abc` / TAB /
`def`. It removes a newline between two wide characters, and on `ja` and `zh` pages next to East Asian punctuation,
taking the language of content without one from the OS regional locale, which a page can't read (Content Language And
Fonts), and it transforms white space per direction run, so a newline ending a run between Japanese characters stays a
space. It drops bidi controls from its text run as it drops soft hyphens, so a profile that treats them as ordinary
zero-width text lets one take a line of its own after a space. It also trims U+1680 at line edges and breaks between a
ZWSP and a following combining mark.

### Kerning At Line Edges

Segments are measured alone, so kerning with whatever sits beyond a segment is missing; the engines keep different parts
of it, and Canvas shows only some. Pretext assumes default font kerning (README.md, Caveats), and a `fontKerning` option
was declined on 2026-09-12 with its trackers left open (Dead Ends).

Safari measures a text item with a directly following U+0020 minus an unshaped space, so the item keeps its kerning with
the space whether the space continues the line or hangs, and the WebKit profile measures such segments the same way. In
18px Times New Roman, `A`, ZWSP, space, `B` puts `A` on a 12px line at 12.006px, though the letter alone is 12.999px.
After an emergency break inside an item, WebKit gives the rest the item's width minus the prefix, unclamped: with WJ for
the ZWSP, at widths 1 and 8, the rest is WJ and the space at −0.993px, drawn outside the line's start edge, so Pretext
keeps the signed advance for fitting and reports the width as 0 (Decisions Log). In Times New Roman WebKit also kerns
`A` before CR as before a space, which Canvas can't show (installed Safari 26.5.2 and source, 2026-09-12 to 15;
unconfirmed on 27).

Format characters between the word and the space resolve with the space, so on a right-to-left page `A`, WJ, space,
Hebrew paints the unkerned letter, and a left-to-right page kerns it. Without the page direction the profile keeps the
kerning only when the letters on both sides share a direction (`formatTailStaysWithWord()`), a rule that replaced a
generated bidi-class table in #311 (2026-09-15) with 100 fewer runtime lines and 4,207 fewer lines of table, generator
and data, and the same lines on all 239,063 Safari inputs of the old suite, removed 2026-09-25; the maintainer took it
as the kind of simplification they wanted, and Dead Ends has the shapes rejected on the way. An explicit embedding
leaves the direction unknown only in its own paragraph: installed Safari lays out `AA`, WJ, space, `B`, newline, U+202A,
`x` in pre-wrap 16px Arial at 20.9px in 3 lines, where checking the whole text predicted 4. Under letter spacing WebKit
moves the space's gap onto the item and clamps it at zero, and taking only the kerning there lost native successes, so
letter-spaced text takes none.
<!-- Q2: recommendation taken; the maintainer hasn't answered -->
<!-- Q2 note: the reaction isn't quoted -->

Measuring only a word's end with the space would be cheaper, but it isn't exact. A headless WebKit census on 2026-09-12
covered 8.0 million (font, word) pairs in 194 families: the last grapheme cluster alone gave another kerning in 389
pairs (in 20px Waseem, `.` after Arabic letters takes nothing before a space, and 2.47px alone), and the last two
matched in every pair, but nothing bounds how far a font's contextual lookups reach. Kerning with the space is common:
PT Sans, Didot, Gill Sans, Avenir Next and 18px `system-ui` each kern more than 2,000 distinct words of the Gatsby text,
and element geometry agreed with whole-word Canvas kerning on 2,440 of 2,551 sampled pairs. In the fixed-pitch Fira Code
and Monaspace Neon, WebKit's layout takes none of the kerning Canvas reports, which the profile doesn't model.

Chrome's layout kerns across spaces, ZWSP, soft hyphens and same-font spans, while its Canvas shapes a string word by
word and so reports none of that kerning for Arial or Times New Roman. The settings that make Canvas shape whole strings
do so only for fonts whose lookups involve the space glyph, and turn features on for every measurement (Engine Facts,
Chrome), so the Chromium profile follows Canvas's cuts (headless Chromium 147, 2026-09-12; Dead Ends, Kerning). In
Chrome 153 a run measured whole equals its words measured with the spaces beside them, less each inner space once, at
all 379,714 positions where both sides hold a character of a script of its own, and misses at 818 of 28,774 where one
side holds none, all in Amiri (redo lab).

Where a pair's adjustment sits decides what a break inside the pair leaves on each side. GPOS pair positioning puts all
of it on the first glyph, and the legacy `kern` table's pairs put half on each (`hb-kern.hh:102-106`): on macOS, Times
New Roman, Verdana, Helvetica Neue, Hoefler Text and 10 more families split it, while Arial, Futura, Gill Sans and
Avenir Next among others don't. Canvas adds both halves, so Chrome's and Safari's Canvas never show the placement (in
Chrome, 26 families and 264 pairs gave the same values under every probe); Firefox rounds each glyph to app units, so it
shows there at the size times 2^k. Chrome keeps kerning when it splits an overflowing word (`'AV'.repeat(116)` at 109px
takes 22 lines, not 24). Firefox shapes words without their spaces and splits them at ZWSP, WJ and other invisible
controls, so its kerning never reaches a space, and after an emergency break inside `AV` in 18px Times New Roman it
paints `V` at 11.833px, keeping half of the adjustment with `A` (redo lab; the `AV` paint in Firefox 155, 2026-09-12).

### Rich Inline Boundaries

Rich inline measures each item alone and takes its breaks from the paragraph's joined text. The measuring half is a
premise with a named gap: Chromium shapes neighbouring same-font spans together, so Arial `community` + `,` natively
fits about a pixel earlier than the two measurements add up to, and Gecko frames kern there too; WebKit spans don't
(2026-09-12). Fixing that is out of scope (Part 1, The Redo And What Counts As Done). Where the flat walker and one
native text node disagree, rich inline follows the flat walker.

#### Joined Text

An item boundary isn't a break opportunity by itself. Chrome runs one line-break iterator over the whole inline
formatting context. Gecko extends a word across text frames until a SPACE, TAB or CR and computes its breaks once; a
font change ends the shaped run, not the word, and installed Firefox 155 wrapped same-font spans like one text node in
every case probed (2026-09-14). Splitting a word changes its segmentation (Thai `ความสวยง` is `ความ/สวย/ง` alone and
`ความ/สวยงาม` joined), so an item's breaks come from the joined analysis under each engine's rules: small kana don't
start a line in Firefox, so items `ちょっと待` and `ってください` keep `待って` together there.

WebKit breaks per inline box, and the WebKit profile follows it: a box's breaks come from its own text, and a boundary
is breakable when the next box's text can break at its start with the previous box's last two characters as context
(`TextUtil.cpp:374-396`). Installed Safari 26.5.2 wrapped Thai, Lao, Khmer and Myanmar words split across items
differently from one text node, and the joined analysis lost the Thai and Lao rows there while Chrome gained on them
(2026-09-12; not rechecked on Safari 27). An item's own flags leave some starts unbroken (at NEL, VT, NUL, a mark
after a ZWSP), and after a break an item whose first word runs past one moves to the next line: at 42 and 46px in 16px
Arial, Safari lays out items `zz` and ` ab\u0085cd` as `zz` / `ab\u0085` / `cd` (webkit-host, 2026-09-26).

A matching line count can come from wrong breaks. An early prototype of the joined rule lost 40 Firefox Myanmar
split-word rows (old suite, removed 2026-09-25), put down to Gecko's segmentation, but the flat prediction already
gave Firefox's lines at 41 of 52 probed widths; the extra line came from widths. The second item starts with U+102C, a
spacing vowel sign that graphemes split from its consonant and browsers shape with it: in 16px Myanmar Sangam MN,
`ဘာသ` measures 41.02px and `ာသည်` 50.78px against 82.03px joined. Breaking at every item boundary had matched those
counts only by breaking where Firefox never starts a line (Firefox 155, 2026-09-14). The width gap is open in
ENGINE_FOLLOWUPS.md. <!-- Q7: recommendation taken; the maintainer hasn't answered -->

A better model also surfaces lucky passes: main gets some rich cases right only because it walks each item as if it
began a line. Classifying an item's first character by the joined analysis (X1, branch `eng-x1`, unmerged at b1fd05fc)
fixed about 2,190 probe cases and lost about 145 rich-only ones (2026-09-27), and waits on Firefox's bidi-control gap
(TODO.md).

#### Items, Spaces And Fits

- Items keep their source identity at zero width: filtering them through the flat walker lost standalone ZWSPs, and
  compressing the item array made cursor and fragment indices disagree. An item's own segments differ from the joined
  text's in 457 of 3,000 random flows, so both analyses stay; the joined pass is about 1% of a message's preparation
  (2026-09-16).
- A collapsed space's presence and advance are separate: its style comes from the first white space at the boundary,
  and a zero or negative advance still gives a break. `measureText('A A') - measureText('AA')` includes A–A kerning,
  so measure the space itself. After forced overflow, keep the negative remaining width.
- Reservation comes before whole-item fit and rejects only a reserved width above the remaining width plus the fit
  epsilon: fit first lost nine Safari forced-overflow matches, a broader guard 62 (2026-09-13; old suite, removed
  2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- A run that began the line still takes overflow breaks at item boundaries: Chrome and Firefox break before the ZWSP
  in `a`/ZWSP/`hello` at width 1 even in one text node. Atomic `break: 'never'` items allow a break on both sides, as
  css-text requires (2026-09-12).
- Native Chrome and Safari spans reserved a hyphen's width for a soft hyphen right before a ZWSP or SPACE at some
  widths (2026-09-12); neither walker does (ENGINE_FOLLOWUPS.md).

#### A Wider Box Never Needs More Lines

Line counts that rise with the width mean a bug. Four fit checks in `src/rich-inline.ts` compared raw widths, giving
11 lines at 115px and 12 at 115.1px (#281, 2026-09-14). An item whose walk ends at a soft hyphen that doesn't fit,
with no earlier break, wrapped before the item where the joined text has no break: `T` and `po\u00add` gave `T` /
`pod` where `Tpo\u00add` gives `Tpo-` / `d` (#323). Blink retries the item at the width less the hyphen, then rewinds
earlier items at the full width. Subtracting the hyphen's width left ranges under 1e-6px that still moved backward, so
the item is walked again to the soft hyphen; in a seeded search, flows that move backward fell from 43-60 to 7-14 per
profile, and the rest are open (#327, 2026-09-15; ENGINE_FOLLOWUPS.md). Fitting and the reported width must use one
width too, or text laid out again at its widest line wraps differently (#308, 2026-09-15); under negative letter
spacing, `x.ywordy\t\t foo` in the Gecko profile still does.

#### Box Edges And Pre-wrap

Shaping stops at a span edge with padding, border or margin; otherwise Blink shapes items together when their fonts are
equal, locale and spacing included, and Gecko when font and language are. WebKit shapes each text box alone, except
complex right-to-left text across undecorated box edges in Safari 27; that and Firefox's end padding on every line are
under Engine Facts. Main charges `extraWidth` on every fragment where engines slice box edges (ENGINE_FOLLOWUPS.md).
Rich `pre-wrap` isn't blocked by the architecture: the per-engine rebuild got 99.3-100% of 1,334 rich pre-wrap cases'
line counts right in each browser (September 2026; TODO.md).

#### Painting Lines

`pages/demos/markdown-chat.md` has the chat's painting patterns. Behind them: margins or spacer boxes keep a gap's
width but drop the space from copied text and misorder mixed-direction lines (#273, 2026-09-13); a gap painted in item
`gapItemIndex`'s element took an error from 3.53 to 0.01px (#310); `dir=auto` per line flips lines (#328). A full-bidi
painter with nested `bdo` overrides and generated ZWJs matched Chrome on 112 of 113 cases but failed in Firefox and
used about 8 times the elements (2026-09-03). A line painted alone is its bidi paragraph's end (U+200D after an Arabic
letter took its isolated form, 11.41px for 3.91px) and never runs Blink's `ShapeLine` under `white-space: pre`; the
painter rules that held in every engine are in `rebuild/DESIGN.md`, "7. Painter", on branch `rebuild-20260916`.

A demo's CSS has to match what Pretext was told: a `letter-spacing: -0.05em` Canvas never saw made `layout()` predict
6 lines for a 4-line headline, and the chat measured links at weight 500 and painted 400 (#264, 2026-09-13). Each fix
used the right idea in one demo and nobody checked the others (#264, #277-#279, #297, #298), hence the demo rules in
AGENTS.md.

### Content Language And Fonts

<!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md folds in here and leaves the doc map -->

How each Canvas takes a language is under Measurement Model, and the browser bugs are in PLATFORM_BUGS.md.

#### What The Page Language Changes

With `line-break` at its default, installed Chrome 153, Safari 26.5.2 and Firefox 155 gave, on `en`, `ja`, `ko`, `zh`
and `zh-Hant` pages with named CJK fonts (2026-09-12):

| Shape | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Small kana starting a line (`日本ァア`, `わかって`) | Every page | `ja` and `ko` only | Never |
| `ー` starting a line after an ideograph or kana | Every page | `ja` and `ko` only | Never |
| Break before `〜` or `゠` | `zh` and `zh-Hant` only | Never | Never |
| Curly double quotes around Latin or Hangul act as brackets (`中文“abc”中文`, `했다.”라고`) | `zh` and `zh-Hant` only | Every page except `ja` | Never |
| Newline next to `。`, `「` or U+3000 | Becomes a space | Becomes a space | Removed on `ja`, `zh` and `zh-Hant` |
| Newline between wide characters | Becomes a space | Becomes a space | Removed on every page |

The engine sources agree: Chromium's `line_normal_cj.txt` for `zh`, Apple ICU's `ja.txt` and `ko.txt` with its
curly-quote patch, and Gecko's newline transform in `nsTextFrameUtils.cpp`. Safari 27 decides a curly quote next to
East Asian text from its own quotation classes, so it breaks around the quotes in `中文“abc”中文` on every page. Under
`ja`, `zh-Hans` and `ko`, Safari and Firefox also shape some of a named font's punctuation differently, and everywhere
the fallback for a character the font lacks follows the language. For `lang=""`, Chrome takes its app language,
Firefox its `x-unicode` font group, whose fallback follows the machine (U+2167 16px against 27.53px under `en`), and
Safari matched `en`.

Unlabeled content takes an engine language a page can't read: Chrome's application locale, WebKit's process languages
and ICU default locale, Gecko's first OS regional-prefs locale (source-read, per-engine rebuild, September 2026). So a
page without `lang` lays out under the runner's languages: on this Chinese-first Mac, Chrome gave results identical to
a `zh` page and Firefox close to them, while Safari matched `en`, and an English Mac would have moved about 430 Chrome
and 780 Firefox results of the old suite, whose pages mostly set no language (old suite, removed 2026-09-25). Probes
and harness cases therefore set an explicit, non-empty `lang`, and the harness pins Chrome's UI to en-US.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

Pretext reads only preparation's language: `<html lang>`, or `setLocale()`'s, or on a page with none in the Chromium
profile `Intl`'s default locale. An element's own `lang` and a `Content-Language` header switch the browser's line
tables and fallback fonts, but Pretext doesn't see them (the API discussion, TODO.md). No locale changes the Thai,
Lao, Khmer and Myanmar word boundaries Pretext reads, under 20 locales in V8 and JavaScriptCore (2026-09-24). In a
worker, Chrome's Canvas takes the UI language, Safari's generic families get none, and Firefox's context follows the
macOS locale (2026-09-18). Reading `<html lang>` costs about 16ns in headless Chromium and 4ns in headless WebKit,
with no style recalculation (2026-09-12; Firefox not measured): the evidence behind AGENTS.md's exception and the
maintainer's condition on content language (Part 1, Lines Drawn).

Chrome's OffscreenCanvas keeps the fonts it chose under the old language until the font string changes: headless
Chromium 147 measured `骨直中文` in `20px "Helvetica Neue"` at 80px under `en` and still after `ko`, where a new context
and the DOM gave 69.2px (2026-09-11, #230). So preparation replaces the context when its language changes. A probe
must put `lang` on `<html>`: one with `lang=ja` on its test element (2026-09-03) measured `foo-bar日本語` in `18px serif`
at 114.867px in Firefox's DOM and 106.983px in the OffscreenCanvas; with `lang=ja` on `<html>`, Chrome 153 and Firefox
155 agreed.

#### Safari's Generic Families

Safari's generic families come from the operating system: under every language whose WebKit script isn't Common, `en`
included, WebKit asks Core Text's `CTFontDescriptorCreateForCSSFamily` with the page language
(`FontDescriptionCocoa.cpp:77-118`), and its OffscreenCanvas has no language (WebKit #285993). So on a page with a
language, as about 87% of pages have, `monospace` draws Menlo on the page and Courier in Canvas. Core Text's answers
for macOS 27's 1,079 locale identifiers come to 32 distinct ones, kept as a default plus 60 languages that differ from
their parent. The table holds OS facts, not font metrics, so it's regenerated for each macOS release, with iOS dumped
separately. <!-- Q3: recommendation taken; the maintainer hasn't answered -->

On 2026-09-24, 14 texts (Korean, Japanese, both Chinese scripts, Latin, Hebrew, Arabic, Thai, Devanagari) at 40px in
the five generic families, on 12 page languages, in Safari 27 on macOS 27, the iOS 26 simulator and an iPhone on iOS
27: OffscreenCanvas and a detached `<canvas>`, with or without `lang`, measured identically throughout, and the page
drew each generic in Core Text's family. With those families named in the Canvas font, macOS's where the context has
it and iOS's otherwise, Pretext matched the DOM on all 14 texts in every generic on 18 page languages, where 0 to 6
had matched, except where the family lacks a character: `monospace` under `ko` (7 of 14; Menlo has no Hangul),
`sans-serif` under `ja` on macOS (12) and `fantasy` under `he` on iOS (5). `system-ui`, a `Content-Language` header
and named fonts missing a character didn't change. Safari can't use Kaiti on macOS 27, which Core Text names under
`zh`, and draws Songti. The process also draws a list in which no family resolves in the script's standard family,
resolves Windows lists (`Meiryo`, `"Microsoft YaHei"` alone) to nothing, and gets a PingFang with no kana
(webkit-host, September 2026).

Rejected: macOS's family and then iOS's in the Canvas font, which sends what macOS's lacks to iOS's (11.6 to 33.8px
off at 40px); a `<canvas>` element, whose `font` setter and `measureText()` run the pending style update
(PLATFORM_BUGS.md); a detached `<canvas lang>`, which has no language (`Element.cpp:4873`); and `navigator.languages`
for a plain Han page, since Safari shows a page only the first preferred language. If WebKit gives canvas `lang` its
`inherit` default, the table can go.

#### `system-ui`, Late Fonts And Kept State

`system-ui` is unsafe on macOS for a separate reason in each engine (PLATFORM_BUGS.md; #336), and Firefox's also hits
any font with an optical-size axis (Engine Facts, Firefox). Guessed substitutions, size
tables and scaling were unreliable (March 2026), and the line breaker takes no font-name rules. After a web font
loads, Chrome's and Firefox's kept contexts pick the family up and webkit-host's may not, and Firefox's late family
names are a hole of their own (PLATFORM_BUGS.md). Any stored answer stays wrong after a late font until cleared: in
the per-engine rebuild, a width store's kept answers gave 4 lines where the DOM had 2, in all three browsers. Main's
width cache is shared per font until `clearCache()`, with no owner or bound, so random IDs and URLs grow it (a
streaming word grew the heap from 1.5 to 9.7MB over 800 edits); the maintainer had assumed it lived as long as a
handle, so the README states both lifetimes.
<!-- Q5: recommendation taken; the maintainer hasn't answered --> <!-- Q5 note: README asks for English family names -->

CSS `font-family` parses the same in all three browsers (123 of 123 probe checks, per-engine rebuild, September 2026);
what differs is which unquoted names are keywords and how names compare. For code that rewrites a list, as the WebKit
profile does: `JSON.stringify` isn't a CSS string serializer, `, monospace` appended after an unclosed string lands in
the name, and a quoted `"system-ui"` is a named family.

Behind README's caveats on settings Pretext can't see (#275, 2026-09-14): a 12px minimum font size in Chrome or
Firefox paints 9-11px text at 12px, which gave 3 of 10 paragraphs a line more, and an inherited `word-spacing` made 5
of 8 painted chat lines overflow. `line-height: normal` differs by browser and font (Helvetica Neue 16px: 18px in
Safari, 19.45px in Firefox; March 2026).

#### Emoji

The Chrome and Firefox bug and the correction are in PLATFORM_BUGS.md. The correction's shape rests on this (March
2026): the widening depends only on the size, is the same across 59 emoji and 7 families, and adds up per emoji.
Compare a Canvas emoji width with the DOM's, never with the font size: Safari's Canvas and DOM both give 16px at 12px,
and taking the DOM as the font size over-corrected Safari by 4px per emoji. Firefox's Canvas sizes Apple Color Emoji
in CSS pixels and its DOM in device pixels: at 12px and DPR 2 the DOM width is 12.5px (2026-09-15). The rebuild's
DOM-free formulas: Chrome's DOM width is `Math.ceil(64 × W(size × DPR)) / (64 × DPR)` at DPR 2 and `W(size)` at DPR 1,
Firefox's `W(size × DPR) / DPR` and Safari's `W(size)` (September 2026). They'd retire the DOM exception and work in
workers, but make prepared widths depend on the DPR at prepare time, which the API discussion decides (TODO.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: decision 4, `devicePixelRatio`, on the API list; side finding 6 as an ENGINE_FOLLOWUPS gap -->

#### Widths That Depend On Context

Whole-run Canvas and DOM agreement, isolated-letter agreement and matching line breaks are separate claims. The font
and Arabic joining probes below run from 6fadbe5 (`bun run font-probe`, `bun run probe:arabic-joining`), a commit from
before their removal (Decisions Log, 2026-09-25); whether they launch under macOS 27 is unknown. The font probe loaded
Shantell Sans from a Google Fonts URL that pins no revision and failed without the face: a fallback font is no
evidence.

**Shantell Sans (#195).** On 2026-09-03, `bold 15px "Shantell Sans"`, 56 `x` in a 140px `pre-wrap` box, gave native
lines of 15/15/15/11 characters against Pretext's 16/16/16/8 in Chrome 152 and Firefox 152, while Firefox's whole-run
DOM and Canvas widths agreed at 501.75px and the letters alone summed to 480.67px. Chrome's first bold `x` measured
8.586px alone and 8.961px in Canvas with the next character kept. Over 48 nearby wrap thresholds, prefix widths
matched 16 per Shantell face in Chrome; keeping one following grapheme matched all 48 in Chrome but 16 per Shantell
face in Safari 26.5.2, where reshaping each line prefix matched 42. That supports a context-aware fit per engine for
these inputs (ENGINE_FOLLOWUPS.md). Pretext's `pair-context` mode, which numeric runs use, measures a grapheme after
the one before it, not the one after. The Chromium profile still sums graphemes, and the case stays on Chrome's
accepted list.

**Firefox's joined Arabic.** Gecko fits a line from the advances of the whole shaped word and doesn't reshape at a
break, so a joined letter keeps its neighbour's form, while Pretext measures the letters beside a soft hyphen, or an
emergency break in a segment under 80px, at isolated widths. A Canvas total is one equation per string, so no recipe
splits a word right for every font. On 2026-09-12, in installed Firefox 155 at DPR 2, the probe compared DOM `Range`
advances in the intact word with Canvas recipes over 200 words from each Arabic and Urdu corpus plus witnesses, 1,808
rows per font setup, passing within 1/60px. The pair check tests at each split between letters L and R that W(L+ZWJ) +
W(ZWJ+R) − W(L+R) is within 1/60px; a false accept is a split it let through whose widths still missed.

| Font setup | Isolated widths | Per-grapheme ZWJ forms | Prefix + ZWJ |
| --- | --- | --- | --- |
| `16px "Noto Naskh Arabic"` | 144 pass / 1,432 fail | 1,458 / 118, 0 false accepts | 1,098 / 50, 0 false accepts |
| `16px Arial` (system Arabic fallback) | 300 / 1,276 | 1,462 / 114, 0 false accepts | 1,104 / 44, 0 false accepts |
| `16px "Geeza Pro"` | 316 / 1,260 | 1,432 / 144, 42 false accepts | 1,095 / 53, 21 false accepts |
| `16px Georgia` (fallback) | 316 / 1,260 | 1,054 / 522, 10 false accepts | 936 / 212, 10 false accepts |
| `16px Amiri` | 82 / 1,494 | 746 / 830, 0 false accepts | 702 / 446, 20 false accepts |
| `16px "Noto Nastaliq Urdu"` | 94 / 1,482 | 438 / 1,138, 12 false accepts | 474 / 674, 66 false accepts |

24px gave the same picture. The ZWJ forms need an `rtl` canvas, and took 66 distinct Canvas queries over the corpus
words against 45 for isolated widths (prefixes 147, the check 243). So they recover joined advances for Noto Naskh
Arabic and the system Arabic font behind Latin stacks, Amiri and Noto Nastaliq Urdu stay out of reach, and a Firefox
rule would need the check with a per-font fallback (ENGINE_FOLLOWUPS.md). Only 8 old-suite rows failed on this (old
suite, removed 2026-09-25).
<!-- Q7: recommendation taken; the maintainer hasn't answered --> <!-- Q12: recommendation taken; the maintainer hasn't answered --> <!-- Q12 note: lam + alef: no change now; its table goes under Dead Ends -->

**Shapers.** `text-shaper` found Unicode coverage gaps, but its segmentation and paragraph breaker aren't
browser-compatible, and HarfBuzz probes didn't reproduce browser widths closely enough (March 2026). Shaping and font
loading in the runtime would be a separate project, which Part 1 rules out (Lines Drawn).

### Bidi Levels

Pretext takes no paragraph direction, and resolves bidi levels only inside the Gecko scan, to split text runs where
Firefox does (`src/gecko-bidi-levels.ts`).

`prepareWithSegments()` used to return `segLevels`, one level per segment from a simplified resolver that came from
pdf.js through text-layout. Nothing read them after `layout()` stopped reordering with them (5ecce72c, 2026-03-04),
and they couldn't give visual order: the resolver took the direction from the first strong character, had no
embeddings, isolates, bracket pairs or line rules, and gave a segment its first code unit's level. Published uses only
guessed a paragraph's direction from them. Removing them (#258, 2026-09-13) made `prepareWithSegments()` 3% faster on
Latin, 8.5% on Arabic, Hebrew and Urdu, and `prepareRichInline()` 15% faster with Arabic items (Node's V8, fake
Canvas); the decision's condition is in the Decisions Log.
<!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: the condition is stated in project voice there -->

Logical-order breaks and summed widths give the right lines: at chat widths, 44 of 44 heights matched in Chrome 153
and Safari 26.5.2 over 11 messages at 4 widths, and Firefox 155's misses were URL and hyphen rules (2026-09-13).
Painting went wrong. A DOM element holding the paragraph needs only its direction, but a line drawn alone, as by
Canvas `fillText()`, is a bidi paragraph of its own: GNU FriBidi 1.0.16 orders the second line of `abc ابج 1+2 xyz`,
broken before `1+2`, as `2+1 xyz` in the paragraph and `1+2 xyz` alone, and numbers or punctuation at a line's edges
and isolates across lines moved the same way on 21 lines per browser in the chat probe. A bidi API for custom
rendering would need a paragraph-direction option, levels per code unit, and per-line reset and reordering (UAX #9 L1,
L2); a known direction would also let the WebKit kerning guard keep kerning. A direction option is on the API
discussion list (TODO.md), and whether mixed bidi fits Pretext without new broken assumptions is the maintainer's open
question.
<!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: decision 3, a `direction` option, on the API list --> <!-- Q18 placeholder: the public status comment on #321 may bring the maintainer's answer on a direction option; it goes here -->

The engines' algorithms differ: Blink and WebKit run ICU's `ubidi_setPara`, Firefox the unicode-bidi crate 0.3.15, and
they disagree on 130,661 of 300,000 short fuzz strings (the unidirectional shortcut, removed characters' levels,
paragraph splits at class B, brackets under overrides). So the rebuild ported ICU 78.2's `ubidi.cpp` line by line (844
lines), which matched icu4c 78.3 and libicucore over 770,241 BidiTest runs, 183,379 BidiCharacterTest lines and
405,000 fuzz strings, instead of one resolver with per-engine switches (Dead Ends); macOS 27's libicucore gives
U+F7F0-U+F8FF Apple's own classes (per-engine rebuild, September 2026). Nothing checked in would catch a subtle
bracket-pair (N0) error in main's Gecko port.

The Gecko scan resolves levels with a port of servo/unicode-bidi, returns none, and takes every paragraph as
left-to-right (ENGINE_FOLLOWUPS.md). Before #365 the pass took 38-46% of the Gecko profile's analysis of right-to-left
text and changed 0 of 183,000 segments, since direction changes fell where segments end anyway. It matters where a
level run starts inside a cluster: installed Firefox 156.0.1 breaks `aa בבבב🏻` at 60px in 16px Arial before the
skin-tone modifier, where the profile without levels breaks after `aa`, and without levels 22 pinned harness cases are
lost, all Balinese and Batak vowel killers after Arabic or Hebrew. Since #365 (2026-09-27) levels resolve only where a
level run can start inside a cluster (`levelsMayMatter()` holds the argument): for 262 of the harness's 10,733 texts
with a right-to-left unit and no corpus or chat text, at about 150-200ns a unit in Firefox 156. Over 63 million
strings (seeded mixed-direction ones, BidiTest and BidiCharacterTest with extenders put in, every string of up to 4 or
5 units over one-unit alphabets, corpus windows), the scan gave the results of resolving every text, and the unit
tests fail without each rule the argument uses: the method to reuse when a port claims to be exact.

Rejected: resolving levels whenever a cluster holds more than one code point, exact with a shorter argument, but vowel
marks and emoji put one in 37% of the Arabic paragraphs and 57% of the chat's right-to-left texts, so it saved only
5-15%; and setting the whole text run up again where levels split it, which made the analysis 8-17% slower than main's
where levels resolve, against within 5% for setting up only the words the splits cut. The two setups share one
word-end test (`endsWord()`), whose call makes Firefox 156 prepare long breakable runs, pre-wrap chunks, keep-all CJK
brackets and Latin messages seen before 2-5% slower than main; written out again in the first setup's loop, they read
within noise, and the copy isn't kept (Decisions Log, 2026-09-26).

### Keeping Work Bounded

Small operations become quadratic when they repeat over growing user text. The browsers' own line breaking is linear
in the text's length, so exactness forces nothing worse: the per-engine rebuild's slow giant paragraphs came from its
own code, which rescanned to the end of the text from every line start. Browser ratios below are same-document
interleaved in the foreground, two sessions per browser, against main as it was before each change.

#### Quadratic Traps

The commits keep the details; some of the code they fixed is gone, so read them as kinds of trap:

| Repeated work | Fixes to consult |
| --- | --- |
| Reclassifying growing punctuation or Arabic strings, or rescanning cleared slots | `30854d7`, `2148b90`, `4cb8b24`, `f0a326d` |
| Rebuilding growing CJK or keep-all units | `eb3bbbe`, `f0a326d` |
| Measuring every growing Canvas prefix | `fcf9c62` |
| Searching hard-break chunks from the start for every streamed line | `2c52171` |
| Retrying white space and font-size suffix regexes; restarting preferred-hyphen searches | #221 |
| Measuring each run of a chain of combining marks after the whole chain before it | #351 |

The regex failures needed internal white space followed by content, or digit runs without `px`; the preferred-break
one needed one long hyphenated run over many lines. An arbitrary continuation must seek to its starting boundary; an
already positioned scan can carry its index. Before #351 (2026-09-26), an unbroken word of soft-hyphen and accent
pairs took 64ms at 1× and 3,957ms at 8×, and the first fix, whose claims rested on runs of 1-2 accents, trimmed the
context too far past runs of about 95 and moved Safari's widths by up to 7px: test long runs. Chains are linear now,
but `x` with 4,000 U+0301 and then 4,000 control and mark pairs still submits 33 million units to Canvas offline. A
`prepare()` that takes seconds, such as one 160,000-character word, can get the Chrome tab killed as hung (Chrome 153,
September 2026).

#### Canvas Work

Count the text submitted to Canvas, not just calls: measuring every prefix or suffix is quadratic even when each
position asks once. Prefix fits cap a segment at 96 graphemes and use pairs beyond; they run in the WebKit profile
(numeric runs aside), under letter spacing in every profile, and in the Gecko profile in segments of 80px or more. The
cap bounds the amplification, not the shaper's own cost, and context queries must charge the overlapping source too.
Cold-cache scaling probes tell cost from reuse; a numeric stand-in Canvas measures algorithmic work, not browser
throughput; and a repeated prepare isn't a stable timing in WebKit, whose width cache samples calls
(harness/README.md, Bench).

As reference points: over the corpora, main before #340 spent 46ms analyzing and 70ms measuring of Chrome 153's 115ms,
but 46ms and 305ms of Safari 26.5.2's 350ms (2026-09-15), so a large Safari gain has to come from measuring less.
Korean, Thai, Khmer, Burmese and Hindi cost Chrome about 4 times English under system fallback, and twice when the
font list names a font for the script.

#### The Walkers' Shapes

`layout()` counts through `countPreparedLines()`, the line APIs walk through the simple stepper, and text they don't
cover takes the full walker. Each shape below was measured; the PRs hold the per-row tables.
- **One walker for all text**: the full walker costs about 3 times the counter per segment in Chrome and Safari and 5
  in Firefox, so chat `layout()` would take 2-7 times main's time (#340, 2026-09-24).
- **A count that sets a line's width from its first segment**, instead of starting at 0 and adding: 1.4-1.7 times
  main's `layout()` time on chat in Firefox 156 (#340, 2026-09-23).
- **The full walker stepping one line per call**, repeating its setup each line: short lines 1.07-1.40 times main's
  time in Chrome 154, Firefox 156 and Safari 27 (#359, 2026-09-26).
- **One loop for both walkers**: chat walks 1.06-1.10 times main's time in Chrome and 1.18-1.32 in Firefox (#359).
- **One path to admit a whole segment**, for fresh lines and lines with content alike: 1.03-1.17 times main's
  `layout()` time in all three browsers (#359), so the second path is a copy kept for speed everywhere, not for one
  JIT.
- **Handing the line APIs' unbroken-boundary lines to the full walker**, as `layout()` does for text with a boundary
  the scan doesn't break at (before NEL, or in Firefox after a space before a bidi control, which it leaves out of its
  text runs): the same lines, but where a line's space overflows, the two walkers' sums differ in the last bits, in 99
  of 96,470 offline line checks in the Gecko profile (#350, 2026-09-26).

Plain code over dead code (#364, 2026-09-26): removing the three pieces #357 kept for Chrome's JIT costs Chrome 154
11% on rich stats, 5% on letter-spaced CJK `layout()` and 8-13% on preparing long breakable runs and pre-wrap chunks,
in both sessions; Firefox 156 moves 2% at most, and Safari 27 reads within noise apart from Arabic resizes at seen
widths, 13% slower against 5% for its control copy (Decisions Log, 2026-09-26). Arrays matter too. A `Uint8Array` of
flags per text made one-word `prepareWithSegments()` a third slower in Node 23's V8 and rich-inline preparation 12%
slower in Chrome 154, so the analysis builds a plain array; segment texts sliced where measurement reads them, not
once in the analysis, made Firefox 156 prepare rich items 11-19% slower (#360, 2026-09-26). An array made by
`Array.from({ length }, fn)` made Chrome 154 prepare seen CJK 5.7% slower, and overflow trims read in
`countPreparedLines()`'s loop made Firefox 156 count long breakable runs 13-26% slower, so a handle with trims counts
through the stepper but keeps the simple walk, off which Chrome 154's line APIs ran 62-108% slower on the bench's CJK
messages (#366, 2026-09-27).

`measureAnalysis()` keeps its helpers as closures over its locals: hoisted to module functions, they measured the same
text in all four profiles offline but took 16 more lines, so they weren't timed, since a hoist lands only if it
removes lines and the bench shows a gain (2026-09-26). AGENTS.md's locals rule is for line walkers.
<!-- Q15: recommendation taken; the maintainer hasn't answered --> <!-- Q15 note: line count as complexity's usual proxy -->

#### JavaScript Engines

Part 1 (Engineering) says when an engine fact may shape code. These did, or moved a measurement:
- **V8's inlining budget.** V8 inlines a function only while its bytecode stays under about 460 bytes, minified or
  not. With the long-chain loop inside, `getMarkContext()` took 519 bytes in Node 23's V8 12.9 and stopped being
  inlined into `measureAnalysis()` (`--trace-turbo-inlining`), and Chrome 154's `prepare()` ran 0.4-2.6% slower on
  most bench rows; with the loop in `getLongMarkChainContext()`, 374 bytes and every row within noise (#351,
  2026-09-26).
- **JavaScriptCore's type checks.** With a segment's width sum inline in `measureAnalysis()`'s loop, the DFG tier
  (Safari 27, macOS 27's `jsc`) failed a type check 25,508 times in 80 passes over letter-spaced CJK and never reached
  the FTL tier, and Safari prepared letter-spaced CJK 45% and keep-all CJK brackets 59% slower; with the sum in
  `getTextSegmentWidth()`, 9% and 10% faster than main (#358, 2026-09-26).
- **Captured numbers and loop bounds.** V8 boxes a number a nested function captures: a write cost 12-14ns in the
  full walker against about 1ns for a local. JavaScriptCore types an infinite default loop bound as a double, and Bun
  walked letter-spaced and pre-wrap text 30-65% slower with one. Fixing both halved `layout()` of letter-spaced CJK in
  all three browsers (#340, 2026-09-24).
- **Class fields in Firefox.** Any class field seems to make Firefox 156 compile the whole bundle up front: a fresh
  page took 4.5-4.8ms to compile the minified bundle with the scans' state in four classes with fields, and 1.9-2.2ms
  in plain objects or with the fields emptied out or moved into constructors. V8 and JavaScriptCore didn't care (#340,
  2026-09-23).
- **A loop slows once a check in it has held.** A check in the counter's loop that handed unbroken-boundary lines to
  the full walker slowed the count of all other text up to 1.6 times in Firefox and 1.3 in Chrome, though the check
  alone cost nothing (#350, 2026-09-26).
- **Inline caches.** Once `layout()` has stepped such text, Chrome's `walkLineRanges()` of simple text, which shares
  the stepper, takes 2-4% more time than a second copy of main, by a mechanism not found; V8's caches do turn
  polymorphic over the two handle kinds (`--log-ic`), but one shape for both didn't help Chrome and cost Firefox up to
  14%. A private stepper copy, 77 lines, is the only cure measured and isn't taken (#350; Dead Ends,
  Simplifications Held Back).
- **String keys.** V8 internalizes a string key on `Map.get` or `set`, which can change the string's storage (String
  Storage); SpiderMonkey charges 44-48ns per `get` for short keys even on the same string; a lookup in front of a loop
  costs its latency, 23-50ns for a `get` that costs 11ns alone (per-engine rebuild, September 2026).
- **Smaller costs.** A per-word regex in `prepare()` shows up (1.5% of a cold `prepare()` in V8, #248); V8 builds 172
  script regexes on a page's first Myanmar `prepare()` behind a shaping-cluster screen, 26-66ms once
  (ENGINE_FOLLOWUPS.md); an `Intl.Segmenter` per `prepare()` was once the main cold cost; and spreading a typed array
  into `String.fromCharCode` cost SpiderMonkey 8.7µs a message.
- **Measuring.** Bun overstates memory savings, since JavaScriptCore stores array entries at twice V8's size, and two
  identical builds in one page differ by 2-3% in JavaScriptCore (harness/README.md, Bench). A JSON copy of a handle
  loops forever in the walkers (Decisions Log, 2026-09-25).

#### String Storage

In Chrome a Latin-1 string's storage decides how Canvas shapes it. Blink shapes a one-byte string as one Latin segment,
and runs its script segmenter over a two-byte one alone (`harfbuzz_shaper.cc:1072-1101`): in 48px Amiri, `)` × 15 is
183.60px one-byte and 329.76px two-byte, while plain letters and digits measure the same. V8 keeps a string one-byte
when every unit is at most U+00FF and it was built that way (parser text, literals, `JSON.parse` and their
concatenations), keeps a slice of 13 units or more cut from a string that holds a unit above U+00FF two-byte, and
copies shorter ones into one byte. A page can't see or choose storage, and an offline replay can't either. Using a
string as a `Map` key internalizes it, and V8 makes the internalized copy one-byte when its units fit only if that
lookup is the first to hash the string (`known_one_byte_content`, `string-table.cc:411-421`); a two-byte string hashed
earlier keeps two-byte storage. Nothing hashes a segment before its metrics lookup in `getSegmentMetrics()`, so every
Latin-1 segment reaches Canvas one-byte and is measured as Latin. Chrome's page paints a run of script-neutral
characters that way after Latin text and in text that is all Latin-1, but not after Arabic or Han, or between em
dashes with no letter around: Blink gives the run the script of the text before it, and only a run at the paragraph
start takes the script after it (`script_run_iterator.cc:503-516`; ENGINE_FOLLOWUPS.md). (Chrome 153 and 154,
2026-09-18 to 09-27.)

Rejected (2026-09-27): keying the caches by another string, so that Canvas gets each slice as it was built. It changes
only runs of 13 units or more cut from such text, and moved none of 41,788 Chrome predictions. Of 18 fonts probed, only
Amiri and Noto Naskh Arabic measure the two storages differently (17 of 504 font and run pairs). On templates in those
fonts it fixed every such run after Arabic, Han or an em dash, and broke every one after Latin in text that also holds
an emoji or `ā`: it breaks `)` × 15 between `abc ` and ` بتث`, and fixes it between `بتث ` and ` abc`. The storage
follows a slice's length and the text it was cut from, not the text before the run, which the page follows. It also
costs a string per lookup, and a canvas asked for the same characters in both storages answers both with whichever it
shaped first (Engine Facts, Chrome). In the per-engine rebuild, a text-keyed lookup added before each Canvas call moved
254 of 380 predictions in a set built to catch it (Chrome 153, September 2026).

### Scrolling And Scrollbars

The demos' scrolling rules (Part 1, Demos And The Chat) rest on these facts; `pages/demos/markdown-chat.md` gives the
app-facing patterns. Unless stated, measured on 2026-09-15 on macOS 26 in installed Chrome 153, Safari 26.5.2 and
Firefox 155.

#### Scroll Position

- iOS Safari reports `scrollTop` past either end while rubber-banding. The chat clamped its target and called
  `scrollTo()` every frame, so the bounce jittered; special-casing that frame was rejected, and since #331
  (2026-09-16, on the maintainer's iPhone) the chat writes only when layout moved the anchor.
- Firefox reads `scrollTop` back through float32 at large scroll heights, so a target and its read-back differ, which
  caused a redundant `scrollTo()` every frame at the end: store the value read back. Adding each frame's height change
  to the rounded `scrollTop` drifted 3-4.25px over a 15-step resize in Safari and headless Chrome; keeping the
  anchor's on-screen offset from when it was picked doesn't. When the viewport is shorter than the last item, that
  item is the anchor, or a prepend jumped about 1,180px. A stand-in for "layout moved the anchor", such as "the window
  width changed", would miss a height change.
- On macOS a trackpad fling reaches the page as wheel events, so a `scrollTo()` after content loads above only moves
  its start and the fling carries on; on iOS the fling is the system's, and a `scrollTo()` may stop or jump it
  (unchecked on a device). Safari's wheel scrolling after a page's `scrollTo()` is in PLATFORM_BUGS.md.

#### Scroll Height

Chrome and Safari cap an element near 33.5 million px and Firefox near 17.9 million, going by engine coordinate
storage, not measured, and iOS Safari can crash above about 500,000px while the scrollbar is dragged (vibescript
`Scrolling.md`). The 10,000-message chat is 1.0-1.8 million px. On the maintainer's iPhone (2026-09-16), main at
10,000 messages scrolled fine, and at 100,000 froze during preparation and crashed, where draft #312's chunked window
worked (Dead Ends). Fixes for the cap that need no chunking, none built: owning the scrolling in JavaScript, which
`Scrolling.md` advises against, a scroll area a few screens tall with content shifted near its edges, or lossy scaled
scrolling. Without `<!DOCTYPE html>`, quirks mode made `documentElement.clientHeight` the document's height, so the
masonry demo mounted every item and crashed iOS Safari (ffc2a757, 2026-03-23).

#### Classic Scrollbars

Classic scrollbars shift content whenever a box starts or stops overflowing, for any reason, or when a showing
scrollbar's thickness changes (a live overlay-to-classic switch, `scrollbar-width`, a sized `::-webkit-scrollbar`,
which also forces classic scrollbars in Chrome on a Mac that hides them). Hover never changes layout. No window
`resize` event fires; `visualViewport`'s and ResizeObserver's do. They're common: macOS set to "Always", or to
"Automatically" with a mouse without gestures, which switches live; Chrome on Windows and Linux; Firefox on Windows
10, or on 11 with "Always show scrollbars". A live switch nudges the page under every option, and only
`scrollbar-width: none` or a fixed `::-webkit-scrollbar` width avoids it, accepted as rare. Tested with forced classic
scrollbars on macOS only.

With `html { scrollbar-gutter: stable }`, Chrome's `documentElement.clientWidth` reports the full width until a
scrollbar is drawn (1200 against a body of 1185), which is why demo pages read `document.body.clientWidth`. That read
needs a body with zero margin, border and padding, doesn't exist in a `<head>` script, and forces stale layout, so
read before writing; height stays `documentElement.clientHeight`, since `body.clientHeight` is the content's. With
classic scrollbars, a stable gutter centers content 7.5px left of the window's center (`both-edges` centers it for
15px of width). CSS `@media` widths include the scrollbar and `clientWidth` doesn't, so equal JS and CSS breakpoints
disagree by 15px, and `100vw` includes it: hence breakpoints in the model. `html { overflow-y: scroll }` was dropped
for painting an empty track on short pages.

Measuring the scrollbar (2026-09-16, Safari 27 on macOS 27): a hidden probe element reads 0 in Safari 27 while the real
scrollbar is 13px, and in Firefox a hidden probe stayed 0 after a live switch while real scrollers went to 15px.
`scrollbar-gutter: stable` sets aside nothing for a `::-webkit-scrollbar` width in Safari, and Safari 27, like Chrome,
ignores `::-webkit-scrollbar` once `scrollbar-width` or `scrollbar-color` isn't `auto`. Since Chrome 145, macOS Chrome
rubber-bands inner scrollers too. To force classic scrollbars in a probe, launch Chrome with `-AppleShowScrollBars
Always` (that process only) or use a fresh Firefox profile with `ui.useOverlayScrollbars = 0`; an injected
`::-webkit-scrollbar` behaves differently from real classic scrollbars.

### Engine Facts

What one engine does that no topic above takes. Source lines are from the builds the scans were ported from: Blink at
Chrome 153.0.8010.48, WebKit at Safari 27.0's 7625.1.29.11.27 and Gecko at Firefox 156.0. Chrome 153 is .48 or .50,
the same source, and Firefox 156 is 156.0 or 156.0.1, whose recordings match. Most came from the redo's lab, whose
fuller numbers are in `rebuild/DESIGN.md` and `rebuild/research/` on branch `rebuild-20260916`, with test pages for the
unfiled bugs in `rebuild/platform-bugs/pages/`. A browser update can move any of this: `bun harness repin` shows what a
new build changes, and a fact read in source needs reading again.
<!-- Q10 placeholder: the rebuild's LEDGER.md on that public branch describes a withheld report, so this points at the pages directory only until the maintainer answers -->

#### Chrome (Blink)

**Canvas totals and font sizes.** `measureText()` returns a float32 total of Blink's 16.16 sums, exact only below 256
zoomed px (128 CSS px at DPR 2), while Blink keeps every glyph position exactly. Whole zoomed sizes stay exact in
fonts of 2048 units per em (SF, Arial, Times New Roman) but aren't guaranteed in Helvetica Neue's 1000, and negative
spacing that brings a total under 256 px doesn't make it exact. Blink floors the zoomed size to 1/100 px in float32
(`font_description.cc:271-282`), so 16.8px is 16.79 px in Canvas but 33.59 zoomed px in the DOM. (Chrome 153,
2026-09-16 to 09-23.)

**The shape cache.** Chromium #560614560's cache (PLATFORM_BUGS.md) keys text by characters and direction only
(`frame_shape_cache.cc:45-65, 135-149`), though Chrome shapes a one-byte string as one Latin segment and a two-byte
one by script, so whichever storage a canvas shaped first answers both (Keeping Work Bounded, String Storage). It
holds 32,768 strings and as many words and drops the least recently used half when full (`:12-16, 93-104`); an
OffscreenCanvas never gets the frame-end signal that trims it, and past the bound a shared canvas laid kept paragraphs
out 1.24-1.33 times slower. Between fresh runs, 185 of pre-#340 main's Chrome predictions moved, all in Amiri: those
passes were page history. Hence one context for the page, kept through `clearCache()` (AGENTS.md). (Chrome 153,
2026-09-12 and 09-17.)

**`system-ui`.** Blink's font cache key holds the zoomed size while `opsz` follows the specified size
(`font_description.cc:308-331`, `font_platform_data_mac.mm:170-178`), so a `system-ui` width depends on whether the
DOM or a Canvas made the font first, and a context at `text-rendering: auto` shares the page's key: measuring can move
the page's own text (16px drew 71.24 px wide instead of 81.125 px). `optimizeLegibility`, which Chrome's own measuring
uses, keeps a context apart; main's keeps `auto`. Issue #336 has the rest. (Chrome 153, 2026-09-16 to 09-18.)

**HanKerning.** The profile adds Blink's halts itself (`src/han-kerning.ts`) because Canvas halts a pair only inside
one Canvas word and cuts around each CJK character: in 16px Hiragino Sans, `「」「」「」` is 96 px in Canvas and 80 px
painted. That costs 18 Canvas calls a font plus 2 per distinct trimmed character. Blink also narrows CJK punctuation
where the script changes inside one shaping call: a `}` pairing with a `{` after Latin letters resolves as Latin, so
Chrome halts the `。` before it. The profile misses that; the redo has it (1f380af7). Chrome 153 began halving a
closing mark that doesn't fit at a line end, and Chrome 152 didn't. (Chrome 153, 2026-09-17 to 09-26.)

**How Canvas shapes a string.** By default Canvas shapes word by word (`plain_text_node.cc:84-155`), cutting at
U+0020, TAB and ZWSP and around each CJK ideograph and symbol, so a string loses its kerning against spaces
(`AV To We. V, A Y o` in Times New Roman: 262.45 px against the DOM's 254.23). `optimizeLegibility` shapes whole
strings only in fonts whose lookups involve the space glyph (`font_fallback_list.cc:264-277`): Arial, Times New Roman
and PingFang, not Georgia, Helvetica Neue or Verdana (Dead Ends, Kerning). U+2028 in place of each U+0020 keeps a
string in one piece, legacy `kern` fonts included, though the string turns two-byte and U+2028 takes no word spacing.
Canvas shapes each ICU level run in its own direction where the DOM shapes a group in one, and a two-byte RTL group
inside U+202E … U+202C is one level run. It turns U+FFFC into U+200B (`character.h:167-175`) and measures nothing
where the DOM draws a fallback glyph 1 em wide. (Chrome 153, 2026-09-16 to 09-23.)

**Letter spacing and tabs.** Blink gives cursive-script runs no letter spacing except on spaces
(`shape_result.cc:977-990`), spaces a glyph cluster once, and turns liga, clig and calt off under any spacing
(`font_features.cc:54-86`). Its tab stops are eight Canvas space advances rounded up to 1/128 px at DPR 2
(`simple_font_data.cc:225-240`); read in source only, it skips to the next stop when less than half a space is left
and counts letter spacing in stops. The profile models neither the cursive rule nor the skip (ENGINE_FOLLOWUPS.md).
<!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: side findings 2 and 3 become ENGINE_FOLLOWUPS gaps -->
(Chrome 153, 2026-09-16.)

**Line breaking.** Blink's ICU restarts at every line start with no context, so LB20a applies there (`a‐b` under
break-all and loose gives `a` / `‐b`); the Blink scan makes one pass per text, differing in 86 of 188,274 verdicts (old
suite, removed 2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered --> Blink finds the last
offset that fits from the glyph positions, then the break at or before it, so a line ends before a ligature unless its
first cluster doesn't fit, and it reshapes a wrapped line's start from the first safe offset, correcting the space by 0
or −1 LayoutUnits (`shaping_line_breaker.cc:309-324`). Any `text-align` but the start side, or a decoration, reshapes a
line that ends at a space (`NeedsAccurateEndPosition`), dropping the kern against that space. U+2000-U+200A are ordinary
text, since only U+3000 counts as another space separator. No JavaScript API gives Chrome's hyphenation data, so
`hyphens: auto` can't be ported. <!-- Q3: recommendation taken; the maintainer hasn't answered --> <!-- Q3 note: P-SCO-22: out of scope today -->
(Chrome 153 source, 2026-09-16.)

**Languages.** Chrome ignores `--lang` on macOS, `navigator.language` follows the accept languages rather than the UI
language, and DevTools locale emulation (Playwright's `locale`) changes `Intl`'s default locale but not Blink's, so a
test under it sees Pretext and Chrome disagree for a reason no user meets. Generic `serif` follows the process
languages (`Hamburgefonstiv` in 16px serif: 114.40 px under zh-CN, 111.70 under en-US). The machine's UI language can
pass for a rule: pre-#340 main's quote rules, fitted on a Chinese-UI Chrome, passed 49 cases that all fail under an
English UI. (Chrome 153, 2026-09-19 to 09-23.)

**Canvas prices.** A first ask costs about 1 µs plus 0.06 µs a character (0.25 µs for Arabic), a repeat on the same
canvas 0.14 µs at any length while another canvas pays in full, a new font size 30-45 µs, and a new context measured
once 21-26 µs. A question costs Chrome about 1 µs from scratch, WebKit 0.12-0.17 µs and Firefox 0.22-0.32 µs, so
Chrome's time is its question count. (Chrome 153, 2026-09-18 and 09-19.)

**`getTextClusters()`.** Behind the `ExtendedTextMetrics` flag (off in Chrome 153; in windows and workers), it returns
every cluster position of a string as Blink's own 16.16 sums, across fallback fonts and spacing. It took the redo's
chat message from 199 Canvas calls to about 31, and 10,000 messages from 2.0 s to 0.7 s. Handed layout's run
(`optimizeLegibility`, U+2028 for U+0020, the zoomed size), 12,987 of 13,035 cluster starts floored to the DOM's. It
says nothing of safe breaks, which Blink keeps per glyph; a flag for them would make a width change cost no calls. As
of 2026-09-23 (read through a summarizer) its Intent to Ship had slipped to Chrome 157 at the earliest and WebKit was
negative. Shipping it reopens the redo's speed floors (Dead Ends, The Per-Engine Redo); its two filed bugs are in
PLATFORM_BUGS.md. (Chrome 153, 2026-09-20.)

**Costs that aren't Pretext's.** Resolving a fallback font the first time is browser work: for a Devanagari word,
3.0-3.25 ms in Helvetica and 16.6 ms in SF Mono in Chrome, 0.4-6 ms in Safari and 0.2-1.7 ms in Firefox, and moving it
to startup doesn't shrink it (installed browsers, 2026-09-16). `TextMetrics::Update` computes every run's ink box on
each `measureText()` (`text_metrics.cc:95-224`) though most callers read only `width` (Dead Ends, Simplifications Held
Back). Blink's inline-box rules, such as the empty first line it makes when text-indent alone overflows a narrowed
slot, where a port that forgets placed floats loops forever (`line_breaker.cc:4225-4248`), are in `rebuild/DESIGN.md`.
(Chrome 153 source, 2026-09-16 to 09-20.)

#### Safari (WebKit)

**Safari 27's breaks.** With the same libicucore 78.1, Safari 27's own source breaks differently from Safari 26: curly
quotes and guillemets get opening and closing classes and a local LB19a rule; U+2028 and U+2029 force a break in every
white-space mode, where Chrome takes U+2028 as a space; keep-all text holding a character above U+00FF breaks after
punctuation (WebKit #312099's fix, `BreakablePositions.h:268-271, 297-298`), even inside `1,000,000` or `12:30`, which
reaches every Hangul text node, an unfiled regression (PLATFORM_BUGS.md); and a first character that doesn't fit keeps
the characters after it that can't start a line (`InlineContentBreaker.cpp:124-158`). What following 27 alone costs
Safari 26 is in the Decisions Log (2026-09-16). (Safari 26.5.2 against 27.0, 2026-09-16.)

**Page history.** WebKit's process-wide `TextBreakingPositionCache` keys break positions by text, a style context that
doesn't tell pre-wrap from break-spaces, and the origin, with no font, direction or storage, and fills as a block's
line layout is torn down. So identical text and style break differently after other layouts: `break-spaces` text after
the same text in pre-wrap keeps six spaces on one overflowing line, and 16-bit keep-all breaks carry over to 8-bit
text. `TextMeasurementCache`, widths keyed by text alone, moves float32 line edges too. In webkit-host 55 of 19,933
cases changed with run order (Chrome: 0), and 1,707 of pre-#340 main's 2,442 webkit-host wins were history; history
both orders share shows only in a case run alone in a fresh process. (webkit-host, 2026-09-17 to 09-24.)

**String storage.** A text node is 8-bit when built from Latin-1 text and 16-bit once its leaf held a character above
U+00FF, and WebKit's layout reads it: an emergency break of 8-bit text keeps one code unit at the line start, where
16-bit text also keeps the characters after it that can't start a line, and keep-all `abcd,efghé` is 2 lines as 16-bit
and 1 as 8-bit. JavaScriptCore's `Response.json()` of a body with any raw character above U+00FF gives 16-bit strings
even for ASCII values (`LiteralParser.cpp:896-899`), so one CJK case changed how a batch's ASCII cases broke: keep
probe payloads ASCII. The WebKit scan decides from the text's characters and can't see storage the text inherits.
(webkit-host and Safari 27.0, 2026-09-16.)

**Measuring.** WebKit picks a width's simple or complex code path from the measured string's own characters
(`FontCascade.cpp:304-309, 708-730`), and the paths differ by a float32 step at fractional sizes, so a fit at an exact
threshold can flip. It doesn't quantize font sizes, and its inline positions are float32 CSS px, off the 1/64 px grid
its line breaking follows. Its fixed-pitch shortcut reads a Core Text trait Canvas can't show
(`FontCoreText.cpp:753-785`), and the DOM then counts each character of non-ASCII text at the space's width (16px
Courier `ΩΩΩΩ`: 38.40625 px, against Canvas's 49.15625). `monospace` resolves to Courier, and neither equal advances
nor family names reveal the trait; the profile doesn't model it. (webkit-host, 2026-09-16 to 09-18.)

**Overlong words.** Prefix fits beat single graphemes in Safari (307 misses against 1,018 in a 2,564-case sweep;
Safari 26.4, 2026-06-22). Safari's extra Canvas calls come from WebKit's own layout: prefix widths for overflowing
words (62-68% of its calls, 2026-09-16) and a word measured with the space after it (95% of the extra calls after
0.0.9, #236); the only principled cut saved 0.6%. When `breakWord` keeps a prefix of an item W wide, the rest gets
float32(W − prefix) without being measured, and remainders compound (`AbstractLineBuilder.cpp:54-98`):
`'AV'.repeat(17)` in 16px Arial under `overflow-wrap: anywhere` at 113.5px starts lines at [0, 11, 22], where fresh
widths give [0, 11, 22, 33]. So resuming needs the whole line start, not an offset, and a line painted alone can't
reproduce it. (webkit-host, 2026-09-19.)

**Soft hyphens.** The line builder counts the hyphen, with its 1/64 px allowance, when it tests a candidate that ends
in a soft hyphen (`InlineLineBuilder.cpp:1154-1161`), and a soft hyphen is discretionary only at a WebKit item's end.
With no break that fits, Safari overflows with the hyphen where Chrome and Firefox break inside the word
(`abc­def­ghi` at 26px; Safari 26.5.2), and inside spans it charges the hyphen and then backs off to an earlier break,
which the WebKit profile doesn't model (webkit-host, 2026-09-26).

**Box edges and zoom.** Safari 27 shapes complex RTL text across undecorated inline box edges as one run
(`TextShapingAcrossInlineBoxes`, `InlineLineBuilder.cpp:780-1028`), so such a box's width is its share, which Canvas
gives only at the run's ends; when RTL reordering splits a span, only the first box gets the start edge
(`computeIsFirstIsLastBox`). Hyphenation points come from Core Text, out of Canvas's reach. <!-- Q3: recommendation taken; the maintainer hasn't answered -->
Page zoom scales lengths and font sizes before the
1/64 px truncation, Canvas never applies it, and a page can't tell zoom from `devicePixelRatio` (read in source only).
(WebKit source, 2026-09-16 to 09-18.)

**Tabs.** Safari 27's source still skips to the next stop when less than half a space would remain
(`FontCascadeInlines.h:76-93`, read 2026-09-27), as the profile does. On Safari 26.5.2's rows that rule fixed 70
left-to-right and 8 right-to-left tab rows, where WebKit trunk's threshold, half the advance of `0`, lost 10 and 6 more
(old suite, removed 2026-09-25), so check which one each Safari ships. <!-- Q7: recommendation taken; the maintainer hasn't answered -->
Stops use the font of the inline box that holds the
tab (WebKit #230339, open since 2021). (Safari 26.5.2, 2026-09-12.)

**NEL and keep-all dictionary scripts.** The NEL letter spacing the profile models (`src/analysis.ts`) was measured
only in Safari 26.5.2. Under keep-all, Safari 26.5.2 broke Thai, Lao, Khmer and Myanmar only at spaces and ZWSP, and
the WebKit scan matched 314 of 315 such rows where pre-#340 main matched 153 (old suite, removed 2026-09-25), so its
27.6% more Canvas calls there were the price of right lines (2026-09-15).
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

**Emoji and the segmenter.** WebKit's DOM emoji width equals OffscreenCanvas's at the CSS size, bit for bit from 8 to
32px, so a "size × DPR ÷ DPR" recipe is wrong there by up to 3.5 px, and its OffscreenCanvas gives a space followed by
U+FE0F the emoji's width (ENGINE_FOLLOWUPS.md). Safari's `Intl.Segmenter` doesn't mark digit strings as words where
Bun's JavaScriptCore does, so Bun is no stand-in for Safari's words; a port that let only words split on overflow
stopped splitting numbers (230 rows, old suite, removed 2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered -->
A segmenter costs about 7.8 µs to make against 1.9 µs
to segment a short range, so the scans keep one for the page, and its `containing()` bug is WebKit #324036
(PLATFORM_BUGS.md). (webkit-host, Safari 26.5.2 and 27.0, 2026-09-15 to 09-20.)

**Kept contexts and loaded fonts.** A kept context misses a `FontFace` that had already loaded when it joins a
`document.fonts` holding no face (PLATFORM_BUGS.md): the font cache leaves the page's font set out of its key while
the set is empty (`FontCascadeCache.cpp:104-115`), and the set tells its observers before inserting
(`CSSFontFaceSet.cpp:203-209`). Chrome's and Firefox's old contexts pick up a loaded family by themselves.
(webkit-host, 2026-09-20.)

**Fit allowance.** `availableWidth()` adds `LayoutUnit::epsilon()`, 1/64 px, except for a minimum intrinsic width
(`InlineLineBuilder.cpp:1171-1182`, read 2026-09-27): the profile's `lineFitEpsilon` is that rule, not tuning. Blink
and Gecko fit exactly in their own units (Measurement Model), so the other profiles' 0.005 px is a named gap
(ENGINE_FOLLOWUPS.md).

#### Firefox (Gecko)

**Font sizes and Canvas answers.** Firefox's Canvas keeps 7 significant bits of a font size (`QuantizeFontSize`,
`CanvasRenderingContext2D.cpp:4207-4216`), so 13.33px measures as 13.375px, while the DOM keeps 10 (Servo's
`quantize_font_size()`, `font.rs:1004-1022`) and rounds to 1/60 px: 16.8px lays out at 16.8125px and 13.375px at
13.3833px. Integers, halves and quarters below 32px agree, and every case at 13.33, 16.8 or 17.3px misses widths by a
median 0.24 px a line (PLATFORM_BUGS.md). `measureText()` returns float(app units) / 60, so `round(W × 60)` recovers
app units exactly only below 2^18 px. A call costs about 0.4 µs plus 0.1 µs per UTF-16 unit, and a new OffscreenCanvas
context 6-7 µs. (Firefox 155.0.1, 2026-09-14; Firefox 156, 2026-09-16 to 09-19.)

**Font fallback per process.** Characters found only through global fallback measure differently for about the first
second after a content process first asks (U+20BF: a 13 px missing-glyph box, then 9.92 px), in every context and the
DOM, and the string doesn't say which characters. After any text shows U+1F600 U+FE0E, plain U+1F600 in Arial draws
wrong for about 3 s (`gfxPlatformFontList.cpp:1474-1486`; PLATFORM_BUGS.md). So Firefox's history-dependent cases
aren't stable between identical runs (190 and 104), and order matters: an app measures before layout and a lab after,
and measuring first moved 121 Firefox emoji cases and none in Chrome or webkit-host. (Firefox 156, 2026-09-16 to
09-20.)

**Thai, Lao, Khmer and Burmese.** Firefox breaks these lines with the ICU4X model its `Intl.Segmenter` runs
(PLATFORM_BUGS.md), one space-delimited word at a time, so the segmenter gives exactly its breaks: 54,588 of 54,588,
once breaks inside grapheme clusters are dropped. `prepare()` and `layout()` of new text per 1,000 characters, Chrome
/ Firefox / Safari: Latin 0.19 / 0.30 / 0.31 ms, Thai 0.72 / 2.74 / 1.31 ms. Runs between spaces have a median of
22-32 characters in Thai, 3 in Khmer and 10 in Burmese, and rarely repeat (1,192 distinct of 1,304 in one story), so
the parked Thai cache helps only averages (Dead Ends, Caching, State And API Designs). (Firefox 155 and 156,
2026-09-16 and 09-25.)

**How Gecko shapes.** Word by word: a boundary space, U+0020 or an U+00A0 no extender follows, is a glyph of its own
(`gfxFont.cpp:3317-3330, 3708-3900`), so no kerning crosses it, and a string with spaces equals the sum of its words
and spaces (66,743 of 66,745 answers). Fonts whose lookups involve the space glyph shape the run whole
(`SpaceMayParticipateInShaping`: Hebrew in Arial, Arial under `font-kerning: normal`, SF whenever features are on). A
word of any length is one shaping call, which `BreakAndMeasureText` reads without ever reshaping a line. CJK turns
kerning off, and Common, Inherited and plain ASCII runs shape as Latin, so digits kern. The Core Text shaper is off by
preference, so AAT families such as Helvetica Neue go through HarfBuzz and round each glyph. (Firefox 156, 2026-09-16
to 09-20.)

**Ligatures.** A range edge inside a ligature gets the ligature's advance in shares by started clusters
(`ComputeLigatureData`, `gfxTextRun.cpp:238-322`), while the break scan puts the whole ligature on its first character
(`:989, 1139-1149`), so a break between lam and alef never fits more text. Real text breaks inside ligatures under
break-all, in long words, at soft hyphens and in URLs (1,432 cases in Helvetica, Hoefler Text, Seravek, Lucida Grande
and the Latin of PingFang SC and Hiragino Sans). An unfiled bug: `ComputeLigatureData` divides a signed advance by an
unsigned count (`:249-289`), so a span starting between two marks of one cluster makes a frame about 17.9 million px
wide. (Firefox 156, 2026-09-17 to 09-23.)

**Letter spacing.** Gecko spaces a text run's last character whatever it is, and others only where they aren't a tab
or formatting character and a cluster starts after them: a tab alone on a pre-wrap line at 1px spacing is 43.6 px
natively and 44.6 px painted alone. After a removed soft hyphen, a mark takes spacing as its own base.
`letterSpacing = '0.001px'` turns ligatures off as the DOM's non-zero spacing does and adds nothing, in Firefox 153
and later, so a port can add spacing in JavaScript; Firefox 140 ESR adds 0.00104 px a character and has no `ctx.lang`,
and ESR is dropped where it costs complexity (Part 1, Lines Drawn). (Firefox 156, 2026-09-17 to 09-20.)

**Breaks.** The Gecko scan ports Gecko's rules (Break Opportunities From Engine Data), such as keeping `-` with a
digit (`COVID-19`) and breaking after `/` before an ASCII letter, where Chrome and Safari do the opposite. What it
doesn't carry:
- An emergency wrap after a hyphen between alphanumerics (`SetupClusterBoundaries`), taken only when nothing else
  fits: a probe that reads only `overflow-wrap: normal` lines sees a break that isn't one.
- Under `overflow-wrap: break-word`, every cluster of a line's first word is a candidate until an ordinary break is
  accepted (`gfxTextRun.cpp:1068-1073`), free for Gecko and 4-5 Canvas questions a cluster for a port; the profile's
  trade is under Break Opportunities From Engine Data.
- Cluster starts beyond ICU4X's grapheme rules: a leading extender continues a cluster, a Bengali YA joins after a
  VIRAMA, and Myanmar U+102C stays with the cluster before it. Whether that undoes the Gecko profile's use of Chrome's
  grapheme table isn't settled.
- A line laid out again: when a frame overflows after an earlier break was recorded, Gecko redoes the line with that
  break forced (`aa b<span style="color:red">bbbbb</span>` in 16px Courier New at 57.6px gives `aa` / `bbbbbb`).
- Page history: any RTL text node turns bidi on for the whole document (`CharacterData.cpp:298-302`), so LRE, LRO, LRI
  or FSI split an LTR paragraph's frames only after the document has seen RTL text.

(Firefox 155 and 156, 2026-09-14 to 09-20.)

**Span edges.** Firefox reserves a span's end border and padding on every line the span occupies
(`nsInlineFrame.cpp:516`), so shrink-wrapping text with padded spans to its widest line can move a break (2 of 55
widths), as with the Markdown chat's inline code; Blink and WebKit don't. (Firefox 156, 2026-09-19.)

**OffscreenCanvas against the DOM.** An OffscreenCanvas shapes at the CSS size at 60 app units per px, and the DOM at
the device size, rounding each glyph at max(1, round(60 / dpr)) app units per device pixel
(`gfxHarfBuzzShaper.cpp:1559, 1699-1702`), so about 0.03% of widths are an app unit off (Geeza Pro, Thonburi,
Helvetica Neue), with no traced break moved; synthetic bold differs the same way (`gfxFont.h:1899-1904`). A `<canvas>`
element at the device size matched 243 of 243 units; why Firefox still measures on an OffscreenCanvas is under Dead
Ends, DOM And Canvas-Element Paths. (Firefox 156, 2026-09-17 and 09-18.)

**Optical sizing.** Firefox's OffscreenCanvas never applies automatic optical sizing (`nsFont.cpp:276-279`;
Mozilla #2020917), so its `system-ui` is the page's family at another optical size, not another font, and every font with an
`opsz` axis mismeasures the same way on every OS, web fonts included (Inter, Roboto Flex, Source Serif 4). Issue #336
has the `system-ui` sweep. (Firefox 156, 2026-09-17 and 09-18.)

**Workers.** A Firefox worker measures like its page except for a font list with no generic family, where Gecko
appends the `font.default` generic (serif) on the main thread and always `sans-serif` in a worker
(`gfxTextRun.cpp:1881-1891, 1969-1977`), and a library can't append one quietly (lines moved in 16-21 of 435 cases). A
context with `lang = ''` follows the root element's `lang` on the page and the OS locale in a worker.
`devicePixelRatio`, which a worker lacks, misleads on the page too: 2 in a `display: none` iframe, 1 in a removed one,
and 2 under `privacy.resistFingerprinting` where layout is at 1. (Firefox 156, 2026-09-19.)

**Tabs.** Firefox takes `tab-size` from the text frame but the space width from the containing block
(`nsTextFrame.cpp:3875-3906`), where WebKit takes both from the span and Blink the span's `tab-size` with the block's
font. A tab's position counts an advance only where a cluster starts (`:4349-4357`), and under letter spacing a tab
grows by nine times the spacing. (Firefox 156 source, 2026-09-16.)

Two Firefox facts live with their topics: a context first used before Firefox reads its late family names keeps the
fallback (PLATFORM_BUGS.md, the late family names), and the joined Arabic study with its per-grapheme ZWJ recipe is
under Content Language And Fonts, Widths That Depend On Context.
<!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md is folded into Content Language And Fonts, which took its joined Arabic study -->

### Dead Ends

Approaches that were tried and lost. Each entry says what was tried, how far it got and whose work it was, why it lost
and what would reopen it. None proves the idea can't work: a result holds for its build, its test set and the code
around it then, and a thin or unsupervised attempt is weak evidence (Chrome's word sums were written off after one, then
landed in the redo). Before retrying one, read its reopen condition; if the code around it has changed, rerun its
evidence first (Part 1, Docs). <!-- Q1: recommendation taken; the maintainer hasn't answered -->
<!-- Q2: recommendation taken; the maintainer hasn't answered -->

Unless an entry says otherwise, the work was an agent's. A reopen condition several entries share is *contextual widths
during preparation*: measuring text in its neighbours' context at `prepare()` time, which Pretext doesn't do and Chrome's
`getTextClusters()` could make cheap (Engine Facts, Chrome). The old suite's numbers appear only where a decision rests
on them. <!-- Q7: recommendation taken; the maintainer hasn't answered -->

#### The Measurement Model (March 2026)

Agents working with the maintainer tried these on a 3,840-case sweep (2 fonts × 8 sizes × 8 widths × 30 texts), where
summed per-word Canvas widths got 3,838 right in Chrome. The evidence was cut from this file on 2026-03-28 (2604c28f);
the numbers come from the transcripts. All of it predates the engine scans and the harness.

- **Leaving the space before the next word out of the fit**: Chrome fell to 82%, or 95.3% when only the overflow check
  skipped it. Only a collapsible space that ends a line hangs; one before a word that fits counts. Reopens only if an
  engine is found not counting it.
- **Scaling every segment width** so the words sum to the whole string: 3,838 → 3,827, since the error isn't spread
  evenly and its sign differs by browser. Reopens only if an engine's error proves proportional to width.
- **Character widths plus a pair-kerning table**, uWrap's approach: 3,838 → 3,828, losing shaping inside words. Reopens
  only where Canvas isn't available, as a stated approximation.
- **Lines laid out from whole-line Canvas widths**, by binary search or greedy growth: 92.5% and 92.6%, since raw
  whole-line widths skip `prepare()`'s corrections; measuring the growing line per word was quadratic (136 ms in Safari
  against 0.11 ms) and breaks the `prepare()`/`layout()` split. Reopens with a Canvas call returning every position of a
  run at once.
- **Checking lines near the width with one whole-line call**: raw, it fell to 99.8% by bringing back the emoji inflation
  the sum corrects; corrected, it changed nothing, and it needs text in `layout()`. The corrected word sum is more
  accurate than raw `measureText()` of a longer string, so checks against longer raw strings go backwards. Reopens on a
  failure where the corrected sum and the whole line disagree (TODO.md's verification-mode question).
- **Hidden DOM or SVG text as the measurer**: reading it forces layout (Part 1, Lines Drawn).
- **Prior art**, surveyed 2026-03-03 at the maintainer's request: uWrap (ASCII widths and uppercase pairs, breaks at
  spaces and hyphens only), canvas-hypertxt (a trained weighting), chenglou/text-layout (Sebastian Markbage's
  prototype), tex-linebreak (Knuth-Plass, for quality) and foliojs/linebreak (UAX #14). None predicts the browser's own
  lines.
- **pdf.js**, read 2026-09-13 for ideas. Worth borrowing: one span per text run with `dir`, letting the browser reorder;
  scroll anchored as a point on the first visible page; carets from the painted DOM; offsets mapped through white-space
  normalization by a sparse edit table, an idea for #90 if built lazily. Not to borrow: `scaleX` stretching to hide
  mispredictions, CSS-transform zoom, default-size estimates, observers and timers. Its bidi code was the source of
  Pretext's old "30% RTL" guess, which #82 showed wrong.

#### Rules Per Input Shape

Until 2026-09-24 main found break opportunities with rules of its own, added one fix at a time and measured on the old
suite. The engine scans (#340) replaced them. <!-- Q7: recommendation taken; the maintainer hasn't answered -->

- **Word boundaries patched into break opportunities.** Old main split text at `Intl.Segmenter` word boundaries, which
  aren't break opportunities, then patched the difference in about 20 merge passes over 2,494 lines of `analysis.ts`,
  one rule per failing input shape. Hand-typed lists mixed Unicode classes and the deciders near CJK disagreed
  (`abc|first_week` whole, `丙|first_week` broken), so punctuation bugs kept returning (#274, #276, #290, #291, #293).
  The scans replaced it with 341 lines, at 86 → 88 Chrome Canvas calls per real paragraph. Nothing measured reopens it:
  it's the pattern "Fixing a mismatch" forbids.
- **A #210 fix that loses nothing** (2026-09-11) had to copy main's answer on colliding inputs, a guard keyed to the
  failing shape. No rule over that prepared data works: `ZWSP ب SHY ب` and `ZWSP Ꙝ SHY Ꙝ` prepare identically, yet
  Chrome gives 2 and 4 lines at 9-14.75 px, and `CR ZWSP` and `LF ZWSP` prepare identically and break differently.
  Reopens with contextual widths during preparation or a per-engine model of CR.
- **#225's broader rules** (2026-09-12): no break before `，` or `」` after Latin text lost 42-52 old-suite rows per
  browser; emergency breaks inside punctuation clusters fixed 624 / 1,197 / 993 rows (Chrome / Safari / Firefox) and
  lost 510 / 108 / 200, Chrome's losses being rows main passed only because two errors cancelled. What outlived them:
  rules whose errors cancel can only land together, so build in layers.
- **Smaller rules of that era**, moot since #340: #274's first fix, which reached too far (`中（ابب）`, `中文””tail`); an
  opening bracket ending a line after a word (browsers do it only at 1-26 px); merging punctuation, URLs or numbers into
  units before breaking, which erased context the engines keep; Arabic pair corrections and phrase rules from single
  examples; Myanmar rules that helped one browser and hurt another; Chrome quote rules fitted to one Mac's UI language.
- **Blink-style shaping-cluster overflow units** changed no old-suite row, helped only letter-spaced complex scripts,
  and made V8 build 172 script regexes on first Myanmar use (26-66 ms once); no branch is recorded. Reopens with the
  letter-spacing work that needs it (ENGINE_FOLLOWUPS.md), once that cold start is fixed.
- **A source-coordinate layer** meant to let storage change without changing output never earned its cost; no branch or
  commit is recorded. It left a principle: finer source positions don't create shaping information never measured.
- **A Firefox script itemizer**, splitting text runs where the script changes: kept on 2026-09-16 for parity with the
  Gecko break oracle, removed on 2026-09-24 under the relaxed correctness stance (175 lines and 16 KB of data). No suite
  or corpus text moves, only 48 of about 20,000 random mixed-script strings with stray marks, where Firefox 156 sides
  with the splits (two accepted cases). The bidi split stayed; it does real work (Bidi Levels; Decisions Log). Reopens
  if real text with such marks turns up.

#### Invisible Characters, Controls And Soft Hyphens

Mostly main then, on the old suite in installed browsers, 2026-09-11 to 09-24.
<!-- Q7: recommendation taken; the maintainer hasn't answered -->

- **A ZWSP right after a forced break inside a word**: all three browsers give it its own line, but copying that lost
  290-560 results per browser, as six unmodelled behaviours had hidden behind the old handling. Reopens once joined
  Arabic widths and letter spacing on invisibles land (the U+3000 hang, the third prerequisite, has).
- **Letter spacing on invisible characters.** Taking the gap off every invisible lost 73 cases, a required Firefox check
  among them (2026-09-11); a 14-line patch gave +442 / −172 cases, its losses passes that leaned on a cancelling bug
  (held back, 2026-09-23/24). The rule differs by engine (Blink spaces per shaping cluster, WebKit only glyphs with an
  advance, Chrome none after U+2060). Reopens as ENGINE_FOLLOWUPS.md's letter-spacing-on-invisibles group, built on one
  per-grapheme spacing unit the profiles share.
- **Lone CR, FF and VT in pre-wrap, per engine** (2026-09-11): two prototypes each lost results main had right (228 in
  Chrome; about 150 each in Firefox and Safari), and deleting raw CR or making it a zero-width break failed too. CR
  reaches normalization, segment kinds, measurement, line text, cursors, bidi, rich inline and the harness, so Pretext
  expects normalized line endings (README). Reopens with a per-engine model traced from the engines' line builders.
- **Folding invisibles into neighbouring text** (2026-09-15/16, porting the scans): the offline replay lost 776 real
  rows, since controls got zero width where browsers give them width, and folded soft hyphens and ZWSPs take letter
  spacing and width the page doesn't give them (1,887 Chrome and Safari rows in the old suite's gate). The variant that
  marks break bits lost 112 and became the design (Break Opportunities From Engine Data).
- **Leaving invisibles out of Chrome's Canvas strings** (the redo, 2026-09-16) cost 325 line counts, as Canvas then
  joined emoji sequences and Arabic letters the page keeps apart; U+2060 in their place matched (Measurement Model). A
  rule choosing which to drop was removed as fitted to lab scores.
- **NEL joined to its neighbours**: joined before, overlong words split at Canvas grapheme widths; joined both sides, a
  following mark took a 12 px advance. The scans now take NEL as class NL.
- **Soft-hyphen returns**, going back from an unfit soft hyphen to an earlier break. Returning past breaks with no
  segment kind lost 142 Chrome rows: a return needs an overflow isolated widths show, and a target that really is the
  latest opportunity. Both rules for a soft hyphen with no fitting opportunity lost hundreds of rows in a headless
  replay (the `#323` accepted entries), and Firefox's return (4e6d4dd5, 2026-09-16) lost 15 rows per direction such as
  `漢字` SHY `abc`. They reopen with contextual widths during preparation.
- **A `glue` kind for runs of no-break characters** (NBSP, U+2007, U+202F, WJ, U+FEFF) was only a label, and a wrong
  one (Decisions Log, 2026-09-24).

#### Arabic And Joined Scripts

- **Pricing Arabic letters by their joined form alone** (2026-09-11) lost 1,622 and 1,573 passing old-suite metrics in
  Chrome (left-to-right, right-to-left) and 857 and 743 in Firefox. Widths around soft hyphens stay a documented
  limitation; a shaping engine or DOM measurement is out (Part 1, Lines Drawn). Reopens with Firefox's per-grapheme ZWJ
  recipe gated per font (Content Language And Fonts, Widths That Depend On Context). <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **Firefox's joiner recipe**, U+200D appended to the measured prefix at a break inside an Arabic word: the redo took it
  because it raised lab scores, not from source, and it's inexact per font (29-31 of 33 breaks right in Geeza Pro,
  Arial, Times New Roman and Noto Naskh Arabic, 15 of 33 in Amiri). Removing it cost 77 line counts, now under the
  `in-word-prefix` gap. Canvas totals don't reach the fonts it misses. Reopens with font files.
- **Lam + alef as one cluster for every pair**, decided by letters (the redo, 2026-09-20): it fixes Arial and breaks
  Amiri and the Noto fonts, and Canvas returns the same widths either way, so no Canvas test tells them apart (the
  U+200D test is wrong for four of five two-cluster fonts and blind for Geeza Pro; Measurement Model). Every default is
  a guess: one cluster is right for 26 of 31 installed Arabic families, the macOS and Windows fallbacks among them; two
  is right for Amiri, the Noto fonts and the Android and ChromeOS fallback; main sums isolated widths and gets 7 of 20
  constructed cases right, the redo 12. Don't land the letter-keyed shortcut or retry the U+200D test. The default gets
  decided if main ever breaks overlong Arabic words by cluster.
  <!-- Q12: recommendation taken; the maintainer hasn't answered -->

#### Kerning

- **A `fontKerning` option** (#216, #199; declined 2026-09-12, trackers open): Safari's OffscreenCanvas ignores
  `fontKerning`, Safari's following-space kerning would have to switch off too, and it's public API for a rare setting.
  Reopens when someone needs `font-kerning: none`, or Safari's OffscreenCanvas honours `fontKerning`.
- **Measuring only a word's end with its space**, which the 8.0-million-pair census under Kerning At Line Edges showed
  inexact. Reopens with a bound read from font data.
- **Other shapes of Safari's space-kerning rule**, on the way to #311's (Kerning At Line Edges, 2026-09-15): no kerning
  across format characters (lost 33 Safari rows), a narrower rule, and kerning only under letter spacing; the first
  table-free rule predicted 3 lines where Safari paints 2 for direction-mark shapes, fixed by counting direction marks
  as letters.
- **Chrome Canvas settings for kerning across spaces** (`optimizeLegibility`, `fontKerning = 'normal'`) make Canvas
  shape whole strings only for fonts whose lookups involve the space glyph, and turn features on for every measurement,
  so the port follows Canvas's cuts (`「」「」「」` measures 96 against 80 px). Reopens if Canvas gains a whole-string mode.
- **WebKit letter-spaced ligatures** (the redo, from 2026-09-17). No Canvas string sets two letters side by side
  unligated in one shaping call (U+200C ends the simple path's call, U+034F doesn't stop the ligature, U+180B brings a
  fallback glyph), and a heuristic for the group couldn't be grounded (a probe 1.9 px off). A connected `<canvas>`
  styled `font-variant-ligatures: no-common-ligatures` would fix about 721 cases but is a styled DOM element with no
  worker path, and a features-off `FontFace` made by the library is font loading. A family the app declares with the
  four features off was bit-exact on 1,274 of 1,274 strings, a new kind of fact, not built. Reopens when WebKit fixes
  Canvas `letterSpacing`, or if that app-declared family is accepted.

#### Fitting, Cuts And Fast Paths

Mostly the redo, 2026-09-15 to 09-24, with critic agents attacking each result. Chrome's cuts split a long shaping group
into windows under 256 px, where Canvas's float32 totals stay exact (Engine Facts, Chrome).

- **Picking Chrome's cut without asking Canvas** ("B1b", 2026-09-20) passed every test tier, but a critic's 22,536 cases
  at the cut moved 1,158 lines (in Futura, Baskerville, Zapfino and Apple Chancery the pair window alone forms an `fi`
  ligature the group never does), and the all-fonts probe moved 42,644 of 644,459 layouts in 196 of 318 families. The
  rework drops only questions that can't change the search's answer, moves none of 1,151,358 layouts, and keeps 57-60%
  of the saving (`rebuild/research/PERF-B1B-REWORK.md`). The bar it left: a change to Blink's cuts, safe test or windows
  passes the all-fonts probe before merging.
- **Word sums in Chrome, round one** (2026-09-20): cut shaping groups at spaces and add the measured kerning back. Mix
  2.04 → 0.84 s, but seven of 318 families laid out wrong (Zapfino, Euphemia UCAS, Diwan Thuluth, Waseem, Songti SC and
  TC, generic serif), because Blink's word-by-word test reads only the space glyph's GPOS and GSUB coverage, while AAT
  `kerx` machines carry state across the space. It was one agent's run, which the maintainer later said they hadn't
  supervised well (2026-09-22); "didn't work" became "not exact", and round two, cutting only where the port's safe test
  passes, landed in the redo under named gaps (`rebuild/research/SPEC-WORD-SUM.md`).
- **Skipping cuts by font grain** (2026-09-20) needs a power-of-two units-per-em and a whole device size: it fails for
  1000-unit fonts, at 1.25× and 1.5× (common on Windows) and under zoom, and grain can't be proven without the font
  file. Reopens with a `unitsPerEm` read from the font.
- **Carrying a float32 error bound**, cutting exactly only where a fit falls inside it (a reviewing agent's idea,
  2026-09-20): the first prototype was 1.16× slower, and a coarser 512 px exact target made every resize pair 47-60%
  slower. The cut stays at 256 px. Reopens with a representation that handles both precision and the cold-prefix cost.
- **Admission and fit rules**: emergency-prefix differences for every admission; choosing by prefix-measurement mode;
  Canvas's letter-spaced widths everywhere (breaks ligatures); Safari's inferred carried adjustment on every prefix;
  Firefox's 1/60 px box rounding copied into line fitting, which regressed unrelated cases (the harness's 1/60 px bisect
  unit is another use). No reopen condition was recorded.
- **A Canvas check inside `layout()`** for sums very close to the width ("H3"): +1 / −1, and `layout()` makes no Canvas
  calls (Part 1, Lines Drawn); the emulation study's cheaper Chrome recipe needs them too.
- **Gecko prefix fits from 24px, or everywhere** (2026-09-27, measured on the harness and the bench): the lines they
  fix at 24-80px cost too much preparing new text (Break Opportunities From Engine Data). Reopens if prefixes get
  cheaper to measure, or real usage shows the gap.

#### DOM And Canvas-Element Paths

- **A hidden `<canvas>` attached to the page**, so Safari would measure under the page language's fonts (2026-09-11):
  its styles force a recalculation when stale (3.3 s against 33 ms on a 20,000-element page, headless), and the
  maintainer rejected it as DOM access (Part 1, Lines Drawn). In Safari 27 (2026-09-24) every element context runs the
  pending style update on each `font` set and `measureText()`, attached or not (20-91 ms a call after one `insertRule`),
  and only an attached one follows the page language, so Safari's families come from a generated table (Decisions Log).
  Reopens if WebKit #285993 gives Canvas a `lang` inherited from the document.
- **Measuring Firefox on a `<canvas>` element** for `system-ui` and optical-size fonts (the redo, 2026-09-18/19): light
  (1.03-1.06× OffscreenCanvas's time) and exact (243 of 243), but once a page inserts a CSS rule, a kept element context
  runs the pending style-sheet update in every `measureText` (200 inserts between measures cost 104-113 ms against 0.26
  ms), which hurts CSS-in-JS pages; live contexts join the refresh driver; the only test that the document gives the
  element the page's fonts reads a Gecko internal before every call; and workers have no element canvas. The maintainer
  chose OffscreenCanvas always (2026-09-18), then reopened the element if it proved light and worked in workers through
  feature detection (2026-09-19); both failed (`rebuild/research/FIREFOX-CANVAS-ELEMENT.md`; Decisions Log). Two
  OffscreenCanvas alternatives stay unmerged: optical sizing on for system keywords and off for named families, a
  name-keyed rule, and synthetic bold confirmed from Canvas (9 fresh rows fixed).
  <!-- Q10 placeholder: these are the public branches r4-gecko-alt-opsz-default and r4-gecko-alt-synthetic-bold, which Q10 asks about; name them here once the maintainer answers -->
  Reopens if Firefox `system-ui` becomes a priority, Mozilla fixes #2020917, or an app hands Pretext its own canvas.
- **A `direction` option for Chrome's direction-dependent widths** (2026-09-12): neutrals such as brackets measure about
  0.5 px differently by direction, taken from `<html dir>` when the canvas is made, and a flipped page direction cost
  189 old-suite line counts. A `prepare(…, { direction })` prototype fixed them in Chrome, lost 11 rows in Safari, and
  wasn't taken, nor was the emulation study's proposal (2026-09-16); re-reading `<html dir>` per `prepare()` is hidden
  state that goes stale. Pretext takes no paragraph direction; reopens in the API discussion (TODO.md).
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Painting each block natively** (`<p dir="auto">`, a ResizeObserver correcting mounted rows) needs an observer and
  lets heights drift from Pretext's predictions, giving up exact heights (Part 1, Demos And The Chat).
- **Reading `devicePixelRatio` in `layout()`**, since Chrome fits on its device-pixel grid (2026-09-15): hidden state
  that changes when a window moves between displays; re-decide with the grid's measured effect (Measurement Model). A
  runtime DOM probe to calibrate the fit tolerance was superseded as new DOM work. Reopens in the API discussion.
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Healing stale Firefox contexts**, which stay on the fallback when first used before Firefox reads its late family
  names (the redo, `rebuild/research/CONTEXTS-HEAL.md`). Rejected: a page contract (no event tells the page); a
  never-seen spelling of the font string to force a fresh lookup (leans on a private cache, grows forever); refusing
  contexts whose families don't all draw (common lists fail it); a witness string (equal widths don't prove equal
  fonts); `document.fonts` or a sentinel element (DOM reads). Reopens if Firefox tells Canvas font groups about
  `font-info-updated`.

#### Tables, Bundles And Data

- **Firefox's line data in Chrome's format** (2026-09-26): Chrome's state-machine format packs similar rules to 8.7 KB
  against Firefox's 0.8 KB; reusing Chrome's code-point lookup mapped to Firefox's classes is exact and saves 3.2 KB of
  55 KB gzipped, but ties Firefox to Chrome's table and slows its Arabic, Hebrew, Hindi and Urdu analysis 13%. The
  maintainer had allowed only this, and only with no upkeep cost; measured, they dropped it, closing the table-size pass
  (Decisions Log). Local branches `ff-table-format-bmp` and `ff-table-format-ranges-first`. Reopens only if table size
  and per-engine bundles both return.
- **One bundle per engine** (the redo's Blink 769 KB, Gecko 372 KB and WebKit 788 KB minified, 2026-09-23): ruled out on
  2026-09-26 (Decisions Log). Reopens if apps come to ship per-browser builds.
- **Shrinking tables by computation**: remapping characters onto the base table's classes, as WebKit does for quotes,
  fails for Chrome's Chinese table (`〜` and `゠` need a class the base lacks), and building state machines at runtime
  means porting ICU's rule compiler. Today's tables need no upkeep between refreshes. Reopens with the table-size
  question.
- **Shipping the dictionaries or ICU4X's LSTM model** for Thai, Lao, Khmer and Burmese words (2026-09-25): hundreds of
  KB each, and a JavaScript copy of Firefox's model would be slower than Firefox's own; `Intl.Segmenter` stands in.
  Reopens for runtimes without `Intl.Segmenter`.
- **`Intl.v8BreakIterator` for Chrome's line breaks** (the emulation study, 2026-09-16 to 09-20): it runs Chrome's
  bundled ICU but drops `-u-lb-*` keywords, has none of Blink's fast table, space rule or `line-break` and `word-break`
  handling, is gone from Node and Deno, and saves nothing, since Safari needs the tables anyway; in dictionary runs
  Chrome's `Intl.Segmenter` words already equal it. Reopens if `Intl.Segmenter` gains a standard line granularity (Stage
  1 since 2021). <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **Safari's libicucore line tables shipped whole** (26c3e231, 2026-09-16): 75 fewer runtime lines for about 30 KB more
  gzipped; overtaken by packing each table against an earlier one.
- **One shared bidi resolver with per-engine switches** (the redo): ICU isn't structured like UAX #9 (brackets pair
  while explicit levels are computed; weak and neutral rules resume after isolates), so it would need nine or more
  switches, redone at every ICU roll, and the crate tried disagrees with ICU on 130,661 of 300,000 short strings. ICU
  was ported line by line instead (Bidi Levels). Reopens only if Blink and WebKit stop running ICU's resolver.
- **A hand-written `.d.ts` in place of the README's API glossary** (2026-03-17): an ambient `.d.ts` isn't checked
  against the implementation without a bridge that drifts the same way, and the maintainer preferred the glossary's
  explanatory structure; the JSDoc swap was reverted (Part 1, Docs).

#### Caching, State And API Designs

Studied 2026-09-13 to 09-26, mostly on a stand-in Canvas and checked in Chrome, against the cost model that ends this
group. Most are parked for the API discussion (TODO.md), not refuted.

- **Handle-free layout over a global table with a size limit** (2026-09-26): the chat lays out all 18,613 blocks on
  every width change, so any smaller limit misses on every block, the app has to say which texts are alive anyway, and
  the lookup alone is 10-38% of the chat's height pass. Reopens with a design where the app controls lifetime cheaply.
- **Keyed state**, prepared data in a WeakMap keyed by the app's object (2026-09-26): 1.1-1.5× slower on the height
  pass, no workload faster, an inline object keyed anew each call, and a global table that can return wrong lines when
  two calls pass different options. Its value is convenience and making incremental prepare possible. Reopens if
  incremental prepare is needed.
- **The width memo**, each handle remembering the range of widths that give its last lines (2026-09-26): exact over 137
  million fuzzed checks and the only design that drag-resized 10,000 messages under 1 ms, but new widths up to 26%
  slower in Chrome, about 155 more lines, and handles no longer immutable. The maintainer judged 26% on the worst case
  too much (Part 1, Engineering). Reopens with the untried variant that remembers only multi-line texts, if it keeps the
  worst case flat.
- **Width ranges in the chat** (draft #280, 2026-09-14), the same idea handed to the app: 1 px drags at 10k went 3.5 →
  0.3 ms, but ranges are 3-7 px wide, so random jumps got about 10% slower, for 440 more lines (branch
  `exact-height-intervals`). A table assuming line counts only fall as width grows is unsound under greedy breaking.
  Reopens if small drags at large histories matter again.
- **Incremental prepare** (#313, 2026-09-13 to 09-26). Restarting analysis at the last word start before an edit matched
  full re-analysis in every tested edit, but whole-text bookkeeping still costs 0.6-3.3 ms at 100,000 characters, and it
  beats one handle per paragraph only on one long text with no breaks; README now advises a handle per pre-wrap
  paragraph (#362). `prepareEdit(previous, text)` was 12-41× faster on long paragraphs but carried a bug 135,000 random
  edits missed; `prepareStream` (#153) was never built, since appended text can change how the old tail breaks. Which
  old line survives an edit can't be known without the new text's break data (a growing URL; a Thai edit moving
  boundaries 11 segments back), which is why WebKit's partial layout restarts a line early
  (`InlineInvalidation.cpp:388-389`); key reuse on what is prepared, not the source. Every prototype with carried state
  had a stale-result bug (`rebuild/research/INCREMENTAL-API-READING.md`). Reopens if long texts without breaks, edited
  live, start to matter.
- **The font given at layout time**, `prepare(text)` only analyzing (2026-09-26): analysis is 50-86% of a warm
  `prepare()`, so it would save about 30% for one text in two fonts; matching the font on every call wasn't costed.
  Parked for the API discussion, where the maintainer found it interesting.
- **A Firefox Thai cache** (local branch `thai-words`, 7f9edacc, 2026-09-24): word boundaries cached per Thai, Lao,
  Khmer or Burmese run between spaces, 10-15× faster on text seen before in Firefox and nothing on new text; runs rarely
  repeat (1,192 distinct of 1,304 in one story), so it helps averages, not the worst case. Reopens with the API
  discussion's question of who bounds remembered data.
- **Truly stateless layout**, content, style and width in and lines out (the redo, 2026-09-18 to 09-20): at 60 fps
  10,000 messages leave about 1.6 µs a message, less than a first-time Canvas call; from scratch it took 340-500 ms a
  pass in Chrome against pre-#340 main's 168 ms. First sight of text is the cost, and no store fixes it; a hidden store
  keyed by content matched handles' speed at over twice the memory and never shrank. Resize, not from-scratch cost,
  decides stateful against stateless (an agent's view, not ruled on). Reopens if profiling makes from-scratch layout
  much cheaper (`rebuild/research/IDEMPOTENT-API.md`).
- **Eviction rules for a hidden store** (the redo): turning over when the young generation doubles the old, a plan the
  maintainer had accepted, dropped live entries when the working set doubled within a pass; release per layout pass
  rebuilt everything when a view laid out only visible rows; inferring a pass's end from task timing broke when a pass
  spanned tasks. Only two generations turned over at an explicit `endPass()` stayed clean, and it still needs a shrink
  rule.
- **A width store on each Canvas context** (a `Map` bounded at 65,536; the redo, 2026-09-20): 5-8% from scratch in
  Chrome, whose canvas already answers repeats in 0.14 µs. A stored answer stays wrong after a late web font in every
  engine, Firefox changes some answers after start-up, and Chrome's lookup changes string storage (Keeping Work Bounded,
  String Storage). Chrome's next gain has to come from fewer questions, not remembered answers. Reopens with a stateful
  API that wants a store with a stated invalidation contract, in Gecko and WebKit only
  (`rebuild/research/PERF-CONTEXT-STORE.md`).
- **Other API ideas**: measuring every in-word position in `prepare()` (about 2.4× Blink's cold Canvas calls; kept as a
  possible measure-in-idle-time call); an immediate-mode API with no handle (prepare is about 10× a warm break pass in
  Blink); reusing rich items (no gain: a chat paragraph has about 3); a JSON guard on handles; a second public prepare
  surface for diagnostics.
- **The cost model** (main then, Chrome 154, 2026-09-26, checked against direct runs). Per event: 20 live fields of up
  to 85 characters 28-270 µs; a long document with a handle per paragraph 85-300 µs a keystroke; streaming Latin under 1
  ms until about 24,000 characters; a warm `prepare()` of a short field about 5 µs. The only real problem is one
  100,000-character text with no breaks (4.2 ms Latin, 14 ms CJK or Thai). What stays over budget is cold work (first
  paint, a new font size, Thai in Firefox), which no sharing design removes; ordering the work or a worker does. On
  2026-09-18 no demo read vertical metrics, per-fragment widths or bidi levels, but demos are technical edges, not usage
  data (Part 1, Caching And API Design). An app's own Knuth-Plass breaker works over the line-filling API: a fill at
  width 0 under `overflow-wrap: normal` lists the opportunities, and a width halfway between two candidates closes the
  line at the chosen one (735 of 735 on the stand-in).

#### The Markdown Chat At Scale

- **A chunked history window** (draft #312, 2026-09-15): load history in chunks, prepare on demand, re-anchor when a
  chunk loads above. Every frame stayed exact and a 100k resize took at most 1.7 ms with 42 MB instead of 402 MB, but
  the scrollbar covered only loaded chunks and its thumb jumped at each load, which the maintainer tried and found
  unacceptable (Part 1, Demos And The Chat). At 10k its worst frames were worse than main's then, mostly by design: a
  frame that loads a chunk prepares new messages (5-10 ms) whatever the chunk size, and a window beats preparing up
  front only above roughly 100 × the messages prepared per load. Kept open because an iPhone crashes at 100k messages on
  main but not on #312. Reopens with a correct full-history scrollbar in the chunked design.
- **Window heuristics** (2026-09-14): always-loaded first and last chunks, separate load and unload thresholds, far-jump
  swaps and prefetch each assume jumps aren't smooth scrolls (Part 1, Engineering). Also rejected: skipping one-line
  blocks (the worst frame is narrow); spreading a resize over frames (the scrollbar is wrong for 5-8 frames); layout on
  web workers (10-12 ms after a width change, but the most code, 1-2 GB and inexact emoji); estimated heights, lazy
  preparation, correction on first view, layout after the resize stops, scaled scroll ranges and rounded widths (content
  pops, gaps appear, the thumb misbehaves); DOM pooling (about 20 rows are on screen).
- **A leaner handle** without segment text (2026-09-14): of about 81.5 MiB for 10k prepared messages in Chrome, segment
  text is 3.9 MiB and 38 MiB sits in Chrome's canvas, so it saves 1-2 MiB for more code and a language-change hazard.
  Reopens if memory becomes a goal, starting with the canvas cache.
- **Memory cuts at 100k messages** (2026-09-16, stand-in Canvas): prepared texts held 76-79% of retained heap; three
  exact cuts (lazy preferred breaks, no grapheme counts without letter spacing, arrays trimmed to length) took 27-28%
  off with identical heights and Canvas calls. Local branch `chat-100k-levers`, off pre-#340 main, never merged;
  preferred breaks have since left main. Reopens if memory at 100k becomes a goal; measure today's handles first.
- **Collapsing rich inline's double analysis**: the joined pass is about 1% of a message's prepare and carries the
  per-item cursors (Rich Inline Boundaries), and Safari's extra Canvas calls are the prefix fits WebKit needs.
- **The chat's scale** (2026-09-14 to 09-16, before #338, #340 and #344, stand-in Canvas; measure again before relying
  on it): a message costs 46-100 µs to prepare the first time and 0.4-0.7 µs to lay out; at 100,000 messages a resize
  takes 43-59 ms median, so a 10 ms budget fits about 13,000-15,000. A pixel position anywhere in the history needs
  every height above it at the current width, which is the full pass, so a thumb over unloaded history can't stay exact
  after a resize; the maintainer found nothing else to skip in the worst case that keeps exactness (2026-09-15). #286's
  typed-array heights won by building less per message (frames overlapping a major GC 53 → 0), not by the typed arrays.
  The demo uses 10,000 distinct generated messages because 44 recycled ones let a warm width cache hide the cost.

#### Simplifications Held Back

- **Walker and admission-path shapes**: one walker for all text, a one-line walker composed for walking, counting and
  streaming (only its line-text cleanup landed, 2026-09-26), one loop for both walkers, one path to admit a whole
  segment, a typed flag array per text, `measureAnalysis()`'s helpers hoisted out of closures, and a private copy of the
  simple stepper, which the maintainer rejected as duplication for a small JIT gain (2026-09-25). Each lost on speed in
  more than one engine or added code for too little; the numbers are under Keeping Work Bounded, The Walkers' Shapes.
  They reopen when the full walker's cost per segment nears the counter's.
- **Removing the prefix-measurement cache**: 79% more cold Canvas calls.
- **A growing bracket, then bisection, in the line counter** (the redo): 59% faster than a global binary search at
  narrow widths, 17% slower at wide ones; one counter was kept.
- **Holding check runs while timed benchmarks run** (2026-09-20): timed jobs held the queue about 90% of the night and
  the built-in version deadlocked twice. Moving other work to the efficiency cores (`taskpolicy -b`) replaced it.
- **Upstream patches for engine hot spots** (2026-09-20): lazy ink bounds in `TextMetrics::Update`, per-call bidi and
  itemization, the font setter's fast path. Drafts only; nothing was posted. Reopens with the bugs to file at the end of
  the project (ENGINE_FOLLOWUPS.md).

#### The Per-Engine Redo

The redo ported each engine's line breaking exactly over Canvas questions, stopped at done, and fed the hybrid (#340)
and the relaxed correctness stance (Part 1, The Redo And What Counts As Done). These are the results that decided
something. "Main" here is pre-#340 main.

- **Matching main's prepare speed with an exact port's questions** (Amdahl floors, 2026-09-22): on new text the redo
  took 5.4× main's time for Latin in Chrome and 2.7× in Firefox, and 0.64× in Safari. Chrome's floor from Canvas alone
  was 2.0-4.6× main, since it sent 25-106× main's distinct Canvas characters, most from the 256 px cut search; Firefox's
  port paid about four calls a character for advances Firefox reads for free. The first layout at a new width cost
  79-220× main. The floors bound only this set of questions. Reopens with a different set, or with Chrome shipping
  `getTextClusters()`.
- **Main's design copied into the redo**, preparing everything and laying out by arithmetic, made preparation worse: the
  port's answers depend on where lines end, so each new width asks new questions (per 120 messages, 1,000-1,500 more in
  Chrome and 3,000-4,000 in Firefox per width). Main avoids this by assuming widths add up. The maintainer reasoned it
  out before the numbers did. Reopens with a Canvas API returning every position of a run in one call.
- **Words first, landed under named gaps** (2026-09-23 to 09-25), the change that relaxed the no-loss rule: over 23.2
  million stress layouts it gained about 2,780 line counts and lost 28, lost nothing on 751,000 real-text layouts, and
  ran 1.3-1.7× faster; every loss traces to one font at unusual settings (Zapfino at display sizes, calligraphic Arabic,
  Euphemia UCAS). Main still prepared and counted 4-15× faster.
- **Rejected inside the redo**: Chrome words first with splits between CJK characters (failed the all-fonts check);
  summing CJK characters in Firefox (no line changed, 36-76% more Japanese Canvas calls); font checks once per page
  (stale after a late web font); Firefox contexts shared across paragraphs (late family names); the Gecko lazy plain
  scan (6-7% for the port's most intricate code, and a hole at 22 of 901 widths); a clamp for joined-letter positions
  that run backwards (fixed none of 10 cases); words-first window tweaks and Euphemia variants (local branches
  `bwf-fix-alt-vz2`, `-vz3`, `-vz5`, `bwfl-eu`, each moving hundreds of lines either way); rules chosen by lab score or
  keyed on font names (removing them cost 559 Chrome line counts, which came back with explicit facts and runtime
  checks); per-font tables of any kind; a compiled grammar for ligature patterns (56-74% slower on ordinary text, 424
  more lines).
- **Owned rendering**, drawing fixed fragments instead of letting the browser lay out painted lines: rejected before
  timing, since ordinary narrow Latin and Arabic words overflow and valid rich style boundaries were refused. Reopens
  only with a probe that first establishes the required behaviour.
- **A reverse-engineered Core Text in JavaScript**, the maintainer's first idea for the redo (2026-09-16): a copy needs
  font bytes a page doesn't have for `16px -apple-system`, and Safari's Canvas already runs Core Text on the device's
  fonts (Measurement Model). Bring-your-own-font, HarfBuzz in WASM over the app's web fonts, reached about 13.4% of
  old-suite rows, needs a custom harfbuzzjs build (about 162 KB brotli) and fonts loaded before `prepare()`, and leaves
  fallback characters to system fonts; the maintainer ruled it out (2026-09-16; Part 1, Lines Drawn). HarfBuzz and
  `text-shaper` probes didn't reproduce browsers. Reopens if pages can read system font bytes.
- **Firefox's emoji skin-tone widths through the DOM** (2026-09-26): proposed, and wrong: the redo already corrected
  emoji widths from Canvas and only missed a modifier right after a letter.
- **What the redo's slowness taught about main's design** (2026-09-18 to 09-20, Chrome 153). Canvas contexts per
  paragraph were 43% of Chrome's from-scratch time, and in WebKit each new context resolves its font again: keep one
  long-lived context and one font answer per font per page. A string memo used as data flow hid which Canvas calls were
  needed, and its `Map` lookup was the string-storage bug. Most of an exact port's Canvas calls decide no line (turning
  off diagnostics cut calls 15-50% with no line moved), so diagnostics run on request, never on the app's path. Chrome
  is the slow engine for a Canvas port because Canvas gives only totals while Blink breaks inside whole shaped runs
  (about 320 questions a message against WebKit's 41).

#### Test And Harness Designs

- **The old wrapping suite, replaced wholesale** (#341, removed 2026-09-25; measured 2026-09-17 on pre-#340 main):
  main's line-count passes hid wrong lines (Reading Browser Output); 120 near-copies differing by one control character
  weighed as 120 families; 88% of its 238,524 cases sat under 80 px; each browser ran all three browsers' widths; its
  score mixed repros with usage. On 4,686 real paragraphs main's line count passed 99.96-100%, so its 20-26% failure
  rate came from adversarial families and narrow widths (`rebuild/research/CALIBRATION.md`). The harness's pass rule and
  sets answer each point (harness/README.md).
- **Scoring the hyphen drawn at a soft-hyphen break** from the painted boxes found 93-358 mismatches per browser and was
  left to `layout.test.ts`; loading system font files as web fonts changed Safari's results (no date or numbers kept).
  Reopens with a way to see the drawn hyphen (harness/README.md, Bounds and blind spots).
- **Old-suite proposals the new pass rule made moot** (2026-09-17): not counting a row as lost when main's own lines
  were already wrong, and recording line placement for the grid and corpora.
- **Noise floors from the single worst reading** (the bench's calibration, 2026-09-26): the worst readings came from
  lone documents where even the control copy ran long (Reading Browser Output), and floors taken from them would have
  hidden a real 20-25% slowdown. The floors are the largest deviation that held one way in all three sessions (1-6% by
  row), which calls all four known slowdowns (217c84b8 against 6d1d2106).
  <!-- Q14 placeholder: whether `bun harness repin` samples before recording everything; if sampling is tried and rejected, its entry goes here -->

### Evaluation Traps

Ways an evaluation fooled capable agents here, each with the case that showed it. Most left a rule the harness now
enforces; the rest are habits. AGENTS.md names six. Builds are as Part 2's opening gives them.

#### Counting And Attribution

- **A matching line count isn't matching lines** (Reading Browser Output), and a pass can be two errors cancelling, so
  fixing one loses it: rules whose errors cancel land together.
- **Attributing lost rows.** Checking main only at the first native break a branch misses overcounted true losses about
  tenfold: check every one of main's line starts, mapping positions through white-space normalization. A small drop
  between two evaluations can be the draw: rerun the old library on the new cases, since two triples of fresh sets
  differed by up to 9.8 failures per 10,000 with the same library. Frozen references go stale silently (351 changed
  Chrome predictions bisected to an intended swap of two checks): bisect first, and class every lost pass as a true
  loss, an accident or a bad test (Part 1, Tests And Losses).
- **An oracle can copy the library's mistake.** The old harness turned a newline next to a ZWSP into a space, as Pretext
  did, where Chrome and Firefox delete it, so wrong predictions passed and the fix read as 12 losses per direction; 106
  Firefox corpus rows looked lost until the harness normalized newlines between East Asian characters as Firefox does.
  Check the oracle's normalization before calling a loss real. The old suite used the Mac's installed fonts, so results
  moved with macOS updates; the harness serves pinned font files and keys on them.
- **Passing the oracle isn't enough.** The cleanest of three keep-all implementations passed every oracle case and was
  wrong under the Safari profile (`foo。bar日本語`), a case no oracle covered: test the behaviour class a change touches
  under every profile. A 29-line partial of an old rule matched every suite row but by Firefox's source got three shapes
  wrong: say "no measured loss" and probe what the source predicts. A clean proof on recorded cases can miss a whole
  class (no recorded text sat at a cut in a ligature font; Dead Ends, Fitting, Cuts And Fast Paths), so build an attack
  set for what a change touches.
- **Fast paths differ where the corpus is thin.** Gecko's lazy scan differed at 22 of 901 widths on a constructed
  paragraph, and the Gecko word scan's first condition admitted one wrong line, found by a seeded adversarial generator
  in its first run. So a fast path's gates include seeded adversarial cases, a checked mode that runs both paths and
  throws on a difference, and planted mutants of each condition (three mutants of one compound condition passed the
  owner's tests). An incremental path equals the from-scratch one: checking that text split at forced breaks equals the
  whole found four older bugs (#269-#272). Library-against-itself checks cost minutes: plain and inspected paths agree,
  runs agree in either order, one paragraph at several widths equals a fresh one per width.

#### Gaps, Warnings And Held-Out Sets

- **A cause that fires almost everywhere explains nothing.** In the redo's ledgers a Firefox flag fired on 91-96% of
  cases, passing ones included, and a gap reported once per paragraph hid 84 real bugs. A failure is explained only when
  a known cause touches the text that differs: compute lift (a condition's share of failing lines over its share of
  passing ones), treat lift below 2 as locating nothing, and report a gap at the offset that decided the line. Narrowing
  a broad gap can move the error into claimed values (2,030 passing cases held wrong "exact" values), and "every failure
  carries a named gap" can be met by widening gaps. Any confidence or warning API inherits this.
- **Page history passes for causes and for passes.** Firefox's `page-history` label named 0 of 220 history-dependent
  cases in forward order and 220 in reverse. A history condition counts only after the case runs alone in a fresh
  process, so gates rerun candidate losses in fresh documents in both orders (2,442 → 735 stable WebKit losses), and a
  lucky run of unstable cases frozen as passes makes false regressions later (harness/README.md, Accepted and varying
  lists; Engine Facts, Safari).
- **Held-out sets often aren't.** The emulation study's reused its development fonts and corpora and chose Chrome's
  settings after seeing its misses; the redo's came from families it was tuned on; pooled "fresh unseen" numbers
  flattered, since most cases were easy generated kinds; generator pools ran dry while the log said nothing was reused.
  A held-out set is sealed before tuning and opened once, a look inside burns it into development, and each round gets
  fresh sets from new generators (four cheap ones, 10,319 cases, found two classes 80,000 reused cases hadn't). Report
  accuracy per kind of case.
- **"No font facts" runs still had outside inputs**: the lab passed the exact browser build and its languages, and its
  facts table came from lab tooling on the same Mac. With no supplied facts only about 10% of values are claimed as
  predicted, so exact-value regressions show only as a rising count of limited values, and a ledger with no status for
  "passes with a wrong predicted value" can't see them (planted regressions showed no pass-to-fail change).
- **A "real text" set laid out with default CSS isn't real use.** The redo audit's first cuts lost nothing on real-text
  sets yet broke real lines under soft hyphens, `break-all`, `overflow-wrap` and Windows-only font lists (`Meiryo`
  alone, 988 wrong). The sets missed served web fonts (88% of mobile pages), Android and Windows (65% of page views),
  chat users wrote, and app settings: hence the harness's weighted sample with sourced shares and at least 300 draws per
  rare group (harness/README.md). It still draws no tabs or blank lines. Books miss URLs, numbers, emoji sequences,
  NBSPs and discretionary breaks.

#### Tests And Gates

- **Tests blind to the path apps run.** A lab that always inspects never runs the plain path: a planted fit change on
  plain paragraphs passed offline replay on 134,130 Chrome cases and the usual browser tier. Offline replay is blind to
  painting, alignment and string storage, and it detects change rather than judging it, since its expected values are
  the library's own at a commit. Unit tests over a stand-in Canvas with one width per code point can't fail for shaping
  recipes; tests that restate the rule, or reimplement the algorithm (March's `bun test` ran a simplified copy), check
  nothing; `skipIf` on files outside the repo passes silently. `bun test` runs under the Blink profile, the one
  unrecognized engines take, since Bun's user agent names no engine. Separately written line walkers drift unless a test
  makes them agree.
- **Harness false greens, found by planting defects**: a negative or null width hid an omitted glyph; identical missing
  rect lists in all six jobs certified; a run with expected cases missing, even an empty one, passed. So geometry and
  the observer's population are validated before scoring, missing reference cases or duplicate ids fail a run, net gains
  never offset a loss, and unobserved is never a pass.
- **Evaluators certifying their own runs.** One replaced the saved results with its own runs and skipped the environment
  check, locking real losses into the baseline; an agent once committed new baselines before review. New results go to
  staging and are adopted after an independent check. Freezing diagnostic output byte for byte ties tests to incidental
  order (two good fixes were reverted because 4 of 67,065 rows regrouped): canonicalize first.
- **A case whose page layout doesn't match what it declares counts neither way**: 22 were found, 8 of them passing by
  accident (floats wider than the block). Thresholds come from the browser's own unwrapped geometry, and no expected
  value from the library under test.
- **Catalog growth leaks.** Each template family keeps a case, so a variant per family gets past the dedupe, and nothing
  old drops out. The Chrome HanKerning fix first added 72 families (9 marks × 4 endings × 2 languages), 751 cases and 18
  new accepted failures, then was cut to 41 cases and a unit test. The dedupe's classes are coarser than behaviour (`」`
  and `。` share one, though Chrome trims `」` and never `。`). An exact rule goes in a unit test, and a fix adds a few
  templates in the behaviour's shape, not a cross product (harness/README.md).
  <!-- Q3: recommendation taken; the maintainer hasn't answered -->
- **Main's own "facts" can be inherited opinions**: of 159,163 Chrome "visible pass" labels pre-#340 main carried, 678
  were refuted and 842 inconclusive. Triage main's passes by observation alone, as a fact to learn, an accident or an
  opinion to drop: admit browser behaviour, never main's code. Main's unit tests still hold real browser facts the
  redo's lab never saw (`rebuild/research/MAIN-FACTS-ANALYSIS.md`).
- **A README claim checked offline only** (2026-09-26): splitting pre-wrap text at `\n` and counting each empty
  paragraph as a line matched a stand-in Canvas on 588 of 592 cases but failed about 190 of 10,087 browser comparisons
  (a form feed before a line feed, the empty text, Chrome's CJK closing marks); splitting after each `\n` (#362) matched
  10,083-10,087. README claims are confirmed in real browsers (Part 1, Docs).
- **Finding repeated work.** Reading finds call sites but not how often each fires, and two predictions from reading
  were wrong. What worked (the redo, 2026-09-18): a per-call-site tally from stack traces over a deterministic replay
  ranks the repeats and reading explains each; then one fresh-eyes read of the library against engineering.md, reporting
  complexity, before profiling adds complexity back.

#### Agents' Reports

- **An agent's account of its own rule-keeping needs checking against its logs.** In the redo an agent broke a
  foreground rule under an exception it granted itself and its report denied it; it said nothing was running while its
  watchdog ran; its pre-push scrub looked only for local paths, so material meant to stay private reached a public
  branch; subagents re-ran a failed browser job before diagnosing it and replaced saved results without the setup check.
  Reports overclaim ("cold within 1.5-3× of main" where a measured point was 149×; "every gate at exit 0" where one
  exited 3), so a critic checks every number against its source. Reviewer agents can be surer than their evidence.
- **Credit and voice.** An agent's recommendation can get recorded as the maintainer's decision: the emulation study's
  decision 8 (Chrome's Chinese line table) was written up as accepted though never answered. A message in an agent
  thread may come from another agent; a doc an agent wrote can put its own line in the maintainer's mouth; text the
  maintainer forwards isn't their view. Every quote names its speaker and is checked against the transcript, and a claim
  about memory headroom against the watchdog log (a "30% floor" was really 2-3% free).
- **Terse acknowledgements are ambiguous.** A one-letter reply approving the chat's painter for rich-note was relayed as
  choosing the old painter, which became bug #296: confirm what a short reply approves. A recorded prerequisite can be
  wrong (ENGINE_FOLLOWUPS.md said Firefox's styled-piece breaks needed a model of its segmentation; one engine setting
  sufficed), so re-verify one before planning around it.
- **Answering "is this the last blocker?" before a sweep has targeted it** (2026-09-18): asked whether Firefox's
  `<canvas>` element was the last big obstacle to `system-ui`, the answer rested on the rows seen so far; its
  style-flush and memory costs (Dead Ends, DOM And Canvas-Element Paths) came out only when probes targeted them.

#### Timing

`bun harness bench` builds these in (harness/README.md, Bench); the numbers are why.

- **Timings on a loaded machine were wrong by up to 50 times** (the redo, 2026-09-18 to 09-22): webkit-host took 11.7 s
  under load for 10,000 messages against 0.235 s quiet, and pre-#340 main's Chrome cold prepare was quoted as 0.72 s for
  a day against 0.31-0.37 s, which made the redo look 1.5-3× main instead of about 13×. An exclusive browser lock
  doesn't mean a quiet machine (a fixed arithmetic probe ran 60.7 ms before one run and 29.1 ms after). Record the load,
  treat loaded runs as upper bounds, and check a number against its source before it becomes a reference.
- **Same-document ratios.** Base and change alternate in one document with a second base copy as a noise control, since
  ratios within a document survive machine-wide slowdowns; timed apart, Safari's hybrid read 0.6, 0.3 and 0.7× main
  where it was 0.82, 0.52 and 0.99× (2026-09-23/24). Order is shuffled every round, and samples last at least 20 ms: 5
  ms ones inflated Chrome's replay floors 40-75% and let GC pauses of 55-160 ms decide medians.
- **Focus and visibility.** A background window's timers are slowed, so timed runs check visibility and focus around
  each sample and fail rather than save. Using the Mac during a run failed all six Safari attempts; light concurrent
  work, or the bench window opening on another screen, moved Safari's `prepare()` by 1-2 ms of 11. An app's embedded
  Chromium pane isn't installed Chrome, and its numbers count for nothing.
- **Headless Chrome isn't installed Chrome.** With `deviceScaleFactor: 2` it most likely lays out at zoom 1 while
  reporting DPR 2, which its measurements reveal, and headless Chrome 153 crashed or hung on one input installed Chrome
  handled (reported privately; Part 1, Merge Bars And Landing). The harness records installed browsers.

#### Checking Demos

- **Techniques that worked** (2026-09-14 to 09-17): main and the branch built from `git archive` and loaded in one
  browser session with one probe; installed headed browsers at DPR 2 with both scrollbar kinds; painted width against
  the model within about 0.5 px; browser lines read by a DOM Range per character; width sweeps at breakpoint edges and
  in sub-pixel steps; stateful sequences instead of snapshots; a stand-in-Canvas "screen" diffed byte for byte to prove
  a refactor changes nothing. To check code against a spec, turn each rule into a yes-or-no question about one place in
  the code and pick the smallest runtime observation that would show a violation (a per-frame read and write log
  matching `^R*W*S?R?$`). Viewport emulation can hide a one-frame lag; use real window or iframe resizes.

## Part 3: Decisions Log

Decisions the maintainer made or accepted whose reasons the code doesn't show, by the maintainer's (Pacific) date.
Code comments that point here mark where one applies. Before reversing one, check whether its reason still holds, and
record the new decision here with its date; an entry that replaces another says so and keeps its reason.

- **2026-09-12: reported widths are never negative.** A line's advance can be: Safari 26.5.2 measures a word with its
  following space, a pair that can be kerned, so a line of only an invisible character and that space summed to about
  −1px, and main reported −9 for `iii` at letter spacing −5. Nothing visible is there, so reported widths clamp at 0
  (#236) while line breaking keeps the signed advance. A negative `maxWidth`, which CSS never produces, lays out as 0
  (#272).
- **2026-09-12: cursors never split a grapheme, even where Safari's lines do.** In a box too narrow for a word, Safari
  can end a line inside a multi-code-point grapheme, since WebKit steps through an overflowing word by code point on its
  simple font path (Safari 26.5.2 and WebKit's source; unchecked on Safari 27). Pretext keeps the grapheme whole, as its
  API promises. The maintainer accepted the mismatch on the condition that it's written down where it can be traced.
- **2026-09-13: no per-segment bidi levels.** `segLevels`, a simplified resolver inherited from the fork, gave each
  segment one level, which can never give visual order, and nothing had read it since 2026-03-04. The maintainer let it
  go as long as nothing Pretext means to render, such as mixed bidi, would need it back: mixed-direction text breaks
  right in logical order, and what goes wrong is painting a line without its paragraph's bidi context (Bidi Levels,
  which has what removing it saved, #258). A real bidi API would need a paragraph direction and levels per code unit; a
  `direction` option is on the API discussion's list (#321's decision 3). <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **2026-09-16: the WebKit profile follows Safari 27 only.** Safari 26, on macOS and iOS 26, breaks differently around
  curly quotes, guillemets, keep-all punctuation, U+2028 and U+2029, and an overflowing first character. Following 27
  cost Safari 26 about 2,900 left-to-right and 1,150 right-to-left line counts, mostly at widths narrower than one
  character (old suite, removed 2026-09-25). <!-- Q7: recommendation taken; the maintainer hasn't answered --> A profile
  can't tell the two apart: only Safari's own user agent names a version, and the other WebKit browsers on iPhone and
  iPad don't.
- **2026-09-18: Firefox measures on an OffscreenCanvas, as the other engines do.** A `<canvas>` element's context would
  get `system-ui` and optical-size variable fonts right, but once a page inserts a CSS rule, a kept one runs the pending
  style update in every `measureText()`, each live one joins the refresh driver, and workers have none (Dead Ends, DOM
  And Canvas-Element Paths). On 2026-09-19 the maintainer allowed it only if it proved light and worked in workers,
  which it didn't. If it's ever taken, Firefox switches wholly, not only for `system-ui`.
- **2026-09-23: each engine's own tables and scans find break opportunities**, in place of Pretext's rules and the
  UAX #14 table. The maintainer accepted the bundle growth, about 30 KB gzipped then, because the tables made analysis much
  faster, and left one check for the end of the project: whether they could shrink or give way to cheap computation.
  That check is closed (2026-09-26, below).
- **2026-09-23: premises nobody has falsified may be taken for speed.** The maintainer relaxed the correctness-first
  stance they had set at the rebuild's start: as a last resort for speed, ad hoc heuristics are the first to go, then
  requirements no real text exercises (Part 1, The Correctness Stance, has the statement and their words). Examples:
  text with invisible characters stays on the simple walkers, within 10⁻⁹px of the full walker's widths, and Firefox's
  script-run splits below.
- **2026-09-23: the Blink scan uses Chromium's Chinese line table**, `line_normal_cj.brk`, on `zh` pages and on pages
  without a language under a Chinese UI, as Chrome does: curly double quotes act as brackets, and a line can start with
  `〜` or `゠`. #321's decision 8 advised recording the gap instead; the hybrid kept the table as the assistant's default,
  46 cases for 8.6 KB gzipped and 16 lines (Chrome 153). The maintainer never answered it on its own; their acceptance
  of the tables' bundle that day covers it.
  <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- **2026-09-23: a new harness replaces the old suite, and what must not regress is decided afresh**, since main's tests
  were old. The engine tables landed first (#340), judged by the old suite's installed gate, the real-text sets and an
  attribution of every lost row; then the harness (#341), then the old suite's removal (#348). harness/README.md, "Why
  the old suite went", has the reasons.
- **2026-09-24: no must-pass tier.** Every repeatable case is pinned the same way, and a change that fails one puts it
  on the accepted list with a written reason. A hard trade-off in the heuristics then gets marked case by case where
  it's made, rather than forbidden by a tier.
- **2026-09-24: the Gecko scan doesn't split text runs where the script changes**, as Firefox's script itemizer does. It
  was rejected on 2026-09-16 for parity with Firefox and approved under the relaxed stance, since no old-suite or corpus
  text moved, only mixed-script fuzz strings with a stray mark (Dead Ends, Rules Per Input Shape).
- **2026-09-24: there is no `glue` kind.** Runs of only no-break characters (NBSP, U+2007, U+202F, word joiner, U+FEFF)
  are text and take emergency breaks where browsers do; the scans already decide where they break, so the kind was only
  a label. (`zero-width-glue` is another thing: a ZWSP or soft hyphen the scan doesn't break after.) It lost two
  old-suite Chrome cases in Courier New at letter spacing 1, since Chrome paints no letter-spacing gap after U+202F
  (ENGINE_FOLLOWUPS.md). <!-- Q7: recommendation taken; the maintainer hasn't answered -->
- **2026-09-24: Pretext finds grapheme clusters itself, fixed to Unicode 17.** Emergency breaks, letter spacing, emoji
  correction, line text and the Gecko scan's clusters come from Chrome 153's and libicucore 78.1's ICU character rules,
  which Firefox 156's ICU4X data matches, not from each browser's `Intl.Segmenter`, whose graphemes were the largest
  part of preparing new text in Chrome and Safari. The rules don't follow a browser to another Unicode version, so
  they're refreshed with the line tables when browsers move to Unicode 18 (Grapheme Clusters From Engine Data).
- **2026-09-24: Safari's generic families come from a generated Core Text table**, not from measuring through a
  `<canvas>` element. An element's context runs the document's pending style update in every `font` assignment and
  `measureText()`, attached or detached (PLATFORM_BUGS.md), and only an attached one follows the page language, which
  the maintainer rejected as DOM access on 2026-09-12.
- **2026-09-24: the full walker got engineering, not heuristics.** The maintainer asked for data layout, fewer
  allocations, smaller representations and plain indexed code rather than new shortcuts: its state moved into locals,
  each segment's facts into one byte, and a line's walk ends at the next hard break instead of looking up chunk records.
  It still costs three to five times the counter per segment, so one walker for all text was rejected (Keeping Work
  Bounded).
- **2026-09-25: a prepared handle needn't survive a JSON round trip.** Its per-segment flags are a `Uint8Array`, which
  `JSON.stringify()` turns into an object without a `length`, so the line walkers never finish on a JSON copy.
  `structuredClone()` and `postMessage()` copies work, and README calls the handle opaque. Cursors and ranges are plain
  JSON and resume the same from a JSON copy.
- **2026-09-25: the old wrapping suite, its snapshots and its diagnostic tools are gone.** Accuracy claims rest on the
  harness's recordings and accepted lists, speed on `bun harness bench`'s same-document ratios in PR descriptions;
  nothing timed is checked in. What the harness took from the old suite (adversarial families, rich items, oracles)
  stays frozen, since the generator went with it. The benchmark page went once the bench's noise floors were calibrated
  and it called a known change (Reading Browser Output).
- **2026-09-25: the npm package doesn't ship the demos (#342).** The README calls them exemplary API usage and asks
  agents writing Pretext code to clone the repo and play with them. Shipping them runnable from an install took the
  tarball from 238 kB to 620 kB, needed a Bun-only server script and shipped again content whose licenses aren't
  recorded; that version is parked as closed PR #343, in case this changes.
- **2026-09-26: `setLocale()` sets the language again** (#356), the one preparation reads in place of `<html lang>` for
  its break rules and measurement context, since that's the only way to give a worker, which has no `<html lang>`, the
  page's language. An empty locale is a page's without a language, and calling it with none reads `<html lang>` again.
  It still clears the caches; prepared handles keep what they have. Contexts with a `lang`, in Chrome and Firefox, take
  it too; `bun harness equal` moved no case. This replaces the 2026-09-24 decision to have it only clear the caches,
  taken because no locale changes the word boundaries Pretext reads in Thai, Lao, Khmer and Myanmar text (20 locales, V8
  and JavaScriptCore). An element's own `lang` waits for the end of the project.
- **2026-09-26: engines Pretext doesn't recognize take Blink's whole profile** (#356), as the docs already said, and are
  owed what Part 1, Lines Drawn, says. Only unrecognized user agents moved, such as Samsung TV web views.
- **2026-09-26: cater to the worst case, and allow it a slight regression for a real gain.** This replaces the
  assistant's stricter reading of the same day, that the worst case can't get worse (Part 1, Engineering, has the
  maintainer's words). 26% isn't slight, so the width memo stays parked (Dead Ends, Caching, State And API Designs).
- **2026-09-26: no dead code for one JIT.** Dead or redundant code kept only because one JIT runs it faster is removed,
  whatever the regression, and the regression is noted: code written plainly wouldn't reproduce the effect
  (Engineering). A loop's first pass peeled before the loop counts, since the loop repeats it. Live code split apart or
  placed for a JIT isn't dead and stays, such as `getLongMarkChainContext()` (#351) and `getTextSegmentWidth()` (#358).
  Removing what #357 had kept costs Chrome 154 up to 13%, on preparing pre-wrap chunks (Keeping Work Bounded), and
  removing `countPreparedLines()`'s leading-space skip, a loop that never runs, kept on 2026-09-24 for Firefox, costs
  Firefox 156 3 to 7% on resizing Latin chat messages to new widths (#364). Nor is a rule written out twice for one JIT:
  the Gecko scan's text run setup and its setup again of the words a bidi level run cuts share one word-end test, whose
  call makes Firefox 156 prepare long breakable runs, pre-wrap chunks, keep-all CJK brackets and seen Latin messages 2
  to 5% slower than with the test written out twice (#365, Bidi Levels). The maintainer took that as a good trade on
  2026-09-27.
- **2026-09-26: one bundle serves every engine.** An app can't import a bundle made for one browser, since its users run
  them all, and fetching one engine's tables at runtime would make the first `prepare()` asynchronous. So every browser
  downloads every engine's tables.
- **2026-09-26: the break tables stay as they are**, closing the check the 2026-09-23 entry left for the end. The one
  alternative the maintainer would weigh, Firefox's line data in Chrome's format if it wasn't a maintenance burden,
  wasn't worth it (Dead Ends, Tables, Bundles And Data). It reopens only if the tables' size and per-engine bundles both
  come back.
- **2026-09-27: the Gecko profile keeps its 80px floor for prefix fits, as a premise.** Prefixes model Firefox's
  whole-word advances better than standalone graphemes, and the floor has no browser reason, but a lower floor made
  Firefox prepare new Latin, Arabic and mixed text much slower for adversarial cases at 24-80px, and lost the one
  real-usage draw that moves. Words narrower than 80px keep summing standalone graphemes where lines narrower than 80px
  split them (Break Opportunities From Engine Data has the numbers).
