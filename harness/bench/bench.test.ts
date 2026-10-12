// The bench's arithmetic and texts, offline. The test name says what a change's author would see if it went wrong.
import { describe, expect, spyOn, test } from 'bun:test'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserKind } from '../types.ts'
import { benchBundle, buildName, srcOf } from './lib.ts'
import type { DocResult, Sample } from './page.ts'
import { FLOORS, report, summary, unconfirmed, verdict, type SessionResults } from './report.ts'
import { bench, benchOptions, documents, ROWS, runSessions, type BenchOptions, type Planned } from './run.ts'
import { EMOJI, familyText, MESSAGE_FAMILIES, STYLE, units } from './texts.ts'

describe('the verdict', () => {
  test('a row is slower or faster only outside the band in every session: one noisy session would call a change', () => {
    expect(verdict([{ candidate: 1.2, control: 1.02 }, { candidate: 1.15, control: 0.99 }], 0.05)).toBe('slower')
    expect(verdict([{ candidate: 0.8, control: 1.02 }, { candidate: 0.85, control: 0.99 }], 0.05)).toBe('faster')
    expect(verdict([{ candidate: 1.2, control: 1.02 }, { candidate: 1.03, control: 0.99 }], 0.05)).toBe('within noise')
    expect(verdict([], 0)).toBe('within noise')
  })

  test('a session\'s band is the larger of its control\'s drift and the row\'s floor: a noisy document would call noise a change', () => {
    // The control drifted 12%: a 10% change in that session is noise.
    expect(verdict([{ candidate: 1.1, control: 1.12 }], 0.03)).toBe('within noise')
    expect(verdict([{ candidate: 1.1, control: 0.88 }], 0.03)).toBe('within noise')
    // A tight control leaves the row's floor.
    expect(verdict([{ candidate: 1.04, control: 1.0 }], 0.05)).toBe('within noise')
    expect(verdict([{ candidate: 1.06, control: 1.0 }], 0.05)).toBe('slower')
  })

  test('a third session takes back what two agreed on by chance, and adds no verdict: the confirming session would have to time every row', () => {
    // Chrome 154's rich stats on 2026-09-30, a candidate doing base's work: its copy ran 11% faster than base's in the
    // first session, and the control's copy 11% slower in the second and 11% faster in the third.
    const richStats = [{ candidate: 0.8904, control: 1.005 }, { candidate: 1.0158, control: 1.1099 }, { candidate: 1.0083, control: 0.8853 }]
    expect(verdict(richStats.slice(0, 1), 0.05)).toBe('faster')
    expect(verdict(richStats, 0.05)).toBe('within noise')
    // Safari 27's Thai layout at widths seen before on 2026-10-02: two sessions read it slower, and in the third the
    // control's copy sat 12.9% from base's.
    const thai = [{ candidate: 1.077, control: 0.973 }, { candidate: 1.147, control: 1.001 }, { candidate: 1.04, control: 1.129 }]
    expect(verdict(thai.slice(0, 2), 0.05)).toBe('slower')
    expect(verdict(thai, 0.05)).toBe('within noise')
    expect(verdict([thai[2]!, thai[0]!, thai[1]!], 0.05)).toBe('within noise')
  })
})

// Twelve rounds of an operation: base's 1,000 units in 20 ms, and the candidate's and the control's cost over base's as
// given.
const rounds = (candidate: number, control: number): Sample[][] => Array.from({ length: 12 }, (_, round) => [
  { label: 'base', ms: 20, units: 1000 }, { label: 'candidate', ms: 20 * candidate * (1 + 0.001 * (round % 3)), units: 1000 }, { label: 'control', ms: 20 * control, units: 1000 },
])
const snapshot = { visible: true, focused: true, dpr: 2 }
// One document's session as the bench saves it: each operation's [candidate, control].
function sessionOf(session: number, ops: Record<string, [number, number]>, browser = 'chrome', family = 'pre-wrap-chunks', row = 'worst'): SessionResults {
  const id = `${row} ${family}`
  return {
    browser, session, seed: '', docs: [{ row, family, id }],
    results: { [id]: { id, timerStep: 0.005, start: snapshot, end: snapshot, ops: Object.entries(ops).map(([op, [candidate, control]]) => ({ op, rounds: rounds(candidate, control) })) } },
  }
}
const BUILDS = 'base: main (0123abc, 2026-09-30); candidate: this tree\'s src/'
// A table's row, judged by the foreground's floors unless the test gives the others.
const row = (all: SessionResults[], entry: string, floors = FLOORS.foreground): string => report(all, { builds: BUILDS, floors, sizes: {} }).split('\n').find(line => line.includes(` ${entry} |`))!

describe('the report', () => {
  const two = [sessionOf(0, { prepare: [1.2, 1], layout: [1.01, 1], walk: [1.1, 1.08] }), sessionOf(1, { prepare: [1.2, 1], layout: [0.99, 1], walk: [1, 0.88] })]

  test('a verdict from two sessions is marked unconfirmed: two sessions\' chance agreement would stand', () => {
    expect(unconfirmed(two, FLOORS.foreground)).toEqual(['worst pre-wrap-chunks'])
    expect(unconfirmed([sessionOf(0, { layout: [0.8, 1] }), sessionOf(1, { layout: [0.8, 1] })], FLOORS.foreground)).toEqual(['worst pre-wrap-chunks'])
    expect(unconfirmed([two[0]!, sessionOf(1, { prepare: [1, 1], layout: [0.99, 1], walk: [1, 1] })], FLOORS.foreground)).toEqual([])
    expect(row(two, 'prepare')).toEndWith('| slower (unconfirmed) |')
    expect(row([...two, sessionOf(2, { prepare: [1.2, 1], layout: [1, 1], walk: [1, 1] })], 'prepare')).toEndWith('| slower |')
    expect(row([...two, sessionOf(2, { prepare: [1.01, 1], layout: [1, 1], walk: [1, 1] })], 'prepare')).toEndWith('] +20.1% +20.1% +1.1% | +0.0% +0.0% +0.0% | within noise (±2.0%) |')
    expect(row(two.slice(0, 1), 'prepare')).toEndWith('| slower (hypothesis: one session) |')
  })

  test('a row without a verdict prints the widest band of its sessions: a row that a copy\'s speed left blind would read as judged to its floor', () => {
    // The worst rows' floor is 2%.
    expect(row(two, 'layout')).toEndWith('| within noise (±2.0%) |')
    expect(row(two.slice(0, 1), 'layout')).toEndWith('| within noise (±2.0%) (hypothesis: one session) |')
    // The control's copy ran 8% slower than base's in the first session and 12% faster in the second.
    expect(row(two, 'walk')).toEndWith('| +8.0% -12.0% | within noise (±12.0%) |')
    expect(row(two.slice(0, 1), 'walk')).toEndWith('| +8.0% | slower (hypothesis: one session) |')
    expect(row([two[1]!, two[0]!].map((r, session) => ({ ...r, session })), 'walk')).toEndWith('| -12.0% +8.0% | within noise (±12.0%) |')
  })

  test('sessions side by side are judged by the floors fitted to them, 2% on seen and 3% on lines, and the other rows by the foreground\'s: a copy that sits 1.5% or 2.5% from base in every session, as one does side by side on identical code, would be called a change', () => {
    const lines = [0, 1, 2].map(session => sessionOf(session, { stats: [1.025, 1] }, 'chrome', 'mixed', 'lines'))
    expect(row(lines, 'mixed stats')).toEndWith('| slower |')
    expect(row(lines, 'mixed stats', FLOORS.sideBySide)).toEndWith('| within noise (±3.0%) |')
    const seen = [0, 1, 2].map(session => sessionOf(session, { seen: [1.015, 1] }, 'chrome', 'latin', 'seen'))
    expect(row(seen, 'latin seen')).toEndWith('| slower |')
    expect(row(seen, 'latin seen', FLOORS.sideBySide)).toEndWith('| within noise (±2.0%) |')
    const others: Record<string, number> = { ...FLOORS.sideBySide, seen: 0.01, lines: 0.01 }
    expect(others).toEqual(FLOORS.foreground)
  })

  test('a verdict on a row Firefox moves with the bundle says so: an unrelated change would be blamed for it', () => {
    const controls = (browser: string, candidate: number): SessionResults[] => [0, 1, 2].map(session => sessionOf(session, { layout: [candidate, 1], prepare: [candidate, 1] }, browser, 'controls'))
    expect(row(controls('firefox', 1.16), 'controls layout')).toEndWith('| slower (moves with the bundle) |')
    expect(row(controls('firefox', 0.84), 'controls layout')).toEndWith('| faster (moves with the bundle) |')
    expect(row(controls('firefox', 1.16).slice(0, 2), 'controls layout')).toEndWith('| slower (unconfirmed) (moves with the bundle) |')
    expect(row(controls('firefox', 1.01), 'controls layout')).toEndWith('| within noise (±2.0%) |')
    expect(row(controls('firefox', 1.16), 'controls prepare')).toEndWith('| slower |')
    expect(row(controls('chrome', 1.16), 'controls layout')).toEndWith('| slower |')
  })

  test('documents that ran in a hidden page are counted under the table: a background window covered whole would be timed slowed and say nothing', () => {
    const seen = [sessionOf(0, { layout: [1, 1] }), sessionOf(1, { layout: [1, 1] })]
    expect(report(seen, { builds: BUILDS, floors: FLOORS.foreground, sizes: {} })).not.toContain('hidden')
    const covered = sessionOf(1, { layout: [1, 1] })
    covered.results['worst pre-wrap-chunks']!.end = { ...snapshot, visible: false }
    expect(report([seen[0]!, covered], { builds: BUILDS, floors: FLOORS.foreground, sizes: {} })).toContain('\n1 documents ran while their page was hidden')
  })

  test('the output ends with one line of what was timed and how many entries read each way, then each entry that read slower or faster, or a line that says none did: a pull request would paste every row to show two', () => {
    const form = '3 sessions each in chrome, firefox, side by side in background windows, 135 s'
    const of = (all: SessionResults[]): string[] => summary(all, { builds: BUILDS, form, floors: FLOORS.sideBySide }).split('\n')
    const chrome = [0, 1, 2].map(session => sessionOf(session, { prepare: [1.2, 1], layout: [1.01, 1], walk: [0.9, 1.01] }))
    const firefox = [0, 1, 2].map(session => sessionOf(session, { layout: [1.16, 1], prepare: [1, 1] }, 'firefox', 'controls'))
    expect(of([...chrome, ...firefox])).toEqual([
      `${BUILDS}; ${form}; 5 entries: 2 slower, 1 faster, 2 within noise`,
      '- chrome | worst | pre-wrap-chunks prepare: slower, +20.1% +20.1% +20.1% (control +0.0% +0.0% +0.0%)',
      '- chrome | worst | pre-wrap-chunks walk: faster, -9.9% -9.9% -9.9% (control +1.0% +1.0% +1.0%)',
      '- firefox | worst | controls layout: slower (moves with the bundle), +16.1% +16.1% +16.1% (control +0.0% +0.0% +0.0%)',
    ])
    expect(of([0, 1, 2].map(session => sessionOf(session, { layout: [1.01, 1] })))).toEqual([`${BUILDS}; ${form}; 1 entries: 0 slower, 0 faster, 1 within noise`, '- no entry read slower or faster'])
    // The marks a table gives a verdict come with it, and so does the count of documents that ran hidden.
    expect(of(chrome.slice(0, 2))[1]).toStartWith('- chrome | worst | pre-wrap-chunks prepare: slower (unconfirmed), +20.1% +20.1% (control')
    const covered = sessionOf(1, { layout: [1.01, 1] })
    covered.results['worst pre-wrap-chunks']!.start = { ...snapshot, visible: false }
    expect(of([sessionOf(0, { layout: [1.01, 1] }), covered])[0]).toEndWith('1 entries: 0 slower, 0 faster, 1 within noise; 1 documents ran hidden, so time again')
  })

  test('the rows marked are rows the bench times: a renamed row would lose its mark and say nothing', () => {
    // Every operation slower but the resize documents' first, at the three widths laid out before.
    const docs = documents(['resize', 'worst'], 'bench-test', false)
    const slower = [0, 1, 2].map(session => ({
      browser: 'firefox', session, seed: '', docs: docs.map(d => ({ row: d.row, family: d.family, id: d.id })),
      results: Object.fromEntries(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(d.row === 'resize' && spec.widths.length > 0 ? 1 : 1.3, 1) })) }])),
    }))
    const marked = report(slower, { builds: BUILDS, floors: FLOORS.foreground, sizes: {} }).split('\n').filter(line => line.endsWith('| slower (moves with the bundle) |'))
    expect(marked.map(line => line.split(' | ').slice(0, 2).join(' | '))).toEqual(['| resize | latin layout at new widths', '| worst | controls layout', '| worst | invisible-tails layout'])
  })

  test('the output starts with the builds it compared, each with its commit: a pasted table wouldn\'t say what it timed', () => {
    expect(report(two, { builds: BUILDS, floors: FLOORS.foreground, sizes: {} }).split('\n')[1]).toBe(BUILDS)
    expect(buildName('HEAD')).toMatch(/^HEAD \([0-9a-f]{7,}, \d{4}-\d\d-\d\d\)$/)
    expect(buildName(join(import.meta.dir, '../../src'))).toMatch(/^this tree's src\/ \(on [0-9a-f]{7,}, \d{4}-\d\d-\d\d(, with uncommitted changes)?\)$/)
  })
})

describe('the sessions', () => {
  // Stand-in browsers: every copy at base's speed, but the candidate's layout of the pre-wrap chunks at `slow`'s cost in
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
      return Promise.resolve(new Map(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(d.id === 'worst pre-wrap-chunks' && spec.op === 'layout' ? slow(browser, session) : 1, 1) })) }])))
    }
    const { all, failed } = await runSessions(browsers, sessions, seed => documents(['worst'], seed, false), { time, save: () => {}, log: () => {} })
    return { given, ids, all, failed }
  }

  test('after two sessions a row that reads slower gets its document, and no other, timed once more, and keeps the verdict only if that session agrees: noise that two sessions share would be called a change', async () => {
    const steady = await run(['chrome'], 2, () => 1.2)
    expect(steady.given).toEqual(['chrome 11', 'chrome 11', 'chrome 1'])
    expect(steady.ids[2]).toEqual(['worst pre-wrap-chunks'])
    expect(row(steady.all, 'pre-wrap-chunks layout')).toEndWith('| slower |')
    expect(row((await run(['chrome'], 2, (_, session) => (session < 2 ? 1.2 : 1))).all, 'pre-wrap-chunks layout')).toEndWith('| within noise (±2.0%) |')
    expect((await run(['chrome'], 2, () => 1)).given).toEqual(['chrome 11', 'chrome 11'])
  })

  test('each browser confirms its own rows, a faster one too: one browser\'s change would be timed again in the others, or a speedup stand unconfirmed', async () => {
    const { given, all } = await run(['chrome', 'firefox'], 2, browser => (browser === 'firefox' ? 0.8 : 1))
    expect(given).toEqual(['chrome 11', 'firefox 11', 'chrome 11', 'firefox 11', 'firefox 1'])
    expect(row(all.filter(r => r.browser === 'firefox'), 'pre-wrap-chunks layout')).toEndWith('| faster |')
  })

  test('one session gets no confirming session, and three need none: one session\'s rows would be timed twice and read as confirmed, or a calibration run a fourth session', async () => {
    const one = await run(['chrome'], 1, () => 1.2)
    expect(one.given).toEqual(['chrome 11'])
    expect(row(one.all, 'pre-wrap-chunks layout')).toEndWith('| slower (hypothesis: one session) |')
    const three = await run(['chrome'], 3, () => 1.2)
    expect(three.given).toEqual(['chrome 11', 'chrome 11', 'chrome 11'])
    expect(row(three.all, 'pre-wrap-chunks layout')).toEndWith('| slower |')
  })

  test('a browser that fails a session sits out the rest, its confirming session too, and the others go on: a stalled browser would be started again and again', async () => {
    // Firefox fails its second session, with a row that read slower in its first.
    const second = await run(['chrome', 'firefox'], 2, () => 1.2, { firefox: 1 })
    expect(second.given).toEqual(['chrome 11', 'firefox 11', 'chrome 11', 'firefox 11', 'chrome 1'])
    expect([...second.failed]).toEqual([['firefox', 'session 2: stalled']])
    expect(row(second.all.filter(r => r.browser === 'firefox'), 'pre-wrap-chunks layout')).toEndWith('| slower (hypothesis: one session) |')
    const first = await run(['chrome', 'firefox'], 3, () => 1, { firefox: 0 })
    expect(first.given).toEqual(['chrome 11', 'firefox 11', 'chrome 11', 'chrome 11'])
    expect(first.all.map(r => r.browser)).toEqual(['chrome', 'chrome', 'chrome'])
  })
})

describe('sessions side by side', () => {
  // Stand-in browsers that end only when the test lets them: each time the sessions that have started are all waiting,
  // they end in the reverse of the order they started in, so the sessions never end in the order of the tables.
  const run = async (together: boolean): Promise<{ events: string[]; order: string[] }> => {
    const events: string[] = []
    const waiting: Array<() => void> = []
    const time = (browser: BrowserKind, docs: Planned[]): Promise<Map<string, DocResult>> => new Promise(done => {
      events.push(`start ${browser}`)
      waiting.push(() => {
        events.push(`end ${browser}`)
        done(new Map(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(1, 1) })) }])))
      })
    })
    const done = runSessions(['firefox', 'chrome'], 2, seed => documents(['worst'], seed, false), { time, save: () => {}, log: () => {} }, together)
    for (;;) {
      // A session starts in the same turn as the one before it ends, so after a turn every session due is waiting.
      const result = await Promise.race([done, Bun.sleep(0).then(() => null)])
      if (result !== null) return { events, order: result.all.map(r => `${r.browser} ${r.session}`) }
      const ending = waiting.splice(0).reverse()
      for (let i = 0; i < ending.length; i++) ending[i]!()
    }
  }

  test('every session of every browser starts before one ends, where one at a time each ends before the next starts: nine sessions would take nine sessions\' time', async () => {
    expect((await run(true)).events).toEqual(['start firefox', 'start firefox', 'start chrome', 'start chrome', 'end chrome', 'end chrome', 'end firefox', 'end firefox'])
    expect((await run(false)).events).toEqual(['start firefox', 'end firefox', 'start chrome', 'end chrome', 'start firefox', 'end firefox', 'start chrome', 'end chrome'])
  })

  test('the tables keep the browsers\' order and each browser\'s sessions in theirs, whichever ended first: a table\'s per-session columns would change places from run to run', async () => {
    expect((await run(true)).order).toEqual(['firefox 0', 'firefox 1', 'chrome 0', 'chrome 1'])
    expect((await run(false)).order).toEqual(['firefox 0', 'firefox 1', 'chrome 0', 'chrome 1'])
  })

  test('a browser that fails one of its sessions keeps the others\' samples, and the other browsers theirs: one stalled window would cost the whole run', async () => {
    let chrome = 0
    const time = (browser: BrowserKind, docs: Planned[]): Promise<Map<string, DocResult>> => {
      if (browser === 'chrome' && chrome++ === 1) return Promise.reject(new Error('stalled'))
      return Promise.resolve(new Map(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(1, 1) })) }])))
    }
    const { all, failed } = await runSessions(['chrome', 'firefox'], 3, seed => documents(['worst'], seed, false), { time, save: () => {}, log: () => {} }, true)
    expect([...failed]).toEqual([['chrome', 'session 2: stalled']])
    expect(all.map(r => `${r.browser} ${r.session}`)).toEqual(['chrome 0', 'chrome 2', 'firefox 0', 'firefox 1', 'firefox 2'])
  })

  test('two sessions side by side are confirmed by the floors fitted to them, and two in the foreground by the foreground\'s: a lines document whose copy sits 2.5% from base, noise side by side, would be timed a third time', async () => {
    const timed = async (together: boolean): Promise<string[]> => {
      const given: string[] = []
      const time = (browser: BrowserKind, docs: Planned[]): Promise<Map<string, DocResult>> => {
        given.push(`${browser} ${docs.length}`)
        return Promise.resolve(new Map(docs.map(d => [d.id, { id: d.id, timerStep: 0.005, start: snapshot, end: snapshot, ops: d.ops.map(spec => ({ op: spec.op, rounds: rounds(1.025, 1) })) }])))
      }
      await runSessions(['chrome'], 2, seed => documents(['lines'], seed, false), { time, save: () => {}, log: () => {} }, together)
      return given
    }
    expect(await timed(true)).toEqual(['chrome 3', 'chrome 3'])
    expect(await timed(false)).toEqual(['chrome 3', 'chrome 3', 'chrome 3'])
  })
})

describe('the quick plan', () => {
  test('a quick session times three rounds a document, the new row its twelve, and no fresh page: a quick run that kept the long form\'s rounds would take the long form\'s time', () => {
    const quick = documents(ROWS, 'bench-test', false, true)
    expect(quick.some(d => d.row === 'fresh')).toBe(false)
    expect(quick.length).toBe(33)
    expect(new Set(quick.filter(d => d.row !== 'new').map(d => d.rounds))).toEqual(new Set([3]))
    expect(new Set(quick.filter(d => d.row === 'new').map(d => d.rounds))).toEqual(new Set([12]))
  })

  test('a quick session\'s documents are the long form\'s, text for text, less the fresh pages: a quick table\'s entry would time other text than the long table\'s entry of the same name', () => {
    const long = documents(ROWS, 'bench-test', false).filter(d => d.row !== 'fresh')
    const quick = documents(ROWS, 'bench-test', false, true)
    expect(new Set(long.map(d => `${d.rounds} ${d.targetMs}`))).toEqual(new Set(['12 50', '16 50']))
    expect(quick.map(d => ({ ...d, rounds: 0 }))).toEqual(long.map(d => ({ ...d, rounds: 0 })))
  })
})

describe('the flags', () => {
  test('with no flag the harness\'s background browsers time three sessions each, and --foreground asks for the focused windows and two: a default back in the foreground would take the screen for eleven minutes', () => {
    expect(benchOptions(new Map(), null)).toEqual({ browsers: ['chrome', 'firefox', 'webkit-host'], sessions: 3, rows: ROWS, foreground: false, quick: false })
    expect(benchOptions(new Map([['foreground', '']]), null)).toEqual({ browsers: ['chrome', 'firefox', 'safari'], sessions: 2, rows: ROWS, foreground: true, quick: false })
    expect(benchOptions(new Map([['sessions', '5'], ['rows', 'worst,new']]), ['chrome'])).toEqual({ browsers: ['chrome'], sessions: 5, rows: ['worst', 'new'], foreground: false, quick: false })
  })

  test('--quick is asked for, never the default, and times three sessions wherever it runs; with it --rows=fresh is refused: a quick run would stand for the long form, or print a table with no fresh page and say nothing', () => {
    expect(benchOptions(new Map([['quick', '']]), null)).toEqual({ browsers: ['chrome', 'firefox', 'webkit-host'], sessions: 3, rows: ROWS, foreground: false, quick: true })
    expect(benchOptions(new Map([['quick', ''], ['foreground', '']]), null).sessions).toBe(3)
    expect(() => benchOptions(new Map([['quick', ''], ['rows', 'worst,fresh']]), null)).toThrow('a quick session times no fresh page')
    expect(benchOptions(new Map([['rows', 'worst,fresh']]), null).rows).toEqual(['worst', 'fresh'])
  })

  test('installed Safari is refused side by side and webkit-host in the foreground, before anything is built: Safari is one app and can\'t run three sessions at once, and webkit-host\'s window never has the focus', async () => {
    const refused = (o: BenchOptions): Promise<string> => bench('HEAD', 'HEAD', o).then(() => 'timed', error => String(error))
    expect(await refused({ browsers: ['chrome', 'safari'], sessions: 3, rows: ['worst'], foreground: false, quick: false })).toContain('safari has no background window')
    expect(await refused({ browsers: ['webkit-host'], sessions: 2, rows: ['worst'], foreground: true, quick: false })).toContain('webkit-host has no foreground window')
  })
})

describe('two builds of the same bytes', () => {
  test('a commit\'s src/ copied to another folder builds the commit\'s bytes, and bench times neither: a change to comments alone would be timed for eleven minutes', async () => {
    const head = srcOf('HEAD')
    const copy = join(import.meta.dir, '../../.artifacts/harness-test-bench/src')
    cpSync(head, copy, { recursive: true })
    expect((await benchBundle(copy)).code).toBe((await benchBundle(head)).code)
    const logged: string[] = []
    const log = spyOn(console, 'log').mockImplementation(text => { logged.push(String(text)) })
    // No browser is named, so a bench that went on would start none.
    try {
      await bench('HEAD', copy, { browsers: [], sessions: 3, rows: ['worst'], foreground: false, quick: false })
    } finally {
      log.mockRestore()
    }
    expect(logged.length).toBe(1)
    expect(logged[0]).toContain('the two bundles are the same bytes')
    expect(logged[0]).toEndWith('bun harness bench HEAD --lib=HEAD')
  })
})

describe('the texts', () => {
  const docs = documents(['new', 'fresh', 'rich'], 'bench-test', false)
  // A mixed message may end with a space and an emoji its text doesn't hold, which a batch's end may cut anywhere.
  const emojiTail = new RegExp(` ?[${EMOJI.join('')}]*$`, 'u')

  test('the rows that time new text never prepare a message of the corpora twice: a warm cache would read as a faster library', () => {
    // The chat documents are left out: the demo repeats sentences, and 6% of `chat`'s new paragraphs repeat an earlier
    // one whole (harness/bench/README.md, Rows).
    for (const family of MESSAGE_FAMILIES) {
      const text = familyText(family)
      let at = 0
      for (const d of docs.filter(x => x.family === family)) {
        const messages = d.fresh !== undefined ? d.fresh.batches.flat() : d.ops.filter(op => op.batches !== undefined).flatMap(op => op.batches!.flat().map(m => (typeof m === 'string' ? m : (m as Array<{ text: string }>).map(item => item.text).join(''))))
        for (const m of messages) {
          const read = family === 'mixed' ? m.replace(emojiTail, '') : m
          const found = text.indexOf(read, at)
          expect(found).toBeGreaterThanOrEqual(at)
          at = found + read.length
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
        for (const message of texts) expect(familyText(family)).toContain(family === 'mixed' ? message.replace(emojiTail, '') : message)
      }
    }
  })

  test('the rich row times the chat demo\'s paragraphs beside the stress items, and its styled ones alone: a change that slows items of several words would be read only on items of a word each', () => {
    type Items = Array<{ text: string }>
    const rich = docs.filter(d => d.row === 'rich')
    expect(rich.map(d => `${d.family} ${d.ops.map(op => op.op).join(' ')}`)).toEqual(['latin', 'chat', 'chat-styled'].map(family => `${family} rich-new rich-stats rich-walk rich-stream rich-seen`))
    const [stress, chat, styled] = rich.map(d => ({ kept: d.ops[1]!.texts as Items[], batch: Math.max(...d.ops[0]!.batchUnits!) }))
    const share = (lists: Items[], of: (items: Items) => boolean): number => lists.filter(of).length / lists.length
    // The stress items are a word or a space each. Most of the demo's paragraphs are one item, as 86% of all it
    // prepares are; its styled ones are several, with an item of several words in most, and in two in five an item
    // that starts inside a word, with no white space on either side of its start.
    expect(share(stress!.kept, items => items.every(item => !/\S\s|\s\S/.test(item.text)))).toBe(1)
    expect(share(chat!.kept, items => items.length === 1)).toBeGreaterThan(0.8)
    expect(share(chat!.kept, items => items.length === 1)).toBeLessThan(0.92)
    expect(share(styled!.kept, items => items.length > 1)).toBeGreaterThan(0.98)
    expect(share(styled!.kept, items => items.some(item => /\S\s+\S/.test(item.text)))).toBeGreaterThan(0.9)
    expect(share(styled!.kept, items => items.some((item, i) => i > 0 && !/\s/.test(item.text[0]!) && !/\s/.test(items[i - 1]!.text.at(-1)!)))).toBeGreaterThan(0.3)
    // A round of new text compares three batches, and the demo's paragraphs differ more than prose does: a batch of
    // them is four of the stress document's (harness/bench/README.md, Rows).
    expect([stress!.batch, chat!.batch, styled!.batch]).toEqual([1000, 4000, 4000])
  })

  test('the worst row prepares letter-spaced Hindi and Arabic again after clearCache(): nothing else would time what the WebKit profile asks Canvas about their glyphs', async () => {
    const spaced = documents(['worst'], 'bench-test', false).filter(d => d.family === 'hindi-letter-spaced' || d.family === 'arabic-letter-spaced')
    expect(spaced.map(d => [d.family, d.lang, d.font, d.options, d.ops.map(op => op.op).join(' ')])).toEqual([
      ['hindi-letter-spaced', 'hi', '16px "Kohinoor Devanagari"', { letterSpacing: 0.5 }, 'prepare prepare-cleared'],
      ['arabic-letter-spaced', 'ar', '16px "Geeza Pro"', { letterSpacing: 0.5 }, 'prepare prepare-cleared'],
    ])
    // Both operations are handed the texts, and never handles made before the rounds.
    for (const d of spaced) for (const op of d.ops) expect([op.handles, units(op.texts as string[])]).toEqual([undefined, op.textUnits!])
    // The library's part, in a process of its own with a Canvas that counts: prepared again, texts ask Canvas nothing,
    // and after clearCache() they ask all they asked when new, each rep.
    const bundle = join(import.meta.dir, '../../.artifacts/harness-test-bench/cleared.js')
    mkdirSync(join(bundle, '..'), { recursive: true })
    writeFileSync(bundle, (await benchBundle(join(import.meta.dir, '../../src'))).code)
    const child = Bun.spawnSync([process.execPath, '--preload', join(import.meta.dir, '../watchdog.ts'), '-e', `
      let calls = 0
      globalThis.OffscreenCanvas = class { getContext() { return { font: '', measureText(text) { calls++; return { width: text.length * 8 } } } } }
      await import(${JSON.stringify(bundle)})
      const asked = op => {
        const before = calls
        globalThis.__benchLibrary.run(op, ['one two three', 'two four'], [300], 2, '16px Test', {})
        return calls - before
      }
      console.log(JSON.stringify([asked('prepare'), asked('prepare'), asked('prepare-cleared'), asked('prepare-cleared')]))
    `], { timeout: 10_000, killSignal: 'SIGKILL' })
    if (child.exitCode !== 0) throw new Error(child.stderr.toString())
    const [first, again, cleared, clearedAgain] = JSON.parse(child.stdout.toString()) as number[]
    expect(first).toBeGreaterThan(0)
    expect([again, cleared, clearedAgain]).toEqual([0, 2 * first!, 2 * first!])
  })

  test('each family\'s new batches hold the same units: a longer batch would read as a slower library', () => {
    for (const d of docs) {
      const sizes = d.fresh !== undefined ? d.fresh.batches.map(units) : d.ops[0]!.batchUnits!
      // One unit more, or one fewer in the item lists, where a cut would split a surrogate pair.
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      if (d.row === 'new' && d.family !== 'labels') expect(Math.min(...sizes)).toBeGreaterThan(200)
    }
  })
})
