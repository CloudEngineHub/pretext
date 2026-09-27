import type { PreparedTextWithSegments, LayoutCursor } from './layout.js'
import {
  analyzeText,
  CONTROL,
  HARD_BREAK,
  INNER_BREAKS,
  isCollapsibleSpaceCode,
  KIND_BITS,
  removeSkippableSegmentBreaks,
  RETURNABLE,
  SOFT_HYPHEN,
  TEXT,
  UNBROKEN,
  ZERO_WIDTH_BREAK,
  ZERO_WIDTH_GLUE,
  type TextAnalysis,
} from './analysis.js'
import { getWebKitBreakBetweenItems } from './line-breaks.js'
import { buildLineTextFromRange, getGraphemeEnds } from './line-text.js'
import {
  breaksAfterKind,
  endsLineBefore,
  isDiscretionaryLineEnd,
  normalizePreparedLineStart,
  stepPreparedLineGeometryFromStart,
  type ItemLine,
} from './line-break.js'
import { getEngineProfile, getFontMeasurement, getPreparationLanguage, getSegmentMetrics, readLetterSpacing } from './measurement.js'
import { measureAnalysis } from './prepare.js'

// Helper for rich-text inline flow under `white-space: normal`.
// It keeps the core layout API low-level while taking over the boring shared
// work that rich inline demos kept reimplementing in userland:
// - collapsed boundary whitespace across item boundaries
// - atomic inline boxes like pills
// - per-item extra horizontal chrome such as padding/borders
// - break opportunities across item boundaries as the engine finds them: from the
//   text the items join in Blink and Gecko, and in WebKit from each item's own text
//   and the previous item's last two characters
// - runs that continue across items without a break, which wrap together

declare const preparedRichInlineBrand: unique symbol

export type RichInlineItem = {
  text: string // Raw author text, including any leading/trailing collapsible spaces
  font: string // Canvas font shorthand used to prepare and measure this item
  letterSpacing?: number // Extra horizontal spacing between graphemes, in CSS px
  break?: 'normal' | 'never' // `never` keeps the item atomic, like a pill or mention chip
  extraWidth?: number // Caller-owned horizontal chrome, e.g. padding + border width
}

export type PreparedRichInline = {
  readonly [preparedRichInlineBrand]: true
}

export type RichInlineCursor = {
  itemIndex: number // Index into the original RichInlineItem array
  segmentIndex: number
  graphemeIndex: number
}

export type RichInlineFragment = {
  itemIndex: number // Index into the original RichInlineItem array
  text: string // Text slice for this fragment
  gapBefore: number // Collapsed inter-item gap paid before this fragment on this line
  gapItemIndex: number // Item whose collapsed whitespace made gapBefore, or -1 when no gap precedes this fragment on this line
  occupiedWidth: number // Text width plus the item's extraWidth contribution
  start: LayoutCursor // Start cursor within the item's prepared text
  end: LayoutCursor // End cursor within the item's prepared text
}

export type RichInlineFragmentRange = {
  itemIndex: number // Index into the original RichInlineItem array
  gapBefore: number // Collapsed inter-item gap paid before this fragment on this line
  gapItemIndex: number // Item whose collapsed whitespace made gapBefore, or -1 when no gap precedes this fragment on this line
  occupiedWidth: number // Text width plus the item's extraWidth contribution
  start: LayoutCursor // Start cursor within the item's prepared text
  end: LayoutCursor // End cursor within the item's prepared text
}

export type RichInlineLine = {
  fragments: RichInlineFragment[]
  width: number
  end: RichInlineCursor
}

export type RichInlineLineRange = {
  fragments: RichInlineFragmentRange[]
  width: number
  end: RichInlineCursor
}

export type RichInlineStats = {
  lineCount: number
  maxLineWidth: number
}

type InternalPreparedRichInline = PreparedRichInline & {
  items: Array<PreparedRichInlineItem | undefined>
}

type PreparedRichInlineItem = {
  break: 'normal' | 'never'
  // An ordinary break at the boundary before this item: collapsed whitespace,
  // or a break the joined text offers there.
  breakBefore: boolean
  // The next item continues this item's last run without a break.
  continued: boolean
  // A line walks the item even where it fits whole: where the item is continued and
  // breaks inside, the walk leaves the line's latest break, which the line returns to
  // where the continuing run doesn't fit, a hard break inside it ends the line, and
  // where it starts with source a line start consumes, as a soft hyphen and a space,
  // its whole width leaves out what a line with content before it keeps.
  walked: boolean
  establishesLine: boolean
  extraWidth: number
  gapBefore: number
  // The item whose collapsed whitespace made gapBefore, or -1 without one.
  gapItemIndex: number
  // Where the item before ends with a soft hyphen, the hyphen a line ending at the break
  // before this item paints in the flat text, which rich-inline leaves out
  // (ENGINE_FOLLOWUPS.md); else 0.
  hyphenBefore: number
  // Per segment, the graphemes inside it before which the joined text breaks, in
  // order. Null without any.
  innerBreaks: (number[] | null)[] | null
  naturalWidth: number
  // The item's own handle, which its fragments' cursors follow.
  prepared: PreparedTextWithSegments
  // What the line walkers and fragment text take: `prepared`, or its copy for the full
  // walker (getWalkedHandle), so a fragment paints the hyphen its line fits.
  lineData: PreparedTextWithSegments
}

// An item's text inside a joined window: the whole item, or its text before
// its first collapsible space or after its last one.
type JoinedPortion = {
  item: PreparedRichInlineItem
  itemIndex: number
  start: number // Offset in the window text, set when the window has a boundary
  startSegmentIndex: number // Item segment where the portion starts
  // Segment after the collapsible space that ends the portion, or -1 when the
  // portion ends with the item.
  spaceEndSegmentIndex: number
}

const EMPTY_LAYOUT_CURSOR: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
const RICH_INLINE_START_CURSOR: RichInlineCursor = {
  itemIndex: 0,
  segmentIndex: 0,
  graphemeIndex: 0,
}

function getInternalPreparedRichInline(prepared: PreparedRichInline): InternalPreparedRichInline {
  return prepared as InternalPreparedRichInline
}

function cloneCursor(cursor: LayoutCursor): LayoutCursor {
  return {
    segmentIndex: cursor.segmentIndex,
    graphemeIndex: cursor.graphemeIndex,
  }
}

function isLineStartCursor(cursor: LayoutCursor): boolean {
  return cursor.segmentIndex === 0 && cursor.graphemeIndex === 0
}

function getCollapsedSpaceWidth(font: string, letterSpacing: number, language: string | null): number {
  return getSegmentMetrics(' ', getFontMeasurement(font, language)).width + letterSpacing
}

// The item's width on a line of its own, from `start`, which it moves past what a line
// start consumes; null where that is all of it.
function measureWholeItem(prepared: PreparedTextWithSegments, start: LayoutCursor): number | null {
  return normalizePreparedLineStart(prepared, start) ? stepPreparedLineGeometryFromStart(prepared, cloneCursor(start), Number.POSITIVE_INFINITY) : null
}

// Whether a line can end before segment `index` of an analysis or a handle, as the line
// walker reads their flags.
function breaksBefore(flags: ArrayLike<number>, index: number): boolean {
  return endsLineBefore(flags[index - 1]! & KIND_BITS, flags[index]! & KIND_BITS, (flags[index]! & UNBROKEN) !== 0)
}

// Marks a segment unbroken, as preparation marks one before which the scan gives no
// break: a ZWSP or soft hyphen before it becomes zero-width glue, which is unbroken
// too after a segment that doesn't break after itself, as the scan doesn't break
// before a ZWSP or soft hyphen there. `before` holds the flags of the segment before
// it at `beforeIndex`.
function markUnbroken(flags: Uint8Array, index: number, before: Uint8Array, beforeIndex: number): void {
  flags[index] = flags[index]! & ~RETURNABLE | UNBROKEN
  const kind = before[beforeIndex]! & KIND_BITS
  if (kind !== ZERO_WIDTH_BREAK && kind !== SOFT_HYPHEN) return
  let glue = before[beforeIndex]! & ~KIND_BITS | ZERO_WIDTH_GLUE
  if (beforeIndex > 0 && !breaksAfterKind(before[beforeIndex - 1]! & KIND_BITS)) glue = glue & ~RETURNABLE | UNBROKEN
  before[beforeIndex] = glue
}

// Gives an item the joined text's breaks inside a portion, which its own segments can
// disagree with, in a copy of its flags where they differ (`walkedFlags`,
// getWalkedHandle): a ZWSP or soft hyphen takes the kind of the last of the joined
// text's segments that start inside it, which ends where it ends and which the text
// around it decides, as at the item's start, where the item's own analysis sees the
// start of a text, or where it joins soft hyphens that the joined text splits. That
// kind decides the break after the segment and the hyphen a line that ends there
// paints. After the portion start, a segment that starts where one of the joined
// text's does starts unbroken where that one does, and text that starts inside one of
// the joined text's segments starts unbroken. The joined text's breaks inside the
// item's segments become graphemes there, where the line walker can end a line
// (innerBreaks). The joined text's segments from `startIndex` start at or after the
// portion start.
function recordJoinedBreaks(
  portion: JoinedPortion,
  joined: TextAnalysis,
  startIndex: number,
  portionEnd: number,
  walkedFlags: Array<Uint8Array | undefined>,
): void {
  const { item, itemIndex } = portion
  const { breakableFitAdvances, entryGeometry, segmentFlags, segments } = item.prepared
  const { flags: joinedFlags, starts } = joined
  let j = startIndex
  let segmentStart = portion.start
  for (let i = portion.startSegmentIndex; i < segments.length && segmentStart < portionEnd; i++) {
    const own = segmentFlags[i]!
    const kind = own & KIND_BITS
    let flags = own
    const firstInside = j
    if (starts[j] === segmentStart) {
      if (i > portion.startSegmentIndex) flags = flags & ~UNBROKEN | (joinedFlags[j]! & UNBROKEN)
      j++
    } else if (i > portion.startSegmentIndex && (kind === TEXT || kind === CONTROL)) {
      flags |= UNBROKEN
    }
    const segmentEnd = segmentStart + segments[i]!.length
    for (; j < starts.length && starts[j]! < segmentEnd; j++) {
      // A line ends inside a segment only between graphemes it has fit advances for,
      // and not in one with fresh-line geometry. Grapheme k + 1 starts where k ends.
      if (!breaksBefore(joinedFlags, j) || breakableFitAdvances[i] === null || entryGeometry?.[i] != null) continue
      const grapheme = getGraphemeEnds(item.prepared, i).indexOf(starts[j]! - segmentStart) + 1
      if (grapheme > 0) ((item.innerBreaks ??= Array.from({ length: segments.length }, () => null))[i] ??= []).push(grapheme)
    }
    if (j > firstInside && (kind === ZERO_WIDTH_BREAK || kind === SOFT_HYPHEN || kind === ZERO_WIDTH_GLUE)) flags = flags & ~KIND_BITS | (joinedFlags[j - 1]! & KIND_BITS)
    if (flags !== own) (walkedFlags[itemIndex] ??= segmentFlags.slice())[i] = flags & ~RETURNABLE
    segmentStart = segmentEnd
  }
}

// The handle an item walks on where its lines can continue into the next item or
// come from the previous one without a break, or its segments disagree with the
// joined text: a copy that only the full walker takes, whose flags mark every break
// returnable, as preparation marks text with an unbroken boundary, so a line returns
// to its latest break, which the walker leaves where the line takes the item's end
// (ItemLine).
function getWalkedHandle(prepared: PreparedTextWithSegments, flags: Uint8Array, innerBreaks: (number[] | null)[] | null): PreparedTextWithSegments {
  for (let i = 0; i < flags.length; i++) {
    if ((flags[i]! & UNBROKEN) === 0) flags[i] = flags[i]! | RETURNABLE
    if (innerBreaks !== null && innerBreaks[i] !== null) flags[i] = flags[i]! | INNER_BREAKS
  }
  return { ...prepared, segmentFlags: flags, simpleLineWalkFastPath: false }
}

export function prepareRichInline(items: RichInlineItem[]): PreparedRichInline {
  const preparedItems = Array.from<PreparedRichInlineItem | undefined>({ length: items.length })
  // One language read for every item, the joined analysis and the boundary spaces.
  const profile = getEngineProfile()
  const language = getPreparationLanguage(profile)
  // Blink runs one line-break iterator over the text of the whole inline formatting
  // context, and Gecko collects a word across text frames until a space and breaks it
  // in one pass, so every break fact near a boundary comes from the joined text, as
  // for engines Pretext doesn't recognize, which take Blink's scan. WebKit finds breaks
  // inside each inline box from that box's own text, and decides a boundary between
  // boxes from the previous box's last two characters.
  const breaksFromItemText = profile.lineBreakScan === 'webkit'
  // A collapsed SPACE can have zero or negative advance. Its existence and
  // ordinary break opportunity must survive independently of that number.
  let pendingGapWidth: number | null = null
  let pendingGapItemIndex = -1
  let previousItem: PreparedRichInlineItem | null = null
  // Collapsible spaces always break and atomic items always allow a break on
  // both sides. Only the text between them joins across item boundaries.
  const joinedPortions: JoinedPortion[] = []
  // Whether the window starts after collapsible white space, and after content, which a
  // soft hyphen at its start follows in the paragraph.
  let joinedAfterSpace = false
  let joinedAfterContent = false
  // Per item, a copy of its flags where they differ from the joined text's breaks.
  const walkedFlags: Array<Uint8Array | undefined> = []
  // An item's last two source characters, read as prior context at the next
  // boundary where breaks come from each item's own text.
  const boundaryContexts: string[] = []
  // Blink transforms segment breaks in the text of the whole inline formatting context,
  // where an atomic inline is U+FFFC, so a collapsible run with a newline next to a ZWSP
  // in another item goes too (ShouldRemoveNewline and
  // RemoveTrailingCollapsibleNewlineIfNeeded, inline_items_builder.cc). Where an item
  // holds a newline, the paragraph's text is transformed once, and where that removes a
  // run, each item that isn't atomic takes its part of the result, which can only remove
  // more than the item's own text does, at its ends. Gecko transforms each text frame's
  // own text (nsTextFrameUtils::TransformText), as the item's own text does.
  let transformedTexts: string[] | null = null
  if (profile.lineBreakScan === 'blink' && items.some(item => item.text.includes('\n'))) {
    let source = ''
    const sourceEnds: number[] = []
    for (let index = 0; index < items.length; index++) {
      source += items[index]!.break === 'never' ? '\uFFFC' : items[index]!.text
      sourceEnds.push(source.length)
    }
    const removed: number[] = []
    const transformed = removeSkippableSegmentBreaks(source, profile, language, removed)
    if (removed.length > 0) {
      transformedTexts = []
      for (let index = 0, r = 0, transformedStart = 0; index < items.length; index++) {
        while (r < removed.length && removed[r]! < sourceEnds[index]!) r++
        const transformedEnd = sourceEnds[index]! - r
        transformedTexts.push(transformed.slice(transformedStart, transformedEnd))
        transformedStart = transformedEnd
      }
    }
  }

  function finishJoinedText(): void {
    if (joinedPortions.length > 1) {
      // Only a window with an item boundary needs its text.
      let joinedText = ''
      for (let i = 0; i < joinedPortions.length; i++) {
        const portion = joinedPortions[i]!
        const { segments } = portion.item.prepared
        const endSegmentIndex = portion.spaceEndSegmentIndex < 0 ? segments.length : portion.spaceEndSegmentIndex - 1
        portion.start = joinedText.length
        for (let s = portion.startSegmentIndex; s < endSegmentIndex; s++) joinedText += segments[s]!
      }
      if (breaksFromItemText) {
        // Inside each item, breaks come from its own text, which made its segments, and at
        // a boundary from the scan over the next item's text with the previous item's
        // last two characters as prior context (TextUtil.cpp:374-396).
        for (let i = 1; i < joinedPortions.length; i++) {
          const portion = joinedPortions[i]!
          const end = i + 1 < joinedPortions.length ? joinedPortions[i + 1]!.start : joinedText.length
          portion.item.breakBefore = getWebKitBreakBetweenItems(boundaryContexts[joinedPortions[i - 1]!.itemIndex]!, joinedText.slice(portion.start, end), language)
        }
      } else {
        // Browsers find ordinary break opportunities in the text their inline items
        // join; the item boundary itself is not one. The joined text is analyzed like
        // prepare()'s, after the collapsible space before the window, which Gecko's scan
        // reads in the source, as it reads an item's leading space, and Blink's normalized
        // text drops, and after the content before it (RESEARCH.md, Rich Inline Boundaries).
        const joined = analyzeText(joinedAfterSpace && profile.lineBreakScan === 'gecko' ? ' ' + joinedText : joinedText, profile, 'normal', 'normal', language, joinedAfterContent)
        for (let i = 0, j = 0; i < joinedPortions.length; i++) {
          const portion = joinedPortions[i]!
          while (j < joined.starts.length && joined.starts[j]! < portion.start) j++
          if (i > 0) portion.item.breakBefore = joined.starts[j] === portion.start && breaksBefore(joined.flags, j)
          recordJoinedBreaks(portion, joined, j, i + 1 < joinedPortions.length ? joinedPortions[i + 1]!.start : joinedText.length, walkedFlags)
        }
      }
    }
    joinedPortions.length = 0
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!
    const letterSpacing = readLetterSpacing(item.letterSpacing)
    const text = transformedTexts === null || item.break === 'never'
      ? removeSkippableSegmentBreaks(item.text, profile, language)
      : transformedTexts[index]!
    let start = 0
    while (start < text.length && isCollapsibleSpaceCode(text.charCodeAt(start))) start++

    if (start === text.length) {
      if (start > 0 && pendingGapWidth === null) {
        pendingGapWidth = getCollapsedSpaceWidth(item.font, letterSpacing, language)
        pendingGapItemIndex = index
      }
      continue
    }

    // Scan from the ends once. A trailing-whitespace regex retries every
    // position in a long internal space run when later content prevents a match.
    let end = text.length
    while (end > start && isCollapsibleSpaceCode(text.charCodeAt(end - 1))) end--
    const hasLeadingWhitespace = start > 0
    const hasTrailingWhitespace = end < text.length
    const whitespaceBefore = pendingGapWidth !== null || hasLeadingWhitespace
    if (breaksFromItemText) boundaryContexts[index] = text.slice(Math.max(0, end - 2), end)

    let gapBefore = pendingGapWidth ?? (
      hasLeadingWhitespace ? getCollapsedSpaceWidth(item.font, letterSpacing, language) : 0
    )
    let gapItemIndex = pendingGapWidth !== null ? pendingGapItemIndex : hasLeadingWhitespace ? index : -1
    // Normalization already drops boundary whitespace, so the item's own text
    // yields the same segments while analysis keeps the source before them:
    // a leading SPACE or TAB is break context inside the item's text node.
    // Fragment cursors then index the same segments and graphemes as
    // prepareWithSegments(item.text). An atomic item, which is only laid out whole,
    // is prepared without emergency breaks.
    const itemBreak = item.break ?? 'normal'
    const analysis = analyzeText(item.text, profile, 'normal', 'normal', language)
    const prepared = measureAnalysis(analysis, item.font, true, letterSpacing, profile, language, itemBreak !== 'never') as PreparedTextWithSegments
    // A collapsible space before a hard break goes with the line's end (CSS Text 3
    // §4.1.2), so an item that starts with one has no gap before it.
    if ((prepared.segmentFlags[0]! & KIND_BITS) === HARD_BREAK) {
      gapBefore = 0
      gapItemIndex = -1
    }
    // The flat walker consumes spaces and soft hyphens at a line start, so an
    // item of only those has no whole width. Its result is a measurement
    // observation, not the rich item's identity or source end.
    const wholeStart: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    const wholeWidth = measureWholeItem(prepared, wholeStart)
    const establishesLine = wholeWidth !== null || prepared.kinds.includes('zero-width-break')

    const preparedItem = {
      break: itemBreak,
      breakBefore: whitespaceBefore,
      continued: false,
      walked: prepared.kinds.includes('hard-break') || (wholeWidth !== null && wholeStart.segmentIndex > 0),
      establishesLine,
      extraWidth: item.extraWidth ?? 0,
      gapBefore,
      gapItemIndex,
      hyphenBefore: 0,
      innerBreaks: null,
      naturalWidth: wholeWidth ?? 0,
      prepared,
      lineData: prepared,
    } satisfies PreparedRichInlineItem
    preparedItems[index] = preparedItem

    if (previousItem === null || whitespaceBefore || preparedItem.break === 'never' || previousItem.break === 'never') {
      finishJoinedText()
      preparedItem.breakBefore = whitespaceBefore || previousItem !== null
    }
    if (preparedItem.break === 'never') {
      finishJoinedText()
    } else {
      // Normal-mode segments hold single collapsed spaces. Text beyond the
      // first and last of them cannot reach a neighboring item's boundary.
      const { kinds } = prepared
      const firstSpace = kinds.indexOf('space')
      if (joinedPortions.length === 0) {
        joinedAfterSpace = whitespaceBefore
        joinedAfterContent = previousItem !== null
      }
      joinedPortions.push({
        item: preparedItem,
        itemIndex: index,
        start: 0,
        startSegmentIndex: 0,
        spaceEndSegmentIndex: firstSpace < 0 ? -1 : firstSpace + 1,
      })
      if (firstSpace >= 0) {
        finishJoinedText()
        joinedAfterSpace = true
        joinedAfterContent = true
        joinedPortions.push({
          item: preparedItem,
          itemIndex: index,
          start: 0,
          startSegmentIndex: kinds.lastIndexOf('space') + 1,
          spaceEndSegmentIndex: -1,
        })
      }
    }
    previousItem = preparedItem

    pendingGapWidth = hasTrailingWhitespace
      ? getCollapsedSpaceWidth(item.font, letterSpacing, language)
      : null
    pendingGapItemIndex = hasTrailingWhitespace ? index : -1
  }

  finishJoinedText()

  // Without a break at the next boundary, the previous item's last run continues
  // into the item, whose start is unbroken for the line walker. Where a break comes
  // before an item a line start consumes between them, as one holding only a soft
  // hyphen, the run starts at that break instead, which a line can end at. Where the
  // item right before ends with a soft hyphen, a break before this item is that hyphen's.
  let previousIndex = -1
  // The latest item a line start consumes since the previous item, where a break comes before it.
  let consumedBreakIndex = -1
  for (let index = 0; index < preparedItems.length; index++) {
    const item = preparedItems[index]
    if (item === undefined) continue
    if (item.establishesLine && previousIndex >= 0 && !item.breakBefore) {
      const runIndex = consumedBreakIndex >= 0 ? consumedBreakIndex : previousIndex
      preparedItems[runIndex]!.continued = true
      const before = walkedFlags[runIndex] ??= preparedItems[runIndex]!.prepared.segmentFlags.slice()
      markUnbroken(walkedFlags[index] ??= item.prepared.segmentFlags.slice(), 0, before, before.length - 1)
    }
    const itemBefore = index > 0 ? preparedItems[index - 1] : undefined
    if (itemBefore !== undefined && itemBefore.break === 'normal' && item.gapItemIndex < 0) {
      const flags = walkedFlags[index - 1] ?? itemBefore.prepared.segmentFlags
      if ((flags[flags.length - 1]! & KIND_BITS) === SOFT_HYPHEN) item.hyphenBefore = itemBefore.prepared.discretionaryHyphenWidth
    }
    if (item.establishesLine) {
      previousIndex = index
      consumedBreakIndex = -1
    } else if (item.breakBefore) {
      consumedBreakIndex = index
    }
  }
  for (let index = 0; index < preparedItems.length; index++) {
    const item = preparedItems[index]
    if (item === undefined || (item.innerBreaks === null && walkedFlags[index] === undefined)) continue
    item.lineData = getWalkedHandle(item.prepared, walkedFlags[index] ?? item.prepared.segmentFlags.slice(), item.innerBreaks)
    // A continued item that breaks inside is walked, which leaves the line's latest break.
    const { segmentFlags } = item.lineData
    let breaks = item.continued && item.innerBreaks !== null
    for (let i = 1; item.continued && !breaks && i < segmentFlags.length; i++) breaks = breaksBefore(segmentFlags, i)
    item.walked ||= breaks
  }

  return {
    items: preparedItems,
  } as InternalPreparedRichInline
}

// Emits a fragment covering an item from `start` to its source end.
function collectItemRest(
  fragments: RichInlineFragmentRange[] | null,
  itemIndex: number,
  item: PreparedRichInlineItem,
  start: LayoutCursor,
  gapBefore: number,
  gapItemIndex: number,
  occupiedWidth: number,
): void {
  fragments?.push({
    itemIndex,
    gapBefore,
    gapItemIndex,
    occupiedWidth,
    start: cloneCursor(start),
    end: { segmentIndex: item.prepared.segments.length, graphemeIndex: 0 },
  })
}

// The room a line that ends at a break without a hyphen leaves for the item's hyphen,
// for a return from an unfit soft hyphen to it: Blink's retry leaves room for it.
function getHyphenRoom(item: PreparedRichInlineItem, unfitHyphenRetreat: string): number {
  return unfitHyphenRetreat === 'reduced-width' ? item.prepared.discretionaryHyphenWidth : 0
}

// The line state a walked item takes and leaves, one for every walk.
const itemLine: ItemLine = { continues: false, breakBefore: false, fitsBreakBefore: false, innerBreaks: null, breakSegmentIndex: -1, breakGraphemeIndex: 0, breakWidth: 0 }

function stepRichInlineLine(
  flow: InternalPreparedRichInline,
  maxWidth: number,
  cursor: RichInlineCursor,
  // The line's fragments go here, unless it is null.
  fragments: RichInlineFragmentRange[] | null,
): number | null {
  const safeWidth = Math.max(1, maxWidth)
  const { lineFitEpsilon, unfitHyphenRetreat } = getEngineProfile()
  let hasContent = false
  let lineWidth = 0
  let remainingWidth = safeWidth
  let itemIndex = cursor.itemIndex
  // The line's latest break before the item where no break comes before the item, where
  // a line that can't take the item's start ends, as the flat walker returns to its last
  // break: the item it falls in (-1 without one), where in that item, the line's width
  // there, the fragments the line keeps and the last one's occupied width, and whether
  // a return from an unfit soft hyphen can end the line there. Where a break comes before
  // the item, the line ends there.
  let breakItemIndex = -1
  let breakSegmentIndex = 0
  let breakGraphemeIndex = 0
  let breakLineWidth = 0
  let breakFragmentCount = 0
  let breakOccupiedWidth = 0
  let breakFits = false
  let returnsToBreak = false

  // Every `continue` moves on to the start of the next item.
  for (; itemIndex < flow.items.length; itemIndex++, cursor.segmentIndex = 0, cursor.graphemeIndex = 0) {
    const item = flow.items[itemIndex]
    if (item === undefined) continue
    if (cursor.segmentIndex === item.prepared.segments.length && cursor.graphemeIndex === 0) continue

    // The line can end before a continued item that follows a break, as the run the next
    // item continues can move to the next line.
    if (item.continued && hasContent && item.breakBefore) {
      breakItemIndex = itemIndex
      breakSegmentIndex = 0
      breakGraphemeIndex = 0
      breakLineWidth = lineWidth
      breakFragmentCount = fragments === null ? 0 : fragments.length
      breakFits = lineWidth + (item.hyphenBefore > 0 ? item.hyphenBefore : getHyphenRoom(item, unfitHyphenRetreat)) <= safeWidth + lineFitEpsilon
    }

    const gapBefore = hasContent ? item.gapBefore : 0
    const gapItemIndex = hasContent ? item.gapItemIndex : -1

    // Retain inactive source items in the original coordinate space without
    // turning their mere presence into a line. A following line can still
    // expose their consumed source. After content, the line keeps the collapsed
    // space before such an item, as the flat text keeps a space before a soft
    // hyphen, which hangs where it doesn't fit, as the item takes no room after it.
    if (!item.establishesLine) {
      collectItemRest(fragments, itemIndex, item, EMPTY_LAYOUT_CURSOR, gapBefore, gapItemIndex, 0)
      lineWidth += gapBefore
      remainingWidth = safeWidth - lineWidth
      continue
    }
    const atItemStart = isLineStartCursor(cursor)

    if (item.break === 'never') {
      if (!atItemStart) continue

      const occupiedWidth = item.naturalWidth + item.extraWidth
      const totalWidth = gapBefore + occupiedWidth
      if (hasContent && totalWidth > remainingWidth + lineFitEpsilon) break

      collectItemRest(fragments, itemIndex, item, EMPTY_LAYOUT_CURSOR, gapBefore, gapItemIndex, occupiedWidth)
      hasContent = true
      lineWidth += totalWidth
      remainingWidth = safeWidth - lineWidth
      continue
    }

    // Every fit check here, including the line walker's, allows its fit epsilon.
    const reservedWidth = gapBefore + item.extraWidth
    if (hasContent && reservedWidth > remainingWidth + lineFitEpsilon) {
      returnsToBreak = !item.breakBefore
      break
    }

    if (atItemStart && !item.walked) {
      const totalWidth = reservedWidth + item.naturalWidth
      if (totalWidth <= remainingWidth + lineFitEpsilon) {
        collectItemRest(fragments, itemIndex, item, EMPTY_LAYOUT_CURSOR, gapBefore, gapItemIndex, item.naturalWidth + item.extraWidth)
        hasContent = true
        lineWidth += totalWidth
        remainingWidth = safeWidth - lineWidth
        continue
      }
    }

    // The walk continues the line's content, where it has some, and ends before the
    // item where it can't take the item's start and the line has a break there or
    // earlier. A return from an unfit soft hyphen ends the line at the break before the
    // item where that line fits, with room for the hyphen in Blink's retry, or with the
    // hyphen where the break follows one.
    const lineEnd: LayoutCursor = {
      segmentIndex: cursor.segmentIndex,
      graphemeIndex: cursor.graphemeIndex,
    }
    // A line start consumes the rest of the item, such as a soft hyphen, and a line
    // that starts at zero-width glue keeps it without taking it as content. A zero-width
    // break that only the joined text gives at the item's start follows text, so a line
    // start consumes it too, where the item's own ZWSP there holds the line.
    if (!hasContent) {
      if (atItemStart && (item.lineData.segmentFlags[0]! & KIND_BITS) === ZERO_WIDTH_BREAK && (item.prepared.segmentFlags[0]! & KIND_BITS) !== ZERO_WIDTH_BREAK) lineEnd.segmentIndex = 1
      if (!normalizePreparedLineStart(item.lineData, lineEnd)) continue
    }
    itemLine.continues = hasContent
    itemLine.breakBefore = hasContent && (item.breakBefore || breakItemIndex >= 0)
    // An engine that keeps an unfit hyphen returns only to a break before a run that
    // continues from an earlier item.
    itemLine.fitsBreakBefore = hasContent && (item.breakBefore
      ? unfitHyphenRetreat !== 'none' && lineWidth + (item.hyphenBefore > 0 ? item.hyphenBefore : getHyphenRoom(item, unfitHyphenRetreat)) <= safeWidth + lineFitEpsilon
      : breakFits)
    itemLine.innerBreaks = item.innerBreaks
    itemLine.breakSegmentIndex = -1
    itemLine.breakGraphemeIndex = 0
    const availableWidth = hasContent ? remainingWidth - reservedWidth : Math.max(1, remainingWidth - reservedWidth)
    const lineWidthForItem = stepPreparedLineGeometryFromStart(item.lineData, lineEnd, availableWidth, itemLine)
    if (lineWidthForItem === null) {
      collectItemRest(fragments, itemIndex, item, cursor, 0, -1, 0)
      continue
    }
    if (
      cursor.segmentIndex === lineEnd.segmentIndex &&
      cursor.graphemeIndex === lineEnd.graphemeIndex
    ) {
      if (!hasContent) continue
      returnsToBreak = !item.breakBefore
      break
    }

    const itemOccupiedWidth = lineWidthForItem + item.extraWidth
    const lineWidthBefore = lineWidth
    fragments?.push({
      itemIndex,
      gapBefore,
      gapItemIndex,
      occupiedWidth: itemOccupiedWidth,
      start: cloneCursor(cursor),
      end: { segmentIndex: lineEnd.segmentIndex, graphemeIndex: lineEnd.graphemeIndex },
    })
    hasContent = true
    lineWidth += gapBefore + itemOccupiedWidth
    remainingWidth = safeWidth - lineWidth

    // A line that takes the item's end goes on, unless a hard break ends it there,
    // from the latest break the walk leaves.
    if (
      lineEnd.segmentIndex === item.prepared.segments.length &&
      lineEnd.graphemeIndex === 0 &&
      (item.prepared.segmentFlags[lineEnd.segmentIndex - 1]! & KIND_BITS) !== HARD_BREAK
    ) {
      if (itemLine.breakSegmentIndex > cursor.segmentIndex || itemLine.breakGraphemeIndex > 0) {
        breakItemIndex = itemIndex
        breakSegmentIndex = itemLine.breakSegmentIndex
        breakGraphemeIndex = itemLine.breakGraphemeIndex
        breakOccupiedWidth = itemLine.breakWidth + item.extraWidth
        breakLineWidth = lineWidthBefore + (gapBefore + breakOccupiedWidth)
        breakFragmentCount = fragments === null ? 0 : fragments.length
        breakFits = breakLineWidth + (
          isDiscretionaryLineEnd(item.lineData.segmentFlags, breakSegmentIndex, breakGraphemeIndex) ? 0 : getHyphenRoom(item, unfitHyphenRetreat)
        ) <= safeWidth + lineFitEpsilon
      }
      continue
    }

    cursor.segmentIndex = lineEnd.segmentIndex
    cursor.graphemeIndex = lineEnd.graphemeIndex
    break
  }

  if (returnsToBreak && breakItemIndex >= 0) {
    itemIndex = breakItemIndex
    lineWidth = breakLineWidth
    cursor.segmentIndex = breakSegmentIndex
    cursor.graphemeIndex = breakGraphemeIndex
    if (fragments !== null) {
      fragments.length = breakFragmentCount
      if (breakSegmentIndex > 0 || breakGraphemeIndex > 0) {
        const fragment = fragments[breakFragmentCount - 1]!
        fragment.occupiedWidth = breakOccupiedWidth
        fragment.end = { segmentIndex: breakSegmentIndex, graphemeIndex: breakGraphemeIndex }
      }
    }
  }
  if (!hasContent) return null

  cursor.itemIndex = itemIndex
  return lineWidth
}

export function layoutNextRichInlineLineRange(
  prepared: PreparedRichInline,
  maxWidth: number,
  start: RichInlineCursor = RICH_INLINE_START_CURSOR,
): RichInlineLineRange | null {
  const flow = getInternalPreparedRichInline(prepared)
  const end: RichInlineCursor = {
    itemIndex: start.itemIndex,
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex,
  }
  const fragments: RichInlineFragmentRange[] = []
  const width = stepRichInlineLine(flow, maxWidth, end, fragments)
  if (width === null) return null

  // As in the text line APIs, only the reported width is clamped at zero;
  // fitting keeps each item's signed advance.
  return {
    fragments,
    width: Math.max(0, width),
    end,
  }
}

function materializeFragmentText(
  item: PreparedRichInlineItem,
  fragment: RichInlineFragmentRange,
): string {
  return buildLineTextFromRange(
    item.lineData,
    fragment.start.segmentIndex,
    fragment.start.graphemeIndex,
    fragment.end.segmentIndex,
    fragment.end.graphemeIndex,
  )
}

// Bridge from cheap range walking to full fragment text. Lets callers do
// shrinkwrap/virtualization/probing work first, then only pay for text on the
// lines they actually render.
export function materializeRichInlineLineRange(
  prepared: PreparedRichInline,
  line: RichInlineLineRange,
): RichInlineLine {
  const flow = getInternalPreparedRichInline(prepared)
  const fragments: RichInlineFragment[] = []

  for (let i = 0; i < line.fragments.length; i++) {
    const fragment = line.fragments[i]!
    const item = flow.items[fragment.itemIndex]
    if (item === undefined) throw new Error('Missing rich-text inline item for fragment')
    fragments.push({
      itemIndex: fragment.itemIndex,
      text: materializeFragmentText(item, fragment),
      gapBefore: fragment.gapBefore,
      gapItemIndex: fragment.gapItemIndex,
      occupiedWidth: fragment.occupiedWidth,
      start: fragment.start,
      end: fragment.end,
    })
  }

  return {
    fragments,
    width: line.width,
    end: line.end,
  }
}

export function walkRichInlineLineRanges(
  prepared: PreparedRichInline,
  maxWidth: number,
  onLine: (line: RichInlineLineRange) => void,
): number {
  let lineCount = 0
  const cursor = { ...RICH_INLINE_START_CURSOR }

  while (true) {
    const line = layoutNextRichInlineLineRange(prepared, maxWidth, cursor)
    if (line === null) return lineCount
    cursor.itemIndex = line.end.itemIndex
    cursor.segmentIndex = line.end.segmentIndex
    cursor.graphemeIndex = line.end.graphemeIndex
    onLine(line)
    lineCount++
  }
}

export function measureRichInlineStats(
  prepared: PreparedRichInline,
  maxWidth: number,
): RichInlineStats {
  const flow = getInternalPreparedRichInline(prepared)
  let lineCount = 0
  let maxLineWidth = 0
  const cursor: RichInlineCursor = {
    itemIndex: 0,
    segmentIndex: 0,
    graphemeIndex: 0,
  }

  while (true) {
    const lineWidth = stepRichInlineLine(flow, maxWidth, cursor, null)
    if (lineWidth === null) {
      return {
        lineCount,
        maxLineWidth,
      }
    }
    lineCount++
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
  }
}
