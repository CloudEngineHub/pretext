# Wrapping suite validation

This branch implements the boundary-policy fixes for #206/#208, #212/#213 and
#214/#215, plus the separate rich-inline source-identity and signed-space fix.
The later leading-ZWSP change fixes the exact flat #210/#211 reproduction; its
deliberate losses are listed in the next section. The twelve native rich-inline
height witnesses are required, as are two exact-fit admission opposites
discovered during review.
[README.md](README.md) explains the runner; [INVENTORY.md](INVENTORY.md) records
coverage, provenance and research protocols outside its scope.

The September 9 SHY observer correction passed the ordinary three-browser run:
33,632 inputs, nine numeric profiles, no lost successes, required failures or
execution errors. The default-language Safari quote control passes its explicit
marker/width contract; keep-all's unwanted marker and width remain known failures.
All accuracy, letter-spacing and corpus result payloads are unchanged; refreshed
snapshots change only provenance and environment records. Runtime sources and
the baseline pin are unchanged, so no runtime benchmark was needed.

## Rich-inline items within the line fit epsilon

This change starts from main after #276. Rich-inline layout could take one more line at a
width than at a slightly narrower width. The walk over the next item takes a longer part of
it when that part fits within the line walker's fit epsilon (0.005px, or 1/64px in Safari),
but the check after that walk compared raw widths and moved the whole item to the next line.
Every rich-inline fit check now allows the epsilon, as the line walker and the carry checks
already did; the allowance applies once per line. Blink's and WebKit's line builders also add
their epsilon once to the available width for every kind of content. Under the Blink, WebKit
and Gecko profiles, the widths where a line count goes up in every width range of 28 flows
fall from 136, 98 and 142 to 0. No suite row has content that fits only within the
allowance, so the installed gate changed no metric.

The installed gate ran against the previous pin `6f22449`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes a metric. No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `63600ad`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 2560x1440 screen. Chrome reads `prepare()` at 8.60 ms
(8.50 on the parent branch) and hot `layout()` at 0.0885 ms (0.0877); Safari reads
12.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 111.9 ms in
Chrome (116.8) and 362 ms in Safari (362).

## Text after a mark that ends CJK text

This change starts from main after #275. After CJK text, Pretext attached punctuation that
can't start a line, such as the `.` in `丙.`, to the CJK text, but then started the next word
as its own break unit, so lines could break between `丙.` and `first_week_voltage}` (#274).
Chrome, Safari and Firefox keep them together wherever UAX #14 keeps the pair: IS, CP and PO
before a letter or number, and straight quotes before anything. The first merge pass and the
CJK unit builder now take the text after such punctuation, and the joined unit still takes
grapheme breaks when it doesn't fit an empty line. Letters inside a CJK unit don't join, and
neither does text after a closing curly quote, where Chrome breaks; the first installed gate
lost rows on both. Where engines disagree, as for `!`, `}`, `/` and `|` before a letter,
Pretext keeps main's behavior, and ENGINE_FOLLOWUPS.md records what each engine does.

The installed gate ran against the previous pin `b569d86`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
Chrome fixes 79 LTR and 37 RTL metrics (42 in `signed-spacing/straight-double`, 32 in `script-prefix-heldout`, 24 in `reported/#274`, 18 in `straight-double`); Safari fixes 80 LTR and 38 RTL metrics (42 in `signed-spacing/straight-double`, 34 in `script-prefix-heldout`, 24 in `reported/#274`, 18 in `straight-double`); Firefox fixes 79 LTR and 37 RTL metrics (42 in `signed-spacing/straight-double`, 32 in `script-prefix-heldout`, 24 in `reported/#274`, 18 in `straight-double`). No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `6f22449`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 2560x1440 screen (the parent branch's runs used the
1440x2560 screen). Chrome reads `prepare()` at 8.50 ms (8.50 on the parent branch)
and hot `layout()` at 0.0877 ms (0.0885); Safari reads 11.0 ms (11.0) and 0.105 ms
(0.103). Long-form corpus totals read 116.8 ms in Chrome (113.7) and 362 ms in
Safari (346).

## A space after an overflowing first word

This change starts from main after #271. Pretext walks lines with a fast loop for plain text
and a general loop when the text anywhere contains soft hyphens, letter spacing, glue or
similar. When a line's first word was wider than the line and a space or zero-width space
followed, the fast loop kept the space on that line and the general loop moved it to the next,
so adding a soft hyphen elsewhere changed line text and line-end cursors. The general loop now
follows the fast one. Browsers draw that space at zero width, so no native observation decides
which line owns it, and plain-text line counts and widths don't change. A negative width now
lays out like 0 in every fit limit, so both loops agree there too. With `letterSpacing`,
rich-inline layout can take fewer lines where invisible characters such as a zero-width space
took a line of their own.

The installed gate ran against the previous pin `8ab3383`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes a metric. No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `b569d86`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen (the parent branch's runs used the
2560x1440 screen). Chrome reads `prepare()` at 8.50 ms (8.65 on the parent branch)
and hot `layout()` at 0.0885 ms (0.0885); Safari reads 11.0 ms (12.0) and 0.103 ms
(0.105). Long-form corpus totals read 113.7 ms in Chrome (118.7) and 346 ms in
Safari (348).

## Safari kerning across paragraphs

This change starts from main after #270. In the Safari profile, a word ending in an invisible
format character such as a word joiner is measured together with a following space, so the
pair keeps its kerning. That was skipped when an explicit bidi control such as U+202A appeared
anywhere in the text, even in another paragraph. The check now scans only the space's own bidi
paragraph, since UAX #9 X8 ends embeddings at a paragraph separator. The maintained
`space-kerning` case `AA⁠ B`, a newline and `‪x` in pre-wrap at about 20.9px is 3 lines in
installed Safari; main predicted 4.

The installed gate ran against the previous pin `4833f8e`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
Safari fixes 3 LTR and 0 RTL metrics (3 in `maintained/space-kerning`). No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `8ab3383`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 2560x1440 screen. Chrome reads `prepare()` at 8.65 ms
(8.45 on the parent branch) and hot `layout()` at 0.0885 ms (0.0887); Safari reads
12.0 ms (11.0) and 0.105 ms (0.103). Long-form corpus totals read 118.7 ms in
Chrome (117.9) and 348 ms in Safari (347).

## Firefox marks after a line break or space

This change starts from main after #269. In the Firefox profile, the numeric affix check
looked back past combining marks for the character before `$`, `%`, `+` or `\`, and after a
line break or a space it took the break or space as the mark's base. So `x`, a newline and
`ً$` split differently from `ً$` at the start of the text. Following UAX #14 LB9 and LB10,
a mark with no base now counts as a letter. At narrow widths such text can take one line
fewer: after `어`, a space and U+3099, `$"` no longer breaks between `$` and `"`. A
counting fake canvas over `src/test-data.ts` and whole corpora found no other change.

The installed gate ran against the previous pin `ee5607e`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes a metric. No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `4833f8e`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 2560x1440 screen (the parent branch's runs used the
1440x2560 screen). Chrome reads `prepare()` at 8.45 ms (8.55 on the parent branch)
and hot `layout()` at 0.0887 ms (0.0880); Safari reads 11.0 ms (11.0) and 0.103 ms
(0.105). Long-form corpus totals read 117.9 ms in Chrome (117.2) and 347 ms in
Safari (345).

## Keep-all URL query text

This change starts from main after #268. `mergeUrlRuns` gave a URL's query segment the start of an inner
`www.` or scheme segment instead of the position after the whole URL run. With
`word-break: keep-all` in the Chrome and Firefox profiles, `アwww.¿www.?־` prepared as
`["アwww.¿", "־"]` and lost `www.?`, and an inner `https://` lost text the same way. The
fix removes that override. In Chrome and Safari, rich-inline layout no longer breaks such a
URL where its text has no break opportunity, as before the second `www.` in items `字` and
`www.a/www.b?q=1`. A counting fake canvas over `src/test-data.ts` and whole corpora under
desktop Chrome, Safari, Firefox and Android user agents found no other change.

The installed gate ran against the previous pin `b510ce1`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes a metric. No leg loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `ee5607e`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 8.55 ms
(8.40 on the parent branch) and hot `layout()` at 0.0880 ms (0.0870); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 117.2 ms in
Chrome (117.5) and 345 ms in Safari (345).

## Removing segLevels

This change starts from main after #256. `prepareWithSegments()` no longer
returns `segLevels`, and `src/bidi.ts` keeps only the class lookup and bracket
check that Safari's following-space kerning guard reads. Nothing in the library,
rich-inline or the demos read the levels, and one level per segment couldn't
produce visual order. The published `PreparedTextWithSegments` type loses the
field; nothing else in the emitted declarations changes.

Before the browsers, a counting fake canvas under desktop Chrome, Safari, Firefox
and Android user agents compared the branch with main on 24,404 cases per user
agent: every corpus text, `src/test-data.ts` and every retained wrapping input.
Handles, layout and rich-inline outputs, and Canvas calls and submitted strings
matched, apart from the missing field. A review probe on 4,915 new bidi-heavy
cases under six profiles matched as well. Interleaved V8 timings of the removed
pass on main read `prepareWithSegments()` 2.9% faster on Latin corpora, 8.5% on
Arabic, Hebrew and Urdu corpora and 16.3% on 500 short Arabic texts, and
`prepareRichInline()` 15.2% faster with 300 Arabic items. The gzipped layout entry
shrinks from 26,099 to 25,441 B.

The installed gate ran against #255's pin `cc2328b`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes or loses a metric, and none has required failures, execution errors,
or new API or rich failures.

`bun test` and `bun run check` pass. The baseline advances to `b510ce1`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused. A first Chrome run read the
long-form corpus total 11% above #255's snapshot, almost all of it in Arabic
measurement, so Chrome was measured again back to back with main 477510e on the
2560x1440 screen. This branch reads `prepare()` at 8.40 ms (8.45 on main), hot
`layout()` at 0.0870 ms (0.0868) and a corpus total of 117.5 ms (115.9), so the
earlier gap was environment drift, not this branch. Safari on the 1440x2560 screen
(#255's runs used the 2560x1440 screen) reads 11.0 ms (11.5 on #255), 0.105 ms
(0.105) and 345 ms (347). The benchmark page times `prepare()`, which never
computed the levels.

## Smaller prepare state

This change starts from main after #254 and leaves output unchanged. The
`letterSpaceNextLine` profile field was false wherever it was read and is gone.
The soft-hyphen shaping map and `clearLineTextCaches` duplicated caches that
already exist. Prepared handles no longer keep per-segment `lineEndFitAdvances`
and `lineEndPaintAdvances`: the complex line walker derives them from the width,
kind and letter-spacing count each handle already holds. Those arrays were
undocumented fields on the published `prepareWithSegments()` type. The hyphen,
mandatory-break and CJK line-start sets now read the generated line-break class
table, and `layoutNextLine()`, `layoutNextLineRange()` and the rich-inline item
step share their duplicated advances. The library loses 110 lines net, and the
core bundle about 316 B gzipped.

Before the browsers, the Blink, WebKit, Gecko and Android profiles produced no
output differences across 163 texts, about 1,956 handles and 11,736 rows each,
with identical Canvas call counts. The derived advances matched the stored arrays
in about 1.5 million checks per profile, and the numeric companion is unchanged.

The installed gate ran against #250's pin `b4d9fd7`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
No leg fixes or loses a metric, and none has required failures, execution errors,
or new API or rich failures.

Interleaved V8 timings (Node 23, a fake canvas with a Chrome user agent, 31
rounds, head against base) read cold `prepare()` over the long-form corpus 2.5%
faster and warm 1.6% faster. `layout()` is 15% faster for pre-wrap, 7% faster
with letter spacing and flat (+0.5%) on the simple path. Soft-hyphen-heavy text
prepares 1.9% slower cold (10.0 ms against 9.85), because each soft hyphen now
looks up its joined text in the segment metrics cache instead of the removed map,
and flat warm.

`bun test` and `bun run check` pass. The baseline advances to `cc2328b`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 2560x1440 screen (the parent branch's Safari runs used
the 1440x2560 screen). Chrome reads `prepare()` at 8.50 ms (9.15 on the parent
branch) and hot `layout()` at 0.0883 ms (0.0885); Safari reads 11.5 ms (11.0) and
0.105 ms (0.105). Long-form corpus totals read 107.9 ms in Chrome (115.0) and 347
ms in Safari (359).

## Small kana and ー in Chrome and Firefox

This runtime change starts from main after #249. Chrome and Firefox now resolve
small kana and `ー` through the class-table predicate that Safari already uses.
Chromium's ICU data classifies these conditional Japanese starters as ideographic
for every page language. So in Chrome they may start a line after CJK text,
including after `？` and `！`. Gecko's `line-break: auto` is strict, so in Firefox,
and in engines Pretext doesn't recognize, small kana stay with the CJK text before
them. The `conditionalJapaneseStarterModel` profile field lost its last use and is
removed.

The installed gate ran against #249's pin `8a54d4c`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
Chrome fixes 25 LTR and 0 RTL metrics (25 in `maintained/content-language`). Firefox
fixes 98 and 0 (80 in `maintained/content-language`, 18 in `maintained/corpus`). Safari changes nothing. No leg
loses a metric or has required failures, execution errors, or new API or rich
failures.

After a digit or a Latin letter, Firefox keeps small kana and `ー` attached, but
Pretext still lets them start a line there. Firefox's emergency split of `本ーー`
is still unmodeled.

`bun test` and `bun run check` pass. The baseline advances to `b4d9fd7`, and the
ordinary snapshots were regenerated against it. Firefox's step-10 corpus sweep now
matches `ja-kumo-no-ito` at all 61 widths, up from 52; no other snapshot payload
changes.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 9.15 ms
(8.80 on the parent branch) and hot `layout()` at 0.0885 ms (0.0900); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 115.0 ms in
Chrome (119.7) and 359 ms in Safari (351). Under a counting fake canvas in Bun, Canvas
calls per cold `prepare()` are unchanged for the Chrome profile. The Firefox profile
adds 22 calls on `ja-kumo-no-ito` (336 to 358) for its new two-grapheme units.

## Safari small kana and ー by page language

This runtime change starts from main after #248. Preparation reads `<html lang>`
once and resolves a line-break language from its primary subtag: `ja`, `ko`,
`zh` or the root rules. In Safari, small kana and `ー` after CJK text may start a
line on Japanese and Korean pages. Elsewhere they stay with the text before them,
as the content-language observations show. One predicate now decides where CJ
characters can start a line, from the generated class table and the profile's CJ
resolution. It replaces a hand-kept set that listed `ー` but no small kana. Chrome
and Firefox keep their previous rules.

The installed gate ran against #248's pin `96f4673`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
Safari fixes 68 LTR metrics (68 in `maintained/content-language`) and loses none. Chrome and Firefox
change nothing, and no leg has required failures, execution errors or new API or
rich failures.

Preparation now reads `<html lang>` once per call instead of twice. A handle
prepared before a language change keeps its line-break rules as well as its
widths, as README says. After Latin letters or digits, Safari's profile still lets
small kana and `ー` start a line on other pages.

`bun test` and `bun run check` pass. The baseline advances to `8a54d4c`, and the
ordinary snapshots were regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 8.80 ms
(8.75 on the parent branch) and hot `layout()` at 0.0900 ms (0.0895); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 119.7 ms in
Chrome (122.0) and 351 ms in Safari (353).

## One separator check per text

This runtime change starts from main after #245. #245 tested every segment with a
regex for a digit, a full-width separator and another digit, so words like
`00，2025` split after the separator. In V8 that regex cost about 1.5% of a cold
`prepare()` over the long-form corpus texts. Preparation now checks the whole
text once for the six separators, and scans segments with a character loop only
when one is present. Line breaks don't change.

An interleaved Node 23 run of cold `prepare()` over the 18 corpus texts, with a
fake canvas, read 252.0 ms before #245, 255.5 ms with #245 and 252.3 ms with this
change. The installed gate ran against #245's pin `9270621`: Chrome 153 through
the Playwright transport, Safari 26.5.2 and Firefox 155 natively, both
directions. No leg fixes or loses a metric, and none has required failures,
execution errors or new API or rich failures. `bun test` and `bun run check`
pass. The baseline advances to `96f4673`, and the ordinary snapshots were
regenerated against it.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 8.75 ms
(9.15 on the parent branch) and hot `layout()` at 0.0895 ms (0.0895); Safari reads
11.0 ms (11.5) and 0.105 ms (0.105). Long-form corpus totals read 122.0 ms in
Chrome (121.4) and 353 ms in Safari (351).

## Numeric runs with a closing full-width comma

This runtime change starts from main after #243. A numeric run now keeps the
closing punctuation that follows it (UAX #14 LB25, with classes from the
generated line-break table), so `00:00:00，` stays whole instead of breaking
after `:` or before the comma. `Intl.Segmenter` keeps a full-width comma, stop
or semicolon between digits inside one word (`00，2025`), and Safari marks such
words non-word. Those words now split after the punctuation, where UAX #14
allows a break, so the time before them merges as one run.

#225's reproductions are reported rows with the reporter's font in `normal` and
`pre-wrap`: both reproductions, the control, a bare `xxxx，b`, a time at a width
that fits only part of it, and a comma between digits. They are required in
Chrome and Safari. Firefox keeps a date such as `2025-08-01` whole, where Chrome
and Safari break after its hyphens, so the first reproduction only observes
Firefox.

The installed gate ran this branch against #243's pin `7652cad`: Chrome 153
through the Playwright transport, and Safari 26.5.2 and Firefox 155 natively, in
both directions. Chrome fixes 11 LTR and 0 RTL metrics, Safari 10 and 0, and Firefox
8 and 0. No leg loses a metric or has required failures, execution errors, or new
API or rich failures.

Two broader rules ran through the same gate and were reverted. Attaching closing
punctuation after any Latin text (LB13) creates kinsoku units without emergency
breaks. It lost 42 Chrome, 52 Safari and 52 Firefox LTR rows, mostly shapes like
`739x「value」! end`. Adding emergency breaks inside kinsoku clusters on top of it
fixed 624 Chrome, 1,197 Safari and 993 Firefox LTR metrics, but lost 510, 108 and
200. Chrome's losses are rows that main passes only while unmodeled U+3000
hanging and controls cancel out. ENGINE_FOLLOWUPS.md keeps both.

`bun test` and `bun run check` pass. The baseline advances to `9270621`, and the
ordinary snapshots were regenerated against it; only provenance and environment
records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. The Chrome snapshot came from a run that
needed focus retries while the Mac was in use, and its measurement totals moved
as much as its analysis totals. A rerun on an idle Mac read `prepare()` at 9.15 ms
(8.75 on the parent branch), hot `layout()` at 0.0895 ms (0.0885) and corpus
totals at 121.4 ms (119.4), with analysis 3.4 ms slower; #248 removes that cost.
Safari reads 11.5 ms (11.0) and 0.105 ms (0.105), and its corpus total reads
351 ms (351). Under a counting fake canvas, Canvas calls
per cold `prepare()` are unchanged on the 18 long-form corpus texts, and a #225
sample drops from 40 to 31.

## Keep-all runs from generated line-break classes

This runtime change starts from the rich-inline boundaries branch. Keep-all runs
now end where each engine's pair rule and the ordinary line-break rules allow a
break, decided from a generated UAX #14 line-break class table (Unicode 17,
refreshed with `bun run generate:line-break-data`) instead of hand-maintained
class sets. Chrome keeps a pair when both sides are letters or numbers, with a
one-mark lookback. Firefox keeps ICU4X's keep-all class pairs, including LB21a
after a Hebrew letter and HY or BA. Safari still breaks only at spaces. The table
ships as one string literal, and plain keep-all letters skip grapheme
segmentation.

The installed gate ran this branch, merged onto #241, against #241's pin
`8e01c01`: Chrome 153 through the Playwright transport, Safari 26.5.2 and Firefox
155 natively, both directions. Chrome fixes 1090 LTR and 514 RTL metrics and loses
28 and 28 in 8 and 8 curly closing-quote keep-all rows at letter spacing 1.5.
After an emergency break just before the quote, Chrome restarts its ICU context
and doesn't break after the quote; the parent matched only because it lacked the
LB19a rule, so these are accidents. Safari changes nothing. Firefox fixes 617 LTR
and 257 RTL metrics and loses none. No leg has required failures, execution errors
or new API or rich failures.

Headless Chromium 147 sweeps over 270 keep-all texts cut wrong widths from 20,037
to 2,337. Headless Chromium runs ICU 77.1 while installed Chrome 153 runs ICU
78.2, so the HH, LB21a and LB20a families rest on the installed gate and ICU
source. The table adds about 3.1 KB gzip; warm `prepare()` in headless V8 is even
or faster on the chat datasets after the plain-letter fast path.

`bun test` and `bun run check` pass. The baseline advances to `7652cad`, and the
ordinary snapshots were regenerated against it; only provenance and environment
records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 8.75 ms
(9.10 on the parent branch) and hot `layout()` at 0.0885 ms (0.0893); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 119.4 ms in
Chrome (121.2) and 351 ms in Safari (346).

## Rich-inline boundaries in Chrome and Safari

This runtime change starts from the Safari next-line branch pin `1771ab8`.
`prepareRichInline()` treated every item boundary as a break opportunity, while
browsers find breaks in the text their items join. Blink runs one line-break
iterator over the whole inline formatting context. WebKit decides a boundary
from the previous box's last two characters followed by the next box's text, and
finds breaks inside a box from that box's own text. The engine profile's
`inlineItemBreaks` is `'joined-text'` for Blink, `'item-text'` for WebKit and
`'item-boundary'` for Gecko or when no engine is named, which keeps main's
behavior. The line walker can stop at an end cursor as if the text were cut
there, so a carried run measures up to its first joined break. The joined
analysis never puts a break before a NEL control segment (LB6). Ten
`maintained/rich-boundaries` witnesses join the suite. The two exact-fit
witnesses are required in Chrome and Safari and observed in Firefox, where main
fails them.

The installed gate ran this change on `daf13ac` against pinned `e5e66be`, and
again from this branch against pinned `5ba3247`: Chrome 153 through the
Playwright transport, Safari 26.5.2 and Firefox 155 natively, both directions.
Both runs agree. Chrome fixes 7 LTR metrics and Safari 6, all witness rich
heights. RTL and Firefox change nothing. No leg loses a metric or has a new
required, API or rich failure, and nine numeric profiles have no new failures.

Headless replays of installed rich-inline research observations (13,038 LTR rows
per browser) gain 757 Chrome rows and 905 Safari rows. They lose 74 and 31, all
accidents. Chrome shapes a word and its comma across spans (38 rows). On
Hiragino kinsoku rows (32) and at thresholds (4), the flat prediction already
differs from native. In Safari, main's boundary break and emergency split
coincided with WebKit's on numeric signs (27) and quote splits (4). Installed
Firefox measured the joined rule at +768 and -93 rows, including 40 Myanmar
split-word rows lost to Gecko's segmentation, so Firefox keeps main's behavior.

Merging onto #239 also made this branch's end-limited walks return from an unfit
soft hyphen in Chrome, as the continuing text does. When an item boundary cuts a
line right after a chosen soft hyphen, or an overflowing partial unit follows one,
the line now ends at the earlier opportunity instead of painting an overflowing
hyphen. A fuzz over 2,574 rich-inline item splits moved 697 widths, all of them
to match flat text.

`bun test` and `bun run check` pass. After #240 landed, this branch was merged
onto it and gated again in installed browsers against #240's pin `53e16ff`.
Chrome fixes 7 LTR and 0 RTL metrics, Safari 6 and 0, and Firefox 0 and 0.
No leg loses a metric or has required failures, execution errors or new API or
rich failures. The baseline advances to `8e01c01`, and the ordinary snapshots were
regenerated against it; only provenance and environment records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 9.10 ms
(9.05 on the parent branch) and hot `layout()` at 0.0893 ms (0.0887); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 121.2 ms in
Chrome (118.3) and 346 ms in Safari (349); Chrome's total moves mostly with the
Arabic prose row (43.8 ms against 41.2), which varies between runs.

## Safari next-line and tab stops

This runtime change starts from the segment-break removal branch head `daf13ac`.
NEL (U+0085) is UAX #14 class NL: a break follows it and no ordinary break
precedes it. In the WebKit profile, analysis gives each NEL its own control
segment, the walker offers a break after it, and a NEL that overflows right after
text or glue ends the line before that content. WebKit's simple text path gives
NEL no letter spacing, so NEL takes spacing only next to complex text or before a
combining mark. Safari also moves a `pre-wrap` tab to the following stop when
less than half a space would remain before the next one. The profile fields
`breakOnlyAfterNextLine` and `skipNarrowTabStops` key on the layout engine;
Chrome and Firefox keep NEL as ordinary text and the previous tab rule.

The installed gate ran this change on `daf13ac` against pinned `e5e66be`: Chrome
153 through the Playwright transport, Safari 26.5.2 and Firefox 155 natively,
both directions. Safari fixes 627 metrics in 235 LTR rows and 442 in 170 RTL
rows, in the hidden-control spacing, NEL, discretionary and tab families. Chrome
and Firefox change nothing. Each Safari direction loses one row, 3 metrics:
`a\u05D0\u05D1aabb((\u0628\u0628\u0628\u0628\t\tword` in 16px Arial, pre-wrap,
at width 64. Safari moves the first tab to the next stop and hangs both tabs.
Pretext now reaches the same stop but hangs only the first overflowing tab, and
main matched only because its tab stayed at the nearer stop. Three rows per
direction that fail either way change widths only. No leg has required failures,
execution errors or new API or rich failures, and nine numeric profiles have no
new failures. Every leg still exits with an error, because the numeric companion
fails when an unverified profile's tab sizing changes: the iOS Chrome, Edge and
Firefox profiles and iPad desktop mode follow the same WebKit threshold, which
installed Safari verifies.

Headless replays in WebKit 26.4 with the Safari 26.5.2 user agent reproduce the
suite result. On installed research NEL observations they gain 310 LTR and 116
RTL rows and lose 8 LTR rows of `aa\u0085\u2060bb` at 1px, where Safari gives the
word joiner no letter spacing.

`bun test` and `bun run check` pass. After #239 landed, this branch was merged
onto it and gated again in installed browsers against #239's pin `81c0c6a`.
Safari fixes 627 LTR and 442 RTL metrics and loses the same trailing tab-run row per
direction, Chrome and Firefox change nothing, and no leg has required failures,
execution errors or new API or rich failures. The baseline advances to `53e16ff`,
and the ordinary snapshots were regenerated against it; only provenance and
environment records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome reads `prepare()` at 9.05 ms
(8.90 on the parent branch) and hot `layout()` at 0.0887 ms (0.0887); Safari reads
11.0 ms (11.0) and 0.105 ms (0.105). Long-form corpus totals read 118.3 ms in
Chrome (120.7) and 349 ms in Safari (348); Chrome's total moves mostly with the
Arabic prose row (41.2 ms against 43.4), which varies between runs.

## Soft-hyphen retreat in Blink

This runtime change starts from the segment-break removal branch head `daf13ac`.
When a selected discretionary hyphen does not fit, Blink retries the text item
against the available width minus the hyphen, so the line ends at the latest
earlier opportunity that leaves room for it. The engine profile's
`unfitHyphenRetreat` is `'reduced-width'` for Blink and `'none'` for WebKit,
Gecko or when no engine is named. `letterSpaceDiscretionaryHyphen` is false only
for Blink, which paints the visible hyphen without letter spacing. For Blink,
`prepare()` records per soft hyphen whether Canvas measures its neighbors
narrower joined than apart, and the walker keeps the overflowing hyphen on a line
with such a soft hyphen. The walker records the latest opportunity that leaves
room for the hyphen when that opportunity is created, and never returns past
text joined to text or a dash inside a segment.

The installed gate ran from this branch against pinned `e5e66be`: Chrome 153
through the Playwright transport, Safari 26.5.2 and Firefox 155 natively, both
directions. Chrome fixes 35 metrics per direction, in 16 rows (10 lineCount, 10
height and 15 source), and loses none: `​a­b` in pre-wrap in four
fonts, `  a­b` and `  ­a­b` in Courier New and Noto Nastaliq
Urdu, and Arabic soft-hyphen rows in Courier New. Safari and Firefox change
nothing. No leg has required failures, execution errors or new API or rich
failures, and nine numeric profiles have no new failures. Predictions also
change on 38 Chrome LTR rows and 3 RTL rows that fail either way. 36 LTR rows
and 1 RTL row move further from native, all with soft hyphens followed by marks
or word joiners: Chrome gives word joiners no letter spacing, and breaks after a
mark that follows a soft hyphen without painting a hyphen.

Headless replays in Chromium 147 and WebKit 26.4 of installed soft-hyphen
research observations gain 802 Chrome LTR rows and 136 RTL rows and lose 79 LTR
rows. 24 are true losses owned by other gaps: letter spacing on U+2060, which
Chrome does not apply (20), and Blink kerning across a space (4). 55 are
accidents, where the base matched the line count by charging a hyphen that Chrome
does not paint: a combining mark after a soft hyphen (43) and a soft hyphen
between word joiners (12). Enabled in WebKit and Gecko, the same rule lost 340
Safari and 80 Firefox research rows, so those engines keep the overflowing
hyphen.

`bun test` and `bun run check` pass. The baseline advances to runtime commit
`81c0c6a`, and the ordinary snapshots were regenerated against it with unchanged
results; only provenance and environment records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Against the segment-break removal
branch, Chrome reads `prepare()` at 8.90 ms (9.00) and hot `layout()` at
0.0887 ms (0.0877), and Safari reads 11.0 ms (11.0) and 0.105 ms (0.105). Chrome's
long-form corpus rows are unchanged beyond run spread, and its total moves only with
the Arabic prose row, which read 43.4, 36.0 and 44.7 ms across the three runs.
Safari's total is unchanged. The benchmark
corpora contain no soft hyphens, so these rows don't exercise the retreat itself.

## Newlines next to zero-width spaces

This runtime and harness change starts from the WebKit engine routing branch
head `04293b9`. In `white-space: normal`, Blink and Gecko remove a collapsible
whitespace run containing an LF when a ZWSP immediately precedes or follows the
run; WebKit turns the run into one space. The engine profile's
`segmentBreakRemovalRun` keys on the layout engine: `'blink'` for Blink,
`'gecko'` for Gecko, and `'none'` for WebKit or when no engine is named. Each
engine checks adjacency on its own run. Blink's holds SPACE, TAB, LF and CR.
Gecko's holds SPACE, TAB and LF, continues through SHY and bidi controls without
ending on one, and leaves out a last SPACE before a combining mark. FF is in
neither. `prepare()` removes such a run before the ordinary collapse, and the
rich-inline helper applies the rule within each item's own text.

The harness normalization contract changes in the same commit.
`normalizeSource()` now takes the observed browser and removes the same runs for
Chrome and Firefox, coded independently of the library, so the API
`source-normalization` contract, source placement, the line-extraction text and
normalized native paragraphs follow the observed engine. The previous documented
form turned every such newline into a space, which is WebKit's transformation.
It copied the library's old rule, so in Chrome and Firefox a wrong prediction
and a wrong oracle agreed. Either half alone loses the rows below.

The installed evidence ran this change on the CJK closing-bracket stack
`d1e12b8`, natively in Chrome 153, Safari 26.5.2 and Firefox 155, both
directions. Through its own harness, the full gate against pinned `59bd256`
fixed 20 metrics in each Chrome and Firefox direction, 12 api and 8 source, and
lost none. All of them are `hanging-ZWSP` rows of `a\u200B\nword` in 16px Arial
and 24px Amiri at widths 8, 24 and 40, now normalized as `a\u200Bword` instead
of `a\u200B word`, with unchanged line counts. Safari changed nothing, no leg had
required failures, execution errors or new API or rich failures, and nine
numeric profiles had no new failures. The same candidate judged by that stack's
own harness read 20 lost successes and 12 new `source-normalization` failures in
each Chrome and Firefox direction, and nothing in Safari. Both runs name the
identical rows and metrics. Pinned main passed them only because the old
documented form copied its newline rule, so those losses are a defect in the old
contract, not a regression. In both runs the four width-8 rows per direction
still fail source, now on line placement instead of normalization.

Headless replays in Chromium 147 and WebKit 26.4 with the recorded user agents
and locales ran every row of the WebKit engine routing gate, whose natives were
recorded against `2f15d72`: 656,407 rows over six legs, with the Firefox legs
through a Gecko user agent in Chromium. Pinned `2f15d72` and this change each
ran through this change's harness and through the previous one, and changed rows
were judged against the recorded natives. Only the same 12 `hanging-ZWSP` rows
per Chrome and Firefox direction change. Through this change's harness they fix
12 api and 8 source metrics per direction, with no lost metric or new API
failure; through the previous harness they read as 20 lost successes and 12 new
`source-normalization` failures. Safari changes no prediction, no row errors,
and in every context the two profiles differ only in `segmentBreakRemovalRun`:
`'blink'` in the Chrome legs, `'gecko'` in the Firefox legs and `'none'` in
Safari. Through the previous harness, headless `2f15d72` reproduces all 218,993
recorded Safari predictions and every changed Chrome row. Chromium does not
reproduce Firefox's widths, so the Firefox legs only show which rows change.

`bun test` and `bun run check` pass. Gecko's East Asian newline rules, the
widths of a CR or FF that survives, and context across rich-inline items are not
modeled. The installed gate ran from this branch against pinned `2f15d72`: Chrome through
the Playwright transport, Safari and Firefox natively, both directions. Through
this change's harness, Chrome and Firefox fix 20 metrics per direction (12 api and
8 source), Safari changes nothing, and no leg loses a metric or has a new
required, API or rich failure; nine numeric profiles have no new failures. The
same run from the previous harness with this change as a candidate reads the
identical 12 rows and metrics per Chrome and Firefox direction as 20 lost
successes and 12 new API failures, because that harness normalizes the removed
newline to a space. The baseline advances to runtime commit `e5e66be`, and the
ordinary snapshots were regenerated against it with unchanged results; only
provenance and environment records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Against the WebKit engine routing
branch, Chrome reads `prepare()` at 9.00 ms (8.85) and hot `layout()` at
0.0877 ms (0.0887), and Safari reads 11.0 ms (11.0) and 0.105 ms (0.100). Chrome's
long-form corpus rows are unchanged beyond run spread, and its total moves only with
the Arabic prose row, which varies between runs. Safari's total moves by -0.3%.

## WebKit engine routing

This runtime change starts from the line-edge kerning branch head `9535bc6`.
Engine profiles now follow the layout engine the user agent names instead of a
browser brand: `Firefox/` names Gecko, `AppleWebKit/537.36` names Blink only
beside `Chrome/` or `Chromium/`, and any other `AppleWebKit/` version names
WebKit. `navigator.vendor` is no longer read, since workers don't have it. Every
profile field keys on that engine, including the following-space kerning, so
Chrome, Firefox and Edge on iPhone and iPad and in-app web views take the Safari
profile, and a page and its workers take the same profile. Before, Safari's
workers and app web views took the default profile, and the three iOS brands
took it with WebKit's hyphen rule after a collapsed tab and, for Chrome, Blink's
CJK carry.

Headless replays in WebKit 26.4 and Chromium 147 with the recorded user agents
and locales compare `8b1f538` with this change on every row of the line-edge
kerning gate: 147,714 Chrome LTR, 71,008 Chrome RTL, 148,019 Safari LTR, 70,974
Safari RTL, 147,680 Firefox LTR and 71,012 Firefox RTL rows, 656,407 in all,
with the Firefox legs through a Gecko user agent in Chromium. No prediction
changes and no row errors, both sources give the same in-page profile in every
context, and in the Safari legs headless `8db5483` reproduces all 218,993
recorded installed predictions. The same replay over the CJK closing-bracket
stack, before the kerning change, changed no prediction either.

In headless WebKit 26.4 over the CJK closing-bracket stack, user agents for
Chrome, Firefox and Edge on iPhone, Chrome on iPad in desktop mode, and app web
views on iPhone and Mac give the desktop Safari profile on every field; on this
branch, iOS Safari and Chrome and Firefox on iPhone equal desktop Safari on all
12 fields. Over that stack and judged against the Safari 26.5.2 natives, an
iPhone Chrome user agent changed 28,564 of the 218,993 Safari rows: 8,055 rows
gain a check and 1,427 lose one. An iPhone Firefox user agent changed 28,783,
with 8,114 gains and the same 1,427 losses. Every candidate prediction under
both user agents equals the desktop Safari user agent's, so each loss is a row
the Safari profile already fails in Safari. The crios, crios-desktop, fxios and
edgios numeric profiles now equal safari's, and `tabSizing` is unchanged in all
nine.

A probe outside the suite ran each user agent in a window and in classic blob,
classic URL and module dedicated workers: 51 user agents over the CJK
closing-bracket stack, and on this branch desktop Safari, iOS Safari, Chrome and
Firefox on iPhone, desktop Chrome and the Firefox user agent. In every row the
workers give the window's engine, profile and lines, and no worker exposes
`navigator.vendor`. With `8b1f538`, Safari's and iOS Safari's workers differed
from their windows on 6 fields, and `A\u2060 B` in 18px Times New Roman at width
12 took three lines in a Safari worker and two on the page.

Desktop Safari's natives stand in for iOS, and nothing ran on a device, so iOS
fonts, older iOS ICU and iOS WebKit builds are unverified. Blink emulating an
iOS user agent, as in developer tools, now takes WebKit's profile on the page
and in its workers while Chromium lays out the text. Samsung's Tizen 3.0 TV web
view runs Chromium 47 but sends `AppleWebKit/538.1`, so it takes WebKit's
profile; it predates `Intl.Segmenter`. Shared and service workers were not
probed.

`bun test` and `bun run check` pass. The installed gate ran from this branch against pinned `8b1f538`: Chrome through
the Playwright transport, Safari and Firefox natively, both directions. Every leg
has zero fixed or lost metrics, required failures, execution errors or new
API/rich failures, and nine numeric profiles have no new failures. The baseline
advances to runtime commit `2f15d72`, and the ordinary snapshots were
regenerated against it with unchanged results; only provenance and environment
records change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Against the following-space kerning
branch nothing moves beyond run spread: Chrome reads `prepare()` at 8.85 ms (8.85)
and hot `layout()` at 0.0887 ms (0.0885), and Safari reads 11.0 ms and 0.100 ms.
The long-form corpus totals move by -1.2% in Chrome and +2.0% in Safari.

## Kerning measured with the following space

This runtime change starts from the line-edge kerning head `9535bc6`, where
each distinct word before a space was measured again together with that space.
The Safari profile now measures such a word together with the space in place of
the word alone, and takes the word's width as that measurement minus a space
alone; the breakable fit advances use it as the last prefix. A word is still
measured alone where Safari's prefix fit widths need it inside a longer word,
where it also occurs before other text, in numeric runs and runs above 96
graphemes, whose fit advances come from pairs, or with a zero-width break before
the space. The widths are unchanged, and the Chrome and Firefox profiles are
untouched. None of the checks below ran in installed browsers, and the baseline
pin and snapshots were not rerun for this change.

In headless WebKit 26.4 with a Safari user agent, one cold `prepare()` makes
1,347 more Canvas calls than `bf93e2e` on `ar-risalat-al-ghufran-part-1`, where
`9535bc6` makes 8,825 more, 2,669 on `en-gatsby-opening` (8,439), 278 on
`hi-eidgah` (1,593), 207 on `ur-chughd` (1,008), 251 on
`he-masaot-binyamin-metudela` (1,694) and 209 on `ko-unsu-joh-eun-nal` (342).
That removes 84.7% of `9535bc6`'s extra calls on the Arabic corpus, 68.4% on
`en-gatsby-opening` and 82.5% on `hi-eidgah`. The numeric API checks make 858
Safari-profile Canvas calls instead of 861 at `9535bc6` and 850 at `8db5483`,
with no failures; the Chrome profile makes 777 in all three.

Segment widths and breakable fit advances equal `9535bc6`'s exactly on 2,646,919
segments of 89 corpus and font rows in headless WebKit, including fonts that
kern with a space. In 17 further font strings, with bold, italic, other weights
and odd sizes, in normal and pre-wrap text, the widths, line-end advances and
fit advances of 6,175,437 segments are bit-identical, 78,476 of them kerned, and
a Bun fuzz with a context-dependent fake canvas finds no difference in 3,000
random texts. A headless replay against the installed natives of the #236
gate, through that gate's harness, with the Safari legs in WebKit 26.4 and the
Chrome and Firefox legs in Chromium 147 with their user agents, predicts exactly
as `9535bc6` on every row of all six legs: 148,019 and 70,974 Safari rows,
147,714 and 71,008 Chrome rows, and 147,680 and 71,012 Firefox rows. Against
`8db5483` the change fixes the same 433 LTR and 402 RTL Safari rows as the
installed gate and loses none.

Native line counts in headless WebKit with a Safari user agent, on LTR and RTL
pages at every width step, cover the corpus rows in their fonts, the benchmark
font, 14 rows in fonts that kern with a space, the Arabic corpus in Waseem, the
Urdu corpus in Noto Nastaliq Urdu and short kerned texts: 62,298 points. The
change gives the same line count as `9535bc6` at every point. Against `bf93e2e`
both match native at 4,816 more points and 35 fewer: the Arabic corpus in 20px
system-ui matches at 601 of 601 widths instead of 507, `hi-eidgah` at 601
instead of 526, and `en-gatsby-opening` in 16px PT Sans at 580 instead of none.
The 35 are short texts in 16px Fira Code and a few widths in Arial, Times New
Roman, Avenir Next, PT Sans and system-ui. Sweeps from 300 to 900px in steps of
3, in fonts outside those rows, again match `9535bc6` at every point and show
the same kind of loss: `en-gatsby-opening` in italic 18px Times New Roman matches
native at 195 of 201 widths instead of 166 but loses 369 and 474px, in 17px
Hoefler Text at 192 instead of 177 but loses 300 and 318px, and `mixed-app-text`
in italic 16px Gill Sans at 200 instead of 188 but loses 462px. At 0.25px steps,
`A B` loses 3 widths and `L B` 2 in both Fira Code and Monaspace Neon.

Timings in headless WebKit with a Safari user agent run `bf93e2e`, `9535bc6`
and this change in five rounds, each in a fresh context with the order rotated,
at load averages 4.5 to 7.6. The first cold `prepare()` of the benchmark's
Arabic corpus takes 158ms, where `bf93e2e` takes 138ms and `9535bc6` 196ms;
`en-gatsby-opening` takes 96ms (95 and 98), `hi-eidgah` 29ms (26 and 38) and
`he-masaot-binyamin-metudela` 17ms (17 and 20). Preparing every paragraph of a
corpus once in a fresh page, as virtualization does, takes 163ms for the Arabic
corpus (148 and 207), 88ms for `en-gatsby-opening` (86 and 99) and 29ms for
`hi-eidgah` (26 and 37): 15, 2 and 3ms more than `bf93e2e`, where `9535bc6` adds
59, 13 and 11ms. Repeated `clearCache()` and `prepare()` of the same text in one
page take more prepares to become cheap, but it is not a lasting cost. At load
averages 1.1 to 3.1, `hi-eidgah` takes 23ms at prepares 16 to 20 and 7ms at 36
to 40, where `bf93e2e` takes about 6ms, and `he-masaot-binyamin-metudela` takes
14ms, then 6ms. WebKit's per-font width cache samples its input after a run of
misses, so it admits this change's strings later. After five prepares,
measuring each distinct string 25 times on preparation's own context, with no
Pretext JavaScript running, brings the next prepares to 6 to 7ms and 5 to 6ms,
and in converged prepares the time inside `measureText` is 0 to 3ms for
`bf93e2e`, `9535bc6` and this change alike. Headless Chromium 147 does not
change.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Chrome is unchanged against the CJK
closing-bracket branch: `prepare()` reads 8.85 ms (8.90), hot `layout()` 0.0885
ms, and the corpus totals move by -0.2%. Safari's hot `layout()` stays at 0.100
ms and `prepare()` reads 11.0 ms (10.0). Its long-form corpus measurement grows by
11.4% and its prepare totals by 8.2% (316 to 342 ms), from the remaining
word-plus-space measurements: Arabic prose 120 to 133 ms, Hindi 21 to 25 ms, Urdu
30 to 34 ms and Thai 21 to 23 ms.

## Kerning with a following space

This runtime change starts from the CJK closing-bracket branch head `bf93e2e`.
WebKit measures a text item together with a directly following U+0020 and
subtracts one unshaped space, so the item keeps its kerning with that space
whether the space continues the line or hangs. The Safari profile now measures
each word before a space the same way at letter spacing 0 and caches the
kerning with the word's metrics; zero-width breaks before the space belong to
the word. Format characters between the word and the space resolve with the
space, so the kerning crosses them only when the text has no explicit bidi
controls and the neutral characters after the space lead to a character of the
word's direction, with no paired bracket among them. The generated bidi data
now lists the paired brackets from `BidiBrackets-17.0.0.txt`. A soft hyphen
before the space takes no kerning. The Chrome and Firefox profiles are
unchanged.

The full native comparison ran this change with the #234 harness in installed
Chrome 153.0.8010.36, Safari 26.5.2 and Firefox 155.0.1, both directions, at
DPR 2: 656,407 browser/input observations, with pinned `8db5483` as the
reference. Every leg has zero lost successes, failed required checks, execution
errors and new API/rich failures, and 45 numeric source/profile runs have no
new failures. The Safari numeric profile makes 861 Canvas calls instead of 850;
the other profiles are unchanged. The change fixes 493 Safari LTR metrics on
433 inputs and 454 RTL metrics on 402 inputs, and none in Chrome or Firefox:
line count, height and source on 28 LTR and 24 RTL inputs, and widths on 409
and 382. LTR gains 336 metrics in `following-space-scope`, 71 in
`following-space-context`, 41 in `space-context`, 27 widths in `spacing-tail`
and 18 in `negative-space`; RTL gains 336, 71 and 47 in the first three. Every
gain is in 16px Arial or 16px or 18px Times New Roman at letter spacing 0. For
example, `A\u2060 B` in 18px Times New Roman at width 12 now takes Safari's
two lines instead of three, `\u05D0\u05D1 A \u0628` in 16px Arial at width 48
one line instead of two, and pre-wrap ` A B` in 16px Arial at width 10 three
lines instead of four. Twelve LTR and 13 RTL width failures change only in
detail: two keep-all `A \u4E2D\u6587\u6D4B\u8BD5` inputs in 18px serif go from
0.777px wider than native to 0.207px narrower, and the rest move by less than
0.00001px.

Reported line widths are clamped at 0, while line breaking keeps the signed
advance. For example, `A\u2060 B` in 18px Times New Roman at width 11.5 puts `A`
alone on the first line, and the second line, the word joiner and the space,
has an advance of -0.993: the kerned word minus the isolated `A`. WebKit leaves
that remainder unclamped; in the suite's Safari rows at widths 1 and 8 the
prediction has the same line, and native Safari draws it 0.993px outside the
line's start edge. Strongly negative letter spacing clamps the same way.

The `rich-boundary-space` contract compared a collapsed gap with the width of a
line holding one space; it now compares both clamped at 0, and a unit test
checks the signed gap against the measured space. A headless replay in WebKit
26.4 and Chromium 147 against the gate's natives, with the unclamped change as
the base, covers every row whose text has a word followed by a space and every
row with a negative predicted width: 37,801 Safari LTR, 21,232 Safari RTL,
37,899 Chrome LTR and 21,210 Chrome RTL rows. Only the negative widths change,
on 2,983, 373, 3,008 and 285 rows; no line count, height, widths or other
metric changes. Under the gate's harness the only rich contract that changes is
`rich-boundary-space` at letter spacing -6 and -10, which the updated contract
accepts, and the nine numeric profiles give identical results.

Headless Chromium 147 and WebKit 26.4 probes outside the suite show what
remains. Without the paragraph direction, the Safari profile drops the kerning
across a soft hyphen, and across format characters before right-to-left text or
a bracket pair, where Safari on an LTR page keeps it. With letter spacing,
WebKit's measurement also moves the space's gap onto the word and clamps the
word at zero, which the per-grapheme gap model does not represent, so
letter-spaced text keeps the unkerned widths. A trailing collapsible space, a
rich-inline item that ends in a space, and CR or CRLF after a word miss the
kerning. Chromium kerns across spaces, ZWSP, SHY and same-font spans, which its
default Canvas does not report, and after an emergency break Gecko keeps a share
of a pair adjustment that Canvas sums cannot attribute.

The baseline advances to runtime commit `8b1f538`, and the ordinary snapshots
were regenerated against it: all six legs pass with zero new regressions,
required failures or execution errors, and nine numeric profiles have no new
failures. Snapshot results are unchanged; only provenance and environment
records change. Suite hash
`7681f371b59384fb346e2b15c5d469da2a30ce9673f5c05ef2cf9a64a3894d3d`; rows are in
`/private/tmp/pretext-eng-20260912/gate-g1b`.

## CJK closing brackets and nonstarters

This runtime change starts from the pair-table branch head `f030304`. Fullwidth
closing brackets such as U+300D and U+FF09 are UAX #14 CL, and Chrome breaks
between them and a following ideograph, kana or Hangul syllable. The Chromium
profile carried CJK text after those brackets as it does after closing quotes; it
now carries only after quotes (QU). That carry had also hidden CJK line-start
prohibitions missing from `kinsokuStart`. The set now holds every code point in
Pretext's CJK ranges whose class forbids a break before it (CL, EX, NS and the
non-extending CM U+3035), 17 more than before, and a piece whose first code point
is in the set attaches to the preceding CJK text even when `Intl.Segmenter` joins
it with the kana after it. Under `keep-all`, a listed letter such as U+3005 or
U+30FC no longer ends a run in the Chromium profile, as in Blink, while the
Firefox profile still breaks after NS letters, as ICU4X does.

The same full native comparison ran this change alone and stacked on the two
previous changes, in installed Chrome 153.0.8010.36, Safari 26.5.2 and Firefox
155.0.1, both directions, at DPR 2: 656,407 browser/input observations, with
pinned `14d92ca` as the reference. There are zero lost metrics, failed required
checks, execution errors and new API/rich failures, and nine numeric profiles
have no new failures. Over the pair-table stack it gains 56 Chrome LTR metrics:
line count and height of 28 `maintained/corpus` cases, whose line counts now
match Chrome's. They are `zh-zhufu` at widths 220, 230, 240, 250, 260, 270, 280,
340, 370, 380, 390, 430, 470, 580, 680, 690, 770 and 790, `zh-guxiang` at 220,
250, 280, 370, 430, 590 and 620, `ja-rashomon` at 240 and 290, and
`ja-kumo-no-ito` at 230. No other leg changes, and the three-change stack's fixed
metrics are exactly the union of each change's own.

Headless Chromium 147 and WebKit 26.4 sweeps outside the suite show what remains.
Chromium hangs U+3000 at a line end; the old carry matched that after a bracket
only by measuring `\u300D\u3000` as one unit, so those widths need a hanging model
for U+3000. Below a kinsoku cluster's width, browsers break inside the cluster,
while Pretext keeps it whole, as main already does for `\u6F22\u3002\u5B57`.
Chromium's rules for Chinese pages allow a break before U+301C and U+30A0, and
Pretext does not read the page language for line breaking. Under `keep-all`, Blink
breaks between a listed letter and a following opening bracket
(`\u4E2D\u6587|\u3005|\u300C\u4E2D|\u6587`), while Pretext decides a keep-all boundary
only from the text before it and keeps them together. U+30FC keeps the
whole-piece rule, because Chromium breaks before it and WebKit does not.

The baseline advances to runtime commit `8db5483`, and the ordinary snapshots
were regenerated against it: all six legs pass with zero new regressions,
required failures or execution errors, and nine numeric profiles have no new
failures. Accuracy results are unchanged. Chrome's step-10 corpus sweep now
matches 28 more widths: `zh-zhufu` 43 to 61, `zh-guxiang` 54 to 61,
`ja-rashomon` 55 to 57 and `ja-kumo-no-ito` 56 to 57. Suite hash
`48fb18fba603a2ae669a5a18af334503009a3c0555c4a07201f05ee84cfae9d1`; rows are in
`/private/tmp/pretext-eng-20260912/stage1b-full`.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Against the pair-table branch, Chrome
reads `prepare()` at 8.90 ms (8.70) and hot `layout()` at 0.0885 ms (0.0893), and
Safari reads 10.0 ms (11.0) and 0.100 ms. The long-form corpus totals move by
-1.2% in Chrome and +0.3% in Safari. The Japanese and Chinese corpora gain
segments from the new CJK units, such as zh-zhufu from 7,944 to 7,992, with
unchanged line counts.

## Exclamation followers, joiners and word-initial hyphens

This runtime change starts from the figure-space branch head `b55311e`. Chrome
and Safari look up characters up to U+00FF in a pair table that follows ICU except
for printable ASCII, where `?` breaks before everything except
`! " ' ) , . / : ; ? ] }`, and `!` breaks only before `(`, `<`, `[` and `{`. Every
merge that could join across that boundary now asks the same rule, so `x?|$b`,
`x?|-|b` and `x!|\u00A9b` break as in Chrome and Safari, while Firefox keeps
`x?-|b`. Above U+00FF the follower's line-break class decides, CJ such as U+30FC
breaks after EX only in Chrome, and U+061B ARABIC SEMICOLON now breaks before a
word as EX. No break follows a ZWJ at the text start or after a ZWSP, TAB or hard
break (LB8a). In Chrome and Safari, a hyphen after a space, ZWSP, hard break or
the text start keeps a following alphabetic or Hebrew letter (LB20a), and the
other Unicode 17 HH dashes such as U+2012 and U+2013 do the same as U+2010.
Without a navigator, the default profile keeps the same letters. Analysis no
longer calls `Intl.Segmenter` `containing()`, which JavaScriptCore gets wrong at
an index just before a surrogate pair.

The same full native comparison ran this change alone and stacked on figure space
glue, in installed Chrome 153.0.8010.36, Safari 26.5.2 and Firefox 155.0.1, both
directions, at DPR 2: 656,407 browser/input observations, with pinned `14d92ca` as
the reference. There are zero lost metrics, failed required checks, execution
errors and new API/rich failures, and nine numeric profiles have no new failures.
Over figure space glue, the stack gains 21 metrics in Chrome LTR and 9 in RTL, 24
and 12 in Safari, and none in Firefox. Its fixed metrics are exactly the union of
each change's own, so the two do not interact. The gains are `!!!!<<aabb`, where
`!` now breaks before `<`, in four LTR `ascii-matrix` cases and three
`signed-spacing/ascii-matrix` cases per direction, and pre-wrap
`\u200D\u0628\u00AD\u0628` in `U+200D/start`: 16px Amiri at width 14.75 in both
directions, plus 16px Noto Naskh Arabic at width 12.42 in Safari. The installed
full gate was rerun on the revision that keeps Hebrew letters in Chrome and the
other HH dashes in both engines, against pinned `fd54445`: the same 21/9, 24/12
and 0 metrics are fixed, with zero lost metrics and no numeric failures. On the
installed research rows for these shapes, the revision fixes 964 LTR and 430 RTL
rows in Chrome and 432 and 160 in Safari over the previous revision, and loses
only the two Chrome pre-wrap rows described below, which the previous revision
matched by breaking in the wrong place.

Headless Chromium 147 and WebKit 26.4 sweeps outside the suite lose shapes that
main matched only through a second error. In `https://x.com/p?-a`, browsers break
after both `?` and `-`; the new break after `?` starts the URL query unit there,
and the unit keeps `-a` (45 of 159 widths per mode). In pre-wrap `a\t -\u0430b` at
widths 10 to 14, browsers hang the preserved space after the TAB, while Pretext
now gives it its own line. Chromium also breaks after the hyphen of a rich item
`\u2010bar baz` after `foo`, because its ICU context crosses items. Headless
Chromium 147 runs ICU 77 and breaks after a word-initial hyphen before a Hebrew
letter, but installed Chrome 153 keeps Hebrew letters and each HH dash observed,
as Safari 26.5.2 does: U+2010, U+2012, U+2013, U+058A, U+05BE, U+1400 and
U+2E17. No installed browser was observed on U+2E40, U+2E5D, U+10D6E or
U+10EAD; for those Pretext rests on ICU 78 data and headless WebKit. In the
installed research rows of `a \u2012b`, `a \u2013b`,
`a \u058A\u0561b`, `a -\u05D1b`, `a \u2010\u05D1b` and `a \u2013\u05D1b`, both
browsers keep the dash with the letter wherever the two fit, while the previous
revision broke after it in 1,165 Chrome rows and 538 Safari rows. Firefox breaks
after each of those dashes.

A headless replay of this revision against the recorded installed natives, with
the previous revision as the base, covers every suite row with U+002D or an HH
dash: 1,034 Chrome, 1,034 Safari and 1,028 Firefox rows, in Chromium 147, WebKit
26.4 and Chromium with a Firefox user agent. No prediction changes there. On the
research rows it fixes all 1,165 Chrome and 538 Safari band rows and changes
nothing on U+2E17, U+1400 or U+05BE. It loses two Chrome rows, pre-wrap
`a \u2010\u05D1b` at letter spacing -1 and widths 8 and 8.5: browsers hang the
preserved space after `a`, and Pretext now gives it its own line, as it already
does in Safari.

The baseline advances to runtime commit `09c7f20`, and the ordinary snapshots
were regenerated against it: all six legs pass with zero new regressions,
required failures or execution errors, and nine numeric profiles have no new
failures. Snapshot results are unchanged; only provenance and environment records
change. The stacked gate's suite hash is
`48fb18fba603a2ae669a5a18af334503009a3c0555c4a07201f05ee84cfae9d1`, with rows in
`/private/tmp/pretext-eng-20260912/stage1b-full`; the revision gate's is
`31db9695b8a03843670809f12a13c9af6cb5b632147f05191e3441dacaece5a3`, with rows in
`/private/tmp/pretext-eng-20260912/gate-233rev`.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Against the figure-space glue branch,
Chrome reads `prepare()` at 8.70 ms (8.80) and hot `layout()` at 0.0893 ms
(0.0878), inside its run spread, and Safari reads 11.0 ms and 0.100 ms, unchanged.
The long-form corpus totals move by +1.3% in Chrome and +1.0% in Safari. The
Arabic prose row reads 120 ms in installed Safari (118 before), so the warm split
seen in Playwright's WebKit build doesn't appear there.

## Figure space glue

This runtime change starts from the attached-generator-canvas branch head
`6b8929d`. U+2007 FIGURE SPACE is UAX #14 class GL, like NBSP and NNBSP, and
every engine keeps the text on both sides of it together. Pretext classified it
as plain text, so `Intl.Segmenter`'s word boundaries around it became break
opportunities. It now joins adjacent text as glue.

The full shared inventory ran with that harness in installed Chrome
153.0.8010.36, Safari 26.5.2 and Firefox 155.0.1, both directions, at DPR 2:
656,407 browser/input observations, with pinned `14d92ca` as the reference.
There are zero lost metrics, failed required checks, execution errors and new
API/rich failures, and nine numeric profiles have no new failures. The candidate
gains 190 metrics in Chrome LTR and 150 in RTL, 210 and 170 in Safari, and 210
and 164 in Firefox. Every gain is a `hanging-FIGURE` case (40 per direction in
Chrome, 44 in Safari and Firefox) or one of 12 LTR `unicode-space` cases, on
`a\u2007\u2007b`, `a\u2007?b`, `foo\u2007bar`, `a\u2007\u2018b` and
`\u05D0\u05D1((tail\u2007word`. For that last text at 24px Amiri and width 40,
Chrome in both directions and Firefox RTL gain line count and height in four
modes while the line text still differs. The bidi-opener carry owns that
difference, so a later fix there could read as a loss against a pin that
includes this change.

Out of suite, headless Chromium 147 and WebKit 26.4 probes show the NBSP glue
model's existing gaps next to U+2007: a dash or soft hyphen before glue, CJK
beside glue, and glued emoji, symbol or non-word digit runs that get no emergency
breaks. RESEARCH.md records them.

The baseline advances to runtime commit `fd54445`, and the ordinary snapshots
were regenerated against it: all six legs pass with zero new regressions,
required failures or execution errors, and nine numeric profiles have no new
failures. Snapshot results are unchanged; only provenance and environment
records change. Suite hash
`48fb18fba603a2ae669a5a18af334503009a3c0555c4a07201f05ee84cfae9d1`; rows are in
`/private/tmp/pretext-eng-20260912/stage1b-full`.

Chrome and Safari benchmark snapshots were refreshed from this branch: three
foreground runs each at DPR 2, visible and focused, with Chrome on the 2560x1440
screen and Safari on the 1440x2560 screen. Hot `layout()` reads 0.0878 ms in
Chrome and 0.100 ms in Safari, as on main. `prepare()` reads 8.80 ms in Chrome
(8.55 on main) and 11.0 ms in Safari (10.0), inside Chrome's run spread and
Safari's 0.5 ms timer steps, and the long-form corpus totals move by +4.1% in
Chrome and +0.3% in Safari.

## Attached generator canvas

This test-only change starts from published main `20ad703`. The case generator
measured width recipes with a detached canvas, which ignores `<html lang>` in all
three browsers: Chrome and Firefox measure in the machine language, and Safari
passes no language, so its fallback follows the machine's preferred languages. It
now measures with a hidden canvas attached to the fixture page, so recipe
thresholds use the page language that paragraphs without their own `lang`
inherit. Explicit-language recipes still reuse those widths. Runtime sources and
the baseline pin are unchanged.

The recorded no-language, `en`, `ja`, `zh-Hans` and `ko` fixture runs generated
identical IDs. Selected by origin, each browser has 3,635 LTR recipe rows, 3,322
of them with measured widths, and 144 RTL recipe rows, all measured. Comparing
their natives on pages without a language and under `en` shows which thresholds
the old canvas missed:

- Firefox paints `Ⅷ` at 27.53px under `en`, but at 16px without a language and
  under `ja` or `zh-Hans`, and the detached canvas measured 16px. The 55%, 80%
  and natural-width-plus-one `Ⅷ%` thresholds (16.63, 24.19 and 31.23px) therefore
  described a `zh-Hans` paragraph; under `en` even the natural-width-plus-one
  paragraph wraps to two lines. As a methodology correction, the change replaced
  six LTR observations that main passed, each with two native lines:
  `wrap-eadf3c82cdbb9ece`, `wrap-74fcdac0799992cc` and `wrap-9181306059a20016` in
  normal whitespace, and `wrap-6639f89b6eb01e63`, `wrap-179b7d018231d861` and
  `wrap-176497a1d936cb3b` in `pre-wrap`. Main and candidates share the generated
  inventory, so the comparison cannot report them as lost. Installed Firefox 155's
  attached canvas returns about 41.77px for `Ⅷ%` under `en`, so the replacements
  use about 22.97, 33.41 and 42.77px: `wrap-b7ffe298cc61c6f0`,
  `wrap-5a0227e23cc7c1b2` and `wrap-5a08270ecc4ea094` in normal whitespace, and
  `wrap-70e339a94111979d`, `wrap-36cf587b7f499adf` and `wrap-8691b11fca22d5b9` in
  `pre-wrap`. Their native paragraphs have two, two and one lines, as the
  recorded `en` painted widths predicted, and main passes every observed metric
  on all six.
- In Chrome, 205 measured LTR rows and 17 measured RTL rows paint differently
  under `en` than under the Chinese app language, and 64 and 9 of them change
  line count. All of them contain curly quotes, and no painted glyph width
  changes, so their thresholds and IDs did not move. Safari paints every recipe
  row the same under both. Headless Chromium 147 resolves `Ⅷ` under `en` to a
  wider fallback and moves the corresponding six `Ⅷ%` rows, but installed Chrome
  paints no such difference.

Empty element language remains a reset input. In the recorded runs, Chrome
resolves `lang=""` to its Chinese app language: in the 15 groups where `en` and
`zh` differ, it matches `zh`, and four of those differ in line count.

The full shared inventory ran with this harness in installed Chrome
153.0.8010.36, Safari 26.5.2 and Firefox 155.0.1, both directions, at DPR 2:
656,407 browser/input observations, with pinned `14d92ca` as the reference.
Relative to the previous full comparison, case IDs are identical in Chrome,
Safari and both RTL legs, and Firefox LTR replaces exactly the six observations
above. The runtime at `20ad703` fixes and loses no metric. There are zero failed
required checks, execution errors and new API/rich failures, and nine numeric
profiles have no new failures. Suite hash
`48fb18fba603a2ae669a5a18af334503009a3c0555c4a07201f05ee84cfae9d1`; rows are in
`/private/tmp/pretext-eng-20260912/stage1b-full`.

The ordinary snapshots were regenerated from this commit: all six legs pass with
zero new regressions, required failures or execution errors, and nine numeric
profiles have no new failures. Snapshot results are unchanged; only provenance
and environment records change.

## Page-language measurement context

This runtime change starts from published main `efa958a`. Chrome's OffscreenCanvas
re-resolves a font under the page language only when the font string changes, so
after `<html lang>` changed, a reused measurement context and its cached widths
kept the previous language even after `clearCache()`. Preparation now replaces the
context and clears width caches when the document language differs from the one
the context was created under.

Suite pages never change language, so the full native comparison against pinned
`14d92ca` changes nothing: installed Chrome, Safari and Firefox, both directions,
DPR 2, 656,407 observations, zero fixed or lost metrics, required failures,
execution errors and new API/rich failures, and nine numeric profiles have no new
failures. That run used the candidate before a null guard for documents without a
root element was added; suite pages never reach that guard. Headless Chromium 147
reproduces the fix on a language switch (`<html lang>` en → ko with an unchanged
font string: 3 → 2 lines, matching the DOM), and headless WebKit is unchanged. The
pin stays at `14d92ca` because no suite result changes. Suite hash
`edf54ed053d7e1c0ef387ffcade551a22dfb6508440215746abb388d29245c30`; rows are in
`/private/tmp/pretext-gallery-fixes-20260911/staleness-full`.

The ordinary snapshots were regenerated from this commit: all six legs pass with
zero new regressions, required failures or execution errors, and nine numeric
profiles have no new failures. Snapshot results are unchanged; only provenance
and environment records change.

Chrome and Safari benchmark snapshots were refreshed from this checkout: three
foreground runs each, with matching environments at DPR 2 on the 2560×1440 screen,
visible and focused. Hot `layout()` reads 0.0875 ms in Chrome (0.0878 before) and
0.105 ms in Safari (0.1025); preparation and rich rows stay within noise.

## English fixture pages

This test-only change starts from published main `a4f17ed`. Fixture pages had no
document language, so Chrome and Firefox followed the macOS preferred language
while Safari used root rules. They now use `en`. Runtime sources and the baseline
pin are unchanged, so no runtime benchmark was needed.

Full native comparisons ran with fixture pages in no language, `en`, `ja`,
`zh-Hans` and `ko`, on a Mac whose preferred languages are Chinese then English:
installed Chrome, Safari and Firefox, both directions, DPR 2. Case IDs were
identical in every run, and installed-context pages did not change. Relative to
no language:

- Chrome equals `zh-Hans` exactly. `en` changes 428 results, all curly-quote
  breaks. Pretext's Canvas widths do not change; it now matches 319 of those
  results and misses 109 it previously matched.
- Safari equals `en` exactly.
- Firefox is close to `zh-Hans`. `en` changes 779 results through
  missing-glyph fallback widths.

`ja`, `zh-Hans` and `ko` also change fallback widths, and Safari breaks around
curly quotes differently under `ja`. Safari's OffscreenCanvas never follows the
page language. Two paths still follow the machine language: Chrome treats an
element's `lang=""` like no language, and the case generator's detached canvas
ignores `<html lang>` in Chrome and Firefox.

The final harness passes all six legs with zero regressions, required failures or
execution errors, and nine numeric profiles have no new failures. Its 656,407 rows
are identical to the `en` comparison run. Regenerated snapshots change only
provenance and environment records. Suite hash
`edf54ed053d7e1c0ef387ffcade551a22dfb6508440215746abb388d29245c30`; rows are in
`/private/tmp/pretext-locale-20260911`.

## Exclamation breaks and leading ZWSP marks

Runtime commit `14d92ca` starts from the leading-ZWSP branch head `fdb7f01`.
UAX #14 breaks after EX punctuation such as `?`, `!`, U+061F and U+06D4 before a
following letter or number. Every engine keeps that break, except where the
Chromium and WebKit Latin-1 pair tables keep `!` with a following printable ASCII
character. The forward carry and the no-space join now keep it for punctuation
with no text before it. Safari also keeps a basic combining mark with a ZWSP that
starts its text node or follows a mandatory break. Rich-inline items prepare their
own text, so a collapsed leading SPACE remains break context.

The full shared inventory ran in installed Chrome, Safari and Firefox, both
directions, at DPR 2: 656,407 browser/input observations, with pinned `6ad8409`
as the reference. There are zero lost metrics, failed required checks, execution
errors and new API/rich failures, and nine numeric profiles have no new failures.
The candidate gains 78 metrics in Chrome, 60 in Safari and 100 in Firefox. The
suite hash is `5bb6eadf9109541475c5d6fb8004a7595756e21ddb070226215ec23e267fef07`;
rows are in `/private/tmp/pretext-210-followers-20260911/full-v4-vs-step1`.

A separate research family of 4,923 inputs per browser checked the engine rules
directly (`probe-followers4` in the same directory): non-ASCII followers after `!`,
ASCII symbols after `?`, Arabic question marks and full stops, Firefox mid-word
`!`, Safari marks after a leading SPACE, TAB, LF or CR, rich items, U+201D under
zh-Hans, ja and en, and letter spacing. Relative to `6ad8409` it fixes 356 Chrome,
462 Firefox and 566 Safari line counts, with no new API failures. It loses 20
research rows:

- Safari `\u200B\u0301ab` at letter spacing 2, widths 27–28.5: the glued ZWSP owns a
  spacing gap the browser does not add.
- Safari pre-wrap `x\u000D\u200B\u0301ab` at widths 3–7.5: the mark stays with the
  ZWSP natively, but the raw CR's separate native line is the existing raw-CR
  limitation.
- One RTL width each of `\u0623\u0645\u0648\u0646!!\u0648\u0644\u0642\u062F` in Chrome and Safari: the new break is native,
  but isolated emergency widths of joined Arabic letters exceed the box.

Excluding default-ignorable characters from letter spacing matched native gap
counts more often, but it lost 73 supported cases in the full comparison,
including a required Firefox control case, so it is not part of this change.
Firefox's ZWSP-plus-cluster-extender grouping and U+201D locale tailoring remain
unmodeled.

After reviewing these per-case changes, the baseline advances to `14d92ca`.

The ordinary snapshots were regenerated against that pin. All six legs pass with
zero new regressions, required failures or execution errors, and nine numeric
profiles have no new failures. Accuracy and letter-spacing results are unchanged.
In the step-10 corpus sweep, the Urdu `ur-chughd` text now matches at all 61 widths
in every browser (57 before), and the Arabic `ar-risalat-al-ghufran-part-1` text at
all 61 widths in Chrome and Safari (60 before): `!` now breaks before the following
word. Refreshed files otherwise change only provenance and environment records.
The ordinary suite hash is
`f50daaa280c974e44db39a778092d8185fd1e7b1af4d29216edeb056924e3307`.

Chrome and Safari benchmark snapshots were refreshed from this checkout: three
foreground runs each, with matching environments at DPR 2 on the 2560×1440 screen,
visible and focused. Hot `layout()` reads 0.088 ms in Chrome (0.086 before) and
0.103 ms in Safari (unchanged); rich statistics, range and streaming rows stay
within timer granularity. Chrome preparation rows read 2–5% higher, for example
Arabic prose 35.5 → 37.1 ms, from the added boundary checks during analysis. Safari
reports whole milliseconds and shows no clear change.

## Leading zero-width spaces

Runtime commit `6ad8409` starts from published main `5443392`. A ZWSP that starts
a paragraph or follows a hard break now establishes its line without owning a
letter-spacing gap; later line starts keep the existing behavior. The flat
#210/#211 reproduction and its ZWSP-only companion now require native height,
line count and API agreement, and the visible text also requires source placement.

The full shared inventory ran in installed Chrome, Safari and Firefox, both
directions, at DPR 2: 656,407 browser/input observations. The candidate was
compared with pinned main `2b73992` and published main `5443392`:

| Browser | Full LTR / RTL | Gained metrics vs pin / published main | Lost metrics per reference |
| --- | ---: | ---: | ---: |
| Chrome | 147,714 / 71,008 | 1,687 / 1,224 | 90 |
| Safari | 148,019 / 70,974 | 1,210 / 1,202 | 60 |
| Firefox | 147,680 / 71,012 | 2,437 / 2,045 | 80 |

Gains and losses count separate metric events, not fully correct cases. Both
references lose the same 40 case IDs, 106 browser/direction observations. There
are zero failed required checks, execution errors and new API/rich failures;
nine numeric environment profiles have no new failures or changed TAB behavior.
The comparison exits 1 only because of the losses below. Each was a success that
dropping the leading ZWSP line had produced by cancelling another error:

- Raw CR before ZWSP in pre-wrap (`\u000D\u200B`, 16px Arial, widths 0, 8, 20,
  30 and 48, letter spacing −1, 0 and 1; Chrome and Safari in every row, Firefox
  except width 0 at spacing 1). The native paragraph occupies one line.
  Normalization turns the CR into a hard break, and main's dropped ZWSP line had
  hidden that extra line. LTR: `wrap-595c31eda7a6c15f`, `wrap-13adec9552de2657`, `wrap-71ae7b15dafd960d`, `wrap-6a4d93c6e3dd464c`, `wrap-dd95abdf59599b03`, `wrap-78994ecb2fb65013`, `wrap-57453093d8be2a1b`, `wrap-bd7578135a3da781`, `wrap-5502ed3295ac0ca0`, `wrap-517ebfc10bd5784f`, `wrap-0167b66269f55b72`, `wrap-dbacb16a12fd357a`, `wrap-41dcf8ea521b4fe0`, `wrap-599f859b5064c041`, `wrap-783698080ebb61ae`. RTL: `wrap-9f5cce0510fe1b5f`, `wrap-8b26138d7daf3c57`, `wrap-e926a20d0f36010d`, `wrap-fc7af6c61815b14c`, `wrap-9f46ce17a060b003`, `wrap-81a2f793fb7de513`, `wrap-fb133c5be30c031b`, `wrap-614383db311fee81`, `wrap-3b1c1fb22c54b2a0`, `wrap-54b74c89f06c524f`, `wrap-ba903ee235bcf072`, `wrap-f3fd33ea1d4b0e7a`, `wrap-5a2d7b6a28fd96e0`, `wrap-b7714be3e70d6641`, `wrap-dee603c8f3523bae`.
- Arabic beh joined across SHY after a leading ZWSP (`\u200B\u0628\u00AD\u0628`,
  pre-wrap; Amiri at 9.8 and 14.75, Noto Naskh Arabic at 10.48 and 12.32, Arial at
  11.35, widths rounded; Chrome in every row, Firefox except Amiri 9.8). Chrome and
  Firefox shape the first letter in context and give two lines. Pretext's isolated
  letter width needs a separate line after the retained ZWSP.
  LTR: `wrap-32c73ec5b7c084af`, `wrap-143ad6ae5b0e509a`, `wrap-3ecde897bf2b5e8b`, `wrap-2b6f9266db70279a`, `wrap-d1ad3222978a7fbc`. RTL: `wrap-6f04fe7d9c575eaf`, `wrap-9001042ea595ca9a`, `wrap-f1fbf02f44b8b78b`, `wrap-30fb0e6625f7a19a`, `wrap-8ad5baa21049c9bc`.

After reviewing these per-case changes, the baseline advances to runtime commit
`6ad8409`. Later changes must preserve its gains, including those of `934141a`,
`a28b542` and #223 made since the previous pin.

The ordinary snapshots were regenerated against that pin. All six legs pass with
zero new regressions, required failures or execution errors, and nine numeric
profiles have no new failures. Accuracy, letter-spacing and corpus result payloads
are unchanged; the refreshed files change only provenance and environment
records. The ordinary suite hash is
`5bb6eadf9109541475c5d6fb8004a7595756e21ddb070226215ec23e267fef07`.

Chrome and Safari benchmark snapshots were refreshed from `1ce3996`, whose runtime
source equals the pinned commit: three foreground runs each, with matching
environments at DPR 2 on the 2560×1440 screen, visible and focused. Hot `layout()`
reads 0.086 ms in Chrome (previous snapshot 0.089) and 0.103 ms in Safari (0.105);
rich statistics, range and streaming rows stay within timer granularity. Safari's
cold `prepare()` row reads 13 ms against 10 ms although preparation source is
unchanged; that runner reports whole milliseconds.

Suite hash: `24ed06aa2d941776605cd68142ec305e60602143061111150d59dccc9fde3657`.
Raw rows, frozen sources and the per-case loss table `lost.tsv` are in
`/private/tmp/pretext-210-landing-20260911/full-vs-2b73992`.

## Retained recipe reduction

The retained JSON shrank from 4,261,040 to 1,635,525 bytes. The original 4,758
profiles repeated 41,449 source records.

The migration compared the complete expanded set with `a56d0f9`: 209,138 inputs
before and after, zero additions, omissions, origin changes or family changes.
Both sorted semantic sets have SHA-256
`b6849c304ca383dbef03202952bb19878ed9217525ca687a9093feab3611e5fa`. This is an
input-preservation audit, not a browser correctness claim. The separate
maintained-oracle corrections described in [INVENTORY.md](INVENTORY.md)
intentionally restore their original protocol and are not relabeled as unchanged
inputs.
