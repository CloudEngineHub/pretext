// What the bench prints: per browser, row and family or operation, base's and the candidate's cost (per 1,000 UTF-16
// units, or per call for labels), candidate/base as the median over rounds of each round's paired ratio with its
// quartiles and each session's median, control/base the same way, and a verdict (`verdict()`). Then the costliest
// entry per row, the fresh pages and the bundles' sizes.
import CALIBRATION from './calibration.json'
import type { DocResult, Sample } from './page.ts'

// Each row's noise floor, from a calibration of HEAD against itself (harness/README.md, Bench): the largest deviation
// from base that the candidate or the control held in one direction in all three sessions, rounded up to a whole
// percent. Calibrated 2026-09-26 at 7204cab2, `bun harness bench HEAD --sessions=3` in the foreground, in Chrome 154.0.8037.57,
// Firefox 156.0.1 and Safari 27.0 (22625.1.29.11.27), on an M5 Max (Mac17,7) under macOS 27.0 (26A428), on AC power, at
// device pixel ratio 2; calibration.json holds its readings. An entry the calibration didn't time in the browser, as
// the lines row's Latin and CJK ones, added later, takes its row's floor and prints "(uncalibrated)".
export const FLOORS: Record<string, number> = { new: 0.06, rich: 0.05, seen: 0.01, resize: 0.05, lines: 0.01, worst: 0.02 }

export type SessionResults = { browser: string; session: number; seed: string; docs: Array<{ row: string; family: string; id: string }>; results: Record<string, DocResult> }

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length === 0 ? NaN : s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
// The lower and upper quartiles, each the same count of values in from its end: three quarters of the values sit at or
// over the lower one, and three quarters at or under the upper.
function quartiles(xs: readonly number[]): [number, number] {
  const s = [...xs].sort((a, b) => a - b)
  const quarter = s.length >> 2
  return [s[quarter]!, s[s.length - 1 - quarter]!]
}

// One session's reading of an entry: the medians over its rounds of candidate/base and control/base, and the quartiles
// of control/base.
export type Reading = { candidate: number; control: number; controlQuartiles: [number, number] }

// Whether the control ran apart from base for a session: three quarters of its rounds beyond the floor on one side.
// The control is base's code, so base's code ran at two speeds there: a copy can keep one speed for a whole document
// (Chrome 154's rich stats ran at 2.3 or 2.6 µs per 1,000 units, copy by copy, 2026-09-30).
const apart = (s: Reading, floor: number): boolean => s.controlQuartiles[0] > 1 + floor || s.controlQuartiles[1] < 1 - floor

export type Verdict = 'slower' | 'faster' | 'two speeds' | 'within noise'
// "slower" or "faster" only when candidate/base is outside the session's band in every session; the band is 1 ± the
// larger of the session's |control/base - 1| and the row's floor. A row that gets neither reads "two speeds" when the
// control ran apart in some session: its band there was the distance between two copies of base, not the row's floor.
export function verdict(sessions: readonly Reading[], floor: number): Verdict {
  let slower = sessions.length > 0
  let faster = slower
  let split = false
  for (const s of sessions) {
    const band = Math.max(Math.abs(s.control - 1), floor)
    if (!(s.candidate > 1 + band)) slower = false
    if (!(s.candidate < 1 - band)) faster = false
    if (apart(s, floor)) split = true
  }
  return slower ? 'slower' : faster ? 'faster' : split ? 'two speeds' : 'within noise'
}

const cost = (round: readonly Sample[], label: string): number => {
  const s = round.find(x => x.label === label)!
  return s.ms / s.units
}
// Paired ratios: a label's cost over base's in the same round, a ratio a round.
const ratios = (rounds: readonly Sample[][], label: string): number[] => rounds.map(round => cost(round, label) / cost(round, 'base'))
const reading = (rounds: readonly Sample[][]): Reading => {
  const control = ratios(rounds, 'control')
  return { candidate: median(ratios(rounds, 'candidate')), control: median(control), controlQuartiles: quartiles(control) }
}

// One browser's entries, a table row each: the operation of a document's family, with its rounds by session in order.
type Entry = { row: string; doc: string; perCall: boolean; sessions: Sample[][][] }
function entriesOf(results: readonly SessionResults[]): Map<string, Entry> {
  const bySession = new Map<string, { entry: Entry; rounds: Map<number, Sample[][]> }>()
  for (const r of results) {
    for (const d of r.docs) {
      const result = r.results[d.id]
      if (result === undefined || 'compileMs' in result) continue
      for (let o = 0; o < result.ops.length; o++) {
        const key = `${d.row}\t${d.family} ${result.ops[o]!.op}${d.row === 'resize' ? (o === 0 ? ' at widths seen before' : ' at new widths') : ''}`
        const e = bySession.get(key) ?? { entry: { row: d.row, doc: d.id, perCall: d.family === 'labels', sessions: [] }, rounds: new Map<number, Sample[][]>() }
        bySession.set(key, e)
        e.rounds.set(r.session, [...(e.rounds.get(r.session) ?? []), ...result.ops[o]!.rounds])
      }
    }
  }
  const out = new Map<string, Entry>()
  for (const [key, e] of bySession) out.set(key, { ...e.entry, sessions: [...e.rounds].sort((a, b) => a[0] - b[0]).map(([, rounds]) => rounds) })
  return out
}

// Every entry's readings by browser, as calibration.json keeps a calibration's: [candidate, control, the control's
// quartiles] per session, the numbers the verdict reads.
export type Readings = Record<string, Record<string, number[][]>>
export function readings(all: readonly SessionResults[]): Readings {
  const out: Readings = {}
  for (const browser of new Set(all.map(r => r.browser))) {
    const entries: Record<string, number[][]> = {}
    for (const [key, e] of entriesOf(all.filter(r => r.browser === browser))) {
      entries[key.replace('\t', ' | ')] = e.sessions.map(reading).map(s => [s.candidate, s.control, ...s.controlQuartiles])
    }
    out[browser] = entries
  }
  return out
}

// The documents of one browser's rows that read slower or faster: after two sessions bench() times them in a third,
// and the verdict stands only if that one agrees. Of HEAD against itself, two sessions alone call a change in 11 of the
// calibration's 423 pairs of sessions; the floors, fitted to three, call none of its 141 entries (calibration.json,
// checked in bench.test.ts).
export function unconfirmed(results: readonly SessionResults[]): string[] {
  const docs = new Set<string>()
  for (const e of entriesOf(results).values()) {
    const v = verdict(e.sessions.map(reading), FLOORS[e.row] ?? 0)
    if (v === 'slower' || v === 'faster') docs.add(e.doc)
  }
  return [...docs]
}

type FreshTimes = { compile: number[]; run: number[]; first: number[]; second: number[] }

const pct = (x: number): string => `${x >= 1 ? '+' : ''}${((x - 1) * 100).toFixed(1)}%`
const speed = (x: number): string => (x >= 100 ? x.toFixed(0) : x.toPrecision(3))

export function report(all: readonly SessionResults[], o: { hypotheses: boolean; sizes: Record<string, { bytes: number; gzipped: number }> }): string {
  const out: string[] = []
  for (const browser of new Set(all.map(r => r.browser))) {
    const results = all.filter(r => r.browser === browser)
    out.push(`\n## ${browser}`, '| row | family / operation | base | candidate | candidate/base [quartiles] per session | control/base per session | verdict |', '|---|---|---:|---:|---|---|---|')
    const calibrated = (CALIBRATION as Readings)[browser] ?? {}
    const fresh = new Map<string, Map<string, FreshTimes>>()
    const steps: number[] = []
    const dprs = new Set<number>()
    for (const r of results) {
      for (const d of r.docs) {
        const result = r.results[d.id]
        if (result === undefined) continue
        steps.push(result.timerStep)
        dprs.add(result.start.dpr).add(result.end.dpr)
        if (!('compileMs' in result)) continue
        const byLabel = fresh.get(d.family) ?? new Map<string, FreshTimes>()
        fresh.set(d.family, byLabel)
        const e = byLabel.get(result.label) ?? { compile: [], run: [], first: [], second: [] }
        byLabel.set(result.label, e)
        e.compile.push(result.compileMs)
        e.run.push(result.runMs)
        e.first.push(1000 * result.batches[0]!.ms / result.batches[0]!.units)
        e.second.push(1000 * result.batches[1]!.ms / result.batches[1]!.units)
      }
    }
    const costliest = new Map<string, { key: string; cost: number }>()
    for (const [key, e] of entriesOf(results)) {
      const name = key.replace('\t', ' | ')
      const unit = e.perCall ? 'µs/call' : 'µs/1k'
      const typical = (rounds: readonly Sample[][], label: string): number => (e.perCall ? 1000 : 1_000_000) * median(rounds.map(round => cost(round, label)))
      const per = e.sessions.map(reading)
      const rounds = e.sessions.flat()
      const cand = ratios(rounds, 'candidate')
      const [low, high] = quartiles(cand)
      const floor = FLOORS[e.row] ?? 0
      let v: string = verdict(per, floor)
      if (v === 'two speeds') {
        // With base's and the control's costs in the session that held them furthest apart.
        let widest = -1
        for (let s = 0; s < per.length; s++) if (apart(per[s]!, floor) && (widest < 0 || Math.abs(per[s]!.control - 1) > Math.abs(per[widest]!.control - 1))) widest = s
        v = `two speeds (base ${speed(typical(e.sessions[widest]!, 'base'))}, control ${speed(typical(e.sessions[widest]!, 'control'))} ${unit})`
      } else if (v !== 'within noise' && per.length < 3) v += ' (unconfirmed)' // the floors are fitted to three sessions
      const hypothesis = o.hypotheses ? ' (hypothesis: background browsers)' : per.length === 1 ? ' (hypothesis: one session)' : ''
      const base = typical(rounds, 'base')
      if (base > (costliest.get(e.row)?.cost ?? -1)) costliest.set(e.row, { key, cost: base })
      out.push(`| ${name} | ${base.toFixed(1)} ${unit} | ${typical(rounds, 'candidate').toFixed(1)} | ${pct(median(cand))} [${pct(low)}, ${pct(high)}] ${per.map(p => pct(p.candidate)).join(' ')} | ${per.map(p => pct(p.control)).join(' ')} | ${v}${hypothesis}${calibrated[name] === undefined ? ' (uncalibrated)' : ''} |`)
    }
    out.push('', `timer step ${Math.min(...steps).toFixed(3)}-${Math.max(...steps).toFixed(3)} ms; device pixel ratio ${[...dprs].join(', ')}${dprs.size > 1 ? ' (it changed: the sessions aren\'t comparable)' : ''}`)
    out.push(`costliest per row (base): ${[...costliest].map(([row, c]) => `${row}: ${c.key.split('\t')[1]} ${c.cost.toFixed(1)}`).join('; ')}`)
    if (fresh.size > 0) {
      out.push('', '| fresh page | library | compile ms | run ms | first batch µs/unit | second batch µs/unit |', '|---|---|---:|---:|---:|---:|')
      for (const [family, byLabel] of fresh) for (const [label, e] of byLabel) out.push(`| ${family} | ${label} | ${median(e.compile).toFixed(2)} | ${median(e.run).toFixed(2)} | ${median(e.first).toFixed(2)} | ${median(e.second).toFixed(2)} |`)
    }
  }
  out.push('', `bundles: ${Object.entries(o.sizes).map(([label, s]) => `${label} ${s.bytes} B minified, ${s.gzipped} B gzipped`).join('; ')}`)
  return out.join('\n')
}
