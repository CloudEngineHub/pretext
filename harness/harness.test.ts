// Planted defects: each test plants one fault the harness exists to catch and checks that it is caught. The test name
// says what an app developer would see if the fault went unseen.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { groupLines, recordedLines, scanLineEnds, searchLineEnds, type RectsAt } from './observe.ts'
import { accept, judge, score, type Outcome } from './score.ts'
import { assertSameEnvironment, parseRecording, readRecordings, recordingText, splitHistory, writeRecordings } from './store.ts'
import type { Case, Prediction, Recording, Rect } from './types.ts'

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
  return { recording: { lines: recordedLines(text, nodeRects, 20, rectsAt), height: starts.length * 20 }, nodeRects, rectsAt, reads: () => reads }
}

function predicted(text: string, starts: number[]): Prediction {
  const lines = []
  for (let i = 0; i < starts.length; i++) lines.push({ start: starts[i]!, end: starts[i + 1] ?? text.length, width: 0 })
  return { lines, calls: 0 }
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
    const lines = recordedLines('a\u00ADb\u000b', nodeRects, 48, offset => points[offset]!)
    expect(lines.map(line => [line.first, line.last])).toEqual([[0, 1], [2, 3]])
    const main: Prediction = { lines: [{ start: 0, end: 3, width: 17.796875 }, { start: 3, end: 4, width: 4.4453125 }], calls: 6 }
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
      // Words of mixed lengths, with astral characters, zero-width spaces and a line of nothing but zero-width spaces.
      text += line === 57 ? '\u200b\u200b\u200b' : `word${line} \u{1F600}x\u200bab${'c'.repeat(line % 7)} `
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
})

describe('the stored recordings', () => {
  test('two recordings swapped fail both cases: the gate would be green or red on another case\'s layout', async () => {
    const three = layOut(TEXT, [0, 16, 31]).recording
    const two = layOut(TEXT, [0, 20]).recording
    const path = `${import.meta.dir}/../.artifacts/harness-test-recordings.txt`
    writeRecordings(path, { env: 'test', recordings: new Map([['b', two], ['a', three]]) })
    const read = readRecordings(path)!
    expect(recordingText(read.recordings.get('a')!)).toBe(recordingText(three))
    writeRecordings(`${path}.2`, { env: 'test', recordings: new Map([['a', three], ['b', two]]) })
    expect(await Bun.file(`${path}.2`).text()).toBe(await Bun.file(path).text())
    expect(score(two, predicted(TEXT, [0, 16, 31])).status).toBe('count')
    expect(score(three, predicted(TEXT, [0, 20])).status).toBe('count')
    expect(parseRecording(recordingText(three))).toEqual(three)
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
})

describe('the accepted-failures list', () => {
  test('a failure off the list blocks, an accepted one counts under its reason, and a fixed one blocks until it leaves: accepted losses would go silent', () => {
    const fail = (status: Outcome['status']): Outcome => ({ status, line: 0, detail: '' })
    const outcomes = new Map<string, Outcome>([['new', fail('count')], ['known', fail('breaks')], ['fixed', fail('pass')], ['moved', fail('count')]])
    const accepted = new Map([
      ['known', { reason: 'Firefox splits scripts later', status: 'breaks' }],
      ['fixed', { reason: 'Firefox splits scripts later', status: 'count' }],
      ['moved', { reason: 'narrower than real layouts', status: 'breaks' }],
      ['gone', { reason: 'narrower than real layouts', status: 'count' }],
    ])
    const verdict = judge(outcomes, accepted, null)
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
    expect(judge(outcomes, next, null).newFailures).toEqual([])
    expect(judge(outcomes, next, null).fixed).toEqual([])
    // A run over other case files leaves this list alone.
    const elsewhere = new Map<string, Outcome>([['other', fail('breaks')]])
    expect(judge(elsewhere, next, id => id === 'other').fixed).toEqual([])
    expect([...accept(elsewhere, next, 'why', id => id === 'other').keys()].sort()).toEqual(['known', 'moved', 'new', 'other'])
  })
})

// The library itself, through the same adapter the page uses. The tests run under a page language of their own, so the
// library measures with a fresh Canvas context and gives it up afterwards; the Canvas is a stand-in when no other test
// file installed one.
describe('the library through the adapter', () => {
  let library: typeof import('../src/layout.ts')
  let adapter: typeof import('./predict.ts')
  let measureCalls = 0
  const saved = { document: Reflect.get(globalThis, 'document') as unknown, installed: false, restore: () => {} }
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
    // Count calls on whatever Canvas the library measures with.
    const proto = Object.getPrototypeOf(new OffscreenCanvas(1, 1).getContext('2d')) as { measureText: (text: string) => unknown }
    const measureText = Object.getOwnPropertyDescriptor(proto, 'measureText')!
    Object.defineProperty(proto, 'measureText', {
      ...measureText,
      value(this: unknown, text: string) {
        measureCalls++
        return (measureText.value as (this: unknown, text: string) => unknown).call(this, text)
      },
    })
    saved.restore = () => Object.defineProperty(proto, 'measureText', measureText)
    library = await import('../src/layout.ts')
    adapter = await import('./predict.ts')
  })
  afterAll(() => {
    saved.restore()
    if (saved.document === undefined) Reflect.deleteProperty(globalThis, 'document')
    else Reflect.set(globalThis, 'document', saved.document)
    if (saved.installed) Reflect.deleteProperty(globalThis, 'OffscreenCanvas')
  })

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

  test('a Canvas call added to layout is caught: every window resize would measure text again', () => {
    const prepared = library.prepareWithSegments('A message long enough to wrap at a few widths, with CJK \u6587\u5B57 and numbers 3.14', '16px Harness Test')
    const callsIn = (fn: () => void): number => {
      const before = measureCalls
      fn()
      return measureCalls - before
    }
    const resize = (layout: typeof library.layout): number => callsIn(() => {
      for (const width of [40, 120, 300, 1000]) {
        layout(prepared, width, 20)
        library.walkLineRanges(prepared, width, () => {})
        library.measureLineStats(prepared, width)
      }
    })
    expect(resize(library.layout)).toBe(0)
    const planted: typeof library.layout = (handle, width, lineHeight) => {
      new OffscreenCanvas(1, 1).getContext('2d')!.measureText('x')
      return library.layout(handle, width, lineHeight)
    }
    expect(resize(planted)).toBeGreaterThan(0)
  })
})
