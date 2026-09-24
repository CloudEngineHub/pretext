// The library used the way an app uses it, in the page: one Canvas font string per run style, maxWidth = the case's
// width, and the prepare options main documents. A case with several run styles goes through rich-inline, one item per
// run. Line cursors index the library's segments, which are the source after white-space normalization, so the adapter
// aligns them with the source and returns UTF-16 source offsets. `run.ts --lib` bundles another build in place of src/.
import { prepareWithSegments, setLocale, walkLineRanges, type LayoutCursor, type PrepareOptions, type PreparedTextWithSegments } from '../src/layout.ts'
import { prepareRichInline, walkRichInlineLineRanges, type RichInlineItem } from '../src/rich-inline.ts'
import type { Case, CssFont, Prediction, PredictedLine, TextRun } from './types.ts'

function sameStyle(a: TextRun, b: TextRun): boolean {
  return a.font.family === b.font.family && a.font.size === b.font.size && a.font.weight === b.font.weight
    && a.font.style === b.font.style && a.letterSpacing === b.letterSpacing && a.wordSpacing === b.wordSpacing
}

// Why the library can't express the case, or null.
export function unsupported(c: Case): string | null {
  const p = c.paragraph
  const reasons: string[] = []
  if (p.whiteSpace !== 'normal' && p.whiteSpace !== 'pre-wrap') reasons.push(`white-space ${p.whiteSpace}`)
  if (p.wordBreak !== 'normal' && p.wordBreak !== 'keep-all') reasons.push(`word-break ${p.wordBreak}`)
  if (p.overflowWrap !== 'break-word') reasons.push(`overflow-wrap ${p.overflowWrap}`)
  if (p.lineBreak !== 'auto') reasons.push(`line-break ${p.lineBreak}`)
  let rich = false
  for (let i = 0; i < p.runs.length; i++) {
    const run = p.runs[i]!
    if (run.wordSpacing !== 0) reasons.push('word-spacing')
    if (run.lang !== null && run.lang !== p.lang) reasons.push('a span lang differs from the paragraph\'s')
    if (!sameStyle(run, p.runs[0]!)) rich = true
    if (run.text.includes('\t') && p.whiteSpace === 'pre-wrap' && p.tabSize !== 8) reasons.push(`tab-size ${p.tabSize}`)
  }
  if (rich && (p.whiteSpace !== 'normal' || p.wordBreak !== 'normal')) reasons.push('rich-inline takes white-space: normal and word-break: normal only')
  return reasons.length === 0 ? null : `unsupported: ${[...new Set(reasons)].join('; ')}`
}

// Canvas font shorthand, as an app writes it: '16px Arial', 'italic 700 16px "Helvetica Neue"'.
export function canvasFont(font: CssFont): string {
  return `${font.style === 'italic' ? 'italic ' : ''}${font.weight === 400 ? '' : `${font.weight} `}${font.size}px ${font.family}`
}

const COLLAPSIBLE = /^[ \t\n\r\f]$/

// For each UTF-16 unit of the library's segment stream, the source range it stands for. Normalization only rewrites or
// removes white space (normal: a run of SPACE, TAB, LF, CR and FF becomes one SPACE, a leading and a trailing one go,
// and some engines remove a run with LF next to a ZWSP; pre-wrap: CRLF, CR and FF become LF), so a greedy walk aligns
// the two. null when they don't align.
export function alignStream(source: string, stream: string, whiteSpace: 'normal' | 'pre-wrap'): { starts: Int32Array; ends: Int32Array } | null {
  const starts = new Int32Array(stream.length)
  const ends = new Int32Array(stream.length)
  let s = 0
  for (let n = 0; n < stream.length; n++) {
    const unit = stream[n]!
    for (;;) {
      if (s >= source.length) return null
      const ch = source[s]!
      if (whiteSpace === 'normal' && unit === ' ' && COLLAPSIBLE.test(ch)) {
        starts[n] = s
        while (s < source.length && COLLAPSIBLE.test(source[s]!)) s++
        ends[n] = s
        break
      }
      if (whiteSpace === 'pre-wrap' && unit === '\n' && (ch === '\r' || ch === '\f')) {
        starts[n] = s
        s += ch === '\r' && source[s + 1] === '\n' ? 2 : 1
        ends[n] = s
        break
      }
      if (ch === unit) {
        starts[n] = s
        ends[n] = ++s
        break
      }
      if (whiteSpace === 'normal' && COLLAPSIBLE.test(ch)) {
        s++
        continue
      }
      return null
    }
  }
  for (; s < source.length; s++) if (whiteSpace === 'pre-wrap' || !COLLAPSIBLE.test(source[s]!)) return null
  return { starts, ends }
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Maps the library's cursors in one prepared text to UTF-16 source ranges: `range(start, end)` for the cursors of a line
// or a fragment.
function sourceRanges(source: string, prepared: PreparedTextWithSegments, whiteSpace: 'normal' | 'pre-wrap'): (start: LayoutCursor, end: LayoutCursor) => { start: number; end: number } {
  const segments = prepared.segments
  const stream = segments.join('')
  const aligned = alignStream(source, stream, whiteSpace)
  if (aligned === null) throw new Error('adapter: the library\'s segments don\'t align with the source text')
  const segmentStarts: number[] = []
  for (let i = 0, offset = 0; i < segments.length; i++) {
    segmentStarts.push(offset)
    offset += segments[i]!.length
  }
  const unit = (cursor: LayoutCursor): number => {
    if (cursor.segmentIndex >= segments.length) return stream.length
    let at = segmentStarts[cursor.segmentIndex]!
    if (cursor.graphemeIndex > 0) {
      let k = 0
      for (const g of graphemes.segment(segments[cursor.segmentIndex]!)) if (k++ === cursor.graphemeIndex) at += g.index
    }
    return at
  }
  return (startCursor, endCursor) => {
    const from = unit(startCursor)
    const to = unit(endCursor)
    const start = from < stream.length ? aligned.starts[from]! : source.length
    return { start, end: to > from ? aligned.ends[to - 1]! : start }
  }
}

// measureText calls, counted on the Canvas prototypes while a prediction runs.
let counting = false
let calls = 0
function countCalls(proto: { measureText: (this: unknown, text: string) => TextMetrics } | undefined): void {
  if (proto === undefined) return
  const original = proto.measureText
  proto.measureText = function (this: unknown, text: string): TextMetrics {
    if (counting) calls++
    return original.call(this, text)
  }
}
countCalls(typeof CanvasRenderingContext2D === 'undefined' ? undefined : CanvasRenderingContext2D.prototype)
countCalls(typeof OffscreenCanvasRenderingContext2D === 'undefined' ? undefined : OffscreenCanvasRenderingContext2D.prototype)

let locale: string | null = null

export function predict(c: Case): Prediction {
  const problem = unsupported(c)
  if (problem !== null) return { error: problem }
  const p = c.paragraph
  // An app sets the locale when its content language changes; setLocale() also clears the library's caches.
  if (locale !== p.lang) {
    locale = p.lang
    setLocale(p.lang === '' ? undefined : p.lang)
  }
  const whiteSpace = p.whiteSpace === 'pre-wrap' ? 'pre-wrap' : 'normal'
  const runs = p.runs
  let rich = false
  for (let i = 1; i < runs.length; i++) if (!sameStyle(runs[i]!, runs[0]!)) rich = true
  const lines: PredictedLine[] = []
  calls = 0
  counting = true
  try {
    if (!rich) {
      let source = ''
      for (let i = 0; i < runs.length; i++) source += runs[i]!.text
      const options: PrepareOptions = {}
      if (whiteSpace === 'pre-wrap') options.whiteSpace = 'pre-wrap'
      if (p.wordBreak === 'keep-all') options.wordBreak = 'keep-all'
      if (runs[0]!.letterSpacing !== 0) options.letterSpacing = runs[0]!.letterSpacing
      const prepared = prepareWithSegments(source, canvasFont(runs[0]!.font), options)
      const ranges: Array<{ start: LayoutCursor; end: LayoutCursor; width: number }> = []
      walkLineRanges(prepared, p.width, line => { ranges.push(line) })
      counting = false
      const range = sourceRanges(source, prepared, whiteSpace)
      for (let i = 0; i < ranges.length; i++) lines.push({ ...range(ranges[i]!.start, ranges[i]!.end), width: ranges[i]!.width })
    } else {
      const items: RichInlineItem[] = []
      for (let i = 0; i < runs.length; i++) items.push({ text: runs[i]!.text, font: canvasFont(runs[i]!.font), ...(runs[i]!.letterSpacing === 0 ? {} : { letterSpacing: runs[i]!.letterSpacing }) })
      const ranges: Array<{ fragments: Array<{ itemIndex: number; start: LayoutCursor; end: LayoutCursor }>; width: number }> = []
      walkRichInlineLineRanges(prepareRichInline(items), p.width, line => { ranges.push(line) })
      counting = false
      // Fragment cursors index prepareWithSegments(item.text) of the item's font and letter spacing.
      const maps: Array<ReturnType<typeof sourceRanges> | undefined> = []
      const bases: number[] = []
      for (let i = 0, base = 0; i < items.length; i++) {
        bases.push(base)
        base += items[i]!.text.length
      }
      const fragment = (f: { itemIndex: number; start: LayoutCursor; end: LayoutCursor }): { start: number; end: number } => {
        const run = runs[f.itemIndex]!
        const map = maps[f.itemIndex] ??= sourceRanges(run.text, prepareWithSegments(run.text, items[f.itemIndex]!.font, run.letterSpacing === 0 ? {} : { letterSpacing: run.letterSpacing }), 'normal')
        const range = map(f.start, f.end)
        return { start: bases[f.itemIndex]! + range.start, end: bases[f.itemIndex]! + range.end }
      }
      let previousEnd = 0
      for (let i = 0; i < ranges.length; i++) {
        const fragments = ranges[i]!.fragments
        const first = fragments[0]
        const last = fragments[fragments.length - 1]
        const start = first === undefined ? previousEnd : fragment(first).start
        const end = last === undefined ? previousEnd : fragment(last).end
        lines.push({ start, end, width: ranges[i]!.width })
        previousEnd = end
      }
    }
  } catch (error) {
    return { error: `threw: ${error instanceof Error ? error.message : String(error)}` }
  } finally {
    counting = false
  }
  return { lines, calls }
}
