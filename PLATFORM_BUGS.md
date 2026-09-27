# Platform Bugs

This is the ledger of browser and operating-system behaviour that affects Pretext: reports we filed or follow, what Pretext does about each and what can go once one is fixed; then behaviour that's by design or unreported, and what looked like a bug and wasn't. How the engines lay text out is in `RESEARCH.md`, "Engine Facts".

Entries were measured on macOS at a device pixel ratio of 2 unless they say otherwise; Windows is untested, and an iOS device checked only Safari's generic families (iOS 27, 2026-09-24). `Exact` means the report holds our repro or the same failure, `Related` that it explains the behaviour but not our case. Each status is dated by when it was last read.

**Rechecking.** Mozilla's and WebKit's Bugzillas answer `curl` on their REST API: `curl -s 'https://bugzilla.mozilla.org/rest/bug/2075174?include_fields=status,resolution,last_change_time'`, and the same path on `bugs.webkit.org`. issues.chromium.org draws its pages in script, so read them in a signed-in browser once loaded.

**Filing.** Search the tracker first; where a report covers the case, comment there with the repro instead of filing another, as on WebKit #285993. Write in plain words, without AI tone or jargon, with a small standalone repro page when the bug deserves one. The agent fills in the form and the maintainer submits it. Unfiled candidates are filed together at the end of the project. A crash or hang found while probing goes in as a restricted security report and stays out of public issues, branches and this file until triaged. <!-- Q2: recommendation taken; the maintainer hasn't answered --> <!-- Q2 note: filing rules stated as project rules, not quoted -->

## Open bugs

### Chrome and Firefox: Canvas measures emoji too wide at small sizes

- **Reports:** [Chromium #489494015](https://issues.chromium.org/issues/489494015), open, no activity (2026-09-12). [Mozilla #2020894](https://bugzilla.mozilla.org/show_bug.cgi?id=2020894), `UNCONFIRMED`, untouched since March (2026-09-27). Both exact.
- **Behaviour:** `measureText()` gives Apple Color Emoji more width than the page draws, once per emoji, by an amount that depends only on the size: in March 2026 (build not recorded) Chrome's gap was 4 px at 14-16 px and none from 24 px. Headed on 2026-09-15 (Chrome 153, Firefox 155), `1`, `#`, `*`, `©` and `✔` with U+FE0F took the full gap, and U+FE0F after a letter, a space, U+3000 or a soft hyphen none. Headless runs at DPR 1 can hide it.
- **Pretext:** `prepare()` reads the gap once per font from one hidden DOM span, one of the DOM exceptions in `AGENTS.md`, and subtracts it per emoji. It's still needed: headed on 2026-06-22, the accuracy sweep (removed 2026-09-05) lost 20 of 7,680 cases in Chrome and 28 in Firefox without it, and none with it. A worker has no document, so there's no correction there ([#292](https://github.com/chenglou/pretext/issues/292); PR #346 proposes a hand-off from the page), and it ignores `devicePixelRatio` (`ENGINE_FOLLOWUPS.md`). <!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: side finding 6 as an ENGINE_FOLLOWUPS gap --> The rebuild's formulas from the width at the device size (`RESEARCH.md`, "Content Language And Fonts") would drop the DOM read and work in workers, at the cost of prepared widths that depend on the DPR; they belong as comments on both reports.
- **When fixed:** the correction goes for that engine.

### Chrome: `system-ui` in Canvas and DOM

- **Report:** [Chromium #489579956](https://issues.chromium.org/issues/489579956), open, assigned (2026-09-12). Exact.
- **Behaviour:** Canvas and DOM pick different SF Pro optical variants at some sizes, which move between releases and pages. Blink's font cache key holds the zoomed size while `opsz` follows the specified one, so at DPR 2 a 13 px span and a 26 px Canvas font share an entry, and whichever came first decides both: 13 px DOM text measured 67.875 px in a fresh renderer and 60.5703125 px after a Canvas measured 26 px (Chrome 153, 2026-09-18). So measuring `system-ui` can move the page's own text; main measures at the `text-rendering` that shares the page's entry (not checked on main).
- **Pretext:** unsupported for accuracy. The README says to use a named font, and [#336](https://github.com/chenglou/pretext/issues/336) says what supporting it would take. The rebuild's page for the cache key is for a comment on the report.

### Firefox: `system-ui` in Canvas and DOM

- **Report:** [Mozilla #2020917](https://bugzilla.mozilla.org/show_bug.cgi?id=2020917), `UNCONFIRMED`, untouched since April (2026-09-27). Exact, though its "different font" is wrong.
- **Behaviour:** an OffscreenCanvas never applies automatic optical sizing (`nsFont.cpp:276-279`), so `system-ui` gets the DOM's family at another optical size: DOM text with `font-optical-sizing: none` equals it at 13, 14, 16 and 20 px (Firefox 156.0, 2026-09-18). By the source, any font with an optical-size axis is measured the same way, web fonts such as Inter included (not measured). The Markdown chat's overflow in [#202](https://github.com/chenglou/pretext/issues/202) was this: one `14px -apple-system, …` fragment measured 206.68 px in an OffscreenCanvas and 238.12 px in DOM text (Firefox 152, 2026-09-03).
- **Pretext:** unsupported, as for Chrome. The rebuild's page is for a comment that corrects the report.

### Chrome: a Canvas remembers what it measured

- **Report:** [Chromium #560614560](https://issues.chromium.org/issues/560614560), `Unconfirmed` (2026-09-12, the day we filed it). Exact.
- **Behaviour:** on one context, a string's width can depend on what the context measured before. Chrome keeps shaped text per canvas, keyed by characters and direction only, and the first shaping wins with the script it resolved. In fonts with Latin-only punctuation forms, such as Amiri and Noto Naskh Arabic, the form kept first decides: in 16 px Amiri, `)` measured 4.080 px on a new context and 7.328 px after `(\u0628\u2060\u0628)`, where DOM layout gave 4.094 px (Chrome 153.0.8010.36, 2026-09-12). Reassigning the font, `reset()` and resizing don't clear it.
- **Pretext:** no workaround. Preparation keeps one context and replaces it only when preparation's language changes, never on `clearCache()`, so a paragraph with brackets beside Arabic or Hebrew can wrap differently depending on what the page prepared before. A new context per preparation was rejected: it moved unrelated Amiri results both ways, and a new context still disagrees with the DOM for `\u0101 )` (18.720 px against 15.484 px).
- **When fixed:** the Chrome cases this moves leave `harness/varying/chrome.txt`, where they're `order` entries.

### Firefox: the late family names

- **Report:** [Mozilla #2075174](https://bugzilla.mozilla.org/show_bug.cgi?id=2075174), filed by the maintainer on 2026-09-24; `NEW`, marked a likely regression from Mozilla #2063742, `wontfix` for 156 and affected in 157 to 159 (2026-09-27). Exact.
- **Behaviour:** a Canvas context resolves its font families at its first measurement, but Firefox reads localized family names, such as `ヒラギノ角ゴ ProN`, and single faces' legacy names, such as `Avenir Next Condensed Heavy`, only 8 s after start-up (60 s on Windows, by the source), or soon after a lookup of a non-ASCII name misses. DOM text then reflows onto the right font, while a context that measured the font string before keeps the fallback for life. Since Firefox 156 nothing a page assigns to an OffscreenCanvas heals it; a change to `document.fonts` does. With the page loaded first in a newly started Firefox 156.0.1, `20px "ヒラギノ角ゴ ProN", monospace` measured `Hamburgefonstiv 0123` at monospace's 240.67 px in 11 of 11 starts, while a new context and DOM text moved to 230.77 px 2 to 4 s after load. The English name gave 230.77 px from the start, and Chrome 153 and Safari 27 found the family at once (2026-09-24). 9 of 22 family names from common CSS font lists arrive late on this Mac.
- **Pretext:** no workaround. With one context for the life of the page, every later preparation of a font string first measured in that window keeps the fallback's widths, `clearCache()` or not, and nothing the page can see says when to prepare again. English family names avoid it (`"Hiragino Kaku Gothic ProN"`, or the English name first), as the README's named-font caveat says. <!-- Q5: recommendation taken; the maintainer hasn't answered --> A context per prepared paragraph, as the rebuild keeps in Firefox, would cost 3.8-3.9 µs each, 0.12-0.25 s per 10,000 plain messages (Firefox 156, 2026-09-20); main hasn't taken or rejected that.
- **Separately**, cause not traced: emoji beside Arial laid out differently when recorded 11 s after launch than at 12, 15 or 30 s (91 cases, pinned Firefox 156, 2026-09-24), so Firefox harness jobs hold their first document until 15 s after launch.
- **When fixed:** nothing to remove; the English-names advice stays while 156 is in use.

### Safari: Canvas text has no language

- **Report:** [WebKit #285993](https://bugs.webkit.org/show_bug.cgi?id=285993), `NEW` (2026-09-27). Related: it tracks the canvas `lang` attribute, whose default, `inherit`, is what's missing. Our comment there has a repro.
- **Behaviour:** an OffscreenCanvas, a transferred canvas and a detached `<canvas lang>` measure with no language, while DOM text and a connected `<canvas>` follow the page. It shows wherever a generic family, `system-ui` or glyph fallback depends on the language: under `<html lang="ko">`, 32 px `sans-serif` `永骨` is 64 px in an OffscreenCanvas and 55.36 px in DOM text (WebKit 22625.1.29.11.27, Safari 27's, 2026-09-18; Safari 26.5.2 and the iOS 26 simulator the same).
- **Pretext:** preparation names in the Canvas font the families Safari gives the generic keywords under the page's language, from a table of Core Text's answers (`src/generated/webkit-generic-families.ts`). A connected `<canvas>` was rejected: its `font` setter and `measureText()` run the document's pending style update, 20 to 91 ms per `measureText()` after one `insertRule()` on pages of 300 and 3,000 rows, against under 0.03 ms on an OffscreenCanvas (Safari 27, 2026-09-24). Still off: `system-ui`, whose OffscreenCanvas fallback follows the OS languages, and characters a named family lacks.
- **When fixed:** the generated table and its generator can go.

### Safari: `keep-all` and punctuation

- **Reports:** [WebKit #312099](https://bugs.webkit.org/show_bug.cgi?id=312099), fixed in 311090@main for Safari 27; [WebKit #298022](https://bugs.webkit.org/show_bug.cgi?id=298022), the broader punctuation report, `NEW` (2026-09-27). Exact.
- **Behaviour:** CSS Text says `word-break` doesn't change punctuation break opportunities ([WPT `word-break-keep-all-006`](https://wpt.fyi/results/css/css-text/word-break/word-break-keep-all-006.html)). Safari 26 breaks `keep-all` text only at spaces. Safari 27 breaks after every punctuation character except the text's last, `(` included, though only in text holding a character above U+00FF.
- **Pretext:** the WebKit scan follows Safari 27, Latin-1 test included; Safari 26 is a known gap.
- **Unfiled follow-ups**, with pages (WebKit 22625.1.29.11.27, 2026-09-18): the fix breaks Korean text inside `1,000,000`, `3.14`, `U.S.A.` and `12:30` and after `(`. And it follows a string's storage, not its characters: ASCII text sliced from a string holding U+4E2D, or parsed from JSON that holds one, stays 16-bit and breaks after a comma where a literal doesn't. Pretext can't see storage.

### Safari: wheel scrolling after a page's `scrollTo()`

- **Reports:** [WebKit #262287](https://bugs.webkit.org/show_bug.cgi?id=262287), fixed in 308215@main (Related); [WebKit #324310](https://bugs.webkit.org/show_bug.cgi?id=324310), `NEW`, for what's left (Exact). Both 2026-09-27.
- **Behaviour:** during a wheel scroll, after a page removes content above the viewport and calls `scrollTo()` to keep the view in place, the next wheel event can apply to the old position, so `scrollTop` reads stale and the content skips: 10 to 18 stale reads per run on a plain scroller in installed Safari 26.5.2, none in Chrome 153 and Firefox 155. Safari Technology Preview 27.0 reads none, but drops wheel input while the `scrollTo()` is pending (2026-09-15; not rechecked on Safari 27.0).
- **Pretext:** the Markdown chat's chunked history window (#312) skips up to 28 messages in Safari from it. Main's chat scrolls from script only to anchor on resize and to jump.

### WebKit: extra `Range` rectangles on wrapped text

- **Report:** [WebKit #296765](https://bugs.webkit.org/show_bug.cgi?id=296765), `NEW` (2026-09-27). Related.
- **Behaviour:** a `Range` across wrapped text can report an extra zero-width rectangle on the preceding line. Safari 27 no longer gives a line-initial character one at the end of the previous line (2026-09-16). <!-- Q7: recommendation taken; the maintainer hasn't answered --> <!-- Q7 note: the old suite's row count is dropped -->
- **Pretext:** diagnostics only. The harness reads each code point's positive-size rectangles; a span per character moves WebKit's breaks (`RESEARCH.md`, "Reading Browser Output").

### Filed, and not reaching Pretext

- [WebKit #324036](https://bugs.webkit.org/show_bug.cgi?id=324036), filed by us, `NEW` (2026-09-27): JavaScriptCore's `Intl.Segmenter` `containing(n)` also returns the previous segment when code unit n starts a surrogate pair (for `' \u{1F600}'`, `containing(1)` gives index 0, length 3), in Safari 26.5.2 and Bun 1.4.0 (2026-09-12) and in Safari 27's source. Pretext doesn't call it; a test under Bun that does gets this answer.
- Chromium 564022255 and 564022256, filed under the maintainer's account on 2026-09-20, not read since: `getTextClusters()`, behind a flag in Chrome 153, wraps cluster starts past 65,535 in one shaped item and gives equal strings stored one-byte and two-byte different clusters. Pretext doesn't call it; what it would buy is in `RESEARCH.md`, "Engine Facts".
- [WebKit #230339](https://bugs.webkit.org/show_bug.cgi?id=230339), `NEW` since 2021 (2026-09-27): a tab in a 16 px Menlo span inside a 16 px Times New Roman block ends at 8 Menlo spaces (77.063 px), where CSS Text, Chrome and Firefox end it at 8 of the block's (32 px) (WebKit 22625.1.29.11.27, 2026-09-18). Rich inline collapses tabs and plain text has one font. The rebuild's page can go on the report.

## By design, or unfiled

The rebuild's pages for the unfiled bugs are in `rebuild/platform-bugs/pages/` on branch `rebuild-20260916`, run in Chrome 153.0.8010.50, Firefox 156.0 and WebKit 22625.1.29.11.27 on 2026-09-18; Bugzilla searches found no report for them, and issues.chromium.org wasn't searched. Its candidates that don't reach main have pages there too. <!-- Q10 placeholder: the rebuild's LEDGER.md on that public branch describes a withheld report, so this points at the pages directory only until the maintainer answers -->

### Firefox: Canvas measures at a rounded font size

By design: `QuantizeFontSize()` keeps 7 significant bits so the font cache doesn't fill with near-equal sizes, while DOM text keeps 10 and then rounds to 1/60 px. So an OffscreenCanvas measures 13.33 px as 13.375 px at any DPR, while the DOM lays out 13.375 px itself at 13.3833 px, which explains the residual once called unknown. <!-- Q18: recommendation taken; the maintainer hasn't answered --> <!-- Q18 note: side finding 13 corrects the old "1/64px grid" sentence --> At 13.33 px, Chrome's and Firefox's default button size, the same 3 test paragraphs changed line count at every DPR tested, while whole-pixel sizes matched within 0.02 px (Firefox 155.0.1, 2026-09-14). The README recommends whole pixels. Rescaling widths from the rounded size was rejected for leaving that residual; with both roundings known it may leave none, which would reopen it.

### Firefox: a text-presentation emoji changes later emoji

Unfiled: two readings, in pinned Firefox 156.0, need reconciling first. In the harness, once a document had laid out `❤️😀︎❤️` in Arial, later documents in the same process drew `😀` 18 px wide where other runs gave 17 px, in 5 of 6 fresh processes (2026-09-24). The rebuild's page shows that once U+1F600 U+FE0E is shaped in a new content process, plain U+1F600 in Arial is a missing-glyph box in new contexts and DOM text until Firefox's character-map loader finishes about 3 s later (7 of 7 processes, 2026-09-18). A width measured then stays cached until `clearCache()`, and the emoji correction is wrong then too. The harness lays out Firefox's U+FE0E cases last and never pins them.

### Safari: a kept Canvas context misses a loaded `FontFace`

Unfiled, with no page or tracker search yet (the rebuild's probes, WebKit 22625.1.29.11.27, 2026-09-20). With no `@font-face` rule and no face in `document.fonts`, a context that measured `32px "Late", monospace` keeps the fallback after `await f.load(); document.fonts.add(f)`, while a new context uses the face: WebKit leaves the font set out of its cache key while the set is empty, and the set tells its observers before inserting. The same font string again doesn't heal it; another string and back does. Main keeps one context and assigns each prepared font in turn, so it keeps the fallback until the page prepares another font, and cached widths until `clearCache()` (not run on main). Adding the face before it loads, or an `@font-face` rule, avoids it.

### Canvas spacing and controls that disagree with the page

Unfiled, from the rebuild's pages (2026-09-18):
- Chrome 153: a `<canvas>` element takes CSS `letter-spacing` and `word-spacing` from its element, times the DPR, and `'0px'` doesn't clear them; `measureText()` under `wordSpacing` depends on order, through the cache of Chromium #560614560.
- Firefox 156: Canvas `wordSpacing` spaces U+3000 and skips U+00A0, the reverse of CSS; Canvas `letterSpacing` spaces joined Arabic letters apart where the DOM adds nothing (بيت in 40 px Geeza Pro at 8 px: 73.350 px against 49.350 px); an OffscreenCanvas measures bidi and C0 controls the DOM hides.
- WebKit: Canvas `letterSpacing` keeps the optional ligatures CSS letter spacing turns off (`ffi fl` in 32 px Hoefler Text at 1 px: 57.400 px against 63.408 px).

Pretext measures on an OffscreenCanvas, never sets `wordSpacing`, and gives Firefox's hidden controls no width. It takes Canvas `letterSpacing` only for some widths at a line's edges (`measureWithLetterSpacing()`), where the Firefox and WebKit spacing bugs reach it (not measured on main).

### Firefox: Thai, Lao, Khmer and Burmese words from a model

Unfiled on purpose. Firefox's `Intl.Segmenter` runs a small model over every character, 24-30 times slower than Chrome's and Safari's dictionaries (0.6 ms per Thai chat message against 0.02 ms) and 90-93% of Thai `prepare()` in Firefox; Firefox breaks its own lines with it, so the segmenter gives exactly its breaks (Firefox 155 and 156, 2026-09-16 and 09-25). It's a deliberate trade for a small download; the closest report is Mozilla #1744875.

### Engine rules Pretext models

- Safari fits a line with 1/64 px to spare where Chrome and Firefox take 0.005 px, because WebKit's `availableWidth()` adds `LayoutUnit::epsilon()` (`InlineLineBuilder.cpp:1172-1183`, webkit-7625.1.29.11.27). The case behind it, `الأحمد, the results`, stayed on one line at about 150.0139 px in a 150 px box (Safari 26.4, June 2026). WebKit adds it only where its source does; main applies it at every fit.
- An overlong word breaks by measured prefixes in Safari, and in Firefox in segments 80 px and wider; Chrome sums lone graphemes (`RESEARCH.md`, "Break Opportunities From Engine Data"). <!-- Q13 placeholder: the maintainer's answer on Firefox's 80 px floor (measure a 24 px floor and exact everywhere, or keep 80 as a premise with its gap) goes here -->
- Safari 27 breaks lines differently from Safari 26 on purpose (`RESEARCH.md`, Decisions Log, 2026-09-16); the profile follows 27, since only Safari's own user agent names a version.
- Safari 27 lays line boxes on the 1/64 px grid, so three 20.96 px lines are 62.875 px tall, not 60 px as in Safari 26. `layout()` returns n × `lineHeight`, within 1/64 px, and the harness counts lines from rectangle positions, not the block's height.

## Investigated, not platform bugs

- [#195](https://github.com/chenglou/pretext/issues/195): Shantell Sans bold wraps unlike Pretext in Chrome 152 and Firefox 152 (2026-09-03), but whole-run Canvas and DOM widths agree; the gap is Pretext's per-letter sums (`RESEARCH.md`, "Content Language And Fonts"). <!-- Q6: recommendation taken; the maintainer hasn't answered --> <!-- Q6 note: FONT_DIAGNOSTICS.md folded into RESEARCH.md -->
- An element's own `lang` doesn't reach an OffscreenCanvas; `<html lang>` does, within 0.05 px in Chrome 153 and Firefox 155 (2026-09-14). pdf.js says Firefox's Canvas follows the OS language ([Mozilla #1869001](https://bugzilla.mozilla.org/show_bug.cgi?id=1869001), on Windows); on this Chinese-language Mac that holds only in a worker, for a context with no language.
- After `<html lang>` changes, Chrome's OffscreenCanvas keeps an unchanged font string's fonts from the old language (headless Chromium 147: `骨直中文` in 20 px Helvetica Neue stays 80 px after `en` → `ko`, where a new context gives 69.2 px). The [HTML spec](https://html.spec.whatwg.org/multipage/canvas.html#offscreencanvas-inherited-lang) sets an OffscreenCanvas's inherited language once, when it's created, so we didn't file it; preparation replaces the context when its language changes.
- Safari's Canvas and DOM agree on emoji, though Apple Color Emoji is wider than `font-size` at small sizes (16 px at 12 px): compare Canvas with the DOM, never with the font size.
