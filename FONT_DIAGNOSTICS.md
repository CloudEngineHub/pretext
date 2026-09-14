# Font context diagnostics

Findings from the optional font-probe tool: why whole-word, individual-letter and
line-prefix measurements differ. It is development tooling, not part of the
library's layout path. General measurement pitfalls belong in
[RESEARCH.md](RESEARCH.md#reading-browser-output).

The tool uses the Google Fonts request from [#195](https://github.com/chenglou/pretext/issues/195)
and fails if the requested face is absent. That live URL does not pin a font
revision; a fallback font is not valid evidence.

Repeated-letter controls sample 48 nearby wrap thresholds.

## Shantell Sans

On September 3, 2026, `bold 15px "Shantell Sans"`, 56 `x` characters, a 140px
content width and `pre-wrap` produced native lines of 15/15/15/11 characters versus
Pretext's 16/16/16/8 in Chrome 152 and Firefox 152. Firefox's whole-run DOM and
Canvas widths both measured 501.75px; isolated characters summed to 480.66665px.
Agreement on the whole word did not establish its internal widths.

Enabling the existing prefix model fixed that width, but matched only 16/48
nearby thresholds for each Shantell face in Chrome. It was rejected. Chrome's
first bold `x` measured about 8.586px alone, 8.969px inside the whole DOM run, and
8.961px in Canvas when the following character was retained. That extra context
mattered, but the browsers did not use it alike:

| Diagnostic model | Chrome | Safari 26.5.2 |
| --- | --- | --- |
| Retain one following grapheme for fitting | 48/48 for both Shantell faces and Arial | 16/48 for each Shantell face; 48/48 for Arial |
| Reshape each line prefix | Insufficient for Shantell | 42/48 for each Shantell face |

These results support a contextual fit model for the tested inputs, not arbitrary
shaping, exact painted widths, or an unconditional browser policy.

## Language context

For `foo-bar日本語` in `18px serif`, the September 3 probe set `lang=ja` on its
test element in a `lang=en` page. Firefox's DOM measured 114.867px versus
106.983px in the offscreen canvas, which follows `<html lang>`, not the element.
An HTML canvas with `lang=ja` restored 114.867px. Chrome showed the same kind of
difference; named Times New Roman controls agreed in both browsers. With
`lang=ja` on `<html>`, installed Chrome 153 and Firefox 155 later measured this
text at 114.86px in both OffscreenCanvas and DOM.

Safari's language-matched canvas, which the probe never attaches to the page,
still measured 106.972px against the DOM's 114.859px; its named-font control
agreed. Safari measures a detached `<canvas lang>` with no language
([PLATFORM_BUGS.md](PLATFORM_BUGS.md)), and Pretext's OffscreenCanvas never
follows the page language there, so matching `lang` alone is not a
cross-browser solution.

The [Canvas text-style specification](https://html.spec.whatwg.org/multipage/canvas.html#text-styles)
includes language context.

In headless Chromium 147, `20px "Helvetica Neue"` measured `骨直中文` at 80px under
`<html lang=en>`. After switching to `ko`, assigning the same font string to that
OffscreenCanvas context still gave 80px; a new context and the DOM gave 69.2px.
Preparation therefore starts with a new context and empty caches after the page
language changes. Headless WebKit 26.4's OffscreenCanvas gave 80px in both
languages.

## Firefox joined Arabic advances

Pretext measures Arabic letters on each side of a soft hyphen or an emergency
break at isolated widths. Gecko fits a line from the advances of the whole shaped
word and does not reshape at a break, so a joined letter keeps the glyph the font
chose for its neighbour. A Canvas total gives one equation per string, so no
recipe can split a word for every font.

`bun run probe:arabic-joining --browser=firefox --output=<dir>` compares DOM
`Range` advances inside the intact word, and native soft-hyphen and emergency
thresholds, with Canvas recipes. On September 12, 2026, installed Firefox 155 at
DPR 2 measured 200 words from each Arabic and Urdu corpus plus witnesses, 1,808
rows per font setup. Widths pass within 1/60px. A false accept is a partition the
pair additivity gate admitted whose widths did not match.

| Font setup | Isolated widths | Per-grapheme ZWJ forms | Prefix + ZWJ |
| --- | --- | --- | --- |
| `16px "Noto Naskh Arabic"` | 144 pass / 1,432 fail | 1,458 / 118, 0 false accepts | 1,098 / 50, 0 false accepts |
| `16px Arial` (system Arabic fallback) | 300 / 1,276 | 1,462 / 114, 0 false accepts | 1,104 / 44, 0 false accepts |
| `16px "Geeza Pro"` | 316 / 1,260 | 1,432 / 144, 42 false accepts | 1,095 / 53, 21 false accepts |
| `16px Georgia` (fallback) | 316 / 1,260 | 1,054 / 522, 10 false accepts | 936 / 212, 10 false accepts |
| `16px Amiri` | 82 / 1,494 | 746 / 830, 0 false accepts | 702 / 446, 20 false accepts |
| `16px "Noto Nastaliq Urdu"` | 94 / 1,482 | 438 / 1,138, 12 false accepts | 474 / 674, 66 false accepts |

The 24px setups gave the same picture. The ZWJ forms need an rtl canvas: the same
queries in an ltr canvas failed more than half the widths. Across the corpus
words, per-grapheme forms took 66 distinct Canvas queries, prefixes 147 and the
gate 243, against 45 for isolated widths.

Per-grapheme ZWJ forms recover the joined advances for Noto Naskh Arabic and for
the system Arabic font behind Latin font stacks. Amiri and Noto Nastaliq Urdu are
out of reach: most widths still fail, or the gate admits wrong partitions. A
Firefox rule therefore needs the gate and a fallback to isolated widths per font.
