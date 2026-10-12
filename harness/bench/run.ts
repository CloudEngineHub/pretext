// bun harness bench <base> [--lib=<dir|ref>] [--browser=chrome,firefox,webkit-host] [--sessions=3] [--rows=new,seen,...]
//   [--quick] [--foreground]
// Times <base>'s src/ against --lib's (this tree's by default) in the same documents, with a second copy of base as the
// control (harness/README.md, Bench). The harness's background browsers, webkit-host for WebKit, time three sessions
// each, every session of every browser side by side. --foreground times pinned Chrome and Firefox and installed Safari
// one at a time in focused windows, as a release's bench does: two sessions there, and then each browser times the
// documents of the rows that read slower or faster in a third. --quick times three rounds a document and no fresh
// page, for iterating (QUICK_ROUNDS). Raw samples go to .artifacts/harness-bench/<time>/, with a run.json that names
// the builds they compare. Two builds whose bundles are the same bytes aren't timed; `--lib=<base>` times a build
// against itself.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { serveJob, watched, windowTitle } from '../run.ts'
import { BROWSER, BROWSERS, type BrowserKind } from '../types.ts'
import { benchBundle, buildName, srcOf } from './lib.ts'
import type { Doc, DocResult, OpSpec } from './page.ts'
import { FLOORS, report, summary, unconfirmed, type SessionResults } from './report.ts'
import { createRng } from '../sets/build.ts'
import type { RichInlineItem } from '../../src/rich-inline.ts'
import { chatItems, familyText, itemReader, labels, MESSAGE_FAMILIES, reader, richItems, shapes, STYLE, units } from './texts.ts'

export const ROWS = ['new', 'fresh', 'rich', 'seen', 'resize', 'lines', 'worst'] as const
const LABELS = ['base', 'candidate', 'control'] as const
const WARM = 2
const ROUNDS: Record<(typeof ROWS)[number], number> = { new: 12, fresh: 9, rich: 12, seen: 16, resize: 16, lines: 12, worst: 12 }
const TARGET_MS = 50
// The quick form: every row with a verdict at three rounds a document, in three sessions. A reading's spread on most
// rows is between documents, where a copy of a library keeps one speed, not between a document's rounds, so three
// rounds say much of what twelve or sixteen do, in a third of the time (harness/bench/README.md, Protocol, has what
// they miss).
// The `new` row keeps its rounds: they cost half a second, and its spread is between batches of text.
const QUICK_ROUNDS = 3
const SEEN_UNITS: Record<(typeof MESSAGE_FAMILIES)[number], number> = { latin: 40_000, cjk: 15_000, arabic: 40_000, thai: 30_000, mixed: 40_000 }
const FRESH_UNITS: Record<(typeof MESSAGE_FAMILIES)[number], number> = { latin: 1000, cjk: 200, arabic: 1000, thai: 650, mixed: 1000 }
const RICH_UNITS = 1000
// A new batch of the chat documents holds four times the stress document's, whose size the length of the Latin text
// caps (The Great Gatsby's opening, texts.ts). A round compares three batches, one a library, and 1,000 units of the
// demo's paragraphs cost 180 to 1,900 µs per 1,000 units in Chrome by what they held, where batches of prose differ
// less: main read 15-49% slower than itself in three sessions (RESEARCH.md, Evaluation Traps, Timing).
const CHAT_UNITS = 4000
const NEW_BATCHES = LABELS.length * (WARM + ROUNDS.new)
const FRESH_ROUNDS = WARM + ROUNDS.fresh

// The documents of one session in one browser, in this order, so the rows that want new text meet text no document
// before them laid out: new, fresh and rich read each family forward; seen, resize and lines take its first units.
export type Planned = Omit<Doc, 'libraries'> & { lang: string; row: string; family: string; library?: string }
export function documents(rows: readonly string[], seed: string, focus: boolean, quick = false): Planned[] {
  const out: Planned[] = []
  const doc = (row: (typeof ROWS)[number], family: string, lang: string, font: string, options: object, ops: OpSpec[], fresh?: { label: string; round: number; batches: string[][] }): void => {
    const id = `${row} ${family}${fresh === undefined ? '' : ` ${fresh.round} ${fresh.label}`}`
    out.push({
      id, row, family, lang, seed: `${seed}/${id}`, font, options, focus, warm: WARM, rounds: quick && row !== 'new' ? QUICK_ROUNDS : ROUNDS[row], targetMs: TARGET_MS, ops,
      ...(fresh === undefined ? {} : { library: fresh.label, fresh: { batches: fresh.batches, units: fresh.batches.map(units) } }),
    })
  }
  const rng = createRng(seed)
  const readers = new Map(MESSAGE_FAMILIES.map(family => [family, reader(family)]))
  // The fresh pages have no verdict and are most of a session's documents (165 of 196), so a quick session has none.
  const want = (row: string): boolean => rows.includes(row) && !(quick && row === 'fresh')
  for (const family of MESSAGE_FAMILIES) {
    const size = newBatchSize(family)
    const batches = Array.from({ length: NEW_BATCHES }, () => readers.get(family)!.batch(size)!)
    if (want('new')) doc('new', family, STYLE[family].lang, STYLE[family].font, {}, [{ op: 'new', batches, batchUnits: batches.map(units), widths: [320] }])
  }
  const all = labels()
  const per = Math.floor(all.length / NEW_BATCHES)
  if (want('new')) {
    const batches = Array.from({ length: NEW_BATCHES }, (_, b) => all.slice(b * per, (b + 1) * per))
    // Per call: a label's units are one.
    doc('new', 'labels', STYLE.labels.lang, STYLE.labels.font, {}, [{ op: 'new', batches, batchUnits: batches.map(b => b.length), widths: [320] }])
  }
  // A fresh page a library a round, the libraries of a round in a shuffled order.
  for (const family of MESSAGE_FAMILIES) {
    for (let round = -WARM; round < ROUNDS.fresh; round++) {
      const order = LABELS.map(label => ({ label, key: rng.next() })).sort((a, b) => a.key - b.key)
      for (const { label } of order) {
        const batches = [readers.get(family)!.batch(FRESH_UNITS[family])!, readers.get(family)!.batch(FRESH_UNITS[family])!]
        if (want('fresh')) doc('fresh', family, STYLE[family].lang, STYLE[family].font, {}, [], { label, round, batches })
      }
    }
  }
  if (want('rich')) {
    const latin = readers.get('latin')!
    const batches = Array.from({ length: NEW_BATCHES }, () => latin.batch(RICH_UNITS)!.map(m => richItems(m, STYLE.latin.font)))
    const kept = reader('latin').batch(20_000)!.map(m => richItems(m, STYLE.latin.font))
    const itemUnits = (lists: RichInlineItem[][]): number => lists.reduce((n, list) => n + list.reduce((m, item) => m + item.text.length, 0), 0)
    const rich = (family: string, newBatches: RichInlineItem[][][], texts: RichInlineItem[][]): void => doc('rich', family, 'en', STYLE.latin.font, {}, [
      { op: 'rich-new', batches: newBatches, batchUnits: newBatches.map(itemUnits), widths: [220] },
      ...['rich-stats', 'rich-walk', 'rich-stream'].map(op => ({ op, texts, textUnits: itemUnits(texts), handles: 'rich' as const, widths: [180, 220, 260] })),
      // The kept messages prepared again, where every item looks its font up and measures nothing.
      { op: 'rich-seen', texts, textUnits: itemUnits(texts), widths: [220] },
    ])
    // The stress items, a word or a space each; then the chat demo's messages as it prepares them, most of them one
    // item, and its styled paragraphs alone, which no document before them prepared (texts.ts, chatItems). Each chat
    // document's kept paragraphs are read before its new batches, so a batch's size doesn't decide which paragraphs
    // the line operations run on.
    rich('latin', batches, kept)
    const chat = itemReader(chatItems())
    const chatKept = chat.batch(20_000)
    rich('chat', Array.from({ length: NEW_BATCHES }, () => chat.batch(CHAT_UNITS)), chatKept)
    const styled = itemReader(chat.rest().filter(items => items.length > 1))
    const styledKept = styled.batch(20_000)
    rich('chat-styled', Array.from({ length: NEW_BATCHES }, () => styled.batch(CHAT_UNITS)), styledKept)
  }
  for (const family of MESSAGE_FAMILIES) {
    const texts = reader(family).batch(SEEN_UNITS[family])!
    const style = STYLE[family]
    if (want('seen')) doc('seen', family, style.lang, style.font, {}, [{ op: 'seen', texts, textUnits: units(texts), widths: [320] }])
    if (want('resize')) doc('resize', family, style.lang, style.font, {}, [
      { op: 'layout', texts, textUnits: units(texts), handles: 'fast', widths: [260, 380, 440] },
      { op: 'layout', texts, textUnits: units(texts), handles: 'fast', widths: [] },
    ])
  }
  if (want('lines')) {
    // Latin and CJK messages of their own too: the mixed ones hold little of any one script, so a line walk that slowed
    // on one script's handles would leave their rows within noise, as one on CJK handles would have in #366
    // (RESEARCH.md, The Walkers' Shapes).
    for (const family of ['mixed', 'latin', 'cjk'] as const) {
      const texts = reader(family).batch(20_000)!
      const ops = family === 'mixed' ? ['stats', 'walk', 'stream', 'lines'] : ['stats', 'walk', 'stream']
      doc('lines', family, STYLE[family].lang, STYLE[family].font, {}, ops.map(op => ({ op, texts, textUnits: units(texts), handles: 'segments' as const, widths: [180, 240, 320] })))
    }
  }
  if (want('worst')) {
    for (const shape of shapes()) {
      doc('worst', shape.id, shape.lang, shape.font, shape.options, shape.ops.map(op => ({
        op, texts: shape.texts, textUnits: units(shape.texts), widths: [240, 300, 360], ...(op === 'prepare' || op === 'prepare-cleared' ? {} : { handles: op === 'walk' ? 'segments' as const : 'fast' as const }),
      })))
    }
  }
  return out
}

// Each family's new batch size, found once per process: the largest multiple of 10 units, from an even share of its text
// down, whose batches leave room for the fresh documents' and, in Latin, the rich ones.
const newBatchSizes = new Map<string, number>()
function newBatchSize(family: (typeof MESSAGE_FAMILIES)[number]): number {
  let size = newBatchSizes.get(family)
  if (size !== undefined) return size
  const reads = [
    ...Array.from({ length: FRESH_ROUNDS * LABELS.length * 2 }, () => FRESH_UNITS[family]), ...(family === 'latin' ? Array.from({ length: NEW_BATCHES }, () => RICH_UNITS) : []),
  ]
  for (size = Math.floor(familyText(family).length / NEW_BATCHES / 10) * 10; ; size = Math.floor(size * 0.95 / 10) * 10) {
    const r = reader(family)
    let fits = true
    for (let i = 0; i < NEW_BATCHES + reads.length && fits; i++) fits = r.batch(i < NEW_BATCHES ? size : reads[i - NEW_BATCHES]!) !== null
    if (fits) break
    if (size <= 10) throw new Error(`${family}: its text holds no new batches`)
  }
  newBatchSizes.set(family, size)
  return size
}

function power(): { source: string; percent: number } {
  const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' })
  return { source: out.includes("'AC Power'") ? 'AC' : 'battery', percent: Number(/(\d+)%/.exec(out)?.[1] ?? 100) }
}
const load = (): string => execFileSync('sysctl', ['-n', 'vm.loadavg'], { encoding: 'utf8' }).trim()

// One session in one browser: every document, each a fresh page, each library's bundle with a comment of its own. A
// background window's title says so (windowTitle, run.ts); a foreground one keeps the title its floors were fitted with.
async function session(browser: BrowserKind, docs: Planned[], bundles: Record<string, string>, foreground: boolean): Promise<Map<string, DocResult>> {
  const id = crypto.randomUUID()
  const results = new Map<string, DocResult>()
  let n = 0
  let attempt = 0
  const script = await Bun.build({ entrypoints: [join(import.meta.dir, 'page.ts')], target: 'browser', format: 'esm' }).then(built => built.outputs[0]!.text())
  const isolated = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cache-control': 'no-store' }
  const docUrl = (i: number): string => `/doc?job=${id}&n=${i}&attempt=${attempt}`
  // Chrome's documents take up to 3.6 GB, near the 4 GB a harness job gets.
  await serveJob(browser, id, docUrl(0), { stallMs: 300_000, stalled: () => `at ${docs[n]?.id}`, foreground, boundMb: 6144 }, async (request, url, finish) => {
    if (url.searchParams.get('job') !== id && url.pathname !== '/favicon.ico') return new Response('Inactive job', { status: 409 })
    const d = docs[Number(url.searchParams.get('n'))]!
    switch (url.pathname) {
      case '/doc': return new Response(`<!doctype html><html lang="${d.lang}"><head><meta charset="utf-8"><title>${foreground ? 'pretext bench' : windowTitle('pretext bench', browser)}</title>${watched(browser) ? '<style>html{background:#111}</style>' : ''}</head><body><script type="module" src="/page.js?job=${id}&n=0"></script></body></html>`, { headers: { ...isolated, 'content-type': 'text/html; charset=utf-8' } })
      case '/page.js': return new Response(script, { headers: { ...isolated, 'content-type': 'text/javascript; charset=utf-8' } })
      case '/api/doc': {
        const names = d.library === undefined ? LABELS : [d.library]
        const libraries = names.map(label => ({ label, code: `/* ${d.id} ${label} ${id} ${attempt} */\n${bundles[label === 'control' ? 'base' : label]}` }))
        return Response.json({ ...d, libraries } satisfies Doc)
      }
      case '/api/result': {
        const body = await request.json() as { result?: DocResult; error?: string }
        if (body.error !== undefined) {
          if (!/focus/.test(body.error) || ++attempt > 4) {
            finish(new Error(`${browser}: ${d.id}: ${body.error}`))
            return Response.json({ next: null })
          }
          console.log(`${browser}: ${d.id} lost focus; again in 60 s (attempt ${attempt + 1} of 5)`)
          await Bun.sleep(60_000)
          return Response.json({ next: docUrl(n) })
        }
        results.set(d.id, body.result!)
        attempt = 0
        if (++n === docs.length) {
          finish(null)
          return Response.json({ next: null })
        }
        return Response.json({ next: docUrl(n) })
      }
      default: return new Response(null, { status: 404 })
    }
  })
  return results
}

// Every session of a run: each browser's `sessions` of every document, then, after two, the confirming one, of the
// documents whose rows read slower or faster (report.ts, unconfirmed): the floors are fitted to three sessions, so a
// verdict needs three; one session stays a hypothesis, and three or more need no other. A browser that fails a session
// sits out the rest, and the others' tables still print.
// `together` starts every session of every browser at once, each in a browser process of its own, where one at a time
// a session ends before the next starts, as a foreground window needs: one window has the focus. A bench is one busy
// thread a browser and a verdict rests on ratios inside one document, so sessions side by side share the machine's
// cores and not each other's samples, and a run takes its slowest session's time. A browser's sessions there have all
// started by the time one fails, and run on.
export async function runSessions(
  browsers: readonly BrowserKind[], sessions: number, plan: (seed: string) => Planned[],
  io: { time: (browser: BrowserKind, docs: Planned[]) => Promise<Map<string, DocResult>>; save: (entry: SessionResults) => void; log: (text: string) => void },
  together = false,
): Promise<{ all: SessionResults[]; failed: Map<BrowserKind, string> }> {
  const all: SessionResults[] = []
  const failed = new Map<BrowserKind, string>()
  const run = async (browser: BrowserKind, s: number, only: readonly string[] | null): Promise<void> => {
    const seed = crypto.randomUUID()
    const docs = plan(seed).filter(d => only === null || only.includes(d.id))
    const started = Date.now()
    let results: Map<string, DocResult>
    try {
      results = await io.time(browser, docs)
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error)
      failed.set(browser, `session ${s + 1}: ${why}`)
      io.log(`${browser} session ${s + 1} failed, so ${browser} sits out the rest: ${why}`)
      return
    }
    const entry: SessionResults = { browser, session: s, seed, docs: docs.map(d => ({ row: d.row, family: d.family, id: d.id })), results: Object.fromEntries(results) }
    io.save(entry)
    io.log(`${browser} session ${s + 1}${only === null ? '' : ', confirming the rows that read slower or faster'}: ${docs.length} documents in ${((Date.now() - started) / 1000).toFixed(0)} s, seed ${seed}`)
    all.push(entry)
  }
  const confirm = async (browser: BrowserKind): Promise<void> => {
    const again = failed.has(browser) || sessions !== 2 ? [] : unconfirmed(all.filter(r => r.browser === browser), FLOORS[together ? 'sideBySide' : 'foreground'])
    if (again.length > 0) await run(browser, sessions, again)
  }
  if (together) {
    const started: Promise<void>[] = []
    for (let b = 0; b < browsers.length; b++) for (let s = 0; s < sessions; s++) started.push(run(browsers[b]!, s, null))
    await Promise.all(started)
    await Promise.all(browsers.map(confirm))
  } else {
    for (let s = 0; s < sessions; s++) for (const browser of browsers) if (!failed.has(browser)) await run(browser, s, null)
    for (const browser of browsers) await confirm(browser)
  }
  // Sessions side by side end in any order: the tables keep the browsers' order and each browser's sessions in theirs.
  all.sort((a, b) => browsers.indexOf(a.browser as BrowserKind) - browsers.indexOf(b.browser as BrowserKind) || a.session - b.session)
  return { all, failed }
}

// What a bench's flags ask for. With none: the harness's background browsers, three sessions each, since side by side a
// third costs no time and three need no confirming one. --foreground: the browsers that take the focus, two sessions
// each and the confirming one. --quick: three sessions of three rounds a document, wherever they run. `named` is
// --browser's browsers, or null without the flag.
export type BenchOptions = { browsers: BrowserKind[]; sessions: number; rows: readonly string[]; foreground: boolean; quick: boolean }
export function benchOptions(flags: ReadonlyMap<string, string>, named: readonly BrowserKind[] | null): BenchOptions {
  const foreground = flags.has('foreground')
  const quick = flags.has('quick')
  const rows = flags.get('rows')?.split(',') ?? ROWS
  if (quick && flags.has('rows') && rows.includes('fresh')) throw new Error('--rows=fresh can\'t go with --quick: a quick session times no fresh page')
  return {
    browsers: named === null ? BROWSERS.filter(browser => BROWSER[browser][foreground ? 'foreground' : 'background']) : [...named],
    sessions: Number(flags.get('sessions') ?? (foreground && !quick ? 2 : 3)), rows, foreground, quick,
  }
}

export async function bench(baseRef: string, lib: string, { browsers, sessions, rows, foreground, quick }: BenchOptions): Promise<void> {
  const started = Date.now()
  const behind = browsers.find(browser => !BROWSER[browser].foreground)
  if (foreground && behind !== undefined) throw new Error(`${behind} has no foreground window: time its engine in a browser that has one, or leave --foreground out`)
  // Sessions side by side need a browser process each, and installed Safari is one app.
  const single = browsers.find(browser => !BROWSER[browser].background)
  if (!foreground && single !== undefined) throw new Error(`${single} has no background window of the harness's, which sessions side by side need: pass --foreground`)
  const src = { base: srcOf(baseRef), candidate: srcOf(lib) }
  const built = { base: await benchBundle(src.base), candidate: await benchBundle(src.candidate) }
  // Two builds whose bundles are the same bytes, as after a change to comments or types alone, give a browser nothing
  // to tell apart. One build named on both sides is a calibration, and is timed.
  const same = built.base.code === built.candidate.code
  if (same && src.base !== src.candidate) {
    console.log(`bench ${baseRef} against ${lib}: the two bundles are the same bytes (${built.base.bytes} B minified), so there is nothing to time. To time a build against itself, name it on both sides: bun harness bench ${baseRef} --lib=${baseRef}`)
    return
  }
  const before = power()
  if (before.source === 'battery' && before.percent < 20) throw new Error(`On battery at ${before.percent}%: the Mac throttles; plug it in to time`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = resolve(import.meta.dir, '../../.artifacts/harness-bench', stamp)
  mkdirSync(dir, { recursive: true })
  // What the samples beside it compare: a saved run names its builds and how it timed them.
  writeFileSync(join(dir, 'run.json'), JSON.stringify({ base: buildName(baseRef), candidate: buildName(lib), sameBytes: same, browsers, sessions, rows, background: !foreground, quick }))
  console.log(`bench ${baseRef} against ${lib}, ${sessions} ${quick ? 'quick ' : ''}sessions in ${browsers.join(', ')}${foreground ? ', one at a time in the foreground' : ', side by side in background windows'}; power ${before.source} ${before.percent}%, load ${load()}; samples in ${dir}`)
  const { all, failed } = await runSessions(browsers, sessions, seed => documents(rows, seed, foreground, quick), {
    time: (browser, docs) => session(browser, docs, { base: built.base.code, candidate: built.candidate.code }, foreground),
    save: entry => writeFileSync(join(dir, `${entry.browser}-${entry.session}.json`), JSON.stringify(entry)),
    log: text => console.log(text),
  }, !foreground)
  const after = power()
  const builds = `base: ${buildName(baseRef)}; candidate: ${buildName(lib)}${quick ? `; quick sessions, ${QUICK_ROUNDS} rounds a document` : ''}`
  const floors = FLOORS[foreground ? 'foreground' : 'sideBySide']
  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  console.log(report(all, { builds, floors, sizes: { base: built.base, candidate: built.candidate } }))
  console.log(`power ${after.source} ${after.percent}%, load ${load()}; ${seconds} s in all`)
  const form = `${sessions} sessions each in ${browsers.join(', ')}, ${foreground ? 'one at a time in the foreground' : 'side by side in background windows'}, ${seconds} s${failed.size > 0 ? `; ${[...failed.keys()].join(', ')} failed a session` : ''}`
  console.log(`\n${summary(all, { builds, form, floors })}`)
  if (failed.size > 0) throw new Error(`bench: ${[...failed].map(([browser, why]) => `${browser} ${why}`).join('; ')}`)
}
