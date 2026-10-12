// What the bench prints: the builds, then per browser, row and family or operation, base's and the candidate's cost (per
// 1,000 UTF-16 units, or per call for labels), candidate/base as the median over rounds of each round's paired ratio
// with its quartiles and each session's median, control/base the same way, and a verdict (`verdict()`). Then the
// costliest entry per row, the fresh pages and the bundles' sizes; and last, the few lines a pull request quotes
// (`summary()`).
import type { DocResult, Sample } from './page.ts'

// Each row's noise floor, from a calibration of HEAD against itself (harness/bench/README.md, Floors): the largest
// deviation from base that the candidate or the control held in one direction in all three sessions, rounded up to a
// whole percent. Uncalibrated rows take none. A form of the bench has its own, since sessions side by side share the
// machine's cores.
// - `foreground`, one window at a time: calibrated 2026-09-26 at 7204cab2, `bun harness bench HEAD --sessions=3` in the
//   foreground, in Chrome 154.0.8037.57, Firefox 156.0.1 and Safari 27.0 (22625.1.29.11.27), on an M5 Max (Mac17,7)
//   under macOS 27.0 (26A428), on AC power, at device pixel ratio 2. The rich row's kept lines and chat documents (#456)
//   were run against its floor on 2026-10-07 at e1c6ed68, in Chrome 154.0.8037.98 and the same Firefox and Safari: main
//   against itself was called on none of its entries in eight sessions of the row or in three of every row.
// - `sideBySide`, every session at once in background windows: the same rule, a run at a time, over 22 runs of three
//   sessions a browser on 2026-10-11 at bac1774c, in Chrome 154.0.8037.98, Firefox 157.0.1 and webkit-host on WebKit
//   22625.1.29.11.27, on the same machine, each run alone on it: five of main against itself, and the controls of 17
//   other builds timed against main, where the candidate's copy is another build's and doesn't count. `seen` held 2% or
//   less in all 22 runs and over 1% in 11, and `lines` 3% or less in 19 and over 1% in 20, on entries of every
//   browser, so those two take 2% and 3%. The others keep the foreground's: `rich` and `resize` held 5% or less in 18
//   and 19 runs, and what holds more than 6% on `new` and 2% on `worst` is copies that keep another speed for a
//   document and batches of new text that differ, which a session's band covers and no floor short of that distance
//   does (harness/bench/README.md, Floors, has the counts).
export const FLOORS: Record<'foreground' | 'sideBySide', Record<string, number>> = {
  foreground: { new: 0.06, rich: 0.05, seen: 0.01, resize: 0.05, lines: 0.01, worst: 0.02 },
  sideBySide: { new: 0.06, rich: 0.05, seen: 0.02, resize: 0.05, lines: 0.03, worst: 0.02 },
}

// Firefox 156.0.1's rows that read slower or faster with changes to the bundle their code doesn't run (2026-10-02;
// harness/bench/README.md, Entries that misread, has each). A verdict on one says so, and wants a second change's table
// before it is blamed on the change.
const MOVES_WITH_BUNDLE: Record<string, readonly string[]> = {
  firefox: ['resize | latin layout at new widths', 'worst | controls layout', 'worst | invisible-tails layout'],
}

export type SessionResults = { browser: string; session: number; seed: string; docs: Array<{ row: string; family: string; id: string }>; results: Record<string, DocResult> }

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length === 0 ? NaN : s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const quartile = (xs: readonly number[], q: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!

// One session's reading of an entry: the medians over its rounds of candidate/base and control/base.
export type Reading = { candidate: number; control: number }
// A session's band: how far from base the candidate must sit to count as changed there, the larger of how far the
// control, base's own code, sat and the row's floor.
const band = (s: Reading, floor: number): number => Math.max(Math.abs(s.control - 1), floor)

export type Verdict = 'slower' | 'faster' | 'within noise'
// "slower" or "faster" only when candidate/base is outside the session's band in every session.
export function verdict(sessions: readonly Reading[], floor: number): Verdict {
  let slower = true
  let faster = true
  for (const s of sessions) {
    if (!(s.candidate > 1 + band(s, floor))) slower = false
    if (!(s.candidate < 1 - band(s, floor))) faster = false
  }
  return sessions.length > 0 && slower ? 'slower' : sessions.length > 0 && faster ? 'faster' : 'within noise'
}

const cost = (round: readonly Sample[], label: string): number => {
  const s = round.find(x => x.label === label)!
  return s.ms / s.units
}
// Paired ratios: a label's cost over base's in the same round, a ratio a round.
const ratios = (rounds: readonly Sample[][], label: string): number[] => rounds.map(round => cost(round, label) / cost(round, 'base'))
const reading = (rounds: readonly Sample[][]): Reading => ({ candidate: median(ratios(rounds, 'candidate')), control: median(ratios(rounds, 'control')) })

// One browser's entries, a table row each: the operation of a document's family, with its rounds by session in order.
type Entry = { row: string; doc: string; perCall: boolean; sessions: Sample[][][] }
function entriesOf(results: readonly SessionResults[]): Map<string, Entry> {
  const bySession = new Map<string, { entry: Entry; rounds: Map<number, Sample[][]> }>()
  for (const r of results) {
    for (const d of r.docs) {
      const result = r.results[d.id]
      if (result === undefined || 'compileMs' in result) continue
      for (let o = 0; o < result.ops.length; o++) {
        const name = `${d.row} | ${d.family} ${result.ops[o]!.op}${d.row === 'resize' ? (o === 0 ? ' at widths seen before' : ' at new widths') : ''}`
        const e = bySession.get(name) ?? { entry: { row: d.row, doc: d.id, perCall: d.family === 'labels', sessions: [] }, rounds: new Map<number, Sample[][]>() }
        bySession.set(name, e)
        e.rounds.set(r.session, [...(e.rounds.get(r.session) ?? []), ...result.ops[o]!.rounds])
      }
    }
  }
  const out = new Map<string, Entry>()
  for (const [name, e] of bySession) out.set(name, { ...e.entry, sessions: [...e.rounds].sort((a, b) => a[0] - b[0]).map(([, rounds]) => rounds) })
  return out
}

// The documents of one browser's rows that read slower or faster. After two sessions bench() times them in a third,
// and a row keeps its verdict only if that one agrees, which is the verdict three whole sessions give: a row two
// sessions don't call, a third can't.
export function unconfirmed(results: readonly SessionResults[], floors: Record<string, number>): string[] {
  const docs = new Set<string>()
  for (const e of entriesOf(results).values()) if (verdict(e.sessions.map(reading), floors[e.row] ?? 0) !== 'within noise') docs.add(e.doc)
  return [...docs]
}

type FreshTimes = { compile: number[]; run: number[]; first: number[]; second: number[] }

const pct = (x: number): string => `${x >= 1 ? '+' : ''}${((x - 1) * 100).toFixed(1)}%`

// An entry's readings by session and its verdict as the table words it. A row without a verdict prints its widest
// band, the smallest change these sessions could have called: where a copy of base kept another speed for a document,
// that is the distance between two copies, not the row's floor. A verdict of two sessions waits for the third the
// floors are fitted to.
function judged(browser: string, name: string, e: Entry, floors: Record<string, number>): { per: Reading[]; verdict: Verdict; words: string } {
  const per = e.sessions.map(reading)
  const floor = floors[e.row] ?? 0
  const v = verdict(per, floor)
  const note = v === 'within noise' ? ` (±${(100 * Math.max(...per.map(s => band(s, floor)))).toFixed(1)}%)`
    : `${per.length === 2 ? ' (unconfirmed)' : ''}${MOVES_WITH_BUNDLE[browser]?.includes(name) === true ? ' (moves with the bundle)' : ''}`
  return { per, verdict: v, words: `${v}${note}${per.length === 1 ? ' (hypothesis: one session)' : ''}${floors[e.row] === undefined ? ' (uncalibrated)' : ''}` }
}

// A foreground page stops when it is hidden (page.ts); a background one runs on, and a browser may slow it there.
function hiddenDocuments(results: readonly SessionResults[]): number {
  let hidden = 0
  for (const r of results) {
    for (const d of r.docs) {
      const result = r.results[d.id]
      if (result !== undefined && (!result.start.visible || !result.end.visible)) hidden++
    }
  }
  return hidden
}

// The last lines of a run, for a pull request to quote in place of the tables: one line with the builds, how they were
// timed (`form`) and how many entries read each way, then each entry that read slower or faster with its readings by
// session and the control's, or a line that says none did. Documents that ran hidden are counted here too, since a
// reader of these lines alone has to know to time again.
export function summary(all: readonly SessionResults[], o: { builds: string; form: string; floors: Record<string, number> }): string {
  const called: string[] = []
  let entries = 0
  let slower = 0
  let hidden = 0
  for (const browser of new Set(all.map(r => r.browser))) {
    const results = all.filter(r => r.browser === browser)
    hidden += hiddenDocuments(results)
    for (const [name, e] of entriesOf(results)) {
      const j = judged(browser, name, e, o.floors)
      entries++
      if (j.verdict === 'within noise') continue
      if (j.verdict === 'slower') slower++
      called.push(`- ${browser} | ${name}: ${j.words}, ${j.per.map(p => pct(p.candidate)).join(' ')} (control ${j.per.map(p => pct(p.control)).join(' ')})`)
    }
  }
  const counts = `${entries} entries: ${slower} slower, ${called.length - slower} faster, ${entries - called.length} within noise`
  return [`${o.builds}; ${o.form}; ${counts}${hidden > 0 ? `; ${hidden} documents ran hidden, so time again` : ''}`, ...(called.length > 0 ? called : ['- no entry read slower or faster'])].join('\n')
}

export function report(all: readonly SessionResults[], o: { builds: string; floors: Record<string, number>; sizes: Record<string, { bytes: number; gzipped: number }> }): string {
  const out: string[] = ['', o.builds]
  for (const browser of new Set(all.map(r => r.browser))) {
    const results = all.filter(r => r.browser === browser)
    out.push(`\n## ${browser}`, '| row | family / operation | base | candidate | candidate/base [quartiles] per session | control/base per session | verdict |', '|---|---|---:|---:|---|---|---|')
    const fresh = new Map<string, Map<string, FreshTimes>>()
    const steps: number[] = []
    const dprs = new Set<number>()
    const hidden = hiddenDocuments(results)
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
    const costliest = new Map<string, { name: string; cost: number }>()
    for (const [name, e] of entriesOf(results)) {
      const unit = e.perCall ? 'µs/call' : 'µs/1k'
      const rounds = e.sessions.flat()
      const typical = (label: string): number => (e.perCall ? 1000 : 1_000_000) * median(rounds.map(round => cost(round, label)))
      const { per, words } = judged(browser, name, e, o.floors)
      const cand = ratios(rounds, 'candidate')
      const base = typical('base')
      if (base > (costliest.get(e.row)?.cost ?? -1)) costliest.set(e.row, { name, cost: base })
      out.push(`| ${name} | ${base.toFixed(1)} ${unit} | ${typical('candidate').toFixed(1)} | ${pct(median(cand))} [${pct(quartile(cand, 0.25))}, ${pct(quartile(cand, 0.75))}] ${per.map(p => pct(p.candidate)).join(' ')} | ${per.map(p => pct(p.control)).join(' ')} | ${words} |`)
    }
    out.push('', `timer step ${Math.min(...steps).toFixed(3)}-${Math.max(...steps).toFixed(3)} ms; device pixel ratio ${[...dprs].join(', ')}${dprs.size > 1 ? ' (it changed: the sessions aren\'t comparable)' : ''}`)
    out.push(`costliest per row (base): ${[...costliest].map(([row, c]) => `${row}: ${c.name.split(' | ')[1]} ${c.cost.toFixed(1)}`).join('; ')}`)
    if (hidden > 0) out.push(`${hidden} documents ran while their page was hidden: a window covered whole; time again with it uncovered`)
    if (fresh.size > 0) {
      out.push('', '| fresh page | library | compile ms | run ms | first batch µs/unit | second batch µs/unit |', '|---|---|---:|---:|---:|---:|')
      for (const [family, byLabel] of fresh) for (const [label, e] of byLabel) out.push(`| ${family} | ${label} | ${median(e.compile).toFixed(2)} | ${median(e.run).toFixed(2)} | ${median(e.first).toFixed(2)} | ${median(e.second).toFixed(2)} |`)
    }
  }
  out.push('', `bundles: ${Object.entries(o.sizes).map(([label, s]) => `${label} ${s.bytes} B minified, ${s.gzipped} B gzipped`).join('; ')}`)
  return out.join('\n')
}
