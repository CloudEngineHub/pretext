// The pass rule and the numbers a run prints.
//
// A case passes when the prediction has the browser's line count and each line's first and last visible character sits
// in the predicted line of that index. The predicted lines are ranges in source order, so that checks every visible
// character (observe.ts). A right count with a wrong break is a failure of its own kind, 'breaks': main passed 4.5-8.1%
// of its census cases that way by accident.
import { recordingText } from './store.ts'
import type { Case, Failure, Prediction, Recording, Status } from './types.ts'

export type Outcome = { status: Status; line: number; detail: string }

// Whether a recording can be scored at all: a recording error, or no visible character to check, can't be.
export function observable(recording: Recording): boolean {
  if ('error' in recording) return false
  for (let i = 0; i < recording.lines.length; i++) if (recording.lines[i]!.first >= 0) return true
  return false
}

export function score(recording: Recording, prediction: Prediction): Outcome {
  if ('error' in recording) throw new Error('A recording error has no score')
  if ('unsupported' in prediction) return { status: 'error', line: -1, detail: `unsupported: ${prediction.unsupported}` }
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
  if ('error' in recording || !('lines' in prediction)) return false
  let native = 0
  let predicted = 0
  for (let i = 0; i < recording.lines.length; i++) native = Math.max(native, recording.lines[i]!.width)
  for (let i = 0; i < prediction.lines.length; i++) predicted = Math.max(predicted, prediction.lines[i]!.width)
  return Math.ceil(predicted) < native
}

// How two predictions of one case differ: 'lines' when a line holds other characters (what the pass rule judges),
// 'widths' when only line widths moved (what the report-only shrink-wrap check reads), else 'same'.
export type PredictionChange = 'same' | 'widths' | 'lines'

export function predictionChange(a: Prediction, b: Prediction): PredictionChange {
  if (!('lines' in a) || !('lines' in b)) return JSON.stringify(a) === JSON.stringify(b) ? 'same' : 'lines'
  if (a.lines.length !== b.lines.length) return 'lines'
  let change: PredictionChange = 'same'
  for (let i = 0; i < a.lines.length; i++) {
    const x = a.lines[i]!
    const y = b.lines[i]!
    if (x.start !== y.start || x.end !== y.end) return 'lines'
    if (x.width !== y.width) change = 'widths'
  }
  return change
}

// What predictions say about the library itself, whatever the browser did: the cases where another line API disagrees
// with the walk, and those whose line APIs asked Canvas anything after preparing. Both block.
export function libraryFaults(ids: readonly string[], predictions: ReadonlyMap<string, Prediction>): { disagree: string[]; measuring: string[] } {
  const out = { disagree: [] as string[], measuring: [] as string[] }
  for (let i = 0; i < ids.length; i++) {
    const prediction = predictions.get(ids[i]!)!
    if (!('lines' in prediction)) continue
    if (prediction.disagreement !== null) out.disagree.push(`${ids[i]}: ${prediction.disagreement}`)
    if (prediction.lineCalls > 0) out.measuring.push(`${ids[i]}: ${prediction.lineCalls}`)
  }
  return out
}

// A font list the README says the library doesn't take: system-ui and its aliases resolve differently for Canvas on macOS.
export const SYSTEM_UI_FONT = /^\s*(system-ui|-apple-system|BlinkMacSystemFont|ui-sans-serif)\b/

// Whether a case is outside what the library claims: a style the adapter can't express (break-all, rich-inline in
// pre-wrap) or a system-ui font list. The headline prints its share, and the share right without it.
export function outsideClaims(c: Case, prediction: Prediction): boolean {
  return 'unsupported' in prediction || SYSTEM_UI_FONT.test(c.paragraph.font.family)
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
// go silent. An accepted case that fails another way is printed, not blocked. A varying case (harness/varying) is never
// judged, only counted. Entries for cases outside `scope` (a run over some case files only) are left alone.
export type Verdict = { newFailures: string[]; fixed: string[]; changed: string[]; byReason: Map<string, string[]>; varying: { pass: number; fail: number } }
type AcceptedList = ReadonlyMap<string, { reason: string; status: Failure }>

export function judge(outcomes: ReadonlyMap<string, Outcome>, accepted: AcceptedList, varying: ReadonlyMap<string, string>, scope: ((id: string) => boolean) | null): Verdict {
  const verdict: Verdict = { newFailures: [], fixed: [], changed: [], byReason: new Map(), varying: { pass: 0, fail: 0 } }
  for (const id of varying.keys()) if (accepted.has(id)) throw new Error(`${id} is both an accepted failure and a varying prediction`)
  for (const [id, outcome] of outcomes) {
    if (varying.has(id)) {
      verdict.varying[outcome.status === 'pass' ? 'pass' : 'fail']++
      continue
    }
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

// The gate's reverse-order predictions against the forward ones: the cases whose breaks move, which block unless listed
// as varying, and those whose widths alone move, which only the report-only shrink-wrap check reads.
export function reverseOrder(ids: readonly string[], forward: ReadonlyMap<string, Prediction>, reverse: ReadonlyMap<string, Prediction>, varying: ReadonlyMap<string, string>): { moved: string[]; listed: string[]; widths: string[] } {
  const out = { moved: [] as string[], listed: [] as string[], widths: [] as string[] }
  for (let i = 0; i < ids.length; i++) {
    const change = predictionChange(reverse.get(ids[i]!)!, forward.get(ids[i]!)!)
    if (change === 'lines') out[varying.has(ids[i]!) ? 'listed' : 'moved'].push(ids[i]!)
    else if (change === 'widths') out.widths.push(ids[i]!)
  }
  return out
}

// The gate's fresh re-recording of a sample against the stored recordings. `attempts[0]` records every sampled case;
// the later attempts record again, each case alone in its own document, the cases the first laid out differently. A
// case laid out differently in every attempt is stale: the stored recording no longer describes the browser, which
// blocks. One laid out as stored in some attempt depends on the cases or documents before it: page history the
// recordings missed, which record would list.
export function freshRecordings(ids: readonly string[], stored: ReadonlyMap<string, Recording>, attempts: ReadonlyArray<ReadonlyMap<string, Recording>>): { stale: string[]; history: string[] } {
  const out = { stale: [] as string[], history: [] as string[] }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const want = recordingText(stored.get(id)!)
    if (recordingText(attempts[0]!.get(id)!) === want) continue
    let always = true
    for (let k = 1; k < attempts.length; k++) if (recordingText(attempts[k]!.get(id)!) === want) always = false
    out[always ? 'stale' : 'history'].push(id)
  }
  return out
}

// Why a new failure fails, from the gate's recording of it alone and its two predictions alone (each in a fresh
// document of its own job). A lone prediction can't tell the library's caches from the browser's Canvas state, so a
// prediction that moves is never called a library defect.
export type Attribution = 'page history' | 'varies between runs' | 'depends on what was predicted before' | 'true loss'

export function attribute(stored: Recording, recordedAlone: Recording, inCheck: Prediction, alone: readonly [Prediction, Prediction]): Attribution {
  if (recordingText(recordedAlone) !== recordingText(stored)) return 'page history'
  if (predictionChange(alone[0], alone[1]) === 'lines') return 'varies between runs'
  if (predictionChange(alone[0], inCheck) === 'lines') return 'depends on what was predicted before'
  return 'true loss'
}

// The list after `check --accept=<reason>`: the new failures under that reason, fixed entries gone, statuses current.
export function accept(outcomes: ReadonlyMap<string, Outcome>, accepted: AcceptedList, reason: string, scope: ((id: string) => boolean) | null): Map<string, { reason: string; status: Failure }> {
  const next = new Map<string, { reason: string; status: Failure }>()
  for (const [id, entry] of accepted) if (!outcomes.has(id) && scope !== null && !scope(id)) next.set(id, entry)
  for (const [id, outcome] of outcomes) {
    if (outcome.status === 'pass') continue
    next.set(id, { reason: accepted.get(id)?.reason ?? reason, status: outcome.status })
  }
  return next
}
