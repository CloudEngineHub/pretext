// The bench's arithmetic and texts, offline. The test name says what a change's author would see if it went wrong.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserKind } from '../types.ts'
import type { DocResult, Sample } from './page.ts'
import { FLOORS, readings, report, unconfirmed, verdict, type Reading, type Readings, type SessionResults } from './report.ts'
import { documents, runSessions, type Planned } from './run.ts'
import { familyText, MESSAGE_FAMILIES, STYLE, units } from './texts.ts'

// A session's reading. The control's rounds sit within `spread` of its median: tight when its copy kept one speed,
// wide when its rounds were noisy.
const s = (candidate: number, control: number, spread = 0.004): Reading => ({ candidate, control, controlQuartiles: [control - spread, control + spread] })
const called = (v: string): boolean => v === 'slower' || v === 'faster'
const toReading = ([candidate, control, low, high]: number[]): Reading => ({ candidate: candidate!, control: control!, controlQuartiles: [low!, high!] })

describe('the verdict', () => {
  test('a row is slower or faster only outside the band in every session: one noisy session would call a change', () => {
    expect(verdict([s(1.2, 1.02), s(1.15, 0.99)], 0.05)).toBe('slower')
    expect(verdict([s(0.8, 1.02), s(0.85, 0.99)], 0.05)).toBe('faster')
    expect(verdict([s(1.2, 1.02), s(1.03, 0.99)], 0.05)).toBe('within noise')
    expect(verdict([], 0)).toBe('within noise')
  })

  test('a session\'s band is the larger of its control\'s drift and the row\'s floor: a noisy document would call noise a change', () => {
    // The control's noisy rounds put its median 12% from base: a 10% change in that session is noise.
    expect(verdict([s(1.1, 1.12, 0.15)], 0.03)).toBe('within noise')
    expect(verdict([s(1.1, 0.88, 0.15)], 0.03)).toBe('within noise')
    // A tight control leaves the row's floor.
    expect(verdict([s(1.04, 1.0)], 0.05)).toBe('within noise')
    expect(verdict([s(1.06, 1.0)], 0.05)).toBe('slower')
  })

  test('a control that kept another speed than base marks a row left without a verdict, and takes none away: a row judged to a copy\'s speed would read as judged to its floor', () => {
    // Chrome 154's rich stats on 2026-09-30, a candidate doing base's work: its copy ran 11% faster in the first
    // session, the control's 11% slower in the second and 11% faster in the third.
    const richStats: Reading[] = [
      { candidate: 0.8904, control: 1.005, controlQuartiles: [1.0018, 1.0176] }, { candidate: 1.0158, control: 1.1099, controlQuartiles: [1.1073, 1.1131] },
      { candidate: 1.0083, control: 0.8853, controlQuartiles: [0.8811, 0.8896] },
    ]
    expect(verdict(richStats, 0.05)).toBe('two speeds')
    expect(verdict(richStats.slice(0, 1), 0.05)).toBe('faster')
    // The candidate inside the band the control's other speed set.
    expect(verdict([s(1.12, 1.0), s(1.105, 1.11)], 0.05)).toBe('two speeds')
    expect(verdict([s(0.9, 1.0), s(0.9, 0.89)], 0.05)).toBe('two speeds')
    // Outside the band in every session, the verdict main's rule gave stands.
    expect(verdict([s(1.12, 1.0), s(1.115, 1.11)], 0.05)).toBe('slower')
    expect(verdict([s(0.88, 0.89)], 0.05)).toBe('faster')
    // Under the floor the control's speed is the row's noise, however tight; over it, noisy rounds are no speed.
    expect(verdict([s(1.0, 1.04)], 0.05)).toBe('within noise')
    expect(verdict([s(1.0, 1.08, 0.04)], 0.05)).toBe('within noise')
  })

  // calibration.json: HEAD against itself, three sessions per browser, the run the floors came from.
  const calibration = JSON.parse(readFileSync(join(import.meta.dir, 'calibration.json'), 'utf8')) as Readings
  const entries = Object.values(calibration).flatMap(browser => Object.entries(browser).map(([key, sessions]) => ({ floor: FLOORS[key.split(' | ')[0]!]!, sessions: sessions.map(toReading) })))

  test('the floors call no change on the calibration they came from: a build would read slower than itself', () => {
    expect(entries.length).toBeGreaterThan(100)
    for (const e of entries) expect(e.sessions.length).toBeGreaterThanOrEqual(3)
    expect(entries.filter(e => called(verdict(e.sessions, e.floor))).length).toBe(0)
  })

  test('two of its sessions alone call changes, each taken back by the third: the confirming session would be dead weight', () => {
    // 11 of the 423 pairs of sessions in the calibration of 2026-09-26.
    let pairs = 0
    for (const e of entries) for (let skip = 0; skip < 3; skip++) if (called(verdict(e.sessions.slice(0, 3).filter((_, i) => i !== skip), e.floor))) pairs++
    expect(pairs).toBeGreaterThan(0)
  })
})

// Twelve rounds of an operation: base's 1,000 units in `ms`, the candidate's and the control's cost over base's as
// given, the control's rounds a third each at its cost and `spread` either side of it, or each round's cost as
// `control` gives it.
const rounds = (candidate: number, control: number | ((round: number) => number), spread = 0, ms = 20): Sample[][] => Array.from({ length: 12 }, (_, round) => [
  { label: 'base', ms, units: 1000 }, { label: 'candidate', ms: ms * candidate * (1 + 0.001 * (round % 3)), units: 1000 },
  { label: 'control', ms: ms * (typeof control === 'number' ? control * (1 + spread * (round % 3 - 1)) : control(round)), units: 1000 },
])
const snapshot = { visible: true, focused: true, dpr: 2 }
// One document's session as the bench saves it: each operation's [candidate, control, the control's spread]. The
// calibration timed the pre-wrap chunks' prepare, layout and walk in Chrome, and no stats.
function sessionOf(session: number, ops: Record<string, [number, number | ((round: number) => number), number?]>, browser = 'chrome', ms = 20): SessionResults {
  const id = 'worst pre-wrap-chunks'
  return {
    browser, session, seed: '', docs: [{ row: 'worst', family: 'pre-wrap-chunks', id }],
    results: { [id]: { id, timerStep: 0.005, start: snapshot, end: snapshot, ops: Object.entries(ops).map(([op, [candidate, control, spread]]) => ({ op, rounds: rounds(candidate, control, spread, ms) })) } },
  }
}
const BUILDS = 'base: main (0123abc, 2026-09-30); candidate: this tree\'s src/'
const row = (all: SessionResults[], entry: string): string => report(all, { builds: BUILDS, hypotheses: false, sizes: {} }).split('\n').find(line => line.includes(` ${entry} |`))!

describe('the report', () => {
  const two = [
    sessionOf(0, { prepare: [1.2, 1], layout: [1.01, 1], walk: [1.1, 1.08], stats: [1, 1.08, 0.3] }),
    sessionOf(1, { prepare: [1.2, 1], layout: [0.99, 1], walk: [1, 1.12], stats: [1, 1] }),
  ]

  test('a verdict from fewer than three sessions is marked unconfirmed: two sessions\' chance agreement would stand', () => {
    expect(unconfirmed(two)).toEqual(['worst pre-wrap-chunks'])
    expect(unconfirmed([sessionOf(0, { layout: [0.8, 1] }), sessionOf(1, { layout: [0.8, 1] })])).toEqual(['worst pre-wrap-chunks'])
    expect(unconfirmed([two[0]!, sessionOf(1, { prepare: [1, 1], layout: [0.99, 1], walk: [1, 1] })])).toEqual([])
    expect(row(two, 'prepare')).toEndWith('| slower (unconfirmed) |')
    expect(row([...two, sessionOf(2, { prepare: [1.2, 1], layout: [1, 1], walk: [1, 1] })], 'prepare')).toEndWith('| slower |')
    expect(row([...two, sessionOf(2, { prepare: [1.01, 1], layout: [1, 1], walk: [1, 1] })], 'prepare')).toEndWith('] +20.1% +20.1% +1.1% | +0.0% +0.0% +0.0% | within noise |')
    expect(row(two, 'layout')).toEndWith('| within noise |')
    expect(row(two.slice(0, 1), 'layout')).toEndWith('| within noise (hypothesis: one session) |')
    expect(row(two.slice(0, 1), 'prepare')).toEndWith('| slower (unconfirmed) (hypothesis: one session) |')
  })

  test('an entry the calibration didn\'t time in the browser says so: a borrowed floor would read as a fitted one', () => {
    expect(row(two, 'stats')).toEndWith('| within noise (uncalibrated) |')
    expect(row(two.map(r => ({ ...r, browser: 'webkit-host' })), 'layout')).toEndWith('| within noise (uncalibrated) |')
  })

  test('the control ran apart with three quarters of its rounds beyond the floor, on either side: a fast copy would need more rounds than a slow one', () => {
    const nine = (speed: number) => (round: number): number => (round < 9 ? speed : 1)
    const eight = (speed: number) => (round: number): number => (round < 8 ? speed : 1)
    expect(row([sessionOf(0, { layout: [1, nine(1.11)] })], 'layout')).toContain('| two speeds (base 20000, control 22200 µs/1k)')
    expect(row([sessionOf(0, { layout: [1, nine(0.89)] })], 'layout')).toContain('| two speeds (base 20000, control 17800 µs/1k)')
    expect(row([sessionOf(0, { layout: [1, eight(1.11)] })], 'layout')).toContain('| within noise')
    expect(row([sessionOf(0, { layout: [1, eight(0.89)] })], 'layout')).toContain('| within noise')
  })

  test('readings.json keeps what the verdict read, under the names the table prints: a calibration saved from it would check other numbers', () => {
    // Firefox's control a third of a percent slower each round.
    const kept = readings([...two, sessionOf(0, { layout: [0.9, round => 1 + round / 300] }, 'firefox')])
    expect(Object.keys(kept)).toEqual(['chrome', 'firefox'])
    expect(Object.keys(kept['chrome']!)).toEqual(['worst | pre-wrap-chunks prepare', 'worst | pre-wrap-chunks layout', 'worst | pre-wrap-chunks walk', 'worst | pre-wrap-chunks stats'])
    const walk = kept['chrome']!['worst | pre-wrap-chunks walk']!
    expect(walk.length).toBe(2)
    for (let i = 0; i < 4; i++) expect(walk[0]![i]).toBeCloseTo([1.1011, 1.08, 1.08, 1.08][i]!, 10)
    // The lower quartile is the fourth of twelve rounds, the upper the ninth.
    const layout = kept['firefox']!['worst | pre-wrap-chunks layout']!
    expect(layout.length).toBe(1)
    for (let i = 0; i < 4; i++) expect(layout[0]![i]).toBeCloseTo([0.9009, 1 + 5.5 / 300, 1 + 3 / 300, 1 + 8 / 300][i]!, 10)
    expect(verdict(walk.map(toReading), FLOORS['worst']!)).toBe('two speeds')
  })

  test('a row with two speeds prints both, of the session that held them furthest apart: the cell would give a distance no session held', () => {
    // 20 ms per 1,000 units is 20,000 µs per 1,000; the control's copy ran 8% slower in the first session and 12% in
    // the second.
    expect(row(two, 'walk')).toEndWith('| two speeds (base 20000, control 22400 µs/1k) |')
    // Of the session whose control ran apart, not of one whose noisy control sat further off at its median, nor of
    // every session together: here the second, at 2.62 µs per 1,000 units.
    const noisyThenApart = [sessionOf(0, { layout: [1, 1.3, 0.5] }), sessionOf(1, { layout: [1, 1.12] }, 'chrome', 0.00262)]
    expect(row(noisyThenApart, 'layout')).toEndWith('| +30.0% +12.0% | two speeds (base 2.62, control 2.93 µs/1k) |')
    // A control 8% from base at its median, with a third of its rounds on base's other side, is noise.
    expect(row(two, 'stats')).toContain('| +8.0% +0.0% | within noise')
  })

  test('the output starts with the builds it compared: a pasted table wouldn\'t say what it timed', () => {
    expect(report(two, { builds: BUILDS, hypotheses: false, sizes: {} }).split('\n')[1]).toBe(BUILDS)
  })
})

describe('the sessions', () => {
  // Stand-in browsers: every copy at base's speed, but the candidate's layout of the controls shape at `slow`'s cost in
  // the browser and session it gives one for; a browser fails the session `fails` names for it. `given` keeps the
  // documents each session was handed.
  const run = async (browsers: BrowserKind[], sessions: number, slow: (browser: BrowserKind, session: number) => number, fails: Partial<Record<BrowserKind, number>> = {}): Promise<{ given: string[]; ids: string[][]; all: SessionResults[]; failed: Map<BrowserKind, string> }> => {
    const given: string[] = []
    const ids: string[][] = []
    const time = (browser: BrowserKind, docs: Planned[]): Promise<Map<string, DocResult>> => {
      const session = given.filter(g => g.startsWith(browser)).length
      given.push(`${browser} ${docs.length}`)
      ids.push(docs.map(d => d.id))
      if (fails[browser] === session) return Promise.reject(new Error('stalled'))
      return Promise.resolve(new Map(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(d.id === 'worst controls' && spec.op === 'layout' ? slow(browser, session) : 1, 1) })) }])))
    }
    const { all, failed } = await runSessions(browsers, sessions, seed => documents(['worst'], seed, false), { time, save: () => {}, log: () => {} })
    return { given, ids, all, failed }
  }

  test('after two sessions a row that reads slower gets its document, and no other, timed once more, and keeps the verdict only if that session agrees: noise that two sessions share would be called a change', async () => {
    const steady = await run(['chrome'], 2, () => 1.2)
    expect(steady.given).toEqual(['chrome 9', 'chrome 9', 'chrome 1'])
    expect(steady.ids[2]).toEqual(['worst controls'])
    expect(row(steady.all, 'controls layout')).toEndWith('| slower |')
    expect(row((await run(['chrome'], 2, (_, session) => (session < 2 ? 1.2 : 1))).all, 'controls layout')).toEndWith('| within noise |')
    expect((await run(['chrome'], 2, () => 1)).given).toEqual(['chrome 9', 'chrome 9'])
  })

  test('each browser confirms its own rows, a faster one too: one browser\'s change would be timed again in the others, or a speedup stand unconfirmed', async () => {
    const { given, all } = await run(['chrome', 'firefox'], 2, browser => (browser === 'firefox' ? 0.8 : 1))
    expect(given).toEqual(['chrome 9', 'firefox 9', 'chrome 9', 'firefox 9', 'firefox 1'])
    expect(row(all.filter(r => r.browser === 'firefox'), 'controls layout')).toEndWith('| faster |')
  })

  test('one session gets no confirming session, and three need none: two sessions would print as a verdict, or a calibration keep a fourth reading its floors weren\'t fitted to', async () => {
    const one = await run(['chrome'], 1, () => 1.2)
    expect(one.given).toEqual(['chrome 9'])
    expect(row(one.all, 'controls layout')).toEndWith('| slower (unconfirmed) (hypothesis: one session) |')
    const three = await run(['chrome'], 3, () => 1.2)
    expect(three.given).toEqual(['chrome 9', 'chrome 9', 'chrome 9'])
    expect(readings(three.all)['chrome']!['worst | controls layout']!.length).toBe(3)
    expect(row(three.all, 'controls layout')).toEndWith('| slower |')
  })

  test('a browser that fails a session sits out the rest, its confirming session too, and the others go on: a stalled browser would be started again and again', async () => {
    // Firefox fails its second session, with a row that read slower in its first.
    const second = await run(['chrome', 'firefox'], 2, () => 1.2, { firefox: 1 })
    expect(second.given).toEqual(['chrome 9', 'firefox 9', 'chrome 9', 'firefox 9', 'chrome 1'])
    expect([...second.failed]).toEqual([['firefox', 'session 2: stalled']])
    expect(row(second.all.filter(r => r.browser === 'firefox'), 'controls layout')).toEndWith('| slower (unconfirmed) (hypothesis: one session) |')
    const first = await run(['chrome', 'firefox'], 3, () => 1, { firefox: 0 })
    expect(first.given).toEqual(['chrome 9', 'firefox 9', 'chrome 9', 'chrome 9'])
    expect(first.all.map(r => r.browser)).toEqual(['chrome', 'chrome', 'chrome'])
  })
})

describe('the texts', () => {
  const docs = documents(['new', 'fresh', 'rich'], 'bench-test', false)

  test('the rows that time new text never prepare a message twice: a warm cache would read as a faster library', () => {
    for (const family of MESSAGE_FAMILIES) {
      if (family === 'mixed') continue // its messages may end with an emoji the text doesn't hold
      const text = familyText(family)
      let at = 0
      for (const d of docs.filter(x => x.family === family || (x.row === 'rich' && family === 'latin'))) {
        const messages = d.fresh !== undefined ? d.fresh.batches.flat() : d.ops.filter(op => op.batches !== undefined).flatMap(op => op.batches!.flat().map(m => (typeof m === 'string' ? m : (m as Array<{ text: string }>).map(item => item.text).join(''))))
        for (const m of messages) {
          const found = text.indexOf(m, at)
          expect(found).toBeGreaterThanOrEqual(at)
          at = found + m.length
        }
      }
    }
  })

  test('the line functions run on Latin and CJK messages of their own: one script\'s slower line walk would hide among the mixed ones', () => {
    const lines = documents(['lines'], 'bench-test', false)
    expect(lines.map(d => `${d.family} ${d.ops.map(op => op.op).join(' ')}`)).toEqual(['mixed stats walk stream lines', 'latin stats walk stream', 'cjk stats walk stream'])
    for (const d of lines) {
      const family = d.family as 'mixed' | 'latin' | 'cjk'
      expect({ font: d.font, lang: d.lang }).toEqual(STYLE[family])
      for (const op of d.ops) {
        expect(op.textUnits).toBeGreaterThanOrEqual(20_000)
        const texts = op.texts as string[]
        expect(units(texts)).toBe(op.textUnits!)
        // The mixed messages may end with an emoji their text doesn't hold.
        if (family !== 'mixed') for (const message of texts) expect(familyText(family)).toContain(message)
      }
    }
  })

  test('each family\'s new batches hold the same units: a longer batch would read as a slower library', () => {
    for (const d of docs) {
      const sizes = d.fresh !== undefined ? d.fresh.batches.map(units) : d.ops[0]!.batchUnits!
      // One unit more where a cut would split a surrogate pair.
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      if (d.row === 'new' && d.family !== 'labels') expect(Math.min(...sizes)).toBeGreaterThan(200)
    }
  })
})
