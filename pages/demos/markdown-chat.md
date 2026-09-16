# Markdown chat patterns

The [Markdown chat demo](https://chenglou.me/pretext/markdown-chat/) renders 10,000 distinct markdown messages with Pretext: exact heights before paint, only the messages on screen in the DOM, and the message you're reading held in place while the window resizes. This guide lists the patterns behind it: what a naive app does and what goes wrong, what the chat does, and when you can skip it. Pick the ones your content and history size need.

`markdown-chat.model.ts` parses, prepares and lays out without touching the DOM; `markdown-chat.ts` runs the frame loop and paints. Banners cover the top and bottom of the viewport. The "Show virtualization mask" button makes them see-through, so you can watch rows come and go.

## Which patterns you need

- Every app that measures text with Pretext: [measure what you paint](#measure-what-you-paint), [prepare once, lay out per width](#prepare-once-lay-out-per-width), and the painting patterns its content needs.
- A history too long to keep in the DOM: [the frame loop](#the-frame-loop) and [virtualize the rows](#virtualize-the-rows).
- Widths that change while someone reads: [keep the reading position](#keep-the-reading-position).

The chat prepares every message at startup and keeps them all. What that costs:

| Messages | First message on screen | JS heap at the end of a run | Worst frame, a resize |
|---|---|---|---|
| 10,000 | 0.65-0.74 s | 48 MB | 7.9-13.1 ms |
| 100,000 | 4.9-5.4 s | 402 MB | 54.9-55.2 ms |

Measured in installed Chrome 153 on an Apple M5 Max, headed at a device pixel ratio of 2, in a 1280×900 frame with an 860 px chat. A frame's time is its main-thread task in Chrome's trace, and ranges span separate runs. The runs came before [#325](https://github.com/chenglou/pretext/pull/325) simplified painting. By code reading, #325 didn't change preparation or the height pass, but the numbers weren't measured again. Nothing below 10,000 or between 10,000 and 100,000 messages was measured in a browser.

## Measure what you paint

### The model owns every value Pretext measures

A naive app writes typography twice, as canvas font strings for Pretext and as CSS for the page, and the two drift. The chat once measured links at weight 500 and painted them at 400, and painted headings with letter spacing Pretext never saw ([#264](https://github.com/chenglou/pretext/pull/264)). Now each run of text carries a `TextStyle` from `resolveTextStyle()`. Pretext prepares with its `font` and `letterSpacing`, and `applyTextStyle()` paints the same values inline. The values CSS still needs, such as the code font and pill padding, go into root custom properties from the model's constants. Skip it only for text Pretext doesn't measure.

### Named fonts, a page language, whole-pixel sizes

With `-apple-system`, the chat's text overflowed its bubbles in Firefox on macOS ([issue #202](https://github.com/chenglou/pretext/issues/202)). The chat uses named font stacks (`SANS_FAMILY`, `SERIF_FAMILY`, `MONO_FAMILY`), `<html lang="en">` and whole-pixel sizes. README's [caveats](../../README.md#caveats) say why each matters. Don't skip it for measured text.

### Padding counts as width; outlines take no room

Padding around an inline piece such as a code span is width Pretext has to count. A CSS `border` inside a width the model computed pushes the content in: before [#279](https://github.com/chenglou/pretext/pull/279), code sat 13 px from one edge of its box and 11 px from the other, instead of 12 and 12. The chat passes padding as `extraWidth` (`createCodePiece()`, `createImagePiece()`) and gives image chips `break: 'never'` so they stay whole. It draws the outlines of code boxes and user bubbles as inset `box-shadow`s, which take no room. Skip it when nothing inside a measured width has padding or a border.

## Prepare once, lay out per width

### Prepare each block once

Preparing measures text with canvas; layout is arithmetic over the widths it cached. A naive app prepares again on every resize, or measures in the DOM. In Chrome 153, parsing and preparing all 10,000 messages took 382-571 ms with warm and cold caches (measured before [#286](https://github.com/chenglou/pretext/pull/286)). A resize that lays them all out again takes at most 7.9-13.1 ms.

`createPreparedChatMessages()` runs once, at startup. It lexes each message with `marked.lexer()` and prepares one text per block, since one paragraph's lines never depend on another's:

- paragraphs, headings and list-item text with `prepareRichInline()`, one item per run of same-styled text, with links and styles kept in arrays beside the items (`hrefs`, `styles`);
- code fences, tables and block HTML with `prepareWithSegments(text, font, { whiteSpace: 'pre-wrap' })`;
- a hard break starts a new block, since rich-inline text supports only `white-space: normal`.

For plain text, `prepare()` per paragraph is enough. Never prepare again for a new width.

### Heights from line counts; lines only for rows on screen

A naive app lays every message out into lines on each width change. Before #286 the chat built an object for every message and block on each width change and allocated 11-14 MB. Garbage collection pushed its slowest resize frames to 14-17 ms (in Node). Now `layoutConversation()` asks each block only for a line count, through `measureRichInlineStats()` or `layout()`. `layoutMessage()` walks one message's lines (`walkRichInlineLineRanges()` with `materializeRichInlineLineRange()`, or `layoutWithLines()` for code), and only when its row is built or the chat width changes. Both wrap at `getBlockLineWidth()` and size blocks with `getBlockHeight()`, so painted lines match counted heights. Skip it when building every message's lines per width fits your frame. No threshold was measured.

### Heights and tops in typed arrays, without the page chrome

`ConversationLayout` keeps every message's height and top in two `Float64Array`s, 16 bytes per message, filled by one loop per chat width. Only a new chat width lays out again (`needsRelayout` in `render()`). Tops leave out the banners, so when the banners switch between 61 and 43 px on short viewports, nothing is laid out again; the canvas height adds them instead. A naive app stores tops in page coordinates, where a header that changes height moves every top. Skip it when histories are small and nothing above the list changes height.

## The frame loop

### Events only schedule a frame

Doing the work inside scroll and resize handlers reads and writes the DOM several times a frame, and handlers for different events race. The chat's listeners only record a fact and schedule a frame: the scroll listener is passive, `resize` schedules, and the toggle's click sets `st.events.toggleVisualization`. `scheduleRender()` requests at most one animation frame. `render()` handles every input together, then clears the events. When nothing happens, no frame runs. Skip it when the page has one source of events and nothing depends on the scroll position.

### Read, compute, write, then scroll

`render()` reads the scroller's `clientWidth`, `clientHeight` and `scrollTop` once each. Then it computes the chat width, layout, anchor, target scroll position and visible range without touching the DOM. It stores the new state and writes the root custom properties, the canvas height and the rows. Last, and only if the position has to change, it calls `scrollTo()` and reads `scrollTop` back. The canvas height goes first, or the browser clamps the scroll to the old height. A naive app interleaves reads and writes, so the browser lays out again at each read. The model's functions, such as `findVisibleRange()` and `findScrollAnchor()`, take numbers, so you can test the scroll logic in Node. Don't skip this one.

### Size from the scroller, with scrollbar room reserved

A classic scrollbar takes about 15 px. You get one when macOS is set to always show scrollbars, and in Chrome on Windows and Linux. It appears when content first overflows, and no `resize` event fires. Before [#283](https://github.com/chenglou/pretext/pull/283), the chat's first frame read 640 px. The scrollbar then left 625 px, and the chat stayed 15 px too wide until the first scroll. The chat's scroller, `.chat-viewport`, has `scrollbar-gutter: stable`, and `render()` reads that element's own `clientWidth`. A page that scrolls as a whole needs `html { scrollbar-gutter: stable }` and `document.body.clientWidth` instead. Skip it only if the layout doesn't depend on the scroller's width: overlay scrollbars take no room, but you can't count on them.

## Virtualize the rows

### Find the visible messages by binary search

A naive app loops over every message, reads row rectangles from the DOM, or uses `IntersectionObserver`, which only reports on elements already in the DOM. `findVisibleRange()` runs two binary searches over `tops`: for the first message whose bottom is below the top banner, then for the first whose top is at or past the bottom banner. Because tops leave out the banner, the top of the visible area in tops coordinates is just `scrollTop`. At 100,000 messages a search takes 17 steps. Skip it when a loop over every message fits your frame.

### Mount only the rows between the banners, and keep them

Only messages overlapping the area between the banners get rows. The canvas height adds both banners, so the first and last messages can scroll into that area. `projectVisibleRows()` removes rows that left the range and writes each row's top. It inserts new rows before the first kept row, so DOM order stays message order, which should keep tab, selection and screen-reader order right; the chat doesn't check that. A row is its message's bubble: `renderMessageContents()` lays the message out and builds its contents in a `DocumentFragment`, when the row is created and again only when the chat width changes. Every line, marker, code box and rule inside it is absolutely positioned from model values; CSS only paints. A naive app rebuilds every visible row on each frame, or forgets to rebuild them on resize. The chat mounts nothing beyond the visible area, so a scroll the browser paints before `render()` responds can show a blank edge. A margin of extra rows would cover small scrolls. Skip it when you render every message.

## Paint rich and mixed-direction text

### One line box per Pretext line

A naive painter lays a line's styled pieces out as a flex row, or places each piece by x. Flex places items left to right, so a right-to-left paragraph came out with its words in the wrong order ([#273](https://github.com/chenglou/pretext/pull/273)). `renderInlineBlock()` paints each Pretext line as one absolutely positioned `div` with `white-space: nowrap`, holding plain spans and links. The `div` carries the paragraph's `dir`, font and line height, and the browser orders the mixed-direction runs inside the line. Pretext doesn't order mixed-direction text itself, so numbers or punctuation next to a line break can still come out in a different order than in a paragraph the browser wraps. A line row can't re-wrap, either, so a measuring error shows as overflow rather than a wrong height. Skip it when you paint each paragraph natively as one element with its direction set; heights then depend on the browser's line breaks matching Pretext's.

### Paint each space in the element whose font measured it

When differently styled runs meet at a space, Pretext measures that space in one of their fonts, and a space in the code font is wider than one in the body font. Before [#310](https://github.com/chenglou/pretext/pull/310), the chat painted words up to 3.53 px off native layout in Chrome, Safari and Firefox. Each rich-inline fragment reports `gapItemIndex`, the item whose space comes before it on its line. `renderInlineBlock()` paints the space inside that item's element: the fragment's own, the previous fragment's, or a span of its own. Words now sit within 0.01 px of native. Skip it when every run on a line shares one font and letter spacing.

### Decide a paragraph's direction once

Setting `dir=auto` on each separately painted line flips any line of an Arabic paragraph that starts with an English word. `resolveDirection()` decides a paragraph's direction once, at preparation, from its first strong character: the first letter with a direction of its own, as `dir=auto` reads it. Code blocks and rules take the direction of the first paragraph around them (`inheritDirection()`). For a right-to-left block, `renderBlock()` starts indents, markers, code boxes, rules and quote rails from the right, and code still reads left to right inside its box. Before #273, markers and quote rails sat on the left whatever the direction. The Arabic answer near the end of the thread ([#328](https://github.com/chenglou/pretext/pull/328)) shows the result. Skip it only if no right-to-left script can appear, and in a chat users decide that.

### Shrinkwrap bubbles in the same walk

A user bubble is as wide as its widest block plus padding, up to a maximum. `layoutMessage()` finds that width in the walk that builds the lines, with no search over widths. An inline block counts its indent plus its widest line, a code box its indent plus its box, and a rule only its indent, since it stretches across the final bubble. Counting a rule at full width made a short message's bubble span its maximum width ([#261](https://github.com/chenglou/pretext/pull/261)). Pretext's line widths leave out spaces that hang at a wrap, so a code box sized from them doesn't stick out of the column ([#308](https://github.com/chenglou/pretext/pull/308)). Skip it when every message spans the column.

### Paint text, never HTML

`marked.parse()` plus `innerHTML` runs any markup inside a message as HTML, since marked doesn't sanitize its output, and a `javascript:` link runs script when clicked. The chat only lexes. Raw HTML becomes a code block or body text, every paint is `textContent` or a text node, and `parseMarkdownHref()` keeps a link only if it's an `http:` or `https:` URL. Skip it when the content is trusted.

## Keep the reading position

### Anchor a message when heights above it change

When the width changes, every message above the viewport rewraps, and a scroll position left alone shows different content. Before [#302](https://github.com/chenglou/pretext/pull/302), resizing slid the chat by up to 590 px in Chrome. The chat keeps an anchor: a message index, and how far that message's top sits below the top banner. In `render()`, a `scrollTop` other than where the last frame left it means the user scrolled. `findScrollAnchor()` then picks the first message whose top shows below the banner, in the layout the user scrolled. Otherwise the anchor stays. After laying out again, the target is `tops[anchor.index] - anchor.offset`, clamped to the scroll range. Through resizes, the anchored message moved 0 px in Chrome 153 and Safari 26.5.2, and 0.07 px in Firefox 155. Only the anchor holds still: a message at mid-screen still moves. Skip it when nothing above the viewport changes height while someone reads.

### Store the scroll position the browser reports back

Browsers round `scrollTop`, so the value read after `scrollTo()` can differ from the value asked for. The chat stores what it reads back, and the next frame compares with that, with no flag. A naive app stores the value it asked for, or sets a "programmatic scroll" flag. Then it mistakes rounding, or its own scroll event, for a user scroll. Adding each frame's height change to `scrollTop`, instead of starting from the anchor, lets that rounding add up. Skip it when the app never writes `scrollTop`.

### Open on the latest message

`st.scrollAnchor` starts as `'end'`. Until the user scrolls, the target is the end of the scroll range, so a width change keeps the last message showing. The first frame writes the canvas height and the last rows before its `scrollTo()`, so the first paint already shows the end (#328). That needs exact heights: with estimated heights, the end keeps moving as real heights arrive. Skip it when your chat opens elsewhere.

## Not covered

- **Streaming a message.** The chat has no append path. Markdown isn't stable while it grows: a closing `**` or a later `===` line changes what came before. So re-lex the whole message on each token, and reuse the prepared blocks whose text and styles didn't change. [Issue #313](https://github.com/chenglou/pretext/issues/313) has numbers.
- **Selection and find across rows that scroll out.** A row leaves the DOM when it scrolls out and is rebuilt when the width changes, so a selection or focus inside it is lost. Find-in-page sees only mounted rows.
- **Keyboard and screen readers across virtualized rows.** Only mounted rows exist. A link that wraps, or holds bold text, paints one `<a>` per fragment, so one link becomes several tab stops. Nothing was checked with a keyboard or a screen reader.
- **Web fonts that load late.** The chat uses installed fonts. A prepared handle keeps the widths it was measured with, and Pretext caches widths by font string. After a web font loads, call `clearCache()` and prepare again.
- **Layout in workers.** It isn't exact today: Pretext's emoji width correction measures a DOM span, and a worker has no DOM ([issue #292](https://github.com/chenglou/pretext/issues/292)).
- **Content Pretext can't size.** The chat draws images as chips of their alt text, and tables as code text. Images without known sizes, embeds and math would need measuring after mount, plus anchoring.

## Tried and dropped

These reasons come from design arguments, not measurements, unless a number says otherwise.

- **Estimated heights.** An estimate that's too large skips messages that are really on screen, and the scrollbar thumb gets the wrong size. Content jumps when real heights arrive, and a jump to a message lands off. Pretext gives exact heights before paint, so there's nothing to correct.
- **Correcting heights with `ResizeObserver`.** The heights arrive after the frame has painted, and Pretext already knows them.
- **Pooling DOM nodes.** At most 20 messages were on screen in 800 and 1,600 px tall viewports (in Node), so there's little to save. Reusing a node would also tie state such as a selection or focus to whichever node gets reused.
- **A window over loaded chunks.** Draft [#312](https://github.com/chenglou/pretext/pull/312) prepared and laid out only chunks of 24 messages around the screen, and left unloaded chunks out of the scroll area rather than giving them placeholder heights. Every painted frame stayed exact. At 100,000 messages a resize took at most 1.7 ms against the chat's 54.9 ms, and the heap ended at 42 MB against 402 MB (the table's setup). But the scrollbar covered only the loaded chunks, and its thumb jumped on each load, which feels bad. A scrollbar that covers the whole history exactly needs every message's height at the current width, which is the chat's model. Safari 26.5.2 also skipped content when a chunk loaded above during a wheel scroll ([`PLATFORM_BUGS.md`](../../PLATFORM_BUGS.md)).
