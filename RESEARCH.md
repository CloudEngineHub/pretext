# Research Log

Durable findings and rejected approaches from building this library. Keep the
reasoning that code and commit messages do not make obvious; current behavior and
limitations belong in [README.md](README.md), and validation commands and current
results in [DEVELOPMENT.md](DEVELOPMENT.md). Browser bugs and workarounds live in
[PLATFORM_BUGS.md](PLATFORM_BUGS.md); detailed font measurements live in
[FONT_DIAGNOSTICS.md](FONT_DIAGNOSTICS.md).

## Measurement Model

Measuring whole candidate lines during layout, hidden DOM text, and SVG text were
tried; none earned the extra work or the loss of the `prepare()`/`layout()`
separation.

Adding measured segment widths is an approximation: adjacent glyphs can affect
each other's shape and spacing. Keeping punctuation with its word and allowing
trailing collapsible spaces to hang improved results. Uniform scaling and generic
pair corrections did not recover the missing context reliably. Agreement on a
whole word also does not establish the widths of its possible line prefixes.

Engine profiles describe the layout engine, not the browser brand;
`getLayoutEngine()` in `src/measurement.ts` explains how the user agent names it.

In Chrome a Latin-1 string's storage decides how Canvas shapes it. Blink shapes a
one-byte string as one Latin segment, and runs its script segmenter over a two-byte
one alone (harfbuzz_shaper.cc:1072-1101). V8 keeps a slice of 13 units or more cut
from a string that holds a unit above U+00FF two-byte, and copies shorter ones into
one byte. Using a string as a `Map` key internalizes it, and V8 makes the
internalized copy one-byte when its units fit only if that lookup is the first to
hash the string (`known_one_byte_content`, string-table.cc:411-421); a two-byte
string hashed earlier keeps two-byte storage. Nothing hashes a segment before its
metrics lookup, so every Latin-1 segment the metrics caches look up reaches Canvas
one-byte and is measured as Latin. Chrome paints a run of script-neutral characters
that way after Latin text and in text that is all Latin-1, but not after Arabic or
Han, or between em dashes with no letter around: Blink gives the run the script of
the text before it, and only a run at the paragraph start takes the script after it
(script_run_iterator.cc:503-516, ENGINE_FOLLOWUPS.md). Rejected (2026-09-27):
keying the caches by another string, so that Canvas gets each slice as it was built.
It changes only runs of 13 units or more cut from such text, and moved none of
41,788 Chrome predictions. Of 18 fonts probed, only Amiri and Noto Naskh Arabic
measure the two storages differently (17 of 504 font and run pairs). On templates in
those fonts it fixed every such run after Arabic, Han or an em dash, and broke every
one after Latin in text that also holds an emoji or `ā`: it breaks `)`×15 between
`abc ` and ` بتث`, and fixes it between `بتث ` and ` abc`. The storage follows a
slice's length and the text it was cut from, not the text before the run, which the
page follows. It also costs a string per lookup, and a canvas asked for the same
characters in both storages answers both with whichever it shaped first
(PLATFORM_BUGS.md).

## Break Opportunities From Engine Data

Chrome, Safari and Firefox take break opportunities from ports of their engines' own
scans (`src/line-breaks.ts`, `src/gecko-line-breaks.ts`), and engines Pretext doesn't
recognize take Blink's. Blink's
scan answers from its space rule, its generated pair table for U+0021-U+00FF, its
rule for `-` before a digit and keep-all by general category, and asks ICU
otherwise. WebKit's answers from its own pair table and character classes, and asks
ICU, skipping ahead over ASCII letters. The WebKit port follows Safari 27
(`safari-7625.1.29.11`), whose classes make curly quotes and guillemets opening or
closing quotation marks, so a quote next to a letter never breaks and one next to East
Asian text breaks before it opens or after it closes, without asking ICU. Its keep-all
also breaks after punctuation in text holding a code unit above U+00FF, and a U+2028 or
U+2029 that starts an item forces a break, in every white-space mode. Safari 26.5.2 on
macOS 26 and iOS 26 breaks these shapes as Safari 26's source does. Both run a port of ICU's rule-based iterator,
Blink's over Chrome 153's compiled `line_normal.brk` and WebKit's over libicucore's
`line.brk`, `line_normal.brk` and `line_cj.brk`, with Apple's per-locale quotation
remap. Inside Thai, Lao, Khmer and Myanmar runs, `Intl.Segmenter` words
stand in for the engines' dictionaries.

Offline C++ ports of each engine's break code over its own ICU data found no native
line start in the September 14 suite rows that skipped a usable opportunity (210 of
391,755 Chrome starts stayed unexplained, probably widths of joined Arabic and trimmed
brackets). TypeScript copies of the scans matched those ports outside Thai, Lao, Khmer
and Myanmar runs, with 0 differences over 13,108 Blink and 19,393 WebKit requests,
WebKit with the ports' bidi levels. Against the C++ ports themselves, this port differs
outside those runs only where Chrome opens `line_normal_cj.brk` (44 of 13,108 Blink
requests) and, since Pretext resolves no bidi levels, at 71 positions in 71 of 19,393
WebKit requests, all right-to-left at a bidi level change, against the C++ port with
Safari 27's changes. It matches that port on all of 20,000 random requests over quotes,
punctuation, CJK text, separators and keep-all. With those changes the C++ port leaves
no native line start of the September 16 Safari 27 rows unexplained, where Safari 26's
port left 323 left-to-right and 247 right-to-left. Its ICU iterator gives ICU C's boundaries on all 19,338 cases of
LineBreakTest.txt and on the corpora, over Chrome's `line_normal.brk` and through
libicucore's `ubrk_open` for nine page languages.

Every page parses every engine's tables. Unpacked, 480 KB of base64 made a fresh
Firefox page spend 5.2ms evaluating the bundle against main's 1.2ms, so the generator
packs them in a small LZ77 form. The five ICU line tables come from nearly the same
rules, so each packs against the earlier table that packs it shortest, across engines:
Chrome's `line_normal.brk` alone, its `line_normal_cj.brk` and libicucore's
`line_normal.brk` against it, libicucore's `line.brk` against that, and its
`line_cj.brk` against `line.brk`. The minified layout bundle is then 120 KB, 57 KB
gzipped (main: 80 KB and 21 KB), and a fresh page evaluates it in 2.8ms in Firefox and
1.4ms in Chrome and Safari. Packing each engine's tables only against its own first
gave 133 KB and 64 KB, evaluated as fast. Keeping Chrome's root table whole, the other
line tables as copies from an earlier one and every other table unpacked gave 238 KB
and 57 KB, evaluated in 3.6, 1.5 and 1.6ms. Against packing per engine, Safari's first
preparation unpacks three tables for `line.brk` instead of one, about 0.6ms once per page.
The Gecko scan doesn't split text runs where the script changes, as Firefox's script
itemizer does. Those splits only add cluster starts: without them no suite or corpus
request analyzes differently, and against the Gecko oracle the scan's breaks differ in
18 more of 11,875 left-to-right fuzz requests, its cluster starts in 108. A port of the
itemizer first found each code point's script with a RegExp per script name, several
milliseconds of set-up before the first preparation, then read Firefox's own Script
data, 16 KB of tables.

Remapping characters to the root table's categories, as WebKit does for quotes, can't
stand in for Chrome's `line_normal_cj.brk`: its `〜` and `゠` belong to no class the
rules name, a category the root table doesn't have.

Firefox's scan ports how Gecko handles one text node: `TransformText` collapses its
white space and drops soft hyphens and bidi controls, text runs split where bidi
levels change, each shaped word gets its cluster starts,
and `nsLineBreaker` sends each word holding a character outside
`kNonBreakableASCII` to a port of ICU4X 2.1.2's line iterator over Firefox's baked
`segmenter_break_line_v1` data under Strict rules. A break survives only at a
cluster start or after a space (`gfxTextRun::SetPotentialLineBreaks`), which also
drops the word boundaries `Intl.Segmenter` finds inside grapheme clusters in Thai,
Lao, Khmer and Myanmar runs: installed Firefox 155's segmenter matched Gecko's
models on all 54,588 breaks inside such runs that way. Levels come from a port of
servo/unicode-bidi, which Firefox runs, over icu_properties' Bidi_Class data.
Against the Gecko break oracle, the scan gives the oracle's breaks and soft-hyphen
breaks on all 6,569 left-to-right suite and corpus requests and all 11,875
left-to-right fuzz requests, with ICU4X's word segmenter standing in for Firefox's,
and differs only inside Thai, Lao, Khmer and Myanmar runs with Bun's. Pretext takes
no direction, so the scan resolves every paragraph as left-to-right: none of the
4,346 right-to-left suite and corpus requests changes, and 192 of 8,125
right-to-left fuzz requests do. Firefox 156.0's XUL holds the same line data and
Bidi_Class trie byte for byte. The scan replaced the Gecko profile's merges of
`Intl.Segmenter` words, its CJK units and its independent symbol runs, and with
them answers the oracle contradicts, such as ending a keep-all run after `”` before
an ideograph, keeping `−+x«value»!` whole, or keeping `|` with the letter after it
in `a/|b`.

Segments are the text between opportunities, split where the break kind changes, so
a URL splits where the engine may break it and CJK text arrives in its final units,
and a control character stays its own segment, measured alone. A U+2028 or U+2029
the WebKit scan makes a forced break is a hard break. One that ICU's fast-forward
passes stays inside a text item in WebKit's source, and stays a control segment. A
ZWSP or soft hyphen with no break before the text after it,
as at the start of a WebKit scan, before a combining mark or a closing bracket, or
under keep-all, is zero-width glue: its own zero-width segment, which takes no letter
spacing and doesn't end a line. Folding it into that text instead measured the text
with it inside, charged it letter spacing native layout doesn't give it, and let an
emergency break give it a line of its own; the September 15 installed gate lost 1,887
Chrome and Safari rows that way, such as `a`, U+00AD, U+0301, U+00AD, U+0323, `b` at
7px in 16px Arial with letter spacing −4, which both browsers paint as `a` / `b`.
Where a line can still end after the ZWSP or soft hyphen, before a space, tab or hard
break, it keeps its kind. Blink's break-anywhere retry and WebKit's grapheme search
can still give glue a line of its own when the grapheme after it doesn't fit: Chrome
paints `abc`, U+00AD, `)def` at 1px as `a` / `b` / `c` / U+00AD / `)` / `d` / `e` / `f`.
Gecko can't. It drops soft hyphens from its text run, so a soft hyphen at the start
offers no break and isn't a cluster, and it clusters a ZWSP with the marks after it, so
in the Gecko profile glue at a line start isn't the line's content and the segment after
it starts the line however wide it is. Letting the glue start the line gave `SHY a SHY b`
at 0px an empty first line, which the Gecko scan's installed gate lost on 428 Firefox
rows; applying the same rule to the Chrome and Safari profiles loses 101 Chrome and 866
Safari rows in an offline replay. Gecko drops bidi controls from its text run too, breaks
lines in text-run offsets and maps a line end past the characters it dropped
(nsTextFrame.cpp:11161-11170), so a line never ends before one, starts with one after a
wrap or breaks inside a word at one. The Gecko profile does this in its analysis, with no
kind of its own for them. The scan's white-space step notes whether it dropped a bidi
control, and only then does the analysis look for them. A run of soft hyphens and bidi
controls with a control in it joins the segment before it, whether text, white space or a
ZWSP, up to its last control, and the break after the run stays where the scan puts it, so
a line that ends there hangs the space before the run. A soft hyphen before a control
offers no break, since Firefox takes a hyphenation break only from the last character it
drops before one it keeps (nsTextFrame.cpp:4436-4442). A run at a chunk start is text that
starts the line, and the text after it joins it: Firefox trims a line's leading white
space only from the start of its content (nsTextFrame.cpp:10935-10950), so a control there
keeps the space after it, and the break the scan gives after the run, the hard break's or
the collapsed leading space's, can't end a line holding nothing yet. A chunk of only such
characters joins the hard break before it, as Firefox lays no frame of them out as a line
(nsTextFrame.cpp:11421-11429). Firefox's white-space run reads through the controls in it
(TransformText, nsTextFrameUtils.cpp:319-345), so the profile's collapse does too: the
spaces on both sides of a control take the room of one, which is the segment break where
they hold one (TransformWhiteSpaces, nsTextFrameUtils.cpp:151-193), and white space before
only controls at the end of the text goes, and the scan runs again on what's left. The
profile's graphemes look past soft hyphens and bidi controls (Grapheme Clusters From
Engine Data), so a mark after a control joins the cluster before it, except where a bidi
level run starts at the mark, which the scan marks as a cluster start and the analysis as
a segment start. The walkers and `layout()`'s count know nothing of controls, and text
whose controls follow spaces, which had a boundary the scan doesn't break at, now takes
the simple walkers. Making a run of controls zero-width glue that the walkers look past
fixed the same cases, but it counted text ending in controls with the stepper, which made
Firefox's `layout()` of the bench's invisible tails 12 to 13% slower, and its test for
such glue in the shared walkers made Chrome's and Firefox's layout of some worst-case
shapes that never hold any 5 to 11% slower (branch `gecko-bidi-control-gaps`, 5bc0b58a).
The walkers end a line only where the scan breaks: prepared text records the segments that
follow no break, a line that overflows before one returns to its last break, and a line
without one fills graphemes across the unbroken run, as Blink's break-anywhere retry and
WebKit's `TextUtil::breakWord` do. Ending at
any segment boundary instead gave `a`, U+00AD, WJ, `b` at 0px a line holding only the
soft hyphen, and the second installed gate lost 9,068 line-count passes that way.
Combining marks after zero-width glue or a control shape after the grapheme before
them and what separates them, so they're measured as that source with the marks, minus
the source, and take no letter spacing of their own. Measuring every run after the whole
chain was quadratic, so past 96 UTF-16 units of what separates them, a run is measured
after the grapheme and the fewest of the chain's last runs, each with the separators
before it, that hold at least 96 units. Safari gives a run a width that depends on how
far it sits from the grapheme, up to 61 units in the chains measured: after `क`, soft
hyphens and U+0323 in 16px Georgia, the first mark takes 5.2px, the next 29 take 1.6px
and the rest none. Keeping at most the last 96 units instead left only the separator
after a run of 95 marks or more, and Safari then gave such runs up to 7.1px more than
after the whole chain. In Chrome 154, Safari 27 and Firefox 156.0.1, runs measured
this way within 0.0005px of their widths after the whole chain over 10,560 chains of
one- and two-code-point runs in 24 fonts, and within 0.002px over 2,400 chains of six
runs of 1 to 400 marks in 5 fonts, while leaving out the grapheme too took up to 25px
off a run (#351). Measured alone, U+0301 took 2.97px
in 16px Arial. Measured on the grapheme without the glue, Canvas composed the pair or drew
it in another font: `a` with U+0323 in 16px Amiri took 2.22px more than `a`, where
Chrome paints `a`, U+00AD, U+0301, U+00AD, U+0323, `b` as wide as `ab`. WebKit's
Canvas measures text through the page's `FontCascade::width`, so in both installed
Safari and its page such marks take their fallback font's advance (8px for U+0301 in
Georgia). Blink's page shapes a soft hyphen inside its text item, and in about 20,000
suite observations over 13 fonts a nonspacing mark after one never took width. Its
Canvas turns the soft hyphen into a ZWSP and shapes each word alone
(`PlainTextNode::SegmentWord`), so after a soft hyphen the mark can measure as a
dotted circle (8px in Georgia); the Chrome profile gives such runs no advance. After
a ZWSP, Chrome's page splits too and draws the circle, as its Canvas does. WebKit and
Gecko scan a text node's source, where a collapsed TAB is still UAX #14 BA to WebKit,
so their profiles map the source's opportunities onto the normalized text; Blink scans
the collapsed text, as Pretext normalizes it. A break before a run's later unit follows white space,
so it's a break after the space the run became: in `ab`, SPACE, CR, `cd` the only
source opportunities after `b` are before the SPACE and before the CR, and Safari starts
the next line at the CR. Every text segment takes emergency grapheme breaks: under
`overflow-wrap: break-word` Blink retries an overflowing line with a break allowed
between any two graphemes (line_breaker.cc), WebKit searches the word's grapheme
prefixes (`TextUtil::breakWord`) and Gecko wraps before any cluster start
(gfxTextRun.cpp:1069-1072), so the permission doesn't come from
`Intl.Segmenter`'s word-likeness, which Safari's JavaScriptCore withholds from
numbers (`11111111` at 1px laid out as one line, 230 September 15 gate rows) and every
engine from emoji and symbol runs (`🇺🇸/👩‍💻` at 8px, where both browsers break
before the `/` that no scan allows, 526 rows). No scan asks `Intl.Segmenter` for words
outside Thai, Lao, Khmer and Myanmar runs. Gecko clusters its text run after dropping soft
hyphens and bidi controls, per shaped word, so the Gecko scan's cluster starts decide
which segments split: one that holds no cluster start after its first unit takes no
emergency breaks. In `a`, `👩`, U+00AD, ZWJ, `🚀`, `b` at 0px the ZWJ continues the
woman's cluster and joins the rocket to it, so Firefox paints `a` / `👩-` / ZWJ `🚀` /
`b`, where Unicode graphemes split ZWJ from the rocket (68 installed rows). Between
rich-inline items, the WebKit profile reads the previous item's last two characters as
prior context, as `TextUtil::mayBreakInBetween` does.

Where an emergency break falls inside a segment depends on the advances an engine adds
up. Gecko adds the advances of the word shaped whole (`BreakAndMeasureText`), so a
joined letter counts at its joined width: in 16px Arial `بِبِ((tail` at 27.86px Firefox
fits `بِبِ((` (25.98px, the first ب at 3.9px) and starts the next line at `tail`. Summing
standalone graphemes charged both ب their isolated 11.42px, so the Gecko profile ended
the first line after `بِبِ` and gave `((tai` a line (460 installed rows, most of the
Firefox emergency losses). The Gecko profile now fits from grapheme prefixes, as the
WebKit profile does, which give each letter its left context. A prefix still ends in a
final form and misses kerning with the grapheme after it, so after a split a word's last
Arabic letter gets its medial advance and `V` in `AV AV` its kerned one. In an offline
replay of the Firefox rows the Canvas stand-in can measure, prefixes gain 2,110
left-to-right and 703 right-to-left line counts over sums and lose 643 and 349, and double
the Canvas calls of a cold preparation of the corpora (53,017 to 106,768). Pairs, each
grapheme measured after the one before it, gain 2,062 and 702, lose 753 and 352, and
cost 21% more calls on the corpora but 91% more on the accuracy grid, where every
preparation starts cold.

Prefixes are now taken only in segments at least 80px wide; narrower ones sum
standalone graphemes. A segment breaks inside itself only on a line narrower than
itself, so a narrower one never does at 80px and over, and there prefixes cost a
Canvas call per grapheme of every distinct word. With the floor, a cold Firefox
preparation of the census's real text takes 88 calls a paragraph against 113 for
prefixes everywhere and 86 for sums everywhere (main: 79), and the full maintained
books 3,291 against 6,017 and 2,963. Every census, book, corpus-sweep and CJK
paragraph row, and every suite row at 80px and over, keeps its prefix result; sums
everywhere lose 58 of those suite rows in line count and 329 in line count or
visible breaks (`foo@bar.com：b` at 105px, joined Arabic around brackets near
100px). Below 80px the installed Firefox gate loses 1,870 left-to-right and 316
right-to-left line counts against prefixes everywhere and gains 652 and 291;
against main it loses fewer rows than prefixes everywhere did (477 left-to-right
and 314 right-to-left where main placed every character or wasn't placed, against
675 and 343).

The 80px has no browser reason: it was the old suite's boundary for narrow widths.
Measured again with the harness in Firefox 156 (2026-09-27), a 24px floor, where the
harness's layouts narrower than real ones end, costs what prefixes everywhere cost,
since the prefixes' calls sit in words 24-80px wide. Either takes 99 measureText calls
per 1,000 units while preparing where 80px takes 62 (with the 24px floor, 11,367
against 5,857 on the census and 434,843 against 278,106 on the real-usage draws), and
`bun harness bench main` reads new Latin, Arabic and mixed messages and UI labels
28-68% slower in both sessions; new CJK and Thai, seen text and the worst shapes read
within noise. Lines at 24px and wider move the same under both: 281 Firefox cases at
24-80px pass that fail with the floor, 172 of them the old gate's Arabic words with
vowel marks before brackets, quotes, controls or Latin, and 14 fail that pass. Ten of
those are `a ★ーb` in 16px Arial at 25-29px: Firefox's Canvas measures `★ー` at 32px, as
the browser lays it out alone, where the paragraph lays it out at 26.65px after `a `,
which summed standalone widths (10.65px and 16px) match by luck. Three are Amiri
Arabic split at 24.45px, 1/64px from where the lines change, and one is a real-usage
draw, `TKT-84565` in a 31.25px table cell in 16px Helvetica Neue: prefixes give the
hyphen that starts the second line all 2.05px of its kerning with the `T` before it,
so `-845` fits at 30.87px, where Firefox moves the `5` on. No real-usage draw gains,
and 188 of the 11,901 (1.5% of their weight) are narrower than 80px. Below 24px, the
24px floor fixes 40 cases and loses 36, prefixes everywhere 44 and 50. The floor stays
at 80px as a premise (Decisions Log).

An overflowing segment used to end its emergency split after its last hyphen that
fit. Those preferred breaks recovered ordinary breaks the merged segmentation hid
inside a segment. A scan segment ends at every break, so a hyphen left inside one has
no break after it, and Chrome, Safari and Firefox fill graphemes there under
`overflow-wrap: break-word`. Over the corpora and test texts, 188 of 374,178 Blink
and 178 of 374,218 WebKit scan segments still held a hyphen before other graphemes,
such as `ה-16`, `-.` and `—”`, where the preferred break could still move a line end.

On `zh` pages the Blink scan opens Chrome's `line_normal_cj.brk`, as Chrome does for
`zh` content under line-break: auto: Chrome opens ICU's line iterator with the plain
locale (text_break_iterator.h:274-288), and ICU's `brkitr/zh.txt` and `zh_Hant.txt`
map `line` to that table, where `ja.txt`, `ko.txt` and `root.txt` map it to
`line_normal.brk`. There the double curly quotes act as brackets, and `〜` and `゠` can
start a line. Content without a language opens the table of Chrome's UI language.
Probed with the UI and accept languages set apart (zh-CN and en-US each way), the line
table followed the UI language, and so did
`new Intl.DateTimeFormat().resolvedOptions().locale`, which Chrome sets from the same
`--lang` switch; `navigator.language` followed the accept languages. So on a page
without a language the scan takes Intl's default. The page also resolves fonts and
types HanKerning's punctuation under that locale, where Canvas under an empty page
language doesn't: under a zh-CN UI, `16px "PingFang TC"` halts the `。` of `。」` in the
page and not in such a Canvas. So the Chromium profile gives its context that locale
on a page without a language, resolved once per prepare for the scan and the context
alike. ENGINE_FOLLOWUPS.md lists the deliberate differences.

## Grapheme Clusters From Engine Data

Emergency breaks, letter spacing, emoji correction, line text and Gecko's cluster starts
take grapheme clusters from `src/graphemes.ts`, not `Intl.Segmenter`. It reads ICU's
character rules, `char.brk`, as Chrome 153 (ICU 78.2) and libicucore 78.1 ship them, in one
pass. Their forward table accepts in every state but the start state and a look-ahead state
after a regional indicator pair, which is entered only one code point after the position it
returns, so a cluster ends right before the code point whose transition stops or enters that
state, and the next cluster starts there from the start state. The generator checks that
shape. The two tables share their states; libicucore's trie adds Apple's transcoding hints
U+F870-U+F87F, U+F884-U+F899 and U+F89F to Extend, and the WebKit profile takes it. Firefox
156's ICU4X grapheme data puts every code point in the same 18 classes as Chrome's table, and
ICU4X's iterator ends clusters where ICU's does on all 2 million strings of up to five code
points taking one per class and on a million random longer ones, so the Gecko profile takes
Chrome's table. Firefox clusters its text run, which leaves out soft hyphens and bidi
controls (IsDiscardable, nsTextFrameUtils.cpp:32-49), so the profile's table, `gecko/char`,
reads Chrome's rules past them: one goes with the cluster before it, or at the start of a
segment with the one after it, and takes no letter spacing. Below U+0300 only CR and LF share
a cluster, so the Gecko scan skips words of such units; its `Intl.Segmenter` probes had
skipped every word without a unit that may join.

In each installed browser the table its profile takes gives `Intl.Segmenter`'s clusters on
every code point in 14 contexts that tell the classes apart (15.6 million strings), on the
9,323 corpus paragraphs and suite texts and the 1.3 million segments `prepareWithSegments()`
makes of them, and on 200,000 random strings over the classes (`scripts/grapheme-check/`).
The other table differs only at Apple's 39 hints. A second fuzz of 20.6 million strings in
each browser, with emoji sequences, Unicode 16 and 17's new scripts, lone surrogates,
clusters up to 70,000 code units long, sub-ranges and counting only, found no difference.
Node 23's ICU 77.1 (Unicode 16) differs on 1,417 code points and on 61 of those texts, so an
engine on another Unicode version needs its own table. 689 of those code points, the largest
group, are symbols Unicode 17 took out of Extended_Pictographic, such as U+2605, the chess
symbols from U+2654, the dice and the mahjong, domino and playing cards, which no longer join
a ZWJ sequence: U+2654 ZWJ U+2654 is one cluster in Unicode 16 and two in 17. 686 are
consonants and linkers in 14 scripts whose conjuncts Unicode 17 joins, among them Myanmar,
Khmer, Tai Tham, Balinese, Javanese and Sundanese, and 42 are characters new in Unicode 17.

With graphemes from the tables, `Intl.Segmenter` is left only for words inside the runs the
scans break by dictionary: Thai, Lao, Khmer and Myanmar, and in the Blink and WebKit scans
also Tai Le, New Tai Lue, Tai Tham, Tai Viet and Ahom. The scans create the word segmenter
the first time such a run shows up, so other text prepares without `Intl.Segmenter`.

`Intl.Segmenter` graphemes had been the largest part of preparing new text in Chrome and
Safari: 40 to 58% of a pass over batches of about 24,000 code units of Latin, chat, Arabic,
mixed and pre-wrap text, 18 to 28% over CJK and Thai, and 64 to 76% with letter spacing,
whose count ran on every segment of every `prepare()` and took 85 to 89% of preparing seen
letter-spaced text. Against main before the change, in one document, interleaved over 31
rounds in each browser in the foreground, `prepare()` of each batch takes main's time
divided by this many:

| Batch | Chrome 153, new text | fresh page | Safari 27, new text | fresh page | Firefox 156, new text | fresh page |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Latin | 1.63 | 1.34 | 1.75 | 1.30 | 1.12 | 1.11 |
| Chat | 1.96 | 1.44 | 1.64 | 1.17 | 1.26 | 1.11 |
| CJK | 1.17 | 1.05 | 1.23 | 1.06 | 1.02 | 1.07 |
| Arabic | 1.65 | 1.30 | 1.80 | 1.31 | 1.13 | 1.06 |
| Thai | 1.26 | 1.12 | 1.29 | 1.10 | 1.01 | 1.01 |
| Mixed | 1.58 | 1.21 | 1.55 | 1.20 | 1.19 | 1.07 |
| Pre-wrap | 1.74 | 1.23 | 1.58 | 1.22 | 1.11 | 1.04 |
| Letter-spaced | 2.86 | 2.04 | 4.26 | 2.20 | 1.40 | 1.22 |

New text is a pass after `clearCache()`, with the browser's shaping caches warm. A fresh
page is the first pass in a new same-origin iframe, whose library, tables, caches and
canvas all start empty, as for text Chrome's canvas hasn't shaped; it includes reading the
tables, which in a later run made a page's very first `prepare()` 0.05ms slower than main's
in Chrome 154 and 0.14ms in Firefox, and no slower in Safari. Seen text prepares 7.9 to 9.2
times faster with letter spacing in Chrome and Safari and 1.8 times in Firefox, and
otherwise within 3% of main, except Firefox, where Latin and pre-wrap are 6 to 10% faster
and CJK 2 to 4% slower: the Gecko scan now runs the rules over every word with a unit at or
above U+0300, where its probes had skipped Han words that never join. A table of those
probes' answers built from the rules gave 1.01, within the noise. On short Japanese,
Chinese and Korean interface strings, repeated runs read 0.90 to 1.08 of main's speed.
`layout()` on the same batches stays within 4%. Safari's row comes from a run without that
`layout()` control: after it, Safari's next passes over new text took about 65ms more in
both libraries. Canvas calls are unchanged. The tables add 5.5 KB to the minified bundle,
3.8 KB gzipped.

## Breaks And Source Positions

Storage segments, measurement spans, ordinary break opportunities and emergency
grapheme breaks are different things. Merging punctuation, URLs or numeric
expressions into units before deciding breaks erased context that later passes
could not recover; the scans read the whole text. Keeping an ordinary unit together
does not forbid emergency grapheme progress when it is overlong. Kinsoku clusters
such as `漢。` or `「漢`, and keep-all groups, are no exception: under
`overflow-wrap: break-word`, Chromium retries an overflowing line with grapheme
breaks, WebKit breaks at an arbitrary position once the line has
no earlier wrap opportunity, and Firefox admits a word-wrap break at every cluster
start, all ignoring line-break classes. Safari 27 keeps `漢。` together when not
even `漢` fits (`firstCharacterBreakRespectingLineStartProhibitions`), in text holding
a code unit above U+00FF, and so does the WebKit profile; Safari 26.5.2 doesn't. It
keeps punctuation other than dashes, connectors and `\`, NBSP, U+2010 and U+2013 after
the first character, measured by grapheme where WebKit steps by code point. Several narrow rows passed only while this
missing break cancelled another error, such as a combining mark detached from its
base, U+3000 not hanging, joined Arabic widths, raw controls or Chrome's
text-spacing-trim.

Chrome's default `text-spacing-trim: normal` halts CJK punctuation through Blink's
HanKerning (han_kerning.cc): a fullwidth opening mark after an opening, middle,
closing or narrow opening mark, a closing mark before a closing, middle or narrow
closing mark, and a closing mark at a line end where the line doesn't fit otherwise
and a break follows it (shaping_line_breaker.cc:344-363); a wrapped line start keeps
its opening mark whole (text_spacing_trim.h:31-34). Blink's scan gives no break
before a space, tab or line feed, which continue a run of spaces
(text_break_iterator.cc:284-291), but a line that no break of the scan's fits is laid
out again under `overflow-wrap: break-word` with a break after every grapheme
(HandleOverflow, line_breaker.cc:4259-4263), and there the halt applies before
anything: in 16px PingFang SC in pre-wrap, Chrome fits `的」` before a line feed at
24px, while `的的」` before a line feed at 40-47px still ends its first line after
the first `的`. Safari and Firefox halt nothing: WebKit's `text-spacing-trim` is off
by default and initially `space-all` (CSSTextSpacingTrimEnabled), and Gecko 156 has
no such property. Canvas halts a pair only inside what it shapes as one
word: Blink's Canvas cuts a string before and after CJK ideographs and symbols and
shapes each word alone (plain_text_node.cc:93-155, 377-400), and curly quotes, ASCII
brackets, U+00B7, U+2027 and U+FF1B aren't CJK symbols. So the Chromium profile adds
the halts across segment boundaries and across those cuts: `「」「」「」` is three
segments that Canvas measures at 96px in 16px Hiragino Sans and Chrome paints at
80px, and Canvas measures the one segment `(「` at 21.70px where Chrome paints
13.70px. Measuring under `textRendering = 'optimizeLegibility'` makes Canvas shape a
string whole, but only where the primary font's GPOS or GSUB lookups cover its space
glyph (font_fallback_list.cc:264-277): Georgia, Verdana, Helvetica Neue and Thonburi
still cut, so the port follows the cuts instead. Every fact is the font's, from
Canvas: a character's halt is 2 W(c) - W(cc), since HanKerning halts exactly one of
the two in `cc`, `halt` exists where 「「 is narrower than two 「, and the types of
`、。，．：；` and curly quotes follow their ink bounds. HanKerning::FontData shapes
them under the locale's Han script (han_kerning.cc:462), where `locl` can move them:
under zh-Hans PingFang TC draws `。` in the left half of its em, a closing mark, and
alone it's centered, a middle one, so the page halts the `。` of `。”` on a zh page
and not on a zh-Hant one. Canvas shapes a CJK symbol next to 中 as Han, so the port
reads its right edge from `中。` and its left from `。中`; the curly quotes and
U+FF1B are Canvas words of their own and are measured alone. That is 18 Canvas calls
once per font and 2 per distinct trimmed character, on text holding a character in
U+2018..U+301F or U+FF08..U+FF60.

Question and exclamation marks are UAX #14 class EX. ICU and ICU4X break after
EX unless the next character's class forbids a break before it (LB31), and
Firefox sends every word containing EX to ICU4X: its ASCII shortcut covers only
AL, IS, NU and QU words. Chrome and Safari first consult a pair table for
characters up to U+00FF. It follows ICU except for printable ASCII, where `?`
breaks before everything except `! " ' ) , . / : ; ? ] }`, and `!` breaks only
before `(`, `<`, `[` and `{`. So Chrome and Safari break `x?|$b`, `x?|-|b` and
`x!|©b`, while Firefox keeps `x?-|b`. Above U+00FF the engines'
line-break classes decide, so an iteration mark such as `々` (NS) stays after `！`.
Small kana and `ー` (CJ) after EX follow the engine and page language; see
Content Language. Safari's keep-all breaks at spaces, and in text holding a code unit
above U+00FF after punctuation. U+061B ARABIC
SEMICOLON is EX too, while `:`, `.` and U+060C are IS and keep a following
Arabic word (LB29). Firefox also breaks after BA such as `|` and CL such as `}`
before a letter or digit, as Gecko's scan does: installed Firefox
155 paints `xy abc} / 1234`, and ` 丙` after the word doesn't change it, since
ICU4X decides each word alone.

After CJK text, no engine breaks before punctuation that UAX #14 keeps with the
text before it, such as `'`, `/` or `|` (LB13, LB19, LB21), while an opening curly
quote can start a line next to East Asian text (LB19a). The text after
such a mark is decided differently by each engine (#274, #293). Blink reads its
pair table for any two code units up to U+00FF, whatever comes before them, so
`丙!a` keeps `!` with `a`, as `x!a` does. WebKit reaches ICU at the CJK
character, takes ICU's next break, and skips ahead over ASCII letters without
reading its table (`BreakablePositions.h`). So ICU's rules decide before a
letter and the table before a number: `丙!|a` breaks and `丙!1` doesn't. The skip
reaches only the pair right after the character that reached ICU, so the table
keeps `丙!!first` and `丙.!first`, and a letter between the CJK text and the mark,
as in `丙a}first`, puts the pair back on the table. WebKit skips ICU entirely
when CL or CP follows an ideograph or Hangul syllable, so `}` keeps a letter
after Han and Hangul, but not after kana. Firefox sends those words to ICU4X.
The September 15 installed probe (Chrome 153, Safari 26.5.2, Firefox 155; `甲乙丙`,
`あいう` or `가나다` before 32 ASCII marks and `first_week`, `FirstWeek`, `1234` or
`αβγδεζη`) matched each rule: Chrome keeps `!`, `}`, `/`, `|` and `'` with an
ASCII letter or digit and breaks after all but `'` before Greek, Safari breaks
after `!`, `/` and `|` before a letter and after `}` only after kana, and
Firefox follows UAX #14. Each engine's scan answers these from its own rules.
Where UAX #14 keeps the pair, as IS, CP, PO and straight quotes do before a letter
or number, all three engines keep it. A closing curly quote keeps the text after it under
`line_normal.brk` (LB19a), but Chrome's `line_normal_cj.brk` reads `”` as CL, so
where Chrome opens that table it breaks before `tail` in `中文中文””tail`.

No break precedes closing punctuation or a nonstarter, whatever comes before it
(LB13, LB21). For these marks above U+00FF all three engines reach ICU or ICU4X, and
installed Chrome, Safari and Firefox keep `，」：。）！？、` and `」。` after `xxxx` or
`1234` whenever the text plus the mark fits an empty line, breaking before the mark
only in an emergency. Small kana and `ー` start a line there as after CJK text:
Chrome after letters and digits on every page, Safari only on `ja` and `ko` pages,
and Firefox never. The scans break between a space or zero-width space and such a
mark; no installed run has observed `a ，b`. Firefox breaks before the
mark after a run of complex-script code points: ICU4X hands a run of two or more
SA code points to its dictionary or LSTM segmenter, which reports the end of the
run as a break whatever follows, even for an SA script with no model, so Firefox
paints `a ខ្មែរ / ，b`, as Gecko's scan does.

No break follows ZWJ (LB8a), so a ZWJ at the start of the text or after a ZWSP,
tab or hard break stays with the next word. A ZWJ right after a space belongs to
that space's grapheme cluster, and browsers break between them, as the scans do,
so a line can start inside that cluster.

A hyphen after a space, ZWSP, hard break or the text start keeps a following
alphabetic (AL) or Hebrew (HL) letter (LB20a) in Chrome and Safari: always for
U+2010 and the other Unicode 17 HH dashes such as U+2013 and U+05BE, and for `-`
before a letter above U+00FF. Letters of other classes, such as Bopomofo, Hangul
jamo, Yi or Balinese, still break. ICU 77 counts only U+2010 as HH and keeps
only AL letters, so a headless Chromium build on ICU 77 breaks after the dash
before a Hebrew letter. ICU 78 adds HL and the other HH dashes. Installed Chrome
153 keeps each one observed, before Hebrew letters too, as Safari 26.5.2 does:
U+2010, U+2012, U+2013, U+058A, U+05BE, U+1400 and U+2E17.
Their pair tables break `-` before an ASCII letter, and Safari's also before most
Latin-1 letters, such as `é` but not `ª`. Chrome sends a non-ASCII follower of
`-` to ICU instead, which keeps those letters.
Combining marks between `-` and a Latin-1 letter, as in `a -\u0301\u00E9b`,
hide the letter from the pair tables, so ICU keeps it. ICU 78's LB20a letters
($ALPlus) also include AL and AI symbols
such as `#`, U+00A9 and U+221E, so Chrome and Safari keep `a \u2010\u00A9b`
and `a -\u221Eb` together. A TAB
before the hyphen is UAX #14 BA, not a space. Safari's scan reads it even when
normal white space collapses it and breaks after the hyphen, while Chrome breaks
the collapsed text and keeps the letter, as the scans do. Chrome also restarts
its ICU context at each line start, so after a pre-wrap TAB the result can depend
on where the line began. Chrome's context also crosses rich-inline
items, and the Chromium profile takes those breaks from the joined text: items
`foo` and U+2010 `bar baz` break after the dash.
Firefox's ICU4X 2.1 rules follow Unicode 15.0, before LB20a.

ICU4X keeps a hyphen-minus (HY) with a following number (NU), ASCII or not
(LB25), so installed Firefox 155 moves `log-2026` or `2025-08-01` to the next
line whole and breaks `crash-log-2026-09-12.txt` only after `crash-`. Chrome and
Safari break `-` before an ASCII digit from their pair tables. Gecko also marks
the position after a hyphen between alphanumerics as an emergency wrap
(`gfxShapedText::SetupClusterBoundaries`), taken only when nothing else fits: under
`overflow-wrap: normal` Firefox paints `log- | 2026` once the word can't fit a
line, while under `break-word` every cluster start is such a wrap and it fills
graphemes (`log-2 | 026`). A probe that reads only `overflow-wrap: normal` lines
sees a break there. Fullwidth digits are ID, and U+2010, U+2012 and U+2013 are
BA in ICU4X's data, so Firefox still breaks after them before a digit. Gecko's scan
takes these pairs from ICU4X. Before Arabic-Indic, Devanagari or mathematical digits
Chrome keeps the hyphen too, and so does Safari except before Arabic-Indic digits.

`/` isn't in Gecko's table of ASCII characters that never break
(`kNonBreakableASCII` in `nsLineBreaker.cpp`), so Firefox sends every word
containing it to ICU4X, which breaks after `/` (SY) wherever UAX #14 allows it.
The SY row of ICU4X 2.1.1's line table breaks before AL, ID, OP, PR, PO, B2, SA
and emoji, and keeps `/` before BA, CJ, CL, CP, EX, GL, HY, IN, IS, NS, QU and SY
(LB13 and others), HL (LB21b) and NU (LB25). So installed Firefox 155 paints
`https:// | example.com`, `example.com/ | docs`, `and/ | or`, `a/ | (b)`,
`a/ | #b` and `see / | docs`, keeps `1/2`, `example.com/2026`, `a/"b"`, `a/.b`
and `a/עברית`, breaks after a combining mark on `/` rather than before it, and
never breaks before `/`, after CJK text either. Keep-all, pre-wrap, letter
spacing, right-to-left paragraphs and rich-inline items split next to `/` give the
same breaks, and a unit that doesn't fit fills graphemes but still ends its line
at that break (`ryname/ | anotherl`). Chrome and Safari keep `/` with a following
ASCII letter or symbol from their pair tables, and break before Latin-1, Cyrillic,
Arabic, Thai and CJK letters as ICU does. Gecko's scan takes the pair from ICU4X's
table, so a URL breaks after its `/` as in Firefox.

U+2007 FIGURE SPACE is UAX #14 class GL, like NBSP and NNBSP, even though it is
a space separator. Chrome and Safari treat only SPACE, TAB and LF (Safari also
LS/PS) as breakable spaces, and their pair tables stop at U+00FF, so U+2007 goes
to ICU's GL rules. Firefox's line breaker splits words only at SPACE, TAB and
CR, so U+2007, like the rest of U+2000..U+200B, stays inside the word it sends
to ICU4X, which applies the same GL rules. Treating it as plain text let
`Intl.Segmenter`'s word boundaries around it become break opportunities.

NBSP, U+2007, U+202F, WJ and U+FEFF are plain text to the walkers as well. The
scans give no break next to them, so they join the text around them, and a run made
only of them sits between two breaks, as NBSPs between spaces do. Such a run takes
emergency breaks like other text, as all three browsers do: two NBSPs at 1px in
16px Arial take 2 lines in Chrome 153, Firefox 156 and Safari 27. Main's `glue` kind
kept a run made only of them whole and off the simple walkers, and kept a U+3000 run
before it from hanging, where Chrome and Firefox hang it (`a`, U+3000, U+202F,
space, `word` at 20px: `a`, U+3000 / U+202F, space / ...). Word joiners and U+FEFF
paint with no advance, and Chrome and Safari give them no letter spacing, so a run
of them never overflows there, while Pretext charges each a gap (ENGINE_FOLLOWUPS.md):
with letter spacing 1 at 1px, WJ, WJ keeps one line in the browsers, and Pretext
splits it.

Chromium breaks between a fullwidth closing bracket such as `」` or `）` (UAX #14
CL) and a following ideograph. Blink's scan takes the quote rules from ICU:
UAX #14 LB19a allows a break after a quote between East Asian
characters (`文”|文`), though not after `.”` before Hangul. Chromium's ICU rules for
Chinese pages treat `”` as CL and break there too (`다.”|라|고`).

Under `word-break: keep-all`, Blink keeps a pair only when both sides are letters
or numbers by general category and neither is SA. It tests UTF-16 code units and
looks past one combining mark before the boundary, so it never keeps a symbol or a
supplementary character, and it leaves every other pair to ICU's ordinary rules.
So a letter that cannot start a line, such as `々`, `ゝ`, `〼`, `〵` or `ー`, does not
end a run in the Chromium profile, while punctuation such as `」`, `・` or `゛` does.
Gecko's ICU4X keeps pairs by line-break class instead (AI, AL, ID, NU, HY, the
Hangul classes and CJ), where a mark takes its base's class. It keeps `ー`, symbols
such as `★`, supplementary ideographs and, after an ideograph, `〵` or an
ideographic variation selector, but breaks after NS letters such as `々` or `〼`,
and after `〵` following a closing bracket. Safari 27's keep-all breaks at spaces
and, in text holding a code unit above U+00FF, after opening, closing and other
punctuation that isn't the text's last character, but not after letters or dashes;
Safari 26.5.2's broke only at spaces. Chrome, Safari and Firefox take these rules
from their scans.

Where the engine doesn't keep a pair under keep-all, its ordinary rules decide, and
older rules keep more. ICU4X's Unicode 15.0 rules keep any character after a Hebrew
letter and HY or BA (LB21a), so Firefox keeps `א|文` in one run, where ICU 78 keeps
a following character other than CB or a Hebrew letter only after HY or HH, so
Chrome ends the run after `א|`. ICU4X still breaks between an ideograph and a Hebrew
letter, since it keeps only pairs of AI, AL, ID, NU, HY, Hangul and CJ classes. So
`文א|文` ends a run before `א` in Firefox and after `|` in Chrome.

ICU 77 and 78 break before an opening quotation mark and after a closing one between
East Asian characters (LB19a). Gecko's ICU4X rules follow Unicode 15.0 and keep both.
Under keep-all,
Blink's scan breaks there too, so `文|“漢字”|文` ends both runs. Chrome restarts its ICU context
at each line start, so when an emergency break lands just before a closing quote,
Chrome no longer sees the East Asian character before the quote and keeps the quote
with the next ideograph, while Pretext breaks after it. That loses 16 installed
Chrome 153 rows, 8 per direction: `signed-spacing/keep-all/curly-double-close` and
`curly-single-close` at letter spacing 1.5, where Chrome gives `中文中文|”漢字kan|a`
and Pretext `中文中文|”|漢字kan|a`.

Headless Chromium 147, which most headless keep-all evidence comes from, runs ICU
77.1 with Unicode 16 data, while installed Chrome 153 runs ICU 78.2 with Unicode 17
data, as the scans' tables do. The headless build cannot check the HH,
LB21a and LB20a differences described above. The two versions' LB19a rules are
identical, so the quotation mark evidence carries over.

WebKit's pair scan never breaks before a basic combining mark. It reports the
break between ZWSP and that mark (LB8) only from an ICU lookup that started
before the ZWSP. Every text node starts its own scan without prior context, so a
ZWSP at the start of a node, or after LF, CR, FF or another mandatory break, keeps
the mark, while a leading SPACE or TAB is context. This holds per node, not per
paragraph: a rich inline item that begins with ZWSP and a mark keeps it too.
`prepareRichInline()` prepares each item's own text, so a collapsed leading SPACE
still reaches analysis and fragment cursors index `prepareWithSegments(item.text)`.
Safari keeps the mark after a raw CR as well; the separate line that CR can take
in pre-wrap is the raw CR limitation below. Firefox keeps ZWSP with any following
cluster extender in every position, because shaped words end at ZWSP and a
word-initial extender is not a cluster start, and Gecko's scan gives no break there,
so the ZWSP becomes zero-width glue. Folding it into the word instead lost native
successes, because Firefox also applies letter spacing and emergency breaks per
cluster.

The CSS segment break transformation differs per engine. In normal white space,
Blink and Gecko remove a collapsible run containing a newline when a ZWSP
immediately precedes or follows the run; WebKit turns the run into a space like
any other. A word joiner between the newline and the ZWSP keeps the space.
Each engine checks adjacency on its own collapsible run. Blink's run is SPACE,
TAB, LF and CR, so a form feed between the newline and the ZWSP keeps the space.
Gecko's run is SPACE, TAB and LF: a carriage return breaks adjacency, the run
continues through soft hyphens and bidi controls without ending on one, and a
last space before a combining mark stays outside the run and survives. Deciding
adjacency on Pretext's own collapse set instead lost headless Chromium widths on
form-feed shapes and predicted Firefox losses on CR, SHY and combining-mark
shapes. Blink
checks the previous character across element boundaries, while Gecko sees one
text node at a time, so the rich-inline helper applies the rule only inside an
item. Blink compiles out its East Asian width rule. Gecko also removes a newline
between two full-, half- or wide-width non-Hangul characters, skipping default
ignorables, and, for `ja` or `zh` content, next to such punctuation
(nsTextFrameUtils.cpp:84-209, nsUnicharUtils.cpp:500-527). The Gecko profile
removes those runs too, before its scan, reading the page language for the `ja`
or `zh` test; Firefox reads the element's own language, and on a page without one
the OS's regional locale, which Pretext can't see. The ja/zh corpora contain such
newlines: their raw paragraphs in the book survey lost 1 to 7 lines to spaces
Firefox doesn't draw. The wrapping harness's documented form follows the same rule
for Firefox, with the paragraph's own language; before it did, the Firefox ja/zh
corpus rows were observed from text that kept a space there, and that text wrapped
differently from the raw source at 106 of their 244 widths. The form now wraps
like the raw source at all 244, down to the line of every visible character.

NEL (U+0085) is UAX #14 class NL: a break follows it, and no ordinary break
precedes it (LB5, LB6). Chrome and Safari break that way, and so do Firefox's
ICU4X rules and the scans. Each NEL is its own segment. When one overflows,
the line returns to its last break, as it does before any segment the scan gives
no break before, so the content NEL follows moves to the next line with the NEL;
when that content started the line, overflow still breaks right before the NEL,
as browsers do. Joining NEL to the content before it instead split overlong words
at Canvas grapheme widths where browsers break before the NEL. A ZWSP or soft
hyphen right before NEL is zero-width glue, with no break of its own. Merging NEL
with the text on both sides gave a following combining mark a 12px advance in
16px Arial through Canvas prefix widths across NEL, so the mark took its own line.

Safari's simple text path replaces a control character's advance after applying
letter spacing, so NEL takes none, at either sign. In Safari 26.5.2 `a<NEL><NEL>b`
grows by 2px per pixel of spacing from -1px to 1px, a line holding only NEL
keeps its width, and `<NEL><NEL>` fits 24px at 1px and 2px. Per-character Range
rects split those 24px as 13 and 11 at 1px and as 14 and 10 at 2px, so only the
total is an advance.
Pretext still places the gap of the grapheme before a NEL and adds none after
it. Safari's complex path spaces NEL like other characters. A combining mark
directly after NEL puts NEL on that path on either page direction. Text before
NEL shares its item only when its direction matches the page's: Arabic on a
right-to-left page, Devanagari, Thai or a marked letter on a left-to-right one.
Preparation cannot see the page direction, so a NEL next to text in WebKit's
complex ranges keeps its spacing. Safari's unspaced NEL after Arabic on a
left-to-right page, or after Devanagari on a right-to-left page, is not modeled.

Safari moves a `pre-wrap` tab to the following stop when less than half a space
would remain before the next one. Stops are eight spaces apart. The spaced NEL hid
that: in `ab<NEL>\tcd ef` at 2px in 16px Arial, the pen stands 1.77px before the
first stop with NEL unspaced, and Safari's tab reaches the second stop. Headless
WebKit 26.4 jumps 1.77px before a stop but not 2.28px before one. Replaying
Safari 26.5.2's suite rows with this threshold fixes 70 left-to-right and 8
right-to-left tab rows. WebKit trunk's threshold, half the advance of `0`, loses
10 and 6 more rows. Headless probes lose a few widths to one overflowing tab
at negative spacing, such as `ab cd\tef gh\tij` at -1px in 16px Arial: Safari
moves the tab to the second stop and hangs it, and Pretext breaks before it. Only
the Safari profile models the threshold.

In pre-wrap, a run of preserved spaces and tabs at the end of a line hangs (CSS
Text 3 §4.1.2, §8.2): it takes no room when fitting and doesn't count in the
line's width. Before a hard break or the end of the text, only the part past the
available width hangs. Fitting and the reported width have to use the same width,
the one before the run with the gap after the glyph before it, or a text laid out
again at its widest line wraps differently. While the walker counted the space
before fitting the tab after it, `foo \t bar` laid out again at its 28.8px widest
line gave `foo ` / `\t` / ` ` / `bar`. Subtracting the last space's width in the
Markdown chat (#267) couldn't cover tabs, whose advance depends on the pen
position, runs of several segments or letter spacing (#294). Firefox doesn't hang
tabs: hanging them in every profile lost 332 left-to-right and 100 right-to-left
installed Firefox rows where main matched, such as `abc\tdef` at 20px in 16px Arial
with letter spacing −2, which Firefox paints as `abc` / `\t` / `def`. The Gecko
profile keeps main's tab rule, so a tab counts in the fit and the width there.

U+3000 hangs at a line end in Chrome and Firefox, as a space does, and not in
Safari. Blink counts it as a breakable space (`IsBreakableSpace`), so a run of
U+3000 and the spaces after it hang together; Gecko marks it as a space glyph and
fits a line without its trailing space glyphs. The Chromium and Gecko profiles
hang a U+3000 run that ends a text segment before a break, a hard break, the end
of the text or a collapsible space. `中文`, U+3000, `中文` at 33px in 16px
PingFang SC takes 2 lines in installed Chrome 153 and Firefox 156 and 3 in
Safari 27's WebKit; `日本語`, U+3000, `日本語`, U+3000, `日本語` at 60px in 16px Hiragino Sans takes
3 lines in Firefox, where the profile took 4 before it hung the run. Hanging it in
the Gecko profile fixed 214 left-to-right and 198 right-to-left line counts in the
installed Firefox gate and lost none.

Chrome and Firefox keep NEL as ordinary text. In Chrome the same rule lost rows
that main matched only because two errors cancelled: Chrome joins Arabic across
a soft hyphen that Pretext measures as separate segments, hangs preserved spaces
at emergency widths, and gives a word joiner no letter spacing, while Pretext
spaces it. That last gap also costs Safari `aa<NEL>\u2060bb` at 1px, where main
kept the joiner on the NEL's line. Release Firefox also breaks after NEL, but
draws control characters with no advance while its Canvas measures NEL as a
space. In the September 16 installed rows, every C0 and C1 control, DEL, U+2028 and
U+2029 that Firefox painted without letter spacing had a zero-width rect (15,428
code points in the left-to-right rows), and with letter spacing about half took the gap, where its
Canvas gives VT, FS-US, NEL and U+2029 a space and other controls a hexbox. The Gecko
profile gives them no advance and one letter-spacing gap. Chrome's page gives most of
them an advance (NEL 16px and other C1 controls 16px in 16px fonts, VT and FS-US about
5.3px, U+2028 and U+2029 about 4.4-5.5px, some C0 controls 0), and so does Safari's
(about 6-13px), except U+2028, U+2029 and some C0 controls, so those profiles keep
their Canvas widths.

The shared complex walker fixed batch/streaming disagreement after a soft hyphen
([#222](https://github.com/chenglou/pretext/pull/222)). A later usable break could
win in one path while another rewound to the hyphen. This needed one decision
algorithm, not more width measurements.

Do not assume every remaining walker can be collapsed the same way. The simple
walker kept a SPACE or ZWSP after forced overflow on the overflowing line, while
the complex walker moved it to the next one, so a soft hyphen anywhere in the text
changed public cursors. The complex walker now keeps it too, and every walker lays
out a negative width as 0, where the two also disagreed. Routing simple handles
through the complex walker still made `layout()` about twice as slow on
simple-path documents in a Node microbenchmark. Reusing batch traversal for
statistics preserved output but made long-form statistics materially slower.
The simple batch walker was later folded into the simple streaming stepper: batch
walks, statistics and `layout()` loop the stepper, which predicts the same lines.

A selected discretionary hyphen must fit. Chromium retries a text item whose
hyphen does not fit against the available width minus the hyphen, WebKit reverts
to the last wrap opportunity where the hyphen fits, and Gecko records a
soft-hyphen break only when its text plus the hyphen fits. Installed Chrome 153,
Safari 26.5.2 and Firefox 155 all end `ab cd\u00adefgh` (Arial 16) at the space
from 39.25px to 44.25px. In Blink the walker returns to the latest earlier
opportunity whose line leaves room for the hyphen. The target is updated whenever
a later opportunity replaces the pending one, so an earlier soft hyphen can win:
installed Chrome ends `a b\u00adc\u200bi\u00adjki` (Arial 16) at the first soft
hyphen from 34px to 35.5px, where the zero-width space leaves no room for the
hyphen. Blink's retry stays inside one text item and rewinds earlier items at the
full width. The prepared handle has no Blink item boundaries, so the reduced width
applies to every earlier opportunity, which can miss a return to an earlier item.
Chromium also paints the hyphen without letter spacing; WebKit and Gecko space it.

Returning needs an overflow that isolated widths can show, and a target that is
really the latest opportunity. Blink shapes the text on both sides of a soft
hyphen together, so Arabic letters joined across it, a mark after it and a kerning
pair around it measure narrower in context. When Canvas measures the neighbors of
the soft hyphens on the line narrower joined than apart by at least the overflow,
the overflowing hyphen stays; a smaller narrowing can't make the line fit, as in
`schiff­fahrts`, 0.29px narrower joined in 16px Arial, on a line 4.2px too wide.
Contextual widths during preparation would replace that check. Segment
kinds do not mark every opportunity: a break before text, such as after `-` in
`ab-cd` or between ideographs, has none. The walker never returns past one.
Returning past such breaks lost 142
installed Chrome rows on compounds such as `x ab-cd\u00adefgh` and
`a well-known\u00adness`.

The return is enabled in Blink and Gecko. Gecko returns at the full width, to any
earlier break whose line fits, including one between two text segments: Firefox
paints VT, `a`, U+00AD, `b` in pre-wrap 16px Arial at 13.28px as VT / `a-` / `b`.
Where its line breaker also breaks after the soft hyphen, as between an ideograph
and a Latin letter, `BreakAndMeasureText` takes the normal break: it fits no hyphen
and paints none (gfxTextRun.cpp:1053-1063). Firefox ends `漢字\u00ADabc`,
`ab字\u00ADabc`, `かな\u00ADabc` and `漢字\u00AD漢字` after the soft hyphen at the width
of the text before it, in CJK and fallback fonts alike, but returns to the space in
`ab cd\u00ADef`. The Gecko scan marks those breaks, and analysis makes the soft hyphen
a zero-width break. That fixed 16 left-to-right and 15 right-to-left line counts in
the installed Firefox gate and lost none. A soft hyphen right after a space or tab is
such a break too: Firefox 156 paints `ab ` / `cd` for `ab \u00ADcd` at 30px in 16px
Arial, with no hyphen. Only after a preserved newline does it stay a soft hyphen, as a
zero-width break starting a chunk would hold a line of its own.
Isolated widths cannot show what WebKit needs: letter
spacing on U+2060, which WebKit and Gecko do not apply, and combining marks after a
soft hyphen, where Safari breaks between the soft hyphen and the mark and Firefox
paints the hyphen. WebKit keeps the overflowing hyphen until those are
modeled. Firefox's losses have those partners: in an offline replay of the Firefox
gate's rows the return fixed 60 line counts per direction and lost 5 left-to-right
rows, `a` then sixteen U+00AD U+2060 pairs and a mark, and marks after soft hyphens,
at letter spacing 1. Chrome's remaining losses have the same partners. Chrome gives U+2060 no
letter spacing, so `a\u2060b cd\u00adefgh` at letter spacing 1 and 2 still fits
its hyphen line, and it kerns across the space in
`LTA To AV\u00adWAVA`. Chromium breaks after a combining mark that
follows a soft hyphen and paints no hyphen, and a soft hyphen between word joiners
is no opportunity.

Without a fitting opportunity Safari overflows with the hyphen, while Chrome and
Firefox break inside the word. Chromium re-breaks the line at grapheme boundaries
and again retries an unfit hyphen against the reduced width. Gecko keeps cluster
breaks that fit, never between a letter and its soft hyphen (installed Firefox
ends `abc\u00addef\u00adghi` at 26px as `ab` / `c-` / `de` / `f-ghi`), and
otherwise its first candidate. Prototypes of both rules lost hundreds of existing
successes in a headless replay: marks and joiners next to soft hyphens,
letter-spaced invisibles, Arabic contextual widths, and hyphen fits within
Chromium's 1/64px rounding. The overflowing line remains.

A source-coordinate prototype showed that internal storage can change without
changing public output, but only if measurement-local grapheme boundaries survive.
Segmenting the complete source into graphemes is not automatically an equivalent
partition. A word may span stored SHY/mark pieces; entering a later segment is not
the same as starting an untouched word. Finer source positions need not mean more
Canvas calls; they also do not create shaping information we never measured.
The extra compiler/adapter remains experimental and has not earned its production
cost.

Safari's emergency breaks can land inside a grapheme. WebKit steps through an
overflowing word by code point on its simple font path and by ICU cluster on its
complex path, so in a narrow box Safari can end a line partway through a
multi-code-point grapheme. Pretext keeps every public cursor on a grapheme
boundary and moves the whole grapheme instead. That mismatch is accepted: the API
promises grapheme boundaries, and the affected lines only occur where a word
doesn't fit its box.

## Widths After A Line Break

A ZWSP at a paragraph or hard-break start is real source. It establishes a line
and offers a break after it, without owning a letter-spacing gap.
Chrome and Firefox shape an Arabic letter before a selected SHY in context, so
ZWSP, beh, SHY and beh fits in boxes where Pretext's isolated letter width does
not. A raw CR before ZWSP in pre-wrap occupies one native line, while
normalization turns that CR into a hard break. Amiri ZWSP, beh, SHY, beh and
ZWSP, U+A65C, SHY, U+A65C prepare identical widths but need different native line
counts, so no rule inside `layout()` can repair the Arabic case; it needs
contextual widths during preparation. An Arabic-letter guard across SHY, deleting
raw CR and treating CR as a zero-width break each lost other native successes.

Pretext consumes a soft hyphen at a paragraph or hard-break start (Firefox drops
it too; Chrome and Safari keep it, ENGINE_FOLLOWUPS.md), but the hard break after
it ends a line in all three browsers: `a`, LF, soft hyphen, LF, `b` in pre-wrap
paints three lines in each, the second with nothing visible, as do two soft
hyphens there and two such chunks in a row. Pretext used to drop a chunk that a
line start consumed whole, its hard break included; the line start now takes a
hard break that ends a chunk holding nothing else as an empty line. The same goes
for collapsible spaces between two U+2028 or U+2029, which Safari takes as hard
breaks in normal white space too and gives an empty line. At the end of the text,
with no hard break after it, the soft hyphens Chrome and Safari keep still take a
line, where Firefox and Pretext give none (ENGINE_FOLLOWUPS.md).

Keep the original source through analysis:
normalization can erase distinctions needed here. Chrome's normal-mode FORM FEED
followed by ZWSP occupies two lines at width 1 but one at width 100, even though
normalization reduces both inputs to ZWSP. Pre-wrap currently normalizes raw CR
and LF to the same hard boundary, although their native line existence can differ.

An executed WebKit trace separates another source rule from width measurement.
With Amiri at 16px, a 14.75px-wide LTR pre-wrap paragraph containing ZWSP, Arabic beh,
SHY and beh produces four lines: empty, beh, hyphen, beh. After forcing the first
letter onto a line, WebKit leaves the SHY unconsumed. Pretext consumes it earlier.
WebKit already includes the possible hyphen in its candidate width before
overflow; it also considers the previous SHY when wrapping the following text.
Neither a width adjustment alone nor “add the marker after wrapping” describes
this path.

In the investigated WebKit path, SHY becomes discretionary only at the end of
the actual text item.
An internal SHY still occupies source but does not own a marker. The ordinary
endpoint depends on WebKit's boundary shortcuts, Unicode properties and locale;
keep-all uses a different boundary policy. Source occupancy and painted width
must remain separate. The derived policy passed independent ICU checks, but
integrating it still lost existing browser successes around resumed geometry.

Range geometry cannot establish SHY paint in keep-all: Arial 16 `a\u00adb` at
width 10 paints `a / b`, although the hidden SHY has a positive rectangle.

Chromium retains the complete RTL-shaped item across ZWSP and SHY. The same text
fits intact at 25px. At 14.75px it selects a cut after SHY, reshapes the selected
text range with the surrounding original source still available, then adds a
separately shaped U+2010 hyphen in the paragraph's LTR direction. The remaining
letter is reshaped at the next line's start. The selected glyphs differ from
the original whole-run glyphs. Do not treat isolated-letter widths or one RTL
text-and-marker measurement as equivalent observations. Keeping source positions,
measurement context and selected line geometry separate still matters.

These traces used source-built Chromium 152 and cached Playwright WebKit 2272.
They establish those builds' executed paths,
not an execution trace of the installed binaries or general engine equivalence.

Three quantities that look like “remaining width” need different treatment:

- The width used to decide whether the remaining word fits intact.
- The width assigned to a selected prefix when breaking inside that word.
- The width of the suffix measured afresh after the break.

Subtracting an original prefix from an original whole does not generally give
the freshly shaped suffix. Keeping the whole-word remainder can be useful without
making it the right amount to advance the next line's drawing position. Likewise,
fitting a whole word and reaching its end through an emergency-break search can
have different consequences for whether the line continues.

Negative letter spacing makes this distinction especially visible. With 16px
Arial and -8px spacing, the measured prefixes of `WWi` are about 7.10, 14.20 and
9.76px. The intact word can fit 12px even though an intermediate prefix cannot.
Do not assume prefix widths increase, or replace an ordered emergency search
with “choose the farthest prefix that fits.”

Fresh starts can change intrinsic shaping as well as added spacing. Safari's
Shantell Sans probes distinguish a suffix starting at a combining acute from one
starting at the preceding word joiner (WJ). Counting Unicode characters or
“spacing owners” cannot recover this. Zero width is a measured value, not proof
that source is absent; Unicode's default-ignorable classification is not a
spacing rule. Removing controls before measuring changes the experiment.

Desktop Chromium uses the fresh remainder for intact admission; desktop Gecko
keeps original-whole-minus-consumed-prefix admission while using the fresh widths
for emergency fitting and continuing advance. Preparation resolves this choice
into numeric geometry. A new
context for each preparation repeated expensive shaping that the existing
context could reuse, even after clearing Pretext's own caches. That improvement
does not remove the cost of shaping a new, unusually large cluster. Retaining
observations with the segment metrics still matters: repeating the calls and
interval work remained costly even when Canvas reused shaping.

Using emergency-prefix differences for every admission removed one mixed-width
failure but sacrificed other Chrome successes. Choosing by the existing prefix
measurement mode also failed: the opposing Chrome and Firefox cases both use
that mode. These are bounded engine policies, not a universal shaping boundary.
Replacing all widths with Canvas's letter-spaced measurements also regressed
ligatures. Keep the interpretation tied to the actual measurements being reused.

Earlier line breaks can matter too. In 24px Times New Roman, single-text-node
Safari probes forced `AVAVbc` through `AVAV`, `AV/A/V` and `A/V/A/V` using different
first-line indents. The same remaining `bc` had three different fit thresholds;
Chrome kept one. This supports history-sensitive fitting, without proving the
browser's internal algorithm. A follow-up `AVbcidefgh` probe rejected applying
the inferred history adjustment uniformly to every partial prefix.

The current copied source cursor cannot encode those different histories. Do
not hide extra continuation state in batch layout while reconstructing it
differently in the one-line API. Exact history-sensitive flow would need an
explicit contract. Useful improvements within the existing contract remain
possible; they still have to preserve main's results.

## Kerning At Line Edges

Segments are measured alone, so kerning with whatever sits beyond a segment is
missing. The engines keep different parts of it, and Canvas can show only some.

WebKit measures a text item together with a directly following U+0020 and
subtracts one unshaped space, so the item keeps its kerning with that space
whether the space continues the line or hangs. A ZWSP or SHY before the space
ends the same item. Safari's Canvas shapes the whole measured string, so
preparation reproduces this by measuring the segment with its space. In 18px
Times New Roman, `A`, ZWSP, space, `B` puts `A` on a 12px line at 12.006px,
although the isolated letter is 12.999px. After an emergency break inside an
item, WebKit gives the rest of the item the item's width minus the prefix,
without clamping. With WJ instead of ZWSP at widths 1 and 8, the rest is WJ and
the space at -0.993px on their own line, and Safari draws them 0.993px outside
the line's start edge. Pretext keeps that signed advance for line breaking but
reports the line's width as 0. Items are split where bidi levels change before
they are measured, and format characters between a word and the space resolve
with that space. On an RTL page, emoji, space, `A`, WJ, space, Hebrew therefore
paints the unkerned letter, while an LTR page kerns it.
Without the paragraph direction, preparation keeps the kerning across format
characters only when the word's last letter and the first letter after the
space have the same direction, with only spaces and format characters between,
so the characters between the two letters resolve to that direction (UAX #9
N1). LRM, RLM and ALM are strong characters, so they count as letters of their
direction, and a word that ends in one keeps its kerning. An ASCII digit after
the space keeps it too, since it resolves the space to the word's direction
either way (UAX #9 W7 and N1). Letters in the right-to-left blocks have bidi
class R or AL, and every other letter except modifier letters has class L, so no
bidi class table is needed. A generated table also kept the kerning before other
digits, after symbols and across neutral punctuation after the space. Under a
fake Canvas that kerns every glyph with a following space, the letter rule gives
the same segments, widths and lines as the table on all 239,063 Safari suite
inputs. In the installed gate, dropping the kerning across format characters
altogether lost 33 Safari rows (17 LTR, 16 RTL), each a Latin letter, WJ, one or
two spaces and a Latin letter, which both rules keep. A rule that took only
letters before the format characters and only spaces and a letter after them
passed those rows but lost the kerning that installed Safari keeps for `A`, LRM,
space, Hebrew, for `A`, WJ, space, WJ, `b` and for `A`, WJ, space, `1`. A
closed bracket pair takes the paragraph direction when it
contains text of that direction, so on an RTL page `A`, WJ, space, then a
parenthesized Latin letter and Hebrew letter paints the unkerned letter too. On
an RTL page headless WebKit also needs about a hyphen's width more to fit a word
that ends in SHY before a space, so preparation takes no kerning across SHY.
An explicit embedding, override or isolate also leaves the direction unknown,
but only in the space's own paragraph, since explicit levels end with their
paragraph (UAX #9 X8). Installed Safari lays out `AA`, WJ, space, `B`, newline,
U+202A, `x` in pre-wrap 16px Arial at 20.9px, between the word's kerned and
unkerned widths, in 3 lines; checking the whole text for controls predicted 4.
With letter spacing the same measurement also moves the space's gap onto the
item and clamps the item at zero. The per-grapheme gap model does not represent
that; applying only the kerning lost native successes where the fit at a
hanging preserved space ignores the word's trailing gap.

Preparation measures a segment followed by such a space together with the space
instead of alone, and takes the segment's width as that measurement minus a
space alone. Safari's prefix fit widths still measure a word alone where it
begins a longer word, and occurrences before other text measure it alone too. A zero-width break
before the space ends the item, which is then measured alone as well, and so is
a numeric run or a run above 96 graphemes, whose fit widths come from pairs.

Measuring only the end of a word with the space would be cheaper, but it is not
exact. A headless WebKit census covered 8.0 million (font, word) pairs from the
corpora, the Safari suite inputs and a targeted word list, in 194 installed and
fixture families. The final grapheme cluster, with any format characters after
it, gave a different kerning in 389 pairs. In 20px Waseem, `.` after Arabic
letters, and `...`, take nothing before a space, while `.` alone takes 2.470px.
In Noto Nastaliq Urdu, gaf or keheh after alef madda takes 0.183em, while either
letter alone takes nothing. In STIX Two Math, capitals such as `V`, `Y` and Greek
Upsilon kern with the space alone, but not after Cyrillic a, and Upsilon not
after Latin a; after Greek alpha or Hebrew alef they keep the kerning. The final
two clusters matched in every pair, but nothing bounds how far a font's
contextual lookups reach. Kerning with the space is also common: PT Sans, Didot,
Gill Sans, Avenir Next and 18px system-ui each kern more than 2,000 distinct
en-gatsby words, Chalkboard 1,394 and Waseem 827, and 20px system-ui kerns
Arabic, Devanagari and Hebrew words that end in `.` or `,`. Native element
geometry agreed with the whole-word Canvas kerning on 2,440 of 2,551 sampled
pairs. In the fixed-pitch fonts Fira Code and Monaspace Neon, WebKit's layout
takes none of the kerning that Canvas reports, which preparation does not model,
and in STIX Two Math a Latin capital after Cyrillic a keeps its own kerning
natively.

Chromium's layout shapes whole items and kerns across spaces, ZWSP, SHY and
same-font spans. In its default state Chromium's Canvas splits measured strings
at spaces, tabs and ZWSP and reports none of that kerning for Arial or Times New
Roman. With `textRendering = 'optimizeLegibility'`, or with
`fontKerning = 'normal'` for Arial, headless Chromium shapes the whole string
when the font's lookups involve the space glyph and reports the kerning sums
for both fonts, but those settings turn on features for every measurement.
Chromium also reshapes the start of a wrapped line. Legacy `kern` tables, which
HarfBuzz splits between both glyphs (Times New Roman, Helvetica Neue and
Verdana on macOS), change that adjustment, while OpenType pair kerning keeps
the adjustment on the first glyph (Arial). Canvas widths add both halves and
cannot tell the attributions apart.

Gecko shapes words without their spaces and splits them at ZWSP, WJ and other
invisible controls, so ordinary kerning never reaches a space. Its line breaker
adds the original advances of the shaped word. After an emergency break inside
`AV` in 18px Times New Roman, Firefox paints `V` at 11.833px: the letter keeps
half of the adjustment with `A`. That share depends on the same attribution.

## Reading Browser Output

DOM geometry is evidence to interpret, not an exact source-to-line map. Safari
can return a zero-width rectangle on the previous line before the real next-line
rectangle. Chrome can give a letter after SHY positive rectangles on both the
hyphen's line and its own. Neither “first rectangle” nor “first positive
rectangle” reliably assigns source. Range extents are not general glyph advances,
especially with kerning, signed spacing, bidi or invisible controls.

A diagnostic must establish its own setup. Floats intended to force a particular
break history sometimes moved the word below the floats instead. Verify the
actual preceding breaks before interpreting the suffix. Compare resolved CSS
widths, not only requested widths, and prefer clear threshold brackets. Firefox
box widths followed 1/60px rounding in a narrow sweep, but copying that rounding
into line fitting regressed unrelated cases: box resolution does not establish
the browser's text-fit rule.

A span around each character is no witness of WebKit's breaks. WebKit breaks
inside an inline box from that box's text and reads only the previous box's last
two characters at a boundary, so the spans move breaks the text node doesn't
have. Rechecked in Safari 27.0 on 1,336 of the harness's pre-wrap and URL-query
cases (September 25), a span per grapheme laid 157 of them out at another height
and gave 118 others another line start at the same height, mostly narrower than
24px and at `?`, `=`, tabs and soft hyphens. The harness's Range reading, one
code point at a time on the text node, is the one webkit-host's recordings and
the WebKit scan agree with there, so Safari 26's extractor caveat for pre-wrap
and URL queries was dropped with the span probes. Spans change Thai, Lao, Khmer
and Myanmar breaks in every browser too: read them with Range. And take source
offsets from prepared segments and grapheme cursors, never from
`line.text.length`, whose text can hold a hyphen the source doesn't.

One copy of the library can run slower than another copy of the same code for a
whole document. In the bench's calibration of HEAD against itself (September 26,
three sessions in each browser), Firefox's base copy took about twice as long as
the other two to lay out kept CJK handles at widths used before in one session,
and Safari's took 15-21% longer on keep-all brackets in two. The candidate and
the control moved together there, so the control's band covers such a document,
and a verdict needs every session, so one document can't carry one. The noise
floors therefore take the largest deviation either copy held in one direction in
all three sessions, 1-6% by row; floors taken from one copy made 0 and 1 false
calls in 141 entries on the other. The largest deviation in any session, 2-51% by
row, would have hidden four of the slowdowns the bench was checked against
(217c84b8 against 6d1d2106): pre-wrap layout and walk at 1.05 of base's time in
Chrome and 1.18-1.25 in Firefox, and letter-spaced CJK and control layouts at 1.12
and 1.20 in Safari. With the floors it calls every one of them slower in all three
browsers, and seen CJK faster.

## Rich Inline Boundaries

Rich items retain source identity even when they measure zero. Filtering them
through the flat walker's first visible line lost standalone zero-width spaces
(ZWSP); compressing the item array also made cursor and fragment indices disagree.
Preserving source is independent of calculating natural width. The fixes in
[#220](https://github.com/chenglou/pretext/pull/220) do not establish arbitrary
shaping across styled items or solve flat ZWSP wrapping inside an item.

A collapsed space's presence and advance are separate. Its style comes from the
first whitespace at the boundary, and a zero or negative advance still provides
a break opportunity. Fragments name that whitespace's item as `gapItemIndex`,
which is -1 only where no space precedes the fragment on its line. A painter
draws the space inside that item's element, as native layout does. Painting
every space in the paragraph's style moved the text after a code span's own
space by the difference between the two space widths (#295). Margins or spacer
boxes keep the width, but leave the space out of copied text, and margins put
mixed-direction lines out of order (#273). `measureText('A A') -
measureText('AA')` includes the change in A–A kerning, so it is not a clean
space measurement. Measure the space itself. After forced overflow, preserve the
negative remaining width; clamping it to zero gives a following negative gap
room it did not have.

A whole zero-width item fits at the end of an exactly filled line. Checking
whole-item fit before reserving the item's gap and extra width admitted it, but
lost nine Safari forced-overflow matches: a negative next item could undo forced
overflow. A broader guard on prior overflow lost 62 matches where item and style
boundaries differed. Reservation therefore stays first and rejects only a reserved
width greater than the remaining width plus the line walker's fit epsilon (`>`
rather than `>=`).

An item boundary is not a break opportunity by itself. Chrome runs one line-break
iterator over the text of the whole inline formatting context, and Gecko keeps
collecting a word across text frames until whitespace. `prepareRichInline()`
analyzes the text that items join between collapsible spaces, as `prepare()`
would, and an ordinary break falls only where a joined break unit starts. In the
Chromium and Gecko profiles every break fact near a boundary comes from that
joined analysis, not only the boundary itself. Splitting a word changes each
item's own segmentation: Thai `ความสวยง` splits into `ความ/สวย/ง` alone but
`ความ/สวยงาม` joined. The joined breaks therefore become facts of the item's
handle. Where an item's segment starts inside a joined word, the item lays out from
a copy of its handle whose flags follow the joined text at its segment starts, as
preparation marks a scan's boundaries without a break, so the walker returns to the
latest break or fills the word's graphemes. Joined breaks inside an item's segments
become graphemes the walker can end a line before. A ZWSP or soft hyphen takes, in
the copy, the kind of the last of the joined text's segments that start inside it,
which ends where it does, as the text around it decides the kind: at the item's start
its own analysis sees the start of a text, where Gecko's scan makes a soft hyphen
before a combining mark zero-width glue, and after an ideograph or emoji the joined
scan makes one a zero-width break; and the item's own analysis joins two soft hyphens
that Gecko's joined scan splits into a soft hyphen and a zero-width break, so a line
that ends after both paints no hyphen. Taking the kind of the joined segment that
starts where the item's does gave those two the first one's kind, so the line fitted
a hyphen Firefox doesn't draw: 14 Firefox probe cases that main passes, such as
items `文文`, `\u00AD\u00ADحبا` at 37px. The fragments' text follows the copy's kinds too, so a
fragment paints the hyphen its line's width counts; following the item's own handle,
as `materializeLineRange()` over it would, painted one where the width left it out,
as for items `中`, `\u0301\u00ADxy` in the Gecko profile, and none where Firefox
paints one. A zero-width break that only the joined text
gives at the item's start holds no line of its own there, as preparation keeps a
soft hyphen at a text's start one, while a ZWSP that starts an item keeps the line it
holds at the start of a text: taking every item start that continues a run as inside
a chunk, where a line start consumes a ZWSP too, lost 76 webkit-host, 3 Chrome and 2
Firefox probe cases. In the Gecko profile, a window that starts after collapsible
white space is analyzed after a space, which normalization drops and Gecko's scan
reads as context, as it reads an item's leading space: it breaks after a bidi control
such as U+202A that follows a space, and at the start of a text joins it to the
letter after it. Where content comes before that space, the analysis takes the
window's start as following content too: preparation keeps a soft hyphen whose scan
break after it is the space's as a soft hyphen only where nothing but soft hyphens
comes before it on its chunk, as a line start's, so without that a soft hyphen after
the space took a hyphen the paragraph's text doesn't, as in items `ab \u00AD\u200B`,
`cd` or `a`, `b\t \u00ADc`, `d`: 29 Firefox probe cases, 25 of which main fails too,
and 8 widths of the stand-in fuzz where main matched the flat walker.

An item's walk continues the line instead of starting one: the full walker takes
whether the line has content before the item, whether the line can end before it, at
a break before the item or an earlier one, whether a return from an unfit soft
hyphen can end it there, and the item's inner breaks. An item that starts a line on
a fast-path handle still takes the simple stepper (Keeping Work Bounded). Where the
next item continues its last run without a break, the item walks on the full
walker's copy of its handle, and the walk leaves the line's latest break where the
line takes the item's end. A ZWSP or soft hyphen that ends the item
becomes zero-width glue there, and the next item's start unbroken, as analysis marks
them before an unbroken start. A walk that can't take an item's start ends the line
at the line's latest break, which the rich stepper keeps across items, as the flat
walker returns to its last break, and at the item's start where no break comes
before the line's content (a run that began the line). That end before the item
holds in the WebKit profile too (below). A hard break inside an item ends its line
there, so an item holding one doesn't go on the line whole, and a collapsed space
before an item that starts with one leaves no gap, as it goes with the line's end:
items `xx` and `  \u2028  yy` at 18px in 16px Arial, where the space doesn't fit,
kept the separator off the first line and gave it a line of its own in webkit-host.

Before the flags, a list of the item's segment starts inside joined words had the
stepper walk each line that ended at one again, to the joined break, or once per
grapheme of the word that began the line. The flags with a correction only for a
split inside an item's first segment kept every case's lines, but not others: on
plain case texts split into same-font items at graphemes, at words or anywhere
(31,359 inputs in each of the Chromium and Gecko profiles, on the invariants'
stand-in Canvas), the list's lines matched the flat walker's at 114 and 93 widths
where those didn't. With corrections to the walk, lines matched the flat walker's at
427 and 364 widths where the list's didn't, and at every width where they did but
one, in the Gecko profile, where only an invisible ZWSP and mark after a newline
item move to the next line. The item's own unbroken starts count too, in every
profile: in the Gecko profile an item `\t\u200B\u0301ab` after `x` that doesn't
fit moves to the next line, and two Firefox rich cases the library broke one
character later than Firefox pass. Four Myanmar rich cases, which Firefox lays out
in fewer lines than the library, take one more line: the list's lines split
syllables where the joined text doesn't break, which packed them tighter
(ENGINE_FOLLOWUPS.md).

Those corrections walked each item as if it began the line, then walked it again to
an earlier end: to the latest joined break before a split word, to a joined break
after the walk's end, to the text before a soft hyphen whose hyphen overflowed the
line, and to the item's last break where the continuing items' width to their first
break, measured at preparation, didn't fit. The walk continuing the line replaces
all four and the walker's end limit, which existed only for them. On six seeds of the
same fuzz, 31,359 inputs in each profile at ten widths, rich lines then match the
flat walker's at 607 widths where the corrections' didn't in the Chromium profile
and for unknown engines, 918 in the Gecko profile and 981 in the WebKit profile, and
at every width where they did in the first two. Line text counts there, with the
hyphen each fragment paints. The widths only the corrections matched are 13 in the
Gecko profile and 117 in the WebKit profile. The 13 are an item ending in a ZWSP and a
segment break, which the item's own white-space processing removes, so the flat text
holds a space the items don't. 77 are a ZWSP
that ends an item before an item that starts with a combining mark, where the WebKit
profile's boundary rule gives no break and its scan of one text does, and 40 are a
U+2028 or U+2029 after an overflowing line at 1px, which ends up on a line of its
own, where the flat walker and the corrections kept it with the overflowing text.
Safari lays both out as rich-inline does: webkit-host passes all 224 probe cases
(below) of the first shape, of which the corrections failed 19, and all 79 at 1px
holding a separator, of which they failed 20. In a probe of 4,858 rich cases made
from the fuzz's shapes at 1-90px and recorded in all three browsers, Chrome passes 370
cases the corrections failed and fails 11 they passed, Firefox 511 and 4, and
webkit-host 1,308 and 11. Chrome's 11 and 4 of webkit-host's fail as the same text in
one text node does in that browser: a soft hyphen right after a space or ZWSP, or
whose hyphen doesn't fit a narrow line. The other 7 in webkit-host start an item with
a soft hyphen and a space after a collapsed space, and Firefox's 4 start an Arabic
item with a soft hyphen before a kasra, whose line doesn't fit its hyphen at the
items' separate widths (ENGINE_FOLLOWUPS.md). The corrections matched all 11 only
because they walked each item from a line start.

Chrome returns into an earlier span only to a break that leaves a pixel of it: where
a line overflows, Blink walks back over its items and breaks each text item again at
its width on the line less one pixel (`LineBreaker::HandleOverflow`, line_breaker.cc
at Chrome 152), else returns to an earlier break, else lays the line out again
breaking anywhere. The Chromium profile returns to the line's latest break, which a
controlled probe of 140 cases, spans beside the same text in one node, shows apart:
after U+2028 or a ZWSP that a soft hyphen or word joiner follows in its span, Chrome's
spans break anywhere where the text node breaks there, and after U+2028 that a
combining mark or ZWJ follows, they break as the text node does. Blink puts a break
inside a HarfBuzz cluster at its graphemes' share of the cluster's advance, and the
mark or ZWJ joins the separator's cluster, so half its width follows the break;
the soft hyphen and word joiner are clusters of their own. A return only to a break a
pixel before its item's end, falling back to the break before the item, fixed 35
cases of the September 27, 2026 probes that main and the tip fail, and lost 12 they
pass, 10 of them main's: four after U+2028 and a mark, where the cluster's share was
missing; three at 6px, where Blink's anywhere pass ends the line elsewhere, as before
a soft hyphen whose hyphen doesn't fit; one where a span ends at a ZWSP before a span
holding only a soft hyphen, a break the stepper didn't keep then (below); one where the return
from a line that starts inside the span went back before its start, a bug of the
attempt; and three widths of spans `😊\u00AD\u200B\u00AD`, `\u200Dمر\u00AD\u0651`,
where Chrome ends the line at the first span's end with a hyphen, which neither one
text node nor the walk does. It was held back (ENGINE_FOLLOWUPS.md).

An item that a line start consumes, one holding only soft hyphens and collapsible
white space, is no line content, but it takes part in the paragraph's runs and breaks:
where the next item continues its run with no break between, and a break comes before
it, the run starts at that break, which a line that can't take the next item's start
returns to, where the stepper passed over the item and returned to an earlier break or
the one before the item before it, whose trailing ZWSP it made zero-width glue. After
content, such an item keeps the collapsed space before it, as the flat text keeps a
space before a soft hyphen, which hangs where it doesn't fit, as the item takes no room
after it; ending the line before the item there lost 288 Firefox cases of the September
27, 2026 probe of 43,462 rich fuzz shapes, where Firefox keeps the space and the soft
hyphen on the line. An item that starts with source a line start consumes, as a soft
hyphen and a space, is walked where a line has content before it: its whole width,
measured from a line start, leaves the space out. Blink transforms segment breaks in
the text of the whole inline formatting context (`ShouldRemoveNewline` and
`RemoveTrailingCollapsibleNewlineIfNeeded`, inline_items_builder.cc), so in the
Chromium profile a collapsible run with a newline next to a ZWSP in the item before or
after goes, as in one text, where the item's own text kept it as a gap: items `ab\u200B`,
`\n\u00AD\nc`, `d` held two spaces where Chrome lays out one. Gecko transforms each text
frame's own text (`nsTextFrameUtils::TransformText`), so the Gecko profile keeps the
item's own transformation; taking the paragraph's there too lost 30 Firefox cases of
that probe and fixed 7. Against the round's start, on that probe and those of 22,771
and 4,858 shapes, the four fix 432, 111 and 7 Chrome cases and lose 10, 6 and 0, 367,
141 and 9 webkit-host cases against 11, 1 and 0, and 266, 83 and 7 Firefox cases
against 92, 4 and 1. Every one of those losses fails as its text in one node does, or
the browser lays the spans out otherwise than that node, but for 1 in Chrome, a soft
hyphen after a space in an item that continues a run (ENGINE_FOLLOWUPS.md), 1 in
webkit-host, where Safari measures Arabic joined across items, and 5 in Firefox, soft
hyphens next to white space, 3 of them where Firefox collapses white space across the
soft hyphen, which the Gecko profile keeps on both sides; 52 of Firefox's 59 losses
that fail as one node does are that collapse too, which the round's start passed by
leaving a space out. On the stand-in fuzz against the flat walker, rich
lines match it at 842, 644, 434 and 852 widths where the round start's don't in the
Chromium, Gecko, WebKit and unknown-engine profiles, and lose 15, 56, 60 and 13: at 1
to 7px, before a line separator the WebKit profile makes a hard break after the kept
space, and where Gecko's transformation of each item keeps what the flat text removes.

Where a line ends after an item that a line start consumes, after content, the
collapsed space before that item can end the line, and then it hangs, as white space
that ends a line does. Items `see`, ` \u00AD`, `this word` in 16px Arial end their
first line at 25.80px at 30-34.67px in Chrome, Safari and Firefox, the width of `see`:
the browsers break at the space and move the soft hyphen to the next line, where rich
lines that kept the space reported 30.24px. From 36px, where the hyphen fits, Chrome
and Safari end the line at the soft hyphen instead and paint its hyphen after the
space, 35.57px, which rich-inline leaves out, so the space stays in the width, as the
next item's `hyphenBefore` tells; hanging it there too, as the review's prototype did,
lost 118 Chrome and 120 webkit-host line widths of the September 27, 2026 probe of
32,830 rich fuzz shapes, on texts without newlines or tabs, which the fix keeps.
Firefox discards soft hyphens from a text frame's text (IsDiscardable), paints no
hyphen after white space, and keeps 25.80px there, and it hangs the space at the end of
the paragraph as well, where Chrome and Safari lay the soft hyphen out after the space
and give it a line of its own where it doesn't fit, Chrome where the space and the hyphen
don't and Safari where the space doesn't: items `see`, ` \u00AD` take 2 lines in Chrome
at 26-35.5px, and one from 35.57px, the width of `see`, the space and the hyphen, and in
Safari at 26-30px, and one 25.80px line in Firefox.
The harness records Chrome's line there as 25.80px, since it leaves out a U+0020 that
ends a line, and Chrome gives the soft hyphen after it no box, so hanging the space at
the end of the paragraph in the Chromium profile matched Chrome's recorded widths at 460
more lines of the probe of 43,462 shapes, though Chrome moves the soft hyphen to a line of
its own where the space and its hyphen don't fit; in the WebKit profile it lost 104
webkit-host lines. Safari also keeps the soft hyphen,
and the space before it, on a line that ends at white space after it: items `see`,
` \u00AD `, `this word` at 45px end their first line at 30.24px in Safari and at 25.80px
in Chrome and Firefox. Keeping the space there fixed 335 webkit-host line widths of the
probe of 32,830 shapes and lost 136, and in the Chromium profile fixed 73 Chrome ones and
lost 159. The profiles name the three (`spaceBeforeSoftHyphenHangs`). Against the rich
lines that always kept the space (447a5bf9), on cases that main, the round start and both
builds lay out right, on texts without newlines or tabs, line widths move toward the
browser's and away at 97 and 7 Chrome lines of that probe, 492 and 32 Firefox and 59 and 2
webkit-host, at 43 and 9, 1,104 and 17, and 37 and 0 of the probe of 43,462 shapes, and at
14 and 0, 108 and 6, and 18 and 0 of those of 22,771 and 4,858. With newlines, Firefox
records more away, 552 of that first probe, since Firefox gives a space that a newline
collapses to a box as it hangs past the line, which the harness doesn't leave out, as it
leaves out only U+0020: items `ab`, `\n\u00AD`, `cd` at 22px record 22.25px in Firefox.
Firefox's remaining losses without newlines are items that mix soft hyphens and white
space, where it collapses white space across the soft hyphens (ENGINE_FOLLOWUPS.md).

An item that a line start consumes can hold white space between its soft hyphens, as
` \u00AD \u00AD`. That white space follows a soft hyphen rather than the collapsed space
before the item, so Chrome and Safari give it room after content, as in one text node,
and a line can end after it: items `ab`, ` \u00AD \u00AD`, `cd` in 16px Arial take 2
lines in both at 40-43px, where rich lines that left it out, as a line start consumes
it, took one 39.14px line. Such an item is walked where the line has content before it,
as one that starts with a soft hyphen and a space is. Firefox drops soft hyphens and
bidi controls before it collapses white space, and collapses a run of white space with
those characters after it as one, which it carries from one text frame to the next
(`nsTextFrameUtils::TransformText`, nsTextFrameUtils.cpp:286-386, with
INCOMING_WHITESPACE), so there that white space collapses with the space before, and
Firefox lays those items out in one 39.15px line. The Gecko profile follows that run
across items (`collapsesSpaceAcrossSoftHyphens`, `whitespaceRunOpen`): white space that
starts an item collapses into a run the item before leaves open past such characters,
whichever item holds it, so Firefox fits `see this` of items `see`, ` \u00AD`,
` this word` in 16px Arial on a 55.15px line at 56-59px, where rich lines counted a space
from each item and took 3 lines. White space and soft hyphens after an item's leading
white space are part of that run, inside the item or after it, so such an item isn't
walked in the Gecko profile, and what a line start consumes at its start takes no room
after content either. A soft hyphen or bidi control that starts an item ends the run, as
TransformText ends it for one that follows no white space in its frame, and an atomic
inline ends it too (`BuildTextRunsScanner::ScanFrame`): Firefox takes 3 lines for items
`see `, `\u00AD `, `this word` at 56-59px, and 2 from 60px with a 59.60px first line, two
spaces wide, where their text in one node fits `see this` at 56px, and an item that starts
with a soft hyphen is walked there, as in Chrome and Safari. On the second September 27,
2026 review probe, 80,512 rich cases of 5,700 fuzz inputs with their one-node twins, that
fixes 6,220 Firefox cases against 0fef0023 and loses 220, and no Chrome or webkit-host
case moves. Walking an item that starts with a soft hyphen accounts for 1,402 of the fixes
and 134 of the losses; walking every such item lost 421 Firefox cases of the first
September 27, 2026 review probe, of 28,435 rich fuzz shapes, and fixed 30. Of the 220, 187 Firefox lays out otherwise as spans
than as one text node; 112 hold white space, soft hyphens and white space again inside an
item past its leading white space, which the Gecko profile's analysis keeps a space of on
each side of each soft hyphen, where Firefox collapses them into one, as items that start
with a soft hyphen are now walked, and in 96 the line ends at a soft hyphen that ends an
item, whose hyphen rich-inline leaves out (ENGINE_FOLLOWUPS.md), where the space 0fef0023
counted ended the line where Firefox does. Where a line ends after such an item,
its white space hangs with the space before it, but WebKit keeps the first soft hyphen,
and the space before it, on a line that ends at the white space after it (above), so only
the item's white space hangs there: that moved 60 webkit-host line widths of that probe
toward Safari's and 8 away against hanging both, on texts without newlines or tabs,
where hanging only a line's last white space, in every item a line start consumes,
moved 44 toward and 25 away. Against c09d264b on that probe, walking the item fixes 265
Chrome and 288 webkit-host cases and loses 21 and 25. All but one of those losses fail
as their text in one node does, or the browser lays the spans out otherwise than that
node: in 16 Chrome and 21 webkit-host cases the browser keeps the white space after the
first soft hyphen where the next line starts (ENGINE_FOLLOWUPS.md), which the flat
walker consumes, and which rich lines passed by putting the whole item on the next
line. The one that fails as spans only returns from an unfit hyphen to the break before
a run, whose hyphen doesn't fit either, where Chrome returns further
(ENGINE_FOLLOWUPS.md). Letting an item that starts with a hard break end the line
wherever it falls, however little room the line has left, as a hard break in one text
does, lost 159 webkit-host cases of the probe, where Safari gives the separator a line of
its own after white space that hangs.

Firefox's bidi resolution splits text frames where the embedding level changes, and a
text run doesn't go on across that split (`ContinueTextRunAcrossFrames`,
nsTextFrame.cpp:2023-2030), so a character Firefox drops after white space, at another
level than that white space, starts a text run, where TransformText meets it after no
white space and ends the run: items `see \u200F`, ` this` in 16px Arial take 2 lines in
Firefox at 56-59px, as spans and as one node, where fd8002ba carried the run past U+200F
and fit one 55.15px line. U+061C ends it too, while U+202B and U+2067 take the level of
the space before them, as U+200F does between Hebrew letters, and there Firefox keeps the
run. The Gecko profile carries the run past such characters at an item's end only where
the paragraph's levels give them the white space's level (`getGeckoParagraphLevels`, the
Gecko scan's port of Firefox's levels), made only for text with right-to-left characters,
as Firefox resolves levels only there, and only once a run would go on past such
characters, so other rich text pays nothing for them. Since the Gecko profile's analysis
reads white space through bidi controls alone as one run, whatever their levels, and
leaves out white space before only controls at the end of a text (Break Opportunities
From Engine Data), the item `see \u200F` is `see` and the mark, its space is the gap
before the next item, and the next item's white space collapses into that gap: rich lines
fit one 55.15px line at 56-59px there, as the one node's do, where Firefox's two spaces
don't fit (ENGINE_FOLLOWUPS.md). A gap is one space in one item's font, so it can't hold
both. The rule reads the item's segments where a soft hyphen among the characters the run
goes past keeps the white space before them, and so do bidi controls after the trailing
white space of a run that goes on, or after an item's leading white space: Firefox's first
line of items `see \u200F\u00AD`, ` this more` at 60px is 59.60px, two spaces wide, which
rich lines give too. An atomic item's own leading white
space sits inside its inline-block, which trims it, so it collapses into an open run too:
Firefox's first line of items `see \u00AD`, atomic ` chip`, ` this word` at 60px is `see `
and `chip`, 59.60px, where fd8002ba counted a space more. On the third September 27, 2026
review probe, 59,415 rich cases of 3,349 fuzz inputs with their one-node twins, the two
fix 183 Firefox cases against fd8002ba and lose 90, and move no Chrome or webkit-host
case; of the 90, Firefox lays out 37 otherwise as spans than as one node, 46 fail as their
one node does and 7 as spans only, where fd8002ba's collapsed space kept a bidi control
Firefox drops off a line of its own (ENGINE_FOLLOWUPS.md), and main passes 5 of them. The
review's diagnostic of the level rule alone fixed 153 and lost 91, and dropping the
atomic item's exception alone fixed 35 and lost none. No case of the second probe, of
80,512, moves.

An atomic item's own white space, leading or trailing, makes no gap anywhere, as every
browser lays an inline-block's text out as a paragraph of its own, whose lines drop white
space at their start and end, and puts the box in the outer line as one object: Blink as
one U+FFFC (`AppendAtomicInline`), removing its own paragraph's leading spaces and, in
`ExitBlock`, its trailing ones (inline_items_builder.cc:869-871, 1622-1629); WebKit as one
atomic inline box item, whose own lines collapse leading white space (`Line::appendText`,
InlineLine.cpp:348-373) and remove trailing (InlineLineBuilder.cpp:646); Gecko by ending
the text run at the box (`BuildTextRunsScanner::ScanFrame`), whose own lines skip leading
white space (nsTextFrame.cpp:10935-10944) and trim trailing (nsBlockFrame.cpp:5844).
Items `see`, atomic ` chip`, `this` in 16px Arial at 60px take a 55.15px first line in all
three browsers, where a gap made it 59.60px. On the three September 27, 2026 review probes
that fixes 1,845 Chrome, 818 Firefox and 1,884 webkit-host cases against giving it a gap
and loses 76, 81 and 101. Of those, the browser lays out 11, 24 and 16 otherwise as spans
than as one node, 63, 53 and 85 fail as their one node does, and 2, 4 and none fail as
spans only; 241 of the 258 hold a soft hyphen or bidi control next to the atomic item's
white space, where the gap made up for white space the library gets wrong there. In Firefox,
items `42 \u200F`, ` \u00AD `, ` Wi-Fi see`, atomic ` ok`, U+200F, `über שלום \u202D` at
140px take a 111.15px first line of `42`, two spaces, `Wi-Fi see` and `ok`, as the mark
is at another level than the white space after it (above), where rich lines count one
space there and, with no gap before `ok`, fit `über` too. In the rich set it fixes 12
Chrome and 12 webkit-host cases and loses 5 webkit-host ones 1/64px from where Safari's
lines change, where Safari's line is 0.008-0.016px wider than the library's.

In the Gecko profile a soft hyphen after collapsible white space is a zero-width break,
which Firefox drops from its text (`IsDiscardable`, nsTextFrameUtils.cpp:32-49), so it
holds no line: a rich line start consumes it wherever it reaches it, as the flat walker
consumes a zero-width break inside a chunk. An item that starts with white space and
soft hyphens, as ` \u00AD \u00ADx`, took a line of its own, holding nothing visible,
where the word after them didn't fit: items `\u05E9\u05DC\u05D5\u05DD `,
`\u05E9\u05DC\u05D5\u05DD`, ` a`, ` \u00AD \u00ADx`, U+00A0, `nation\u00ADal ation\u00AD`
at 49px in 16px Arial take 5 lines in Firefox and took 6. A line start reaches such a
break only at a chunk's start, where normalization holds a zero-width break, and the
chunk's start goes on after it, which the rich line start steps past itself
(`normalizeItemLineStart`). The Gecko analysis makes one only of the last soft hyphen of
white space and soft hyphens, before other source, so the step reaches no space or soft
hyphen: skipping those after it too, as fd8002ba did, changed nothing in `bun test`,
`equal --offline`, 40,000 Gecko fuzz inputs or the third September 27, 2026 review probe's
59,415 rich cases in the three browsers, and cost six lines. Giving
`normalizePreparedLineStart()`, which the flat walkers share, the chunk's start as a
parameter read Firefox's lines mixed stream
2.2% and 2.4% slower against 0fef0023 in a 2-session bench. 0fef0023 normalized again from
the next segment, which is no chunk's start, and so consumed a ZWSP that holds the line
there, as for items ` \u00AD \u00AD\u200B`, `textword`, which take an empty first line in
Firefox at 20-60px, as spans and as one node, and which 0fef0023 laid out without it; its
message's 35 fixed cases and none lost counted only the first review probe, and the
second one's diagnostic of the rule fixed 431 Firefox cases of it and lost 21. A soft
hyphen that the joined text makes such a break at an item's start goes on past it the same
way, where a line start consumed a ZWSP after the zero-width break that only the joined
text gives there: items ` \u00AD`, ` \u00AD\u200B`, `textword` take an empty first line in
Firefox at 16-60px. Taking an item's start as a text's start only at its first segment
instead, so that a line start consumes any zero-width break after a soft hyphen there,
lost a ZWSP's line in all three browsers: items `ab `, `\u00AD\u200Bxyzwxyz` at 20px take
an empty second line in Chrome, Firefox and Safari, as their text in one node does, where
the flat walker consumes the ZWSP (ENGINE_FOLLOWUPS.md). The line start tells the two
apart by the segment's first code unit, which it reads only where it reaches a zero-width
break. Firefox also keeps white space after a soft hyphen that starts a paragraph, as its
line start trims only white space (ENGINE_FOLLOWUPS.md): items `\u00AD \u00ADab`, `hyphen`
take an empty first line in Firefox at 6-22px, as spans and as one node, which c09d264b
gave them through the second soft hyphen, holding a line at it as the flat walker does,
and which the line start no longer holds there.

A line ends before an item whose reserved width, the gap and extra width before it,
doesn't fit, even where the item reserves none after a line that already overflows, but
for an item a line start consumes: its soft hyphen follows the line's content, and the walk
ends the line after it, as in one text. Firefox ends the third line of items `see`,
`\u00AD \u00AD`, `this word` in 16px Arial at 1px after `e` and the first soft hyphen's
hyphen, 14.23px wide, where rich lines ended it before the item. That fixes 415 Firefox
cases of the second review probe and loses none, and moves no Chrome or webkit-host case.
Letting the walk end the line for every item that reserves nothing, on the build before the
leading run collapsed, fixed 487 more Firefox cases and lost 245 more, and lost 11 Chrome
and 58 webkit-host cases, 54 of which fail as their text in one node does.

Safari's line builder for inline boxes returns from a soft hyphen whose hyphen
doesn't fit to the line's latest earlier break, as its line breaking of one text node
does where it has one (Breaks And Source Positions names the partners that return
waits on in the WebKit profile), and it charges that hyphen where a line ends at
collapsible white space right after a soft hyphen in the same box, though it paints
none there. In September 26, 2026 webkit-host recordings in 16px Arial, items `ab`,
` `, `x\u00AD cd` end the first line after `ab ` at 35px and after `x\u00AD ` from 36px,
where `ab x` with the hyphen takes 35.57px; `ab x`, `\u00AD cd` and `ab`,
` x\u00AD cd` end it after `ab ` at 34px too. A line that ends at white space that
starts the next box, as for `ab x\u00AD`, ` cd`, and a soft hyphen alone in its box,
as in `ab x`, U+00AD, ` cd`, charge nothing, nor do one text node and a single span.
After a soft hyphen that starts an item after a collapsed space, the space after the
soft hyphen then starts the next line and takes its width there, as in `ab\u200B`,
` `, `\u00AD c`, `d` at 26px. Modeling the charge needs that return, which the WebKit
profile makes only where a run continues from an earlier item (#323's cases, above).

WebKit breaks differently, and the WebKit profile follows it. Its inline items
builder runs a break iterator over each inline box's own text, and a boundary
between boxes is breakable when the next box's text can break at its start with
the previous box's last two characters as prior context. Installed Safari 26.5.2
and headless WebKit spans wrapped Thai, Lao, Khmer and Myanmar words split across
items differently from one text node, and joined run extents lost the Thai and
Lao rows where they differ while Chrome gained on the same rows. In the WebKit
profile each item's breaks come from the WebKit scan over its own text, and the
boundary from that scan with the previous item's last two characters as prior
context. An item's last run and the next item's first run come from the items' own
segments. WebKit breaks `-1o(r)` before the parenthesis inside a box, where the
scan over the item's text doesn't.

An item keeps its own flags in the WebKit profile, and they leave some segment
starts unbroken, such as those at a control character like NEL, VT or NUL, at a
combining mark after a ZWSP, or at a soft hyphen inside an emoji sequence. The rich
stepper's end before the item holds here too: after a break, an item whose first
word runs past such a start moves to the next line. Before, the stepper ended a line
before the item only where the walk split its first segment, and split the word at
that start or inside a later segment: in 16px Arial at 42 and 46px, Safari lays out
items `zz` and ` ab\u0085cd` as `zz` / `ab\u0085` / `cd`, which the library now
gives, where it gave two lines. On the plain case texts split into items above,
lines in the WebKit profile now match the flat walker's at 72 widths where they
didn't, and at every width where they did. In a September 26, 2026 probe of 672 rich
cases made from the shapes that move, at 10-90px, webkit-host passes 37 more and
none fewer; none of the harness's cases moves.

Gecko's line breaker keeps extending a word across text frames until a SPACE, TAB
or CR, computes that word's breaks once with ICU4X's line segmenter, and hands each
frame its slice. A font or style change ends the shaped text run, not the word, and
css-text ignores inline box boundaries when it decides adjacency for line breaking.
In every same-font case of a September 14, 2026 probe, installed Firefox 155 spans
wrapped like one text node. The Gecko profile therefore uses the joined analysis
too, with its own break rules across boundaries: small kana don't start a line, so
items `ちょっと待` and `ってください` keep `待って` together where the Chromium
profile breaks before `っ`. Engines Pretext doesn't recognize use the joined
analysis too, with their own break rules. They used to break at every item
boundary, which no major engine does.

An earlier prototype of the joined rule lost 40 installed Firefox Myanmar
split-word rows, which were attributed to Gecko's segmentation. But Gecko breaks
lines with ICU4X's line segmenter, not the word segmenter behind `Intl.Segmenter`,
and the flat prediction already gave Firefox's lines at 41 of 52 probed widths,
including the suite row's 88px. The extra line comes from widths. The second item
starts with U+102C, a spacing vowel sign that Unicode graphemes split from the
consonant before it and browsers shape with it. In 16px Myanmar Sangam MN, Canvas
and the DOM agree that `ဘာသ` measures 41.02px and `ာသည်` 50.78px, while the joined
text and the same two parts as spans both measure 82.03px, so measuring the items
separately overstates this boundary by 9.77px. Breaking at every item boundary
matched those line counts only by breaking where Firefox never starts a line.
Chrome has the same width gap: its rich prediction starts a line at this boundary
where its spans don't. Breaking at every item boundary also matched some Firefox
heights of links and paths split across items by accident: Firefox breaks after
`/` before a letter, as in `https://|example.com`, where the flat prediction keeps
the unit whole.

When following items continue an item's last run, the run moves to the next line
if the line already has an earlier break: the walk over the continuing item, which
can't take its start, ends the line at the line's latest break. That walk follows the
line walker's rules, so a soft hyphen directly before a ZWSP or SPACE adds no
hyphen, and every fit allows the line walker's fit epsilon. A run whose first break
is a soft hyphen whose hyphen doesn't fit moves too, in every profile: WebKit keeps
an overflowing hyphen in one text, but Safari 27 moves the whole run across spans, as
for `the `, `inter`, `na\u00ADtion\u00ADal` at 84px in 16px Arial (#323's cases), so the
WebKit profile returns from such a hyphen only to a break before a run that
continues from an earlier item. Native Chrome and Safari spans reserved a hyphen
width for a soft hyphen before a space at some widths; the flat walker does not, and
neither does rich-inline.

A run that began the line still takes overflow breaks at item boundaries, as before.
Restricting those to units that `prepare()` would split lost the `a`/ZWSP/`hello`
witness at width 1: Chrome and Firefox break before that ZWSP even in a single text
node, while the flat walker keeps it with `a`; Safari agreed on the line count only.
Item admission fits within the line walker's fit epsilon, as the walk inside an
item does. It used to compare raw widths, and line counts then went up as the width
grew, in bands as wide as the epsilon: the item walk took a longer part of the next
item within the epsilon, and the raw check moved the whole item to the next line
instead of keeping the shorter part. No browser witness backed the raw comparison.
Atomic `break: 'never'` items allow a break on both sides. css-text requires this
for atomic inlines, and headless Chromium and WebKit inline-blocks agreed.

An item's walk can also end at a soft hyphen whose hyphen doesn't fit, where the
item has no earlier break to return to. Only the hyphen overflows there, not a
unit the walker forced onto the line. Wrapping before the item anyway broke
where the joined text has no break: items `T` and `po\u00add` gave `T` / `pod`
where `Tpo\u00add` gives `Tpo-` / `d`, and line counts went up as the width grew
(#323). Such a line keeps its hyphen, as the flat walker does, unless the
Chromium or Gecko profile returns to the break before the item with the flat walker's
checks: that break leaves room for the hyphen in Chromium and fits in Gecko, the soft hyphens up to the hyphen
measure narrower joined than apart by less than the overflow, and nothing after the break can hold a
later opportunity. Blink retries the text item against the width minus the
hyphen, then rewinds earlier items at the full width, so any break before the
item counts, including one between ideographs, where the flat walker records no
target. The line's latest break before the item counts too, where the item continues
a run from an earlier one, and a break after an item that ends with a soft hyphen
fits with that hyphen, which the flat text paints there. The walk itself decides
whether the text before the hyphen fits, as it continues the line. In a
seeded search with a tabulated fake canvas, 400 flows per profile with and
without kerning and item options, flows whose lines move backward as the width
grows fell from 43-60 to 7-14 per profile when these returns came, and no flow without a soft hyphen
changed. The rest have an item that starts or ends with a soft hyphen, or move
backward in plain text too, where a Blink return appears only once its target
leaves room for the hyphen. A soft hyphen that starts an item after the line's
content is a break there, as in the flat text: the walk from a line start consumed it,
and lines ended inside the word after it instead.

Items are measured separately. Chromium shapes neighboring same-font spans
together, so Arial `community` + `,` natively fits about a pixel earlier than the
sum of the two measurements; Gecko frames kern there too, while WebKit spans do
not. That is a measurement topic, not a break fact. Where the flat walker and one
native text node disagree, rich-inline in the Chromium, Gecko and WebKit profiles
now follows the flat walker: Japanese dialogue in Hiragino Sans after `」`, numeric
signs that WebKit keeps with the digit, and fit thresholds. Breaking at every item
boundary matched some of those rows only by accident.

## Content Language

Some line-break rules follow the page language. The full-schedule
`maintained/content-language` family renders 31 shapes on `en`, `ja`, `ko`, `zh`
and `zh-Hant` pages, plus 5 `en` controls, with named CJK fonts. On September 12,
2026, installed Chrome 153, Safari 26.5.2 and Firefox 155 gave, under
`line-break: auto`, for the 28 shapes it had then:

| Shape | Chrome | Safari | Firefox |
| --- | --- | --- | --- |
| Small kana starting a line (`日本ァア`, `わかって`) | Every page | `ja` and `ko` only | Never |
| `ー` starting a line after an ideograph or kana | Every page | `ja` and `ko` only | Never |
| Break before `〜` or `゠` | `zh` and `zh-Hant` only | Never | Never |
| Curly double quotes around Latin or Hangul act as brackets (`中文“abc”中文`, `했다.”라고`) | `zh` and `zh-Hant` only | Every page except `ja` | Never |
| Newline next to `。`, `「` or U+3000 | Becomes a space | Becomes a space | Removed on `ja`, `zh` and `zh-Hant` |
| Newline between wide characters | Becomes a space | Becomes a space | Removed on every page |

These agree with the engine sources: Chromium's `line_normal_cj.txt` tailoring
for `zh`, Apple ICU's `ja.txt` and `ko.txt` plus its curly-quote patch, and
Gecko's newline transformation in `nsTextFrameUtils.cpp`. Safari 27 decides a curly
quote next to East Asian text from its own quotation classes before ICU, so it breaks
around the quotes in `中文“abc”中文` on every page, while `했다.”라고` still follows the
page language.

Under `ja`, `zh-Hans` and `ko`, Safari and Firefox also shape some of the named
font's own punctuation differently. An element's `lang=""` marks its language as
unknown rather than inheriting the page's. Chrome resolves it to its app
language, which the report records as `locale`, so these results can differ
between machines. In their sources, Firefox maps it to its generic `x-unicode`
font group and Safari passes no language. Firefox's fallback glyphs then follow
the machine language too: on a Mac preferring `zh-Hans`, U+2167 under `lang=""`
measured 16px, as with no language, against 27.53px under `en`. Safari's matched
`en`. No recorded empty-language row contains a fallback glyph, so no recorded
result separates from `en` yet.

Chrome's and Safari's scans take small kana and `ー` (CJ) from their engines'
tables. libicucore opens its normal line rules, where CJ is ID and may start a line,
on `ja` and `ko` pages, `line_cj.brk` on `zh` pages and strict rules, where CJ is NS
and stays with the CJK text before it, elsewhere, and Safari's scan picks the table
from `<html lang>`. Chromium's ICU data maps `line` to `line_normal.brk` for root and
`ja` and to `line_normal_cj.brk` for `zh` and `zh_Hant`, and both put CJ in ID. So
`ー` starts a line after `？` and `！` exactly as small kana do, and between the marks
in `日？ーー`, as installed Chrome shows. Gecko's scan takes CJ as NS from ICU4X's
strict rules, which Gecko's auto selects, and engines Pretext doesn't recognize
take Blink's scan. Reading `<html lang>` costs about 3-16ns in headless WebKit and
Chromium, with no style or layout work.

## Fonts And Other Measurement Engines

Whole-run Canvas/DOM agreement, isolated-letter agreement and matching line
breaks are separate claims. The Shantell Sans and language-context probes in
[FONT_DIAGNOSTICS.md](FONT_DIAGNOSTICS.md) explain why a prefix model that fixes
one width can still fail nearby thresholds.

Feature detection must precede assignment. In the tested Safari OffscreenCanvas,
`fontKerning` and `textRendering` were absent; assigning and reading them back only
created ordinary JavaScript properties, without enabling the browser feature.

Safari's generic families under a page language come from the operating system,
not from WebKit's own settings: under every language whose WebKit script isn't
Common, which is nearly every language tag a page writes, `en` included, WebKit asks
Core Text's `CTFontDescriptorCreateForCSSFamily` with the page language, and keeps
its settings' families only for names Core Text reserves
(`FontDescriptionCocoa.cpp:77-118`). Safari 27's Canvas can't carry a language, so
the WebKit profile names Core Text's families in the Canvas font. The table is
generated from WebKit's language-to-script map and Core Text's answers dumped on
macOS 27 and in the iOS 26 simulator; it holds no font's metrics. Where the systems
differ, iOS's Safari lacks macOS's family in all but two cases, so the new context
asks itself, with one probe string, whether it has macOS's family, and takes iOS's
if not. In the two cases both systems have both families and macOS's stands: Menlo
against Courier New for `monospace` under `fa`, `ug` and Arabic with a region, and
Papyrus against Arial Hebrew for `fantasy` under `he`. Safari can't use Kaiti SC or
TC on macOS 27, which Core Text names for `cursive` and `fantasy` under `zh`, and
draws the script's standard family, Songti. Rejected: listing macOS's family and
then iOS's in the Canvas font, which on macOS sends the characters macOS's family
lacks to iOS's family, where the page falls back by language: Latin under `hi`
`serif` (ITF Devanagari, then Kohinoor Devanagari) and Hebrew under `he` `cursive`
(Apple Chancery, then Arial Hebrew) measured 11.6 to 33.8px off at 40px; measuring
through a `<canvas>` element, which follows the page exactly when connected but runs
the document's pending style update in every `font` assignment and `measureText()`,
connected or not (`CanvasRenderingContext2D.cpp:206, 304`; `PLATFORM_BUGS.md` has
the cost); a detached `<canvas lang>`, which has no computed style and so no
language (`Element.cpp:4873`); and reading
`navigator.languages` for a plain Han page, whose family WebKit takes from the
user's first Chinese language: Safari shows the page only the first preferred
language, and PingFang SC and TC measured the same widths.

Guessed `system-ui`
substitutions, size tables and scaling were unreliable. Emoji bitmap widths also
do not scale linearly with font size. Keep those platform findings and correction
details in [PLATFORM_BUGS.md](PLATFORM_BUGS.md), rather than adding font-name rules
to the line breaker.

`text-shaper` helped identify Unicode coverage gaps, but its segmentation and
paragraph breaker are not browser-compatible replacements. HarfBuzz probes were
useful references, but did not reproduce browser measurements closely enough;
isolated Arabic words also needed explicit LTR direction in that backend to
avoid misleading widths. Bringing a shaper and font loading into the runtime is
a separate project, not a required next step for Pretext. Measuring every possible
resumed substring is outside the intended bounded preparation model too.

## Bidi Levels

`prepareWithSegments()` used to return `segLevels`, one embedding level per
segment from a simplified resolver that came from pdf.js through text-layout.
`layout()` reordered lines with them at first, but that result was discarded and
the call was removed (`5ecce72`). The levels stayed as custom-rendering metadata
that nothing in the library, rich-inline or the demos read, and they could not
produce visual order. The resolver took the paragraph direction from the first
strong character, with no way to set it, and had no explicit embeddings,
overrides or isolates, no bracket pairs and no line rules. A segment reported
the level of its first code unit, although punctuation merged into a word can
resolve differently, and a line can start or end inside a segment. The published
uses checked on GitHub only read the levels to guess a paragraph's direction,
and one patched in a forced base level.

Every rich preparation still paid for the pass, including each rich-inline item.
Skipping it made `prepareWithSegments()` about 3% faster on the Latin corpora,
8.5% on the Arabic, Hebrew and Urdu corpora and 16% on short Arabic texts, and
`prepareRichInline()` 15% faster with Arabic items (Node V8 with a fake Canvas,
medians of 31 interleaved rounds). The generated bidi class table stayed for the
WebKit following-space kerning guard, until that guard came to need only letters,
direction marks and the right-to-left blocks (see Kerning At Line Edges).

A DOM element that renders the whole paragraph needs only a paragraph direction,
since the browser resolves the paragraph and reorders each line itself. A string
drawn on its own, such as one line passed to Canvas `fillText()`, is a separate
bidi paragraph and loses what was resolved across the line break. GNU FriBidi
1.0.16 orders the second line of the LTR paragraph `abc ابج 1+2 xyz`, broken
before `1+2`, as `2+1 xyz` inside the paragraph, because the digits follow
Arabic, but as `1+2 xyz` on its own. Numbers and punctuation before a line's
first letter, punctuation after its last letter, and embeddings or isolates that
span lines changed order the same way; digits after a letter on the same line
didn't. A real replacement for custom rendering needs a different shape: a
paragraph-direction option, levels per code unit rather than per segment, and
per-line whitespace reset and reordering (UAX #9 L1 and L2) so callers get runs
in visual order. A known paragraph direction would also let the kerning guard
keep the kerning where it now leaves the direction unknown.

Gecko's scan resolves levels of its own with a port of servo/unicode-bidi, only to
split text runs where Firefox splits them (Break Opportunities From Engine Data).
It returns no levels and assumes a left-to-right paragraph.

A text run split changes the scan only inside a cluster. The run's first unit
starts a cluster, clusters restart there within the word, and a space right
before the split ends a word even before a cluster extender, which matters only
for a space that is itself inside a cluster, after a Prepend character such as
U+0600. So the scan sets its text run up in one piece and resolves levels only
when a level run could start inside a cluster. In text with a bidi control one
can start anywhere, since Firefox leaves controls out of its text runs, and in
pre-wrap every line starts a text run. Otherwise a unit resolves to level 0 as
L, 1 as R or 2 as a number, and a unit inside a cluster keeps the level of the
unit before it when it is NSM (UAX #9 W1), BN outside the paragraph's trailing
white space (L1), or L or a neutral after L or a neutral that is no bracket (N0
to N2). The unit itself needs no bracket check: a bracket is inside a cluster
only right after a Prepend character, which is L, AN or AL, and after L it
resolves to L. A level run can also start at a unit the scan drops, and then
splits the text run at the next unit it keeps. The scan drops three kinds of
unit. Collapsed white space leaves a space, and a space inside a cluster
resolves levels whatever its own level, so that check can't narrow to spaces
whose level changes. A soft hyphen is BN, which the check looks past, and a bidi
control resolves levels already. U+0600, a space, a line feed and U+0301 in
normal white space start a level run at the space, which is dropped, and split
the text run at the line feed, kept as a space inside U+0600's cluster. What is
left are shapes such as a skin-tone modifier, a spacing mark or a Balinese or
Batak vowel killer after a Hebrew or Arabic letter or a digit, anything after
U+0600, and a ZWJ that ends a paragraph after a right-to-left letter. In
`aa בבבב🏻` at 60px in 16px Arial, installed Firefox 156.0.1 starts a text run at
the modifier and breaks before it, and without the levels the Gecko profile
breaks after `aa`. Without them it also loses 22 pinned harness cases, all
Balinese and Batak vowel killers after Arabic or Hebrew letters. The scan now
resolves levels for none of the Arabic, Urdu, Hebrew or mixed corpus paragraphs
or the Markdown chat's texts, and for 262 of the harness's 10,733 texts with a
right-to-left unit.

Where levels do split the text run, the scan sets up again only the words the
splits cut, each as the split's two pieces. Setting the whole run up a second
time made the Gecko profile's analysis 8 to 17% slower than main's where levels
resolve, and in Firefox 156, with an RLM before every text, made `prepare()` 13%
slower on the book-length Arabic paragraph, 8.5% on emoji and 7.6% on soft
hyphens with marks. Setting up the cut words only took the analysis to within 5%
of main's there, and in the same Firefox bench every row read within noise or
faster, those three within 1.3% of main's. The word-end test is one function,
which the first setup and the cut words share (Decisions Log).

On 63 million strings, seeded mixed-direction ones of up to 32 code points with
controls, marks, emoji sequences, Prepend characters, brackets, lone surrogates
and line feeds, Unicode's BidiTest and BidiCharacterTest sequences with
extenders and line feeds put in, every string of up to 4 or 5 units over
alphabets of one unit per role, windows of the corpora and the chat's texts with
insertions, and white space templates, the scan and `prepareWithSegments()` gave
the results of resolving every text. The unit tests fail without the bracket
rule, the trailing white space rule, the space check, the words set up again or
their clusters found again, or with R taken to keep the level of the unit before
it. It took 32 to 44% off the Gecko profile's analysis of text with a
right-to-left unit (Arabic 59 to 38µs per 1,000 units in Bun and 89 to 53 in
Node, the chat's right-to-left texts 57 to 36 and 83 to 46), and left
left-to-right text as it was. In Firefox 156 it made `prepare()` 16% faster on
the bench's new Arabic messages and 29% on seen ones, 23% on seen mixed-script
ones, 32% on the book-length Arabic paragraph and 15 to 29% on its texts with
emoji, controls and invisible tails. Four left-to-right rows read slower: long
breakable runs 3 to 5% in each of three runs, and pre-wrap chunks, keep-all CJK
brackets and Latin messages seen before 2 to 3.5% in some runs and within noise
in the others; soft hyphens with marks read 2% slower in one. All of it is the
word-end test's call: with the test written out again in the first setup's loop,
every left-to-right row read within noise of main's, and long breakable runs
4.5% and pre-wrap chunks 2% faster than with the one function. Every row in
Chrome read within the noise, and in a second run every row in Safari, which
runs none of the changed code. Resolving levels whenever a cluster holds more
than one code point is exact as well, with a shorter argument, but vowel marks
and emoji sequences put one in 37% of the Arabic paragraphs and 57% of the
chat's right-to-left texts, so it saved only 5 to 15% there.

## Corpus Lessons

Short examples catch regressions; long text reveals accumulated differences.
Current counts are the census and book sets' in `bun harness check`, not here.

- **Application text:** books miss URLs, numeric expressions, emoji sequences,
  non-breaking spaces and discretionary breaks.
- **Arabic:** punctuation-plus-mark clusters such as `،ٍ` need their preceding
  text, while a space followed by combining marks needs the marks with the next
  word. Pair corrections, larger shaped
  slices and phrase rules from single examples added cost without enough accuracy.
  Clean actual source artifacts before adding rules; do not increase fit tolerance
  to disguise a shaping mismatch.
- **Thai, Lao and Khmer:** Thai exposed contextual ASCII quoting; Khmer benefited
  from retaining explicit ZWSP in clean source. A Lao sample with fixed print
  wrapping was unsuitable for testing normal flowing text.
- **Myanmar:** punctuation usually needed preceding text, and `၏` also needed its
  following word in examples such as `ကျွန်ုပ်၏လက်မ`. Broader grapheme and quote
  rules improved one browser while hurting another.
- **Japanese and Chinese:** iteration marks stay with preceding kana, but remaining
  proportional-font differences varied with browser, width and font. One improved
  corpus line does not justify another global punctuation rule.
- **Pre-wrap:** preserved spaces can hang, tabs depend on the current line's tab
  stop, and a final hard break does not create another empty line. The supported
  textarea-like subset is in [README.md](README.md).

## Keeping Work Bounded

Small operations became quadratic when repeated over growing user text. The
history audit found these traps; the commits retain the implementation details:

| Repeated work | Fixes to consult |
| --- | --- |
| Reclassifying growing punctuation/Arabic strings or rescanning cleared slots | `30854d7`, `2148b90`, `4cb8b24`, `f0a326d` |
| Rebuilding growing CJK/keep-all units | `eb3bbbe`, `f0a326d` |
| Measuring every growing Canvas prefix | `fcf9c62` |
| Searching hard-break chunks from the beginning for every streamed line | `2c52171` |
| Retrying whitespace/font-size suffix regexes; restarting preferred-hyphen searches | [#221](https://github.com/chenglou/pretext/pull/221) |
| Measuring each run of a chain of combining marks after the whole chain before it | `MARK_CHAIN_CONTEXT_UNITS` in `src/prepare.ts` (#351) |

The regex failures involved *internal* whitespace followed by content and long
digit runs without `px`, not just long trailing whitespace or valid font strings.
The preferred-break failure needed one long hyphenated run producing many lines.
An arbitrary continuation must seek to its starting boundary; an already
positioned scan can carry its index.

A long chain of combining marks is trimmed in `getLongMarkChainContext()`, which
runs only for a context longer than 96 units, apart from `getMarkContext()`, which
`prepare()` calls for every segment. V8 inlines a function into its caller only
while its bytecode stays under 460 bytes (`--max-inlined-bytecode-size`). In Node
23's V8 12.9, over the bench's messages and worst-case shapes, main's
`getMarkContext()` took 326 bytes and was inlined into `measureAnalysis()`; with
the trimming loop inside, it took 519 bytes and wasn't (`--trace-turbo-inlining`),
and Chrome 154's `prepare()` took 0.4 to 2.6% more time than main on most bench
rows in every session, 1.8% on seen Arabic and 2.6% on letter-spaced CJK, while
Firefox and Safari didn't move. With the loop apart, `getMarkContext()` takes 376
bytes and is inlined again, and every Chrome row reads within noise: seen Arabic
−0.2% and letter-spaced CJK +0.6% (#351). With `measureAnalysis()` as one switch
over the segment kinds, it still takes 376 bytes, and 374 reading the analysis'
flags bytes. V8's first optimized compile of `measureAnalysis()` leaves it out, as
the loop's direct calls use the budget first, and the later ones, which the loop
keeps running, inline it.

That loop measures a text segment's width in `getTextSegmentWidth()`, apart from
it. With the sum inline, JavaScriptCore's DFG tier (Safari 27, and macOS 27's
`jsc`) failed a type check at the add of the following-space kerning on nearly
every segment of CJK text, 25,508 times in 80 passes over the letter-spaced CJK
shape, recompiled the loop seven times and never compiled it with its FTL tier.
Safari prepared the bench's letter-spaced CJK 45% and keep-all CJK brackets 59%
slower than main in both sessions. With the sum in a function of its own, which
JavaScriptCore inlines, the loop reaches the FTL with no such exit, as main's did,
and Safari prepares the two shapes 9% and 10% faster than main.

`measureAnalysis()` keeps its other helpers as closures over its locals too: the
WebKit following-space check and its scan of a space's paragraph for bidi controls,
the mark-chain context, the joined narrowing at a soft hyphen and the entry
geometry. Hoisted to module functions with explicit arguments, with the state of
the paragraph scan and of the mark chain in two small records, they measured the
same text in the same order as the closures in all four profiles offline, but took
16 more lines, so they weren't timed: the hoist was to land only if it removed lines
and the bench showed a gain.

Rich-inline's line stepper, the full walker's retreat from an unfit hyphen and
`segmentAtLineBreaks()` are written plainly (Decisions Log, 2026-09-26). Against
the code before, which kept three stepper checks that change no result, tested
the engine's `unfitHyphenRetreat` beside the soft-hyphen contexts, which
preparation makes only where the engine retreats, and started the first segment
before the segmentation loop, Chrome 154 measures the bench's rich stats 11%
slower, its rich walk and stream 6 to 7%, and `layout()` of letter-spaced CJK 5%,
and prepares pre-wrap chunks 13%, long breakable runs 8% and most other text 1 to
3% slower, in both sessions. Firefox 156 prepares seen CJK and measures mixed
stats 2% slower. Safari 27 reads those rows within noise; it resizes Arabic at
widths seen before 13% slower, against 5% for its control, and its mixed-line rows
read 2 to 26% slower, about as far as its control moved.

Letter-spaced CJK and pre-wrap chunks moved again when rich-inline items began to
continue their lines in the full walker (Rich Inline Boundaries), though plain text
never runs the item's code. With the block that leaves an item's latest break at a
line's end, Chrome 154's `layout()` read 5 to 6% slower on letter-spaced CJK, and its
`layout()` and `walkLineRanges()` of pre-wrap chunks 1 to 6% slower, in both sessions
of each bench; Firefox 156 and Safari read the pre-wrap rows 2 to 10% faster and
letter-spaced CJK within 4% of main. Without the block the rows read as main in
Chrome, but the same block in a function of its own, or cut down to its three
stores, read as slow, so the slowdown was accepted. By September 27, with the same
walker, those rows read within noise of main in Chrome and `layout()` of long
breakable runs 2.3 and 4.1% slower, against 1.9 and −0.3% for the second copy of
main, as V8 moves such costs between rows. Items on fast-path handles
continue in the full walker: taught to continue a line, the simple stepper made the
plain line APIs' stats, walks and streams of mixed text 39 to 64% slower in Safari,
10 to 13% in Chrome and 6 to 7% in Firefox.

Safari 27 streamed that mixed text slower anyway, though almost none of it runs code
that changed: 133 of the bench's 134 mixed texts take the simple stepper, which
didn't change, through a test that now reads the item where it read an end limit,
and only the text that holds a soft hyphen, 95 of their 20,000 units, takes the full
walker. Its `layoutNextLineRange()` read 24.2 and 31.0% slower than main in the two
sessions of the full bench and 39.6 and 9.4% in a re-time; 7.7 and 12.3% without the
walker's item seeds and the block that leaves an item's latest break; and 12.3 and
12.9% in a re-time on an idle machine, where a second copy of main read −0.4 and
−18.7%. Stats, walks and lines of the same texts read within noise, and Chrome and
Firefox streamed them as main. A profile finds no work that changed. Safari 27's own
JavaScriptCore, the system `jsc` shell of its build (22625.1.29.11.27), ran the bench's
bundles over its lines texts with stand-in widths: stepping the texts alone in a
process, a build of this change read 5% slower than main in the median of 12
processes (−1 to +12%) and a second copy of main within 3%, and its sampling profiler
put all the extra time in `stepPreparedSimpleLineGeometry()`, whose source is the same
in both builds and whose FTL machine code is the same but for one structure ID loaded
in two instructions instead of one, at one loop whose cost moved between the two
copies from process to process. Run after the other three line operations, as the
bench's document runs them, the same stream read 7 to 12% faster than main in all 8
processes, and the final build read as main stepping alone and 5 to 11% faster after
them. The rich walk moves the same way: identical walk code over identical handles
read 12 to 21% slower than main in the shell before the last round's preparation
changes and as main after them, while Safari read the final build's rich walk 9.0%
(5.3 and 12.3%) and 15.3% (12.6 and 15.9%) slower in two benches, and its stream 34.5%
(32.9 and 35.1%, where the second copy of main read 25.6 and 14.8%). Only the JIT's
placement and compile history differ, so the slowdowns were accepted. The next round,
which keeps the break and the space before an item holding only a soft hyphen and
runs no new step in the WebKit profile for the bench's messages, read Safari's rich
walk 21.0% faster than main and 12.5% and 12.0% slower than the round before it,
and plain layout rows it doesn't change 2.5 to 8.5% slower than that round.

The analysis gives each segment's flags byte in a plain array while it finds the
segments, and measurement copies the bytes into the prepared handle's
`Uint8Array`. A `Uint8Array` as long as the text, cut to the segments found and
kept as the handle's, with `prepareWithSegments()`'s kinds named from it by
`Array.from`, made `prepareWithSegments()` of one word about a third slower in
Node 23's V8, and the bench's rich-inline preparation, which prepares every item
apart, 12% slower in Chrome 154 in both sessions. The analysis also slices each
segment's text, in a loop of its own once the flags are final, and measurement
and the neighbours it looks at read those strings. Sliced where measurement
reads them instead, by a helper or inline at the top of its loop, the texts made
Firefox 156 prepare the bench's rich items slower than with them sliced in the
analysis in all 15 sessions of three runs, by medians of 11 to 19%, with the
plain array as with the typed one. Sliced in the analysis again, the row reads
within noise of main, 4% faster and faster in 4 of 5 sessions. Chrome doesn't
tell the two apart: its copies of the same code there move up to 17% apart.

`layout()` needs only a count. On simple text, `countPreparedLines()` keeps just
the line width and whether the line has content, with no line ends, pending
breaks, paint widths or visitor calls. It keeps the simple walker's order: a
whole segment is tried before its graphemes, each line takes at least one
grapheme, and a line holding only an overflowing grapheme keeps the graphemes
after it that can't start a line. Every segment boundary of simple text is a
scan break, so it never searches back for a cut. The fresh-line widths of a
segment's tails (entry geometry, which only text holding a default-ignorable code
point has) matter only on a line that starts inside that segment, so the counter
and the simple stepper take them there, and such text keeps the simple walkers.
Other text still counts through the full walker. This removes work from the resize
path without changing preparation or what it measures.

Every counted line starts at 0 and adds the widths on it. A counter that sets a
new line's width straight from its first segment's width or grapheme advance
counts the same lines, but in Firefox 156 it took 1.4 to 1.7 times as long as
main's `layout()` on chat messages in every script tested, same-document
interleaved, while main's loop on the same prepared text took 1.0. Changing
main's loop one step at a time toward it slowed only that step. Starting each
line at 0 gave 0.87 to 1.04 there.

The full walker lays out text with letter spacing, soft hyphens, control segments,
tabs, hard breaks or preserved spaces in every API, and in the line APIs text
with a segment boundary the scan doesn't break at (below). Its line state lived
in variables its nested helpers closed over, which V8 boxes: each write cost
12-14ns there against about 1ns for a local, several per segment. It now keeps
that state in locals of one function, reads each segment's kind, whether it takes
letter spacing and whether the scan gives a break before it from one byte, and
ends a line's walk at the next hard break instead of looking up chunk records.
JavaScriptCore types an infinite default loop bound as a double: Bun walked
letter-spaced and pre-wrap text 30-65% slower with one. Together these halve
`layout()` of letter-spaced CJK in all three browsers and take pre-wrap
`layoutNextLine()` to 0.4 of main's time. The full walker still costs about three
times the counter per segment in Chrome and Safari and five in Firefox: it tracks
the line ends, pending breaks and paint widths the line APIs report, which a count
doesn't need. One walker for every text would make chat `layout()` two to seven
times main's time, and chat's line APIs 1.4 to 7.2 times as slow as on the simple
stepper, several of them then slower than main, so the simple walkers stay.

The full walker walks every line of a text in one call. A version that stepped
exactly one line per call, with one loop composing it and the simple stepper for
walks, counts and streams, gave the same lines but repeated the walker's setup for
every line: nine reads of the handle, the engine profile and six values derived
from them. In both sessions of a bench against main, `layout()` of pre-wrap chunks
took 1.26 to 1.28 times main's time in Chrome 154, 1.11 to 1.15 in Firefox 156 and
1.37 to 1.40 in Safari 27, and `walkLineRanges()` of them 1.10 to 1.12, 1.09 to
1.10 and 1.33 to 1.36; `layout()` of letter-spaced CJK took 1.07, 1.13 to 1.15 and
1.11 to 1.12, and of soft hyphens with marks 1.14 to 1.15 in Firefox and Safari.
The shared loop also started each line of simple text through
`normalizePreparedLineStart()` and `stepPreparedLineGeometryFromStart()`, in place
of the simple walk's own skip and stepper call, and `walkLineRanges()` and
`measureLineStats()` of chat messages took 1.06 to 1.10 of main's time in Chrome and
1.18 to 1.32 in Firefox. Both walkers keep their own loops over lines.

The full walker also admits a whole segment on two paths, one for a fresh line and
one for a line with content, each followed by the same nine lines. One path for
both, which tests at each step whether the line has content, read slower in both
sessions of a bench against main on the text the full walker lays out: `layout()`
of letter-spaced CJK took 1.05 times main's time in Chrome and 1.05 to 1.10 in
Safari, of soft hyphens with marks 1.05 to 1.07 in Firefox and 1.16 to 1.17 in
Safari, of pre-wrap chunks 1.03 to 1.04 in Chrome and 1.11 to 1.15 in Safari, and
of controls 1.08 to 1.11 in Safari. The walker keeps the two paths.

Text of the simple walkers' kinds with a segment boundary the scan doesn't break
at takes the full walker in the line APIs. `layout()` counts it with the simple
stepper instead, and the full walker steps a line again where the stepper ended it
at such a boundary, before the segment or after the space before it. On the old
benchmark page's control row, 46 of 120 texts in the Gecko profile have one: 32
before NEL (UAX #14 LB6), as in the Blink and WebKit scans, and 14 more after a
space before a bidi control. Firefox leaves bidi controls out of the text runs it
breaks (IsDiscardable, nsTextFrameUtils.cpp:32-49), so its break lands on the next
character it keeps, after the control. Since the space takes the control after it
(Break Opportunities From Engine Data), those 14 have no such boundary any more.
While the full walker counted those texts, 1,748 of the row's 4,049 segments, at
five times the counter's cost per segment,
Firefox's `layout()` of the row took 2.2 times the time of main before #340, which
counted them with its counter. Stepping them, Firefox counts the row in 0.44 of
main's time, Chrome in 0.59 and Safari, where NEL is a control segment, in 0.96.
Against main before #340 the ratios move with what else the page runs: Firefox
read 0.85 to 0.90 of its time at the benchmark's widths on pages of four
libraries, 0.98 to 1.01 at a new width every pass, and about 1.07 on the full page
of six; Chrome read 0.80 to 0.83. Paragraphs of 12 of those texts take 0.22 to
0.24 of main's time in Firefox, 0.17 to 0.28 in Chrome and 0.97 to 0.98 in Safari.
The other rows' `layout()` reads 0.97 to 1.04 of main's time in Chrome, 0.99 to
1.03 in Firefox and 0.92 to 0.99 in Safari, where a second copy of main reads 0.96
to 1.05, and preparation doesn't move either (same-document interleaved,
foreground, two sessions per browser).

Finding Firefox's bidi controls in the analysis (Break Opportunities From Engine Data)
costs text without one nothing only where it looks for none. Testing each unit of every
Gecko text for a soft hyphen or control, and scanning each run of them, made Firefox 156
prepare seen messages 4 to 6% slower, and long breakable runs and pre-wrap chunks 9 to 17%;
the analysis now looks only where the scan's white-space step noted a dropped control. The
profile's grapheme table tests only code points in the rules' Control category for what the
text run drops: testing every code point made Firefox prepare CJK and Arabic 2 to 3% slower.
A soft hyphen's look for a control after it, repeated at each soft hyphen of a run, took time
that grew with the square of the run, and Firefox prepared the bench's invisible tails 44%
slower; each run is now scanned once, at its start. A segment ending in a long run of
controls is now a few clusters, not one per control, so it passes fresh-line geometry's bound
of 96 graphemes, and observing that geometry again at every prepare, where it had found none,
made Firefox prepare the invisible tails 6% slower. An empty observation is kept now, as a
found one was.

Chrome's line APIs pay a little for it. Once `layout()` has counted such text with
the simple stepper, Chrome's `walkLineRanges()` of chat messages and other simple
text, which steps its lines with the same function, takes 2 to 4% more time than a
second copy of main (same-document interleaved, foreground, 12 sessions over four
page setups). The cost comes from the count sharing the stepper, by a mechanism
not found. V8 does turn the stepper's six reads of the handle polymorphic once it
has seen both kinds, since a `prepare()` handle has no `segments` or `kinds`
(Node's `--log-ic`), but one shape for both kinds of handle, with those two fields
null on a `prepare()` handle, reads the same as two shapes in Chrome, and makes
Firefox's `walkLineRanges()` of simple text 1.01 to 1.14 of main's time, whether
or not `layout()` steps such text, and whether the shape comes from one literal or
from adding the two fields after it; a build with two literals holding the same
fields takes 0.98 to 1.01. Firefox's walks swing by 10% with what else the page
runs: with two shapes, it walks chat in 0.86 to 0.93 of main's time on a
four-library page and 0.98 to 1.02 on the full one. A private copy of the stepper
for the count, 77 more lines, is the only cure measured, and a few percent of JIT
cost doesn't pay for a second stepper, so Chrome keeps it (ENGINE_FOLLOWUPS.md).

A check inside the counter's loop, handing such a line to the full walker, counted
the row as fast, but it slowed the count of all other text in Firefox and Chrome:
up to 1.6 and 1.3 times main's time when the counter went on after the full
walker's lines, and 5 to 26% more in Firefox when it handed the full walker the
rest of the text or all of it, even with the hand-off after the loop. The check
alone, with that text kept off the counter, and the counter taking that text
without the check each cost nothing: the loop slows once the check has ever held.
The same check in the simple stepper, which the count reaches only for that text,
slowed Chrome's `walkLineRanges()` of other text by 4 to 5%, a little more than
the count's own stepping costs it (above), so the count checks where each stepped
line ended instead. Letting the stepper hand such lines off in the line APIs too
would give the same lines, but a line whose space overflows paints the widths
before the space summed there, and the sum after the space less the space in the
full walker, which differ in the last bits: in 99 of 96,470 offline line checks in
the Gecko profile. No harness prediction moves in any browser, though the harness
compares widths exactly: the one webkit-host prediction that differed, Ethiopic
text in a `system-ui` font list on the simple path, is one whose widths
webkit-host moves with what the process measured before (harness/README.md).

A fresh page pays to compile the whole library before its first `prepare()`. In
Firefox 156, `new Function` over the fresh-page probe's minified bundle took 4.5 to
4.8ms while the engine scans kept their iterator state in four classes, whose
fields compile as class fields, and 1.9 to 2.2ms with that state in plain objects
and functions; main's bundle took 1.6 to 1.7ms. Emptying the class bodies or
moving each field into its constructor gave the same 2.0 to 2.2ms, so any class
field seems to make Firefox compile the whole bundle up front rather than each
function on its first call. V8 and JavaScriptCore compiled all of these in the
same time. The same change made seen Arabic, Latin and mixed chat messages
prepare 6 to 8% faster in Firefox.

Count total submitted Canvas text, not just calls. Measuring every prefix or
suffix is quadratic even if each position triggers only one query. Safari's
production prefix policy caps each segment at 96 graphemes, using pair context
beyond that. A large combining cluster can still occur in up to 96 prefixes:
bounded amplification, not a bound on the native shaper's own cost. Extra context
queries must charge overlapping source too.

Cold-cache scaling probes distinguish those costs from reuse. Numeric Canvas doubles
measure algorithmic work rather than browser throughput. Shared font/segment
caches accumulating until `clearCache()` are a separate lifetime concern.

Repeating `clearCache()` and `prepare()` on one text is not a stable timing in
Playwright's WebKit build. Its per-font width cache samples one Canvas call in 21
after a run of misses, counts only strings of up to 64 UTF-16 units, and returns
to dense sampling only after a hit. A prepare submits each string once, so hits
need the sampled positions to line up again: after 21 / gcd(n, 21) prepares for
n counted strings. The Arabic corpus submitted 21,336, a multiple of 21, and its
prepare fell from about 120ms to 35ms within five repeats. Breaking after U+061B
removed four prefix measurements, and the same prepare stayed at 120ms until the
21st repeat. The first prepares cost the same, replaying the submitted strings
without library code showed the same split, and four extra Canvas calls per
prepare restored the drop. Fresh text never reaches those hits. Compare submitted
Canvas text and first cold prepares, and treat a warm-only change there as a
cache phase until installed Safari shows it. Installed Safari 27 shows it on the
old benchmark page's Thai prose: main submitted 2,982 strings, 142 times 21, and
the measurement part of its repeated cold prepares took 4ms in 5 of 12 page runs
and about 15ms in the rest, while the WebKit scan's segments submit 2,978 and
stayed near 18ms in 11 of 12. Timed around `measureText` in a foreground page, a
first cold prepare of that text spends 20ms in Canvas with main and 15ms with
the scan, and both fall under 1ms once the cache holds the strings.

Per-segment widths that start at zero, HanKerning's trims (`src/han-kerning.ts`),
the soft-hyphen contexts and the U+3000 hangs, start as zeros pushed in a loop
(`zeros()`). Made with `Array.from({ length: count }, () => 0)`, which reads every
index off the object and calls the map function for each, one more such array, the
overflow trims about a quarter of the bench's CJK messages hold, made Chrome 154
prepare seen CJK 5.7% slower than main in both sessions of two runs; with all four
pushed in a loop, it read 9 to 11% faster than main in two runs (#366). Lists of
records or null keep `Array.from`: once one helper pushed nulls too, Node 23's V8
made its zeros generic elements, storing each trim as a boxed double. layout()'s
numeric count loop (`countPreparedLines()`) takes no overflow trims: it hands a
handle with any to the simple stepper, which takes them for a line's first segment.
Read in that loop, where only a line whose first segment overflows reaches them,
they made Firefox 156 count long breakable runs 13 to 26% slower than main and Thai
at widths seen before 10 to 12% slower, in both sessions of two runs, and read
through a helper there, Latin at widths seen before took 2.5 times as long. The line
APIs keep such a handle on the simple walk fast path, since a halt later in a line
follows text the scan gives no break before, which leaves the fast path anyway.
Taken off it, the 31 of the bench's 134 CJK messages that hold overflow trims walked
with the full walker, and in two foreground pages Chrome 154 ran `measureLineStats()`
81 to 84%, `walkLineRanges()` 102 to 108% and `layoutNextLineRange()` 62 to 65% slower
than main on the 134 (#366).

## Decisions Log

Decisions the maintainer made whose reasons the code doesn't show. Code comments
that point here mark where each applies. Before reversing one, check whether its
reason still holds, and record the new decision here with its date.

- **2026-09-16: the WebKit profile follows Safari 27 only.** Safari 26, on macOS 26
  and iOS 26, breaks differently around curly quotes and guillemets, after
  punctuation under keep-all, at U+2028 and U+2029, and after an overflowing first
  character. Following 27 cost the Safari 26 rows about 2,900 left-to-right and 1,150
  right-to-left line counts, mostly at widths narrower than one character. A profile
  can't tell the two apart: only Safari's own user agent names a version, and the
  other WebKit browsers on iPhone and iPad don't.
- **2026-09-23: each engine's own tables and scans find break opportunities**, in
  place of Pretext's rules and the UAX #14 table. The maintainer accepted the bundle
  growth, about 30 KB gzipped, because the tables made analysis much faster. Whether
  they can shrink, or give way to cheap computation, is checked at the end of the
  project, not before.
- **2026-09-23: premises nobody has falsified may be taken for speed.** The
  maintainer relaxed the correctness-first stance: a premise no real font has
  falsified can be a documented default, ad hoc heuristics go before principled
  rules, and a requirement no real text exercises can be dropped with its cost
  stated. CJK support stays. Examples: text with invisible characters stays on the
  simple walkers, with widths within 10⁻⁹px of the full walker's, and Firefox's
  script-run splits below.
- **2026-09-24: the Gecko scan doesn't split text runs where the script changes**,
  as Firefox's script itemizer does. It was rejected on 2026-09-16 for parity with
  Firefox's break oracle and approved under the relaxed stance: no suite or corpus
  text moves, only mixed-script strings with stray marks, and it removed 189 runtime
  lines. Firefox 156 sides with the splits on those strings
  (`tests/wrapping/VALIDATION.md` at 6fadbe5).
- **2026-09-24: there is no `glue` kind.** Runs of only no-break characters (NBSP,
  U+2007, U+202F, word joiner, U+FEFF) are text, so they take emergency breaks where
  browsers do; the scans already decide where they break, so the kind was only a
  label. Two Chrome cases at 26px that main had right, NBSP, U+202F, NBSP in Courier
  New at letter spacing 1, are accepted losses: the error is a letter-spacing gap
  after U+202F that Chrome doesn't paint (ENGINE_FOLLOWUPS.md).
- **2026-09-24: `setLocale()` stays and only clears the caches.** Line breaking
  follows the page language, and no locale changes the word boundaries Pretext reads
  in Thai, Lao, Khmer and Myanmar text, under 20 locales in V8 and JavaScriptCore.
  Removing it, or making it a language input for Safari's families or an element's
  own `lang`, waits for the end of the project. Replaced on 2026-09-26, below.
- **2026-09-24: Pretext finds grapheme clusters itself, fixed to Unicode 17.**
  Emergency breaks, letter spacing, emoji correction, line text and the Gecko scan's
  clusters come from Chrome 153's and libicucore 78.1's ICU character rules
  (`src/graphemes.ts`), not from each browser's `Intl.Segmenter`, whose graphemes
  were the largest part of preparing new text in Chrome and Safari. The rules give
  each browser's clusters today, Firefox's included, but don't follow a browser to
  another Unicode version: one a version behind would differ on about 1,417 code
  points, about half of them symbols such as chess pieces and playing cards that
  Unicode 17 took out of Extended_Pictographic and most of the rest conjuncts in
  Myanmar, Khmer, Javanese and 11 other scripts. They are refreshed with the line
  tables, which are fixed the same way, when browsers move to Unicode 18. The
  tables add about 4 KB gzipped.
- **2026-09-24: Safari's generic families come from a generated Core Text table**,
  not from measuring through a `<canvas>` element. An element's context runs the
  document's pending style update in every `font` assignment and `measureText()`,
  attached or detached (PLATFORM_BUGS.md), and only an attached one follows the page
  language, which the maintainer rejected as DOM access on 2026-09-12.
- **2026-09-24: `countPreparedLines()` keeps its leading-space skip**, a loop that
  never runs: without it Firefox 156 resized Latin chat messages to new widths in
  1.10 to 1.15 of main's time instead of 0.98. Replaced on 2026-09-26, below.
- **2026-09-24: the full walker got engineering, not heuristics.** The maintainer
  asked for data layout, fewer allocations, smaller representations and plain
  indexed code rather than new shortcuts: its state moved into locals, each
  segment's facts into one byte, and chunks into the hard breaks. It still costs
  three to five times the counter per segment, so one walker for all text was
  rejected (Keeping Work Bounded).
- **2026-09-24: the engine tables land before the new test harness**, judged by
  main's installed gate, the real-text sets and an attribution of every lost row.
  The harness replaces `tests/wrapping` and its snapshots in its own change.
- **2026-09-25: a prepared handle needn't survive a JSON round trip.** Its
  per-segment flags are a `Uint8Array`, which `JSON.stringify()` turns into an
  object without a `length`, so the line walkers never finish on a JSON copy.
  `structuredClone()` and `postMessage()` copies work, README calls the handle
  opaque, and the offline invariants (`harness/invariants.ts`) copy handles with
  `structuredClone()`. Cursors and ranges are plain JSON and resume the same from
  a JSON copy.
- **2026-09-25: the old wrapping suite, its snapshots and its diagnostic tools
  are gone.** Browser-accuracy claims rest on the harness's recordings and
  accepted lists. main's catalog, rich and oracle cases were taken once and stay
  frozen, since their generator went with the suite. The font and Arabic joining
  probes measure browsers, not `src/`, so they still run from 6fadbe5, a commit
  from before their removal. Speed rests on same-document ratios from
  `bun harness bench` in PR descriptions, with nothing timed checked in. The
  benchmark page and `benchmarks/*.json` went once the bench's noise floors were
  calibrated and it called a known change: 217c84b8's `src/` against 6d1d2106's
  reads slower on letter-spaced CJK, soft hyphen, control and pre-wrap layout
  and faster on seen CJK in all three browsers (Reading Browser Output).
- **2026-09-26: `setLocale()` sets the language again**, the one preparation reads
  in place of `<html lang>` for its break rules and measurement context, since it is
  the only way to give a worker the page's language: a worker has no `<html lang>`.
  An empty locale is a page's without a language, and `setLocale()` without one reads
  `<html lang>` again. It still clears the caches, and prepared handles keep what
  they have. A context with a `lang`, as in Chrome and Firefox, takes the language,
  since it would follow the page's otherwise; `bun harness equal` moved no case in
  either. An element's own `lang` still waits for the end of the project.
- **2026-09-26: engines Pretext doesn't recognize take Blink's whole profile**, as
  the docs already said. Three fields had differed: the discretionary hyphen took its
  own letter spacing, a line whose hyphen didn't fit kept it, and on a desktop system
  a line starting inside a segment holding a default-ignorable code point had no
  entry geometry, where desktop Chrome fits the segment's rest by its fresh width.
  Only unrecognized user agents move, such as Samsung TV web views, and the third
  only on desktop ones.
- **2026-09-26: no dead code for one JIT.** Dead or redundant code kept only
  because one JIT runs it faster is removed, whatever the regression, and the
  regression is noted: the effect is accidental, and nobody writing the code
  plainly would reproduce it. A loop's first pass peeled before the loop counts,
  since the loop repeats it. Live code split apart or placed for a JIT isn't dead
  and stays, such as `getLongMarkChainContext()` (#351), `getTextSegmentWidth()`
  (#358) and the analysis' slicing of segment texts (#360). #357 had kept three
  pieces of such dead code for Chrome 154, which now cost it, in both sessions of
  the bench: rich-inline's line stepper without its three checks that change no
  result measures rich stats 11% slower; the full walker without its redundant
  `unfitHyphenRetreat` test lays out letter-spaced CJK 5% slower; and
  `segmentAtLineBreaks()` as one loop from the first unit prepares pre-wrap chunks
  13% and long breakable runs 8% slower (Keeping Work Bounded).
  `countPreparedLines()`'s leading-space skip went too: without it Firefox 156
  resizes Latin chat messages to new widths 3 to 7% slower, and every other resize
  row in the three browsers reads within noise except Firefox's mixed text at
  widths seen before, 8% faster. Nor is a rule written out twice for one JIT: the
  Gecko scan's text run setup and its setup again of the words a bidi level run
  cuts share one word-end test, whose call makes Firefox 156 prepare long
  breakable runs, pre-wrap chunks, keep-all CJK brackets and Latin messages seen
  before 2 to 5% slower than main; with the test also written out in the first
  setup's loop, every one of them reads within noise (Bidi Levels).
- **2026-09-27: the Gecko profile keeps its 80px floor for prefix fits, as a
  premise.** Prefixes model Firefox's whole-word advances better than standalone
  graphemes, and the floor has no browser reason, but a floor at 24px or none made
  Firefox 156 prepare new Latin, Arabic and mixed messages and UI labels 28-68%
  slower. In exchange, 281 adversarial cases at 24-80px would pass and 14 fail, and
  the one real-usage draw that moves would fail. Words narrower than 80px keep summing
  standalone graphemes where lines narrower than 80px split them (Break Opportunities
  From Engine Data).
- **2026-09-27: Firefox's bidi controls are laid out by the Gecko profile's analysis, not
  by its walkers.** A run of soft hyphens and bidi controls with a control in it joins the
  segment before it, and the profile's graphemes and white-space collapse read past such
  characters (Break Opportunities From Engine Data), so neither the walkers nor
  `layout()`'s count know of them. Making the run zero-width glue that the walkers look
  past fixed 39 of the 43 harness cases this fixes, in 23 fewer lines of code (branch
  `gecko-bidi-control-gaps`, 5bc0b58a), but it counted text ending in controls with the
  stepper, which made Firefox's `layout()` of the bench's invisible tails 12 to 13%
  slower, and its test for glue in the shared walkers made some of Chrome's and Firefox's
  worst-case rows that never hold any 5 to 11% slower. The other four are `a`, LRI,
  U+0301, PDI, `b` at 1px, whose mark Firefox keeps with the `a`, and here the two spaces
  around a control also take the room of one, which is about 22 of the 68 lines.
