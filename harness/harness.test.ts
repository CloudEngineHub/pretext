// Planted defects: each test plants one fault the harness exists to catch and checks that it is caught. The test name
// says what an app developer would see if the fault went unseen.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { groupLines, recordedLines, scanLineEnds, searchLineEnds, type RectsAt } from './observe.ts'
import { documents } from './run.ts'
import { accept, attribute, freshRecordings, judge, libraryFaults, predictionChange, reverseOrder, score, type Outcome } from './score.ts'
import { assertSameEnvironment, caseProblem, parseRecording, readRecordings, recordingText, splitHistory, writeRecordings } from './store.ts'
import type { Case, Failure, Prediction, Recording, Rect } from './types.ts'

// A browser stand-in: the text laid out with a line starting at each of `starts`, every code point 8 px wide (a space 4)
// and 18 px tall in a 20 px line. Returns the recording `record` would make and the rect reader it made it from.
function layOut(text: string, starts: number[]): { recording: Recording; nodeRects: Rect[]; rectsAt: RectsAt; reads: () => number } {
  const rects = new Map<number, Rect[]>()
  const nodeRects: Rect[] = []
  let line = -1
  let x = 0
  for (let offset = 0; offset < text.length; offset += text.codePointAt(offset)! > 0xffff ? 2 : 1) {
    if (starts[line + 1] === offset) {
      line++
      x = 0
      nodeRects.push({ x: 0, y: line * 20 + 1, width: 0, height: 18 })
    }
    // U+200B has no width, like a zero-width character in a browser.
    const width = text[offset] === '\u200b' ? 0 : text[offset] === ' ' ? 4 : 8
    rects.set(offset, [{ x, y: line * 20 + 1, width, height: 18 }])
    x += width
    nodeRects[line]!.width = x
  }
  let reads = 0
  const rectsAt: RectsAt = offset => {
    reads++
    return rects.get(offset) ?? []
  }
  return { recording: { lines: recordedLines(text, nodeRects, 20, rectsAt, false), height: starts.length * 20 }, nodeRects, rectsAt, reads: () => reads }
}

function predicted(text: string, starts: number[]): Prediction {
  const lines = []
  for (let i = 0; i < starts.length; i++) lines.push({ start: starts[i]!, end: starts[i + 1] ?? text.length, width: 0 })
  return { lines, prepareCalls: 0, lineCalls: 0, disagreement: null }
}

const TEXT = 'The quick brown fox jumps over the lazy dog'
const STARTS = [0, 10, 20, 31]

describe('the pass rule', () => {
  test('a dropped last line fails: a message would lose its last line and its bubble would be too short', () => {
    const { recording } = layOut(TEXT, STARTS)
    expect(score(recording, predicted(TEXT, STARTS)).status).toBe('pass')
    const outcome = score(recording, predicted(TEXT, [0, 10, 20]))
    expect(outcome.status).toBe('count')
    expect(outcome.line).toBe(3)
  })

  test('a break moved by one character fails even with the right line count: a word would paint on the wrong line at the right height', () => {
    const { recording } = layOut(TEXT, STARTS)
    for (const starts of [[0, 11, 20, 31], [0, 9, 20, 31], [0, 10, 20, 32]]) {
      const outcome = score(recording, predicted(TEXT, starts))
      expect(outcome.status).toBe('breaks')
    }
  })

  test('a letter after a soft hyphen is checked on its own line: a wrong break at a hyphen would pass unseen', () => {
    // Chrome 153's rects for "a\u00ADb\u000B" (RTL, 17.85 px): the break is at the soft hyphen, and the "b" after it also
    // reports the hyphen's box on the line above (census row c-1af8783d8fa18040). Main predicted "b" on line 0.
    const points: Rect[][] = [
      [{ x: 3.6171875, y: 15, width: 8.8984375, height: 18 }],
      [{ x: 12.515625, y: 15, width: 0, height: 18 }, { x: 12.515625, y: 15, width: 5.328125, height: 18 }],
      [{ x: 12.515625, y: 15, width: 5.328125, height: 18 }, { x: 8.9453125, y: 63, width: 8.8984375, height: 18 }],
      [{ x: 3.6171875, y: 63, width: 5.328125, height: 18 }],
    ]
    const nodeRects = [
      { x: 3.6171875, y: 15, width: 8.8984375, height: 18 }, { x: 12.515625, y: 15, width: 5.328125, height: 18 },
      { x: 3.6171875, y: 63, width: 5.328125, height: 18 }, { x: 8.9453125, y: 63, width: 8.8984375, height: 18 },
    ]
    const lines = recordedLines('a\u00ADb\u000b', nodeRects, 48, offset => points[offset]!, true)
    expect(lines.map(line => [line.first, line.last])).toEqual([[0, 1], [2, 3]])
    // Other browsers' equal boxes of neighbouring characters are no copies.
    expect(recordedLines('a\u00ADb\u000b', nodeRects, 48, offset => points[offset]!, false).map(line => [line.first, line.last])).toEqual([[0, 1], [3, 3]])
    const main: Prediction = { lines: [{ start: 0, end: 3, width: 17.796875 }, { start: 3, end: 4, width: 4.4453125 }], prepareCalls: 6, lineCalls: 0, disagreement: null }
    expect(score({ lines, height: 96 }, main).status).toBe('breaks')
  })

  test('line count comes from rect positions: fractional line boxes would otherwise fail every Safari 27 case', () => {
    // Three line boxes 20.0149 px tall: 60.0447 / 20 is 3.002, which main's height check rejected.
    const boxes = [0, 1, 2].map(line => ({ x: 0, y: line * 20.0149, width: 50, height: 20.0149 }))
    expect(groupLines(boxes, 20).lo.length).toBe(3)
  })

  test('long paragraphs searched for line starts give the same lines as a scan: a book\'s wrong line would hide, or a right one fail', () => {
    let text = ''
    const starts: number[] = []
    for (let line = 0; line < 120; line++) {
      starts.push(text.length)
      // Words of mixed lengths, astral characters (some lines end with one and a letter), zero-width spaces, and a line
      // of nothing but zero-width spaces.
      text += line === 57 ? '\u200b\u200b\u200b' : `word${line} \u{1F600}x\u200bab${'c'.repeat(line % 7)}${line % 3 === 0 ? '\u{1F680}b' : ' '}`
    }
    const { rectsAt, reads, nodeRects } = layOut(text, starts)
    const lines = groupLines(nodeRects, 20)
    const before = reads()
    const scanned = scanLineEnds(text, lines, rectsAt)
    const scanReads = reads() - before
    const searched = searchLineEnds(text, lines, rectsAt)
    expect(searched).toEqual(scanned)
    expect(scanned.first[57]).toBe(-1)
    expect(reads() - before - scanReads).toBeLessThan(scanReads)
  })

  test('a search that meets a character on an earlier line gives up for a scan: bidi reordering would put a word on the wrong line unseen', () => {
    // Lines of 40, 100 and 60 letters, but the letter at 80, where the search first probes line 1, paints on line 0, as
    // bidi reordering can.
    const text = 'x'.repeat(200)
    const { nodeRects, rectsAt } = layOut(text, [0, 40, 140])
    const reordered: RectsAt = offset => (offset === 80 ? rectsAt(0) : rectsAt(offset))
    expect(searchLineEnds(text, groupLines(nodeRects, 20), rectsAt)).toEqual({ first: [0, 40, 140], last: [39, 139, 199] })
    expect(searchLineEnds(text, groupLines(nodeRects, 20), reordered)).toBeNull()
  })

  test('a line\'s width leaves out the spaces that end it: every bubble sized to its text would read as a space too narrow', () => {
    // "The quick " is 8 code points of 8 px and two spaces of 4 px; the box it needs is 68 px, not 72.
    const { recording } = layOut(TEXT, STARTS)
    if ('error' in recording) throw new Error('unreachable')
    expect(recording.lines.map(line => line.width)).toEqual([68, 68, 76, 88])
  })

  test('a prediction whose breaks move with what was prepared before is order-dependent, one whose widths alone move is not: the gate would block on Chrome\'s shape cache in main too', () => {
    const forward = predicted(TEXT, STARTS)
    const widths = predicted(TEXT, STARTS)
    if (!('lines' in widths)) throw new Error('unreachable')
    widths.lines[1]!.width = 3.25
    expect(predictionChange(forward, predicted(TEXT, STARTS))).toBe('same')
    expect(predictionChange(forward, widths)).toBe('widths')
    expect(predictionChange(forward, predicted(TEXT, [0, 10, 21, 31]))).toBe('lines')
    expect(predictionChange(forward, { unsupported: 'word-break break-all' })).toBe('lines')
    // A line that ends one character earlier while the next starts where it did: a space moved off the line's end.
    const shorter = predicted(TEXT, STARTS)
    if (!('lines' in shorter)) throw new Error('unreachable')
    shorter.lines[0]!.end = 9
    expect(predictionChange(forward, shorter)).toBe('lines')
  })
})

describe('the stored recordings', () => {
  test('two recordings swapped fail both cases: the gate would be green or red on another case\'s layout', async () => {
    const three = layOut(TEXT, [0, 16, 31]).recording
    const two = layOut(TEXT, [0, 20]).recording
    const dir = `${import.meta.dir}/../.artifacts`
    mkdirSync(dir, { recursive: true })
    const path = `${dir}/harness-test-recordings.txt`
    writeRecordings(path, { env: 'test', recordings: new Map([['b', two], ['a', three]]) })
    const read = readRecordings(path)!
    expect(recordingText(read.recordings.get('a')!)).toBe(recordingText(three))
    writeRecordings(`${path}.2`, { env: 'test', recordings: new Map([['a', three], ['b', two]]) })
    expect(await Bun.file(`${path}.2`).text()).toBe(await Bun.file(path).text())
    expect(score(two, predicted(TEXT, [0, 16, 31])).status).toBe('count')
    expect(score(three, predicted(TEXT, [0, 20])).status).toBe('count')
    expect(parseRecording(recordingText(three))).toEqual(three)
  })

  test('a bare text run with a style of its own is refused: the adapter would predict with a font the browser never used', () => {
    const font = { family: 'Arial', size: 16, weight: 400, style: 'normal' as const }
    const c: Case = {
      id: 'bare', family: 'test', origin: 'harness.test.ts', pageLang: 'en',
      paragraph: {
        runs: [{ text: 'hello', node: 'text', font, letterSpacing: 0, wordSpacing: 0, lang: null }], font, letterSpacing: 0, wordSpacing: 0, width: 100,
        lineHeight: 20, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineBreak: 'auto', tabSize: 8, direction: 'ltr', lang: 'en',
      },
    }
    expect(caseProblem(c)).toBeNull()
    c.paragraph.runs[0]!.font = { ...font, size: 12 }
    expect(caseProblem(c)).toContain('bare text run')
  })

  test('a stale environment key refuses to score: a browser update would read as library regressions or fixes', () => {
    const recorded = 'chrome 153.0.8010.48 os=26A428 os-languages=en-US page-languages=en-US,en dpr=2 fonts=abc'
    expect(() => assertSameEnvironment('chrome', recorded, recorded.replace('.48', '.50'))).toThrow('Record again')
    expect(() => assertSameEnvironment('chrome', recorded, recorded.replace('dpr=2', 'dpr=1'))).toThrow('Record again')
    expect(() => assertSameEnvironment('chrome', recorded, recorded)).not.toThrow()
  })

  test('a case laid out differently in its two orders is never pinned: page history would block changes at random', () => {
    const same = layOut(TEXT, STARTS).recording
    const other = layOut(TEXT, [0, 10, 26]).recording
    const recordings = new Map<string, Recording>([['moved', same]])
    const history = new Map<string, [Recording, Recording]>()
    splitHistory(['kept', 'moved'], new Map([['kept', same], ['moved', same]]), new Map([['kept', same], ['moved', other]]), recordings, history)
    expect([...recordings.keys()]).toEqual(['kept'])
    expect([...history.keys()]).toEqual(['moved'])
  })

  test('a case laid out differently from the stored recording of its environment is page history too: the gate would block at random', () => {
    const same = layOut(TEXT, STARTS).recording
    const other = layOut(TEXT, [0, 10, 26]).recording
    const prior = { recordings: new Map([['kept', same], ['moved', other]]), history: new Map<string, [Recording, Recording]>([['listed', [same, other]]]) }
    const recordings = new Map<string, Recording>()
    const history = new Map<string, [Recording, Recording]>()
    const both = new Map([['kept', same], ['moved', same], ['listed', same]])
    expect(splitHistory(['kept', 'listed', 'moved'], both, both, recordings, history, prior)).toBe(1)
    expect([...recordings.keys()]).toEqual(['kept'])
    expect([...history.keys()].sort()).toEqual(['listed', 'moved'])
  })
})

describe('the accepted-failures list', () => {
  test('a failure off the list blocks, an accepted one counts under its reason, and a fixed one blocks until it leaves: accepted losses would go silent', () => {
    const fail = (status: Outcome['status']): Outcome => ({ status, line: 0, detail: '' })
    const outcomes = new Map<string, Outcome>([['new', fail('count')], ['known', fail('breaks')], ['fixed', fail('pass')], ['moved', fail('count')]])
    const none = new Map<string, string>()
    const accepted = new Map<string, { reason: string; status: Failure }>([
      ['known', { reason: 'Firefox splits scripts later', status: 'breaks' }],
      ['fixed', { reason: 'Firefox splits scripts later', status: 'count' }],
      ['moved', { reason: 'narrower than real layouts', status: 'breaks' }],
      ['gone', { reason: 'narrower than real layouts', status: 'count' }],
    ])
    const verdict = judge(outcomes, accepted, none, null)
    expect(verdict.newFailures).toEqual(['new'])
    expect(verdict.fixed.sort()).toEqual(['fixed', 'gone'])
    expect(verdict.changed).toEqual(['moved: breaks -> count'])
    expect(verdict.byReason.get('Firefox splits scripts later')).toEqual(['known'])
    const next = accept(outcomes, accepted, 'a written reason', null)
    expect([...next]).toEqual([
      ['new', { reason: 'a written reason', status: 'count' }],
      ['known', { reason: 'Firefox splits scripts later', status: 'breaks' }],
      ['moved', { reason: 'narrower than real layouts', status: 'count' }],
    ])
    expect(judge(outcomes, next, none, null).newFailures).toEqual([])
    expect(judge(outcomes, next, none, null).fixed).toEqual([])
    // A run over other case files leaves this list alone.
    const elsewhere = new Map<string, Outcome>([['other', fail('breaks')]])
    expect(judge(elsewhere, next, none, id => id === 'other').fixed).toEqual([])
    expect([...accept(elsewhere, next, 'why', id => id === 'other').keys()].sort()).toEqual(['known', 'moved', 'new', 'other'])
  })
})

describe('the gate and page history of predictions', () => {
  const two = layOut(TEXT, [0, 20]).recording
  const three = layOut(TEXT, [0, 16, 31]).recording

  test('a reverse-order effect of the browser\'s, listed with its reason, doesn\'t block, and an unlisted one does: Chrome\'s shape cache kept the gate red in main too', () => {
    const widths = predicted(TEXT, STARTS)
    if (!('lines' in widths)) throw new Error('unreachable')
    widths.lines[0]!.width = 1.5
    const ids = ['amiri', 'plain', 'widths']
    const forward = new Map([['amiri', predicted(TEXT, STARTS)], ['plain', predicted(TEXT, STARTS)], ['widths', predicted(TEXT, STARTS)]])
    const reverse = new Map([['amiri', predicted(TEXT, [0, 10, 21, 31])], ['plain', predicted(TEXT, STARTS)], ['widths', widths]])
    expect(reverseOrder(ids, forward, reverse, new Map())).toEqual({ moved: ['amiri'], listed: [], widths: ['widths'] })
    const varying = new Map([['amiri', 'Chrome\'s per-canvas shape cache moves these breaks with the text measured before']])
    expect(reverseOrder(ids, forward, reverse, varying)).toEqual({ moved: [], listed: ['amiri'], widths: ['widths'] })
  })

  test('a fresh re-recording that differs once but not alone doesn\'t block, and one that differs every time does: Firefox\'s emoji beside Arial blocked the gate at random', () => {
    const stored = new Map([['emoji', two], ['stale', two], ['same', two]])
    const inSample = new Map([['emoji', three], ['stale', three], ['same', two]])
    const alone = new Map([['emoji', two], ['stale', three]])
    expect(freshRecordings(['emoji', 'stale', 'same'], stored, [inSample, alone, alone])).toEqual({ stale: ['stale'], history: ['emoji'] })
    expect(freshRecordings(['same'], stored, [inSample])).toEqual({ stale: [], history: [] })
  })

  test('a prediction that flips between runs, once listed, is never judged, and the gate calls it varying, not a library defect: check blocked at random on a system-ui label', () => {
    const passing = predicted(TEXT, STARTS)
    const flipped = predicted(TEXT, [0, 10, 21, 31])
    const stored = layOut(TEXT, STARTS).recording
    const runs = [score(stored, passing), score(stored, flipped)].map(outcome => new Map<string, Outcome>([['label', outcome]]))
    const none = new Map<string, { reason: string; status: Failure }>()
    expect(runs.map(outcomes => judge(outcomes, none, new Map(), null).newFailures)).toEqual([[], ['label']])
    const varying = new Map([['label', 'system-ui: Chrome resolves it for Canvas otherwise after some earlier documents, and not in every run']])
    for (let i = 0; i < runs.length; i++) {
      const verdict = judge(runs[i]!, none, varying, null)
      expect([verdict.newFailures, verdict.fixed]).toEqual([[], []])
      expect(verdict.varying).toEqual(i === 0 ? { pass: 1, fail: 0 } : { pass: 0, fail: 1 })
    }
    expect(() => judge(runs[0]!, new Map([['label', { reason: 'r', status: 'breaks' }]]), varying, null)).toThrow('both')
    expect(attribute(stored, stored, flipped, [passing, flipped])).toBe('varies between runs')
    expect(attribute(stored, stored, flipped, [passing, passing])).toBe('depends on what was predicted before')
    expect(attribute(stored, three, flipped, [flipped, flipped])).toBe('page history')
    expect(attribute(stored, stored, flipped, [flipped, flipped])).toBe('true loss')
  })
})

describe('the documents a job lays out', () => {
  test('in Firefox, cases with a text-presentation emoji go in documents after every other: color emoji laid out after one are 1 px wider, and the gate\'s fresh recording blocked at random', () => {
    const font = { family: 'Arial', size: 16, weight: 400, style: 'normal' as const }
    const make = (id: string, text: string, pageLang = 'en'): Case => ({
      id, family: 'test', origin: 'harness.test.ts', pageLang,
      paragraph: {
        runs: [{ text, node: 'text', font, letterSpacing: 0, wordSpacing: 0, lang: null }], font, letterSpacing: 0, wordSpacing: 0, width: 100,
        lineHeight: 20, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineBreak: 'auto', tabSize: 8, direction: 'ltr', lang: 'en',
      },
    })
    const cases = [make('a', 'a\u{1F600}b'), make('text', '\u2764\uFE0F\u{1F600}\uFE0E'), make('b', '\u{1F600} a b'), make('ko', '\uD55C', 'ko')]
    const ids = (docs: Case[][]): string[][] => docs.map(doc => doc.map(c => c.id))
    expect(ids(documents('firefox', cases, 2))).toEqual([['a', 'b'], ['ko'], ['text']])
    expect(ids(documents('chrome', cases, 2))).toEqual([['a', 'text'], ['b'], ['ko']])
  })
})

// The library itself, through the same adapter the page uses. The tests run under a page language of their own, so the
// library measures with a fresh Canvas context and gives it up afterwards; the Canvas is a stand-in when no other test
// file installed one.
describe('the library through the adapter', () => {
  let library: typeof import('../src/layout.ts')
  let adapter: typeof import('./predict.ts')
  const saved = { document: Reflect.get(globalThis, 'document') as unknown, installed: false, named: false, restore: () => {} }
  beforeAll(async () => {
    if (typeof OffscreenCanvas === 'undefined') {
      class Context {
        font = ''
        measureText(text: string): { width: number } {
          return { width: text.length * 9 }
        }
      }
      Reflect.set(globalThis, 'OffscreenCanvas', class { getContext(): Context { return new Context() } })
      saved.installed = true
    }
    Reflect.set(globalThis, 'document', { documentElement: { lang: 'x-harness-test' } })
    // Count calls on whatever Canvas the library measures with. The adapter counts on the context prototype, as in a
    // browser, so a stand-in's class is given that name.
    const context = new OffscreenCanvas(1, 1).getContext('2d')!
    if (typeof OffscreenCanvasRenderingContext2D === 'undefined') {
      Reflect.set(globalThis, 'OffscreenCanvasRenderingContext2D', context.constructor)
      saved.named = true
    }
    // The adapters wrap measureText; the original goes back afterwards.
    const proto = Object.getPrototypeOf(context) as object
    const measureText = Object.getOwnPropertyDescriptor(proto, 'measureText')!
    saved.restore = () => Object.defineProperty(proto, 'measureText', measureText)
    library = await import('../src/layout.ts')
    adapter = await import('./predict.ts')
  })
  afterAll(() => {
    saved.restore()
    if (saved.document === undefined) Reflect.deleteProperty(globalThis, 'document')
    else Reflect.set(globalThis, 'document', saved.document)
    if (saved.installed) Reflect.deleteProperty(globalThis, 'OffscreenCanvas')
    if (saved.named) Reflect.deleteProperty(globalThis, 'OffscreenCanvasRenderingContext2D')
  })

  // A copy of src/ with one defect planted, and a copy of the adapter that predicts with it, as `--lib` would.
  async function planted(name: string, file: string, pattern: RegExp, replacement: string): Promise<typeof import('./predict.ts')> {
    const dir = join(import.meta.dir, '../.artifacts/harness-test-libs', name)
    // Real files even when src/ is a link, so the defect lands in the copy only.
    cpSync(join(import.meta.dir, '../src'), join(dir, 'src'), { recursive: true, dereference: true })
    mkdirSync(join(dir, 'harness'), { recursive: true })
    cpSync(join(import.meta.dir, 'predict.ts'), join(dir, 'harness/predict.ts'))
    cpSync(join(import.meta.dir, 'types.ts'), join(dir, 'harness/types.ts'))
    const path = join(dir, 'src', file)
    const source = readFileSync(path, 'utf8')
    const found = source.match(new RegExp(pattern.source, 'g'))?.length ?? 0
    if (found !== 1) throw new Error(`${name}: ${pattern} matches src/${file} ${found} times; plant the same defect in the code as it is now`)
    writeFileSync(path, source.replace(pattern, replacement))
    return await import(join(dir, 'harness/predict.ts')) as typeof import('./predict.ts')
  }

  function paragraph(text: string, width: number): Case {
    const font = { family: 'Harness Test', size: 16, weight: 400, style: 'normal' as const }
    return {
      id: 't', family: 'test', origin: 'harness.test.ts', pageLang: 'en',
      paragraph: {
        runs: [{ text, node: 'text', font, letterSpacing: 0, wordSpacing: 0, lang: null }], font, letterSpacing: 0, wordSpacing: 0, width,
        lineHeight: 20, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineBreak: 'auto', tabSize: 8, direction: 'ltr', lang: 'en',
      },
    }
  }

  test('a width 1/64 px short at a fit threshold fails: text that exactly fits a bubble would wrap', () => {
    const text = 'aaaa bbbb'
    const fit = library.measureNaturalWidth(library.prepareWithSegments(text, '16px Harness Test'))
    const oneLine = layOut(text, [0]).recording
    expect(score(oneLine, adapter.predict(paragraph(text, fit))).status).toBe('pass')
    expect(score(oneLine, adapter.predict(paragraph(text, fit - 1 / 64))).status).toBe('count')
  })

  test('layout() counting other lines than the walk blocks: a virtualized list would size a row for lines it doesn\'t paint (the review\'s D1: an overflowing space starts the next line in layout()\'s counter)', async () => {
    const text = 'aaaa bbbb cccc'
    // "aaaa" fits exactly, so each space overflows and must hang.
    const c = paragraph(text, library.measureNaturalWidth(library.prepareWithSegments('aaaa', '16px Harness Test')))
    const right = adapter.predict(c)
    if (!('lines' in right)) throw new Error('unreachable')
    expect(right.disagreement).toBeNull()
    expect(right.lines.length).toBe(3)
    // Drop the counter's `continue` after an overflow ends a line, so the overflowing space opens the next one.
    const d1 = await planted('d1-counter', 'line-break.ts', /(export function countPreparedLines\([\s\S]*?hasContent = false\n(?:\s*\/\/[^\n]*\n)*)\s*if \([^\n]*\) continue\n/, '$1')
    const wrong = d1.predict(c)
    if (!('lines' in wrong)) throw new Error('unreachable')
    expect(wrong.lines).toEqual(right.lines)
    expect(wrong.disagreement).toStartWith('layout() gives')
    expect(libraryFaults(['t'], new Map([['t', wrong]])).disagree).toHaveLength(1)
    expect(libraryFaults(['t'], new Map([['t', right]]))).toEqual({ disagree: [], measuring: [] })
  })

  test('a text line API giving other text than the walk\'s lines blocks: a list painting layoutNextLine\'s text would drop a character its heights count', async () => {
    const c = paragraph('A message long enough to wrap at a few widths', 120)
    const dropped = await planted('next-line-text', 'layout.ts', /return \{ text, width, start: lineStart, end \}/, 'return { text: text.slice(1), width, start: lineStart, end }')
    const wrong = dropped.predict(c)
    if (!('lines' in wrong)) throw new Error('unreachable')
    expect(wrong.disagreement).toStartWith('layoutNextLine line 0')
  })

  test('a Canvas call per line in the walker blocks: every window resize would measure text again', async () => {
    const c = paragraph('A message long enough to wrap at a few widths, with CJK \u6587\u5B57 and numbers 3.14', 120)
    const right = adapter.predict(c)
    if (!('lines' in right)) throw new Error('unreachable')
    expect(right.lineCalls).toBe(0)
    expect(right.prepareCalls).toBeGreaterThan(0)
    const walker = await planted('walker-canvas', 'layout.ts', /onLine\(createLayoutLineRange\(/, 'new OffscreenCanvas(1, 1).getContext(\'2d\')!.measureText(\' \')\n      onLine(createLayoutLineRange(')
    const measuring = walker.predict(c)
    if (!('lines' in measuring)) throw new Error('unreachable')
    expect(measuring.lines).toEqual(right.lines)
    expect(measuring.lineCalls).toBe(right.lines.length)
    expect(libraryFaults(['t'], new Map([['t', measuring]])).measuring).toEqual([`t: ${right.lines.length}`])
  })
})
