# Engine Follow-ups

<!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: no quotes in this file; decisions read as project rules with their dates -->

Open engine work: known gaps, deferred engine decisions, harness debt and actions outside the repo. A decision answered in chat leaves this file in the same change, for RESEARCH.md's Decisions Log if the code doesn't show its reason; a gap leaves with the PR that fixes it.

Pick work by demand, not by sweeping this list, and finish an open landing before starting new discovery (RESEARCH.md, Part 1: Intent). <!-- Q1: recommendation taken; the maintainer hasn't answered --> Demand shows in the `Real usage` headings of `harness/accepted/<browser>.txt`: at b1fd05fc the largest were WebKit's soft hyphens, Chrome's Japanese and Chinese lines, and Arabic and Urdu with letter spacing. Most entries below matter only under 24px or in adversarial text.

Sizes count the harness cases holding the shape at b1fd05fc, and how many are on each accepted list (Chrome / Firefox / webkit-host); `bun harness explain --text=…` checks one that isn't a case. Dates say when a behavior was seen: Chrome 153, Firefox 155 and Safari 26.5.2 until 2026-09-16, then Firefox 156.0 and Safari 27.0, then the pins of 2026-09-25 (`harness/pins.json`). Safari observations from before 2026-09-16 are unconfirmed on Safari 27 unless a webkit-host case holds them. "Pre-#340 main" is 6d1d2106; old-suite counts (removed 2026-09-25) stay only where they carry a decision. <!-- Q7: recommendation taken; the maintainer hasn't answered -->

Before starting one:
- Rules whose errors cancel land together: #225's broader attempts lost rows pre-#340 main passed only because the U+3000 hang and controls before brackets cancelled out. Build in layers, with a replay after each.
- A prerequisite written here can be wrong: this file once said Firefox's breaks between styled pieces needed a model of its word segmentation, and one engine setting sufficed.
- A fix may be on for one engine and off for another only when the off engine's losses come from a model named here as missing. <!-- Q3: recommendation taken; the maintainer hasn't answered --> <!-- Q3 note: P-COR-11 -->

## Gaps

### Letter spacing

- Blink gives cursive-script runs no letter spacing except on spaces, and Firefox none between joined Arabic letters (RESEARCH.md, Engine Facts); Pretext spaces every character. It's the letter-spacing gap real text shows ("Arabic and Urdu with letter-spacing" on Chrome's and Firefox's lists): at 1.5 in 16px Arial, Chrome and Firefox paint `ابب` in `中（ابب）` 4.5px narrower than Pretext charges. Chrome also gives U+202F no gap. Chrome before 149 lacks the rule or applies it differently, so a fix picks a version gate or a README line. #321's side finding 3 (by 2026-09-12). <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- Characters with no advance take no gap: in Blink per shaping cluster, in WebKit only on glyphs with an advance, in Firefox per cluster and none after a format character. At letter spacing 1, WJ, WJ at 1px in 16px Arial keeps one line in all three browsers, and Pretext splits it (by 2026-09-12). The attempts so far, and what each lost, are under RESEARCH.md, Dead Ends. A fix needs one per-grapheme spacing unit every rule shares, with per-segment arrays allocated only where needed. Waiting on it: WebKit's return from a soft hyphen whose hyphen doesn't fit (`unfitHyphenRetreat`); a ZWSP right after a forced break inside a word, which all three browsers give a line of its own, and which also waits on joined Arabic widths; and Blink's shaping-cluster overflow units.
- Tab stops under letter spacing (each engine's rule is under RESEARCH.md, Engine Facts). Firefox's and Chrome's stops count the letter spacing, and Firefox's next stop is at least half a `0` away; every profile takes stops of spaces alone, and only the WebKit profile has a minimum, half a space, which the walker derives as `tabStopAdvance / 16` and which goes wrong once a stop counts spacing. Every profile also gives each tab a letter-spacing gap of its own, which Firefox gives only a tab that ends its text run, as one before Arabic does. Of 270 pre-wrap cases with a tab and letter spacing, 132 are on Firefox's list, 55 on Chrome's and 17 on webkit-host's (b1fd05fc). The too-narrow stop and the extra gap can cancel, so some of today's passes may be luck: port the interval, the minimum and the tab's own gap in layers, with a replay after each, and pin exact multiples of a stop in the unit test, since a stop such as 43.6px isn't exact in binary. Blink's half-space skip is a separate gap. #321's side finding 2 (by 2026-09-12). <!-- Q18: recommendation taken; the maintainer hasn't answered -->

### Bidi levels, direction and script runs

Pretext takes no paragraph direction, and only the Gecko scan resolves levels, taking every paragraph as left-to-right (RESEARCH.md, Bidi Levels). That premise moved none of 4,346 right-to-left suite and corpus requests and 192 of 8,125 right-to-left fuzz ones (old suite, 2026-09-23). Without levels:
- WebKit keeps the punctuation after an overflowing first character with it only to the end of its item, which a level change ends, and the WebKit profile to the end of the scan's segment. So the profile keeps `((` after `ב` in `אב((tail` on a left-to-right page, where Safari 27 paints `ב` / `(` / `(` (633 cases; 124 / 73 / 128, most under 24px). WebKit also asks its scan again where levels change, as in `ab””tail` (2026-09-23).
- Neutral characters measure with their neighbour's script: Chrome's `(` is 6.12px alone and 11px in an Arabic run, and in right-to-left text Safari paints `）` after Arabic at 9px instead of 16px, so at 12-18px it keeps the U+202F after `中（ابب）` on the line of `）`, where Pretext gives it one of its own (67 cases; 14 / 13 / 4) (by 2026-09-12). Chrome's page gives a run of script-neutral Latin-1 characters, such as `)` × 15 or `«»` × 8, the script of the text before it, and its Canvas measures every Latin-1 segment as Latin, so in Amiri and Noto Naskh Arabic such a run after Arabic or Han paints wider than Pretext charges (RESEARCH.md, String Storage, 2026-09-27).
- Chrome measures under `<html dir>` as it was when Pretext made its context, so text against the page's direction wraps slightly differently around brackets. A `direction` option fixed it in a prototype and wasn't taken (RESEARCH.md, Dead Ends); it's on the API discussion's list (TODO.md) (2026-09-13).
- In a right-to-left paragraph Safari breaks `src/|עברית`, and the WebKit scan doesn't. Not a case (2026-09-14, Safari 26.5.2).
- Whether `direction: rtl` alone turns on Firefox's document bidi has no witness; it decides where the Gecko scan must resolve levels.
- The Gecko scan doesn't split text runs where the script changes (Decisions Log, 2026-09-24). Of the two fuzz strings in `harness/cases/followups.ndjson`, the `ko` one, which Firefox paints in 3 lines and the Gecko profile in 4, is on Firefox's list; the `th` one passes in Firefox and is on Chrome's list for another reason, not traced: Chrome keeps its final U+2007 on the last line, where the library gives it one of its own.

### Emergency breaks inside a word

- Each engine fits an overlong word its own way (#195): Chrome by right-context positions, Safari by line-start prefixes, Firefox by the advances of the word shaped whole, while the Blink profile sums standalone graphemes. At 248px, `'ه'.repeat(140)` in `400 14px Helvetica, Arial, sans-serif` fits 62 isolated letters a line, where Chrome fits 44 joined ones (2026-09-14). A mark that can't start a line sends the word before it through these fits: at about 105px in 16px Hiragino Sans, Chrome and Firefox keep `foo@bar.com` together before `，b`, and Pretext splits off `m` (19 cases; 1 / 0 / 0). In the WebKit profile, fits past 96 graphemes come from pairs: 96 `ه` break where Safari does, 97 don't. The Gecko profile sums standalone graphemes in segments under 80px, a premise whose measured gap, at 24-80px, is in RESEARCH.md, Break Opportunities From Engine Data (Decisions Log, 2026-09-27).
- Chrome keeps kerning when it breaks an overflowing word (`'AV'.repeat(116)` at 109px: 22 lines, not 24), which Canvas can't show (by 2026-09-12). Safari carries the word's remaining width to the next line without measuring it again (`AbstractLineBuilder.cpp:54-98`; `'AV'.repeat(17)`: 3 lines, not 4, and 36 of 36 headless WebKit checks, 2026-09-15); modeling that needs a Safari fit model that loses nothing. Neither is a case.
- In narrow boxes Safari keeps two joined Arabic graphemes on a line where Pretext splits them (by 2026-09-12, Safari 26.5.2).
- Splits inside a segment take Unicode graphemes, where Firefox splits at its own cluster starts: it keeps a Myanmar spacing mark such as U+102C with the cluster before it, though its `Intl.Segmenter` splits them (by 2026-09-12, Firefox 155).
- Arabic joined across a soft hyphen is measured at isolated widths. For the Gecko profile, measuring each connected letter with a ZWJ, gated by a check that a split's two sides add up, matched Firefox 155 on 1,458 of 1,576 widths in Noto Naskh Arabic and in the system Arabic fallback, and can't reach Amiri or Noto Nastaliq Urdu (2026-09-12; RESEARCH.md, Content Language And Fonts). <!-- Q6: recommendation taken; the maintainer hasn't answered --> Prototype it with the Firefox halves of the rules that wait on it.

### Line edges: U+3000, soft hyphens and closing marks

- The Chromium and Gecko profiles hang a U+3000 run that ends a segment, and miss four hangs: Chrome's in pre-wrap before a preserved space or tab (`中文`, U+3000, space, `中文` at 33px in 16px PingFang SC: 2 lines, Pretext 3) and at the start of the next segment after a space, Firefox's after a word joiner (34 cases; 8 / 6 / 0), and Chrome's after an overflowing letter (2026-09-23). Firefox leaves a trailing U+3000 run out of the line's width even where it fits (2026-09-24).
- Chrome paints no hyphen for a soft hyphen right after U+3000 where the line breaks after it (`a`, U+3000, U+00AD, `b` in pre-wrap 16px Arial at 30.2px), where Pretext adds `-` and overflows the box; and it never lets a soft hyphen at a line start hold a line its hyphen doesn't fit (39 cases hold `a`, U+3000, U+00AD, `b`; 6 / 0 / 2) (2026-09-24).
- In real text WebKit takes fewer soft-hyphen breaks than the library, moving the syllable before the hyphen to the next line, and Chrome sometimes breaks before it too (the "Real usage: soft hyphens" headings, 2 / 0 / 15). Those draws are stand-ins, with soft hyphens put every few letters into long words of real text. Not traced; `bun harness explain sample-16a3704504259e8b --browser=webkit-host`, a Gatsby line at 352px, is one to start from.
- Chrome and Safari keep a soft hyphen at a paragraph or hard-break start, where Firefox and Pretext consume it. After #349, still open (stand-in Canvas, b1fd05fc): soft hyphens that end the text after a line feed (`ab cd`, LF, U+00AD in pre-wrap: 2 lines in Chrome and Safari, 1 in Pretext; the "Soft hyphens alone after the last line feed" headings, 8 / 0 / 5), a paragraph of only soft hyphens, and one that starts a chunk before a word that doesn't fit. The lead is one line-start rule shared by soft hyphens and ZWSP (by 2026-09-12).
- Chromium keeps no-break glue on a soft hyphen's line, where WebKit breaks before it; trace Blink first (by 2026-09-12).
- At a chosen soft hyphen Chromium paints U+2010 where the primary font maps it, and Pretext measures `-` (in Geeza Pro, which doesn't map it, widths move 4.4-6.5px); Firefox's hyphen line is one letter-spacing gap narrower. Canvas can tell a font's own hyphen by measuring under two fallback families whose U+2010 differ (36 of 36 families; RESEARCH.md, Measurement Model). #321's side finding 9 (by 2026-09-12). <!-- Q18: recommendation taken; the maintainer hasn't answered -->
- Chrome's `text-spacing-trim` (`src/han-kerning.ts`) isn't modeled inside a unit that takes emergency breaks: Chrome fits `」。b` at 33px in 16px Arial, where Pretext charges 32px for `」。` (2026-09-14), and lays out `『是的。』` before a line feed in pre-wrap 16px PingFang SC in 4 lines at 16-31px, Pretext 5. Widths miss where lines match: `中」`, U+00AD, `中` at 24-32px is 24px wide in Chrome and 41.68px in Pretext (2026-09-27). The port's premises: it types each character of a pair by the font Canvas draws it in, where Blink types both by the halted one's font (no line changed on 5,736 Chinese and Japanese corpus cases, Chrome 153, 2026-09-23), and nothing halts across rich-inline items.

### Negative letter spacing and hanging spaces

Pre-#340 main matched most of these only while it started the next line with the space.
- At −6 in pre-wrap, the browsers don't fit a word after a hanging space where Pretext does: Chrome paints ` A B` in 16px Arial at 6.5-10px as `A` / `B` (7 cases; 3 / 0 / 1) (2026-09-15).
- In Chrome with negative letter spacing, a line ends before a space that follows a soft hyphen (`a`, U+00AD, space, `b` at 7-10px), where Pretext hangs the space after `a` (161 cases; 50 / 2 / 25) (2026-09-15).
- At −1 in pre-wrap, Safari and Firefox give the space after `لا` in `a لا ب` at 1px in 32px Arial a line of its own, where Pretext hangs it (2026-09-15, Safari 26.5.2).
- In pre-wrap, Chrome hangs preserved spaces and tabs after a letter that overflows, where Pretext starts the next line with them (by 2026-09-12).
- Pretext disagrees with itself: text laid out again at its widest line can break earlier, since a normal space, a ZWSP and a soft hyphen fit before the negative gap the reported width includes. In the Gecko profile on the stand-in Canvas, `x.ywordy\t\t foo` in pre-wrap at −1 has a first line 83.48px wide at 99px, and at 83.48px its second tab moves down (rechecked at b1fd05fc). Shrink-wrap callers such as the bubbles demo meet this (2026-09-15).

### White space and controls

- The scans read Pretext's collapsed white space, not each engine's: Blink keeps FF as text in normal white space, and WebKit reads CR and FF as text in both modes. The Gecko scan reads the source's, so its breaks follow Firefox, but widths come from the collapsed text (2026-09-23).
- Lone CR, FF and VT in pre-wrap: Pretext takes CR and FF as hard breaks and VT as text, and each engine differs (`ab cd`, CR, U+00AD, CR, `ef gh` takes a line too many at 12-48px in Firefox). The lists file such cases under "Pasted C0 and C1 controls", and the README tells apps to normalize `\r`. Two per-engine CR prototypes each lost results pre-#340 main got right (RESEARCH.md, Dead Ends): trace the engines' line builders first (by 2026-09-12).
- Before encoding any rule for controls, trace Firefox's hang and trim rules for spaces, CR, FF and tabs at a line end. In pre-wrap Firefox moves a tab that doesn't fit to the next line, back to the last break or, under `break-word`, to just before the tab, where the Gecko profile, which already doesn't hang it (`hangTabs`), ends the line after it (`https://ex.com\tfoo` at 101px in 16px Arial: Firefox `https:// | ex.com\tfoo`, Pretext `https://ex.com\t | foo`; 77 cases, 3 / 7 / 0) (2026-09-14). It trims U+1680 at line edges (40 cases; 0 / 2 / 0), fits negative letter spacing before preserved spaces otherwise (`To To` at 7px and −1; 13 cases, 1 / 1 / 1), and treats a hidden control as a cluster a line must hold (`a`, NUL, `ff` at 8px in 24px Amiri: 4 lines, Pretext 3; 16 cases, 1 / 11 / 0) (by 2026-09-12).
- Firefox removes a newline between wide characters, and next to East Asian punctuation for `ja` and `zh` content. For content without a language it goes by the OS's regional locale, which a page can't read, so there the Gecko profile removes only the first kind (by 2026-09-12).
- In the Gecko profile, a pre-wrap paragraph that starts with a bidi control after a line feed gets an extra break opportunity (`AA`, WJ, space, `B`, LF, LRE, `x` at 1px: 2 cases on Firefox's list). Found 2026-09-26, not traced; it waited on #365, which has landed.

### Rich-inline item edges

The soft-hyphen and U+2028 shapes were rechecked on the stand-in Canvas at b1fd05fc, where the flat walker gets them right.
- Soft hyphens at item edges (2026-09-15): one alone in an item loses the collapsed space before it (items `a `, U+00AD, `b` are 19.2px wide, 24.48px without it); one that starts an item after other content isn't a break, and the walk splits the word after it, so line ends move back as the width grows (items `u`, `\u00ADzv`, `uo` give `u|z / v|u / o` at 19.2-28.7px, the flat walker `u- / zv / uo`); one that ends an item where the line breaks gets no hyphen; and in the Chromium profile an unfit hyphen returns only to the break before its item.
- An item that fits whole doesn't end a line at a U+2028 or U+2029 the WebKit scan makes a hard break: under a Safari 27 user agent, one item `ab`, U+2028, `cd` is one line `abcd` at 200px (2026-09-23).
- Rich inline clamps widths to at least 1px, where the plain walkers clamp to 0; make them agree.
- `extraWidth` is charged on every piece of an item split across lines, where browsers pad only the first piece's start and the last one's end (a `600 13px Menlo` item with 12px of it takes a line more than Firefox at 46-48px; 2026-09-14). Padding per piece is on the API discussion's list (TODO.md).
- Chrome and Firefox shape and kern across same-font items and Safari doesn't, so item widths miss by about 1px at a boundary, and by more where one splits a cluster: in 16px Myanmar Sangam MN, `ဘာသ` and `ာသည်` measure 91.80px apart and 82.03px joined (RESEARCH.md, Rich Inline Boundaries). No `text-spacing-trim` halt crosses items either. The proposal, a prepare-time boundary correction for Blink and Gecko, was parked by the maintainer on 2026-09-26 as a large project for later.
- Chrome's and Safari's spans reserve a hyphen's width for a soft hyphen right before a ZWSP or a space, at some widths; neither walker does (2026-09-12).
- In a seeded search, 7-14 flows per profile still take more lines as the width grows (at #327, 2026-09-15; not rerun since #359 changed where rich lines end).

### Language and generic families

- Preparation reads one language, `setLocale()`'s or else `<html lang>`, never an element's own `lang` or a `Content-Language`, and no canvas follows either; this waits for the end of the project (Decisions Log, 2026-09-26). It costs Chrome's `line_normal_cj.brk`, which Chrome opens for `zh` content and, under a Chinese UI, for content without a language: `<html lang=en><p lang="">中文””tail` breaks before `tail` in Chrome only (22 cases, on no list, since the harness pins Chrome's UI to en-US). And an element with `lang="ja"` on an `en` page takes Safari's Japanese table, which doesn't break before the quotes in `||||““tail`, where the WebKit scan under `en` does (34 cases; 2 / 0 / 0) (2026-09-23). DevTools locale emulation, which Playwright's `locale` uses, changes `Intl`'s default locale but not Blink's, so a test under it shows a disagreement that isn't there.
- Safari's generic families by language, still open (2026-09-24): fallback for characters a named family lacks, and `system-ui`'s fallback order, which follow the page language on the page and the system's in Canvas; a Han page whose user's first Chinese language is a Traditional one; iOS's `monospace` under `fa`, `ug`, `ps`, `sd` and Arabic with a region, and `fantasy` under `he` and `yi`, which the table leaves at macOS's answers; and iOS 27's own answers, never dumped. WebKit #285993, a canvas `lang` that defaults to the document's, would settle them all.
- Safari's `Intl.Segmenter` words in Thai, Lao, Khmer and Myanmar runs aren't checked against its dictionary breaks, as Chrome's and Firefox's are (RESEARCH.md, Break Opportunities From Engine Data).

### Fitting arithmetic

Each engine's line fit is exact in its own units (RESEARCH.md, Measurement Model), and the Blink and Gecko profiles fit with a 0.005px allowance instead: a named gap, not a tolerance to tune. Its cost sits under the "Within 1/64 px of where the browser's lines change" headings, most on Chrome's list; Chrome's real-usage Japanese and Chinese lines, which fit one more character than the Canvas widths add up to, may be the same, untraced. Chrome fits on a grid of 1/64 zoomed px, and the zoom includes the device pixel ratio: at DPR 1, `14.1px "Helvetica Neue"` at 112px kept `over the lazy dog.` on one line though Canvas measured 112.0103px, and at DPR 2 broke before `dog.`, as Pretext does (Chrome 153, 2026-09-14). Nothing in `src/` reads the ratio, which would be hidden state that goes stale when a window moves to another display, so it's an API question (#321's decision 4; TODO.md). <!-- Q18: recommendation taken; the maintainer hasn't answered -->

### Contexts kept for the page's life

Main keeps one measurement context, replaced only when preparation's language changes, and two engines let a kept context go stale. In Firefox 156, a context first used in about the first 8 s keeps the fallback for localized and legacy family names, and every later preparation of that font string with it (PLATFORM_BUGS.md, the late family names). The redo makes Gecko contexts per prepared paragraph, which put its Firefox speed at 0.92 of keeping them on the chat mix and 0.75-0.80 on plain ASCII (2026-09-20); main has neither taken nor rejected that. In WebKit a kept context misses a `FontFace` that loaded before joining an empty `document.fonts` (webkit-host, 2026-09-20); whether `clearCache()` and a second prepare heal that on main isn't checked.

### Emoji correction

The correction is one width per font, read once from a DOM span, but the gap it corrects depends on the device pixel ratio, so it may go stale when a window moves to another display (inferred, never measured; #321's side finding 6). <!-- Q18: recommendation taken; the maintainer hasn't answered --> In a worker it stays 0, and emoji measure too wide in Chrome and Firefox on macOS (#292); a hand-off from the page is on the API discussion's list (TODO.md).

### Canvas answers that differ from the page

Unfiled; PLATFORM_BUGS.md takes any that gets filed.
- Safari's Canvas gives isolated and fallback-font combining marks an advance they don't have in context (by 2026-09-12, Safari 26.5.2).
- Safari's OffscreenCanvas gives a space before U+FE0F the emoji's width, 21px at 16px, where the page draws a space, 4.45px (2026-09-15, Safari 26.5.2).
- Chrome's Canvas gives VS16 about 4.9px that the page doesn't (by 2026-09-12).
- Firefox's Canvas puts a ZWJ that ends a text in a left-to-right bidi run of its own: `آگ`, ZWJ measures 16.32px in 16px Arial, where the page joins them at 9.97px (2026-09-23).

### Cost

- A run of combining marks after zero-width glue or a control prepares in linear time since #351, but each run's context still holds the grapheme before the chain: `x` with 4,000 U+0301, then 4,000 pairs of a control and a mark, submits 33 million units to Canvas offline, against 64 million before #351 (2026-09-26).

### Small ones

- In Chrome, `£€£€““tail` in 16px Arial at 35.7-38.7px, on `zh` pages and on pages without a language under a Chinese UI, keeps `£€£€` on the first line, where the Chromium profile ends it after `£€£`; the scan agrees with Chrome, so the widths differ. Not traced (98 cases; 9 / 0 / 0) (2026-09-23).
- Under keep-all, Safari offers no break on either side of NEL, and the WebKit scan none after `-` in Latin text; recheck in installed Safari (by 2026-09-12, Safari 26.5.2).
- Firefox keeps `x`, U+2028, U+202F on one line at 10px in 16px Arial, where Pretext gives U+202F its own; not traced, since the offline widths can't measure U+202F there (26 cases; 0 / 4 / 0) (2026-09-23).
- Chrome and Safari never end an emergency line with an opening bracket after emoji or digits (`12(ab`), where Firefox and every profile do. Not a case (2026-09-23).
- Letter-spaced Shantell Sans is 0.016px wider than Canvas with `letterSpacing` set, likely because ligatures turn off (by 2026-09-12).
- Why Amiri `il` at a line start measures 2.544px or 7.416px in Safari is unexplained (by 2026-09-12, Safari 26.5.2).

### Probably stale

Check each with `bun harness explain`, then drop it.
- Safari breaking `a-|١٢` where the WebKit scan doesn't: 36 of the 60 cases that hold it run in webkit-host, and none is on its list.
- A leading ZWNJ, joiner, bidi mark or bare combining mark adding a line to a long word: with zero-width invisibles on the stand-in Canvas, none does at b1fd05fc.

### Never measured

- Whether a line or piece measured with Canvas matches its painted DOM width in installed browsers, the premise of one element per line.
- Whether the exactness holds off macOS: every recording comes from one Mac, and Edge is covered as Blink without a Windows run.
- The checks from #321's decision 7 that the redo didn't settle: Chrome's whole-string widths under `optimizeLegibility`, held-out Chrome cases at a real DPR 2, whether the emoji correction changes between DPR 1 and 2, and the U+2010 width in Amiri and Noto Naskh Arabic.
- Whether an iPhone holds 100k chat messages now (RESEARCH.md, Dead Ends, The Markdown Chat At Scale). Offline on 2026-09-16, with the break-data branch that became #340 and three memory cuts that haven't landed, JavaScriptCore retained 565-625 MiB against pre-#340 main's 858 MiB.

## Deferred engine decisions

- Lam + alef when an overlong Arabic word breaks: Canvas can't tell whether a font draws it as one cluster, so every default is a guess (RESEARCH.md, Dead Ends). No change now; decide if main ever breaks overlong Arabic words by cluster. Reopens when `getTextClusters()` or `TextMetrics.advances` ships. <!-- Q12: recommendation taken; the maintainer hasn't answered -->
- Per-paragraph contexts in the Gecko profile, against Firefox's late family names (Contexts kept for the page's life).
- A version gate or a README line for cursive letter spacing in Chrome before 149 (Letter spacing).
- An Arabic-script soft-hyphen policy, only once demand for Persian appears, and after observing how browsers render soft hyphens typed in place of ZWNJ (RESEARCH.md, Break Opportunities From Engine Data, has how rare they are).

## Harness debt

One line each; harness/README.md, "Bounds and blind spots", has the rest.
- The hyphen drawn at a soft-hyphen break: scoring it needs recordings that tell it apart, and every case recorded again.
- The real-usage sample has no blank line and no tab in any of its 3,335 pre-wrap draws, so a planted tab-stop defect left the headline unchanged; give it a sourced share of such text.
- A bracket-pair (N0) error in the Gecko bidi port passes everything checked in; Unicode's `BidiCharacterTest.txt` would give the port a reference.
- Shared fit advances rebuilt in place for another fit mode go unseen, since the stand-in Canvas gives every mode the same advances; held handles checked under a stand-in whose modes differ would see it.
- Laying text out again at its own widest line is a candidate invariant.
- No rich case splits an emoji modifier from its base across items.
- A new environment key starts the page-history list empty, and two orders find few of Firefox's page-history cases, so `repin` keeps the list it finds.
- No planted fault guards the watchdog's kill, or the bench's shuffle and separate compiles. <!-- Q9: recommendation taken; the maintainer hasn't answered -->

## External actions

- At the end of the project, file the collected browser bugs (TODO.md): PLATFORM_BUGS.md's unfiled rows, the rebuild's pages for unfiled bugs (`rebuild/platform-bugs/pages/` on branch `rebuild-20260916`), and the drafted upstream patches for engine hot spots (RESEARCH.md, Dead Ends). Leave out anything reported privately. <!-- Q10 placeholder: the rebuild's LEDGER.md on that public branch describes a withheld report, so this points at the pages directory only until the maintainer answers --> PLATFORM_BUGS.md's header says how to file and how to recheck statuses.
<!-- Q18 placeholder: the status comment on #321, sorting its ten decisions and 17 side findings against main, goes here as an action; it's a public post and waits for the maintainer's word. -->
