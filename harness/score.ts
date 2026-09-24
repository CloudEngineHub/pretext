// The pass rule and the numbers a run prints.
//
// A case passes when the prediction has the browser's line count and each line's first and last visible character sits
// in the predicted line of that index. The predicted lines are ranges in source order, so that checks every visible
// character (observe.ts). A right count with a wrong break is a failure of its own kind, 'breaks': main passed 4.5-8.1%
// of its census cases that way by accident.
import type { Case, Prediction, Recording } from './types.ts'

export type Status = 'pass' | 'count' | 'breaks' | 'error'
export type Outcome = { status: Status; line: number; detail: string }

// Whether a recording can be scored at all: a recording error, or no visible character to check, can't be.
export function observable(recording: Recording): boolean {
  if ('error' in recording) return false
  for (let i = 0; i < recording.lines.length; i++) if (recording.lines[i]!.first >= 0) return true
  return false
}

export function score(recording: Recording, prediction: Prediction): Outcome {
  if ('error' in recording) throw new Error('A recording error has no score')
  if ('error' in prediction) return { status: 'error', line: -1, detail: prediction.error }
  const native = recording.lines
  const predicted = prediction.lines
  if (native.length !== predicted.length) {
    let line = 0
    while (line < native.length && line < predicted.length && (native[line]!.first < 0 || (inLine(native[line]!.first, predicted[line]!) && inLine(native[line]!.last, predicted[line]!)))) line++
    return { status: 'count', line, detail: `native ${native.length} lines, predicted ${predicted.length}` }
  }
  for (let line = 0; line < native.length; line++) {
    const { first, last } = native[line]!
    if (first < 0) continue
    const range = predicted[line]!
    if (!inLine(first, range)) return { status: 'breaks', line, detail: `native line ${line} starts at ${first}, predicted line holds ${range.start}-${range.end}` }
    if (!inLine(last, range)) return { status: 'breaks', line, detail: `native line ${line} ends at ${last}, predicted line holds ${range.start}-${range.end}` }
  }
  return { status: 'pass', line: -1, detail: '' }
}

function inLine(offset: number, range: { start: number; end: number }): boolean {
  return offset >= range.start && offset < range.end
}

// Report only, for now: a chat bubble sized to the predicted widest line, rounded up (pages/demos/bubbles-shared.ts),
// must be at least as wide as the browser's widest line, or the browser wraps the text again.
export function shrinkWrapShort(recording: Recording, prediction: Prediction): boolean {
  if ('error' in recording || 'error' in prediction) return false
  let native = 0
  let predicted = 0
  for (let i = 0; i < recording.lines.length; i++) native = Math.max(native, recording.lines[i]!.width)
  for (let i = 0; i < prediction.lines.length; i++) predicted = Math.max(predicted, prediction.lines[i]!.width)
  return Math.ceil(predicted) < native
}

// Whether two predictions are the same, line for line.
export function samePrediction(a: Prediction, b: Prediction): boolean {
  if ('error' in a || 'error' in b) return 'error' in a && 'error' in b && a.error === b.error
  if (a.lines.length !== b.lines.length) return false
  for (let i = 0; i < a.lines.length; i++) {
    const x = a.lines[i]!
    const y = b.lines[i]!
    if (x.start !== y.start || x.end !== y.end || x.width !== y.width) return false
  }
  return true
}

export function widthBand(c: Case): string {
  const width = c.paragraph.width
  return width < 24 ? '<24 px' : width < 80 ? '24-80 px' : '>=80 px'
}

// The headline: the weighted share of real-usage draws that pass, with a 95% interval from resampling the draws within
// each group (a seeded generator, so the same results print the same interval).
export function headline(draws: ReadonlyArray<{ group: string; weight: number; pass: boolean }>): { share: number; low: number; high: number } | null {
  if (draws.length === 0) return null
  const groups = new Map<string, Array<{ weight: number; pass: boolean }>>()
  for (let i = 0; i < draws.length; i++) {
    const draw = draws[i]!
    let group = groups.get(draw.group)
    if (group === undefined) groups.set(draw.group, group = [])
    group.push(draw)
  }
  const lists = [...groups.values()]
  const share = (pick: (list: Array<{ weight: number; pass: boolean }>, k: number) => { weight: number; pass: boolean }): number => {
    let right = 0
    let total = 0
    for (let g = 0; g < lists.length; g++) {
      const list = lists[g]!
      for (let k = 0; k < list.length; k++) {
        const draw = pick(list, k)
        total += draw.weight
        if (draw.pass) right += draw.weight
      }
    }
    return right / total
  }
  let seed = 0x9e3779b9
  const random = (): number => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const shares: number[] = []
  for (let r = 0; r < 1000; r++) shares.push(share(list => list[Math.floor(random() * list.length)]!))
  shares.sort((a, b) => a - b)
  return { share: share((list, k) => list[k]!), low: shares[24]!, high: shares[975]! }
}

// What the accepted-failures list makes of the pinned cases' outcomes. A failure off the list is new and blocks. An
// entry whose case passes or is no longer pinned is fixed and blocks until it leaves the list, so accepted losses never
// go silent. An accepted case that fails another way is printed, not blocked. Entries for cases outside `scope` (a run
// over some case files only) are left alone.
export type Verdict = { newFailures: string[]; fixed: string[]; changed: string[]; byReason: Map<string, string[]> }
type AcceptedList = ReadonlyMap<string, { reason: string; status: string }>

export function judge(outcomes: ReadonlyMap<string, Outcome>, accepted: AcceptedList, scope: ((id: string) => boolean) | null): Verdict {
  const verdict: Verdict = { newFailures: [], fixed: [], changed: [], byReason: new Map() }
  for (const [id, outcome] of outcomes) {
    const entry = accepted.get(id)
    if (outcome.status === 'pass') {
      if (entry !== undefined) verdict.fixed.push(id)
      continue
    }
    if (entry === undefined) {
      verdict.newFailures.push(id)
      continue
    }
    if (entry.status !== outcome.status) verdict.changed.push(`${id}: ${entry.status} -> ${outcome.status}`)
    let list = verdict.byReason.get(entry.reason)
    if (list === undefined) verdict.byReason.set(entry.reason, list = [])
    list.push(id)
  }
  for (const id of accepted.keys()) if (!outcomes.has(id) && (scope === null || scope(id))) verdict.fixed.push(id)
  return verdict
}

// The list after `check --accept=<reason>`: the new failures under that reason, fixed entries gone, statuses current.
export function accept(outcomes: ReadonlyMap<string, Outcome>, accepted: AcceptedList, reason: string, scope: ((id: string) => boolean) | null): Map<string, { reason: string; status: string }> {
  const next = new Map<string, { reason: string; status: string }>()
  for (const [id, entry] of accepted) if (!outcomes.has(id) && scope !== null && !scope(id)) next.set(id, entry)
  for (const [id, outcome] of outcomes) {
    if (outcome.status === 'pass') continue
    next.set(id, { reason: accepted.get(id)?.reason ?? reason, status: outcome.status })
  }
  return next
}
