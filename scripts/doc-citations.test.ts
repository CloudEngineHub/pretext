import '../harness/watchdog.ts'
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'

// Code, data and docs cite a doc's section as `<DOC>.md, <Section>[, <Subsection>]` when a reason is longer than a
// comment. Each citation has to name headings of that doc, and a doc named with no section has to be in the repository,
// so a heading renamed or a doc removed fails here instead of leaving readers searching. A heading's text on either
// side of its colon counts too (`Part 3: Decisions Log`, `Firefox: the late family names`), and so does it without a
// closing parenthesis (`Firefox (Gecko)` as `Firefox`). After the first section, a part that starts in lower case is
// prose and ends the citation. RESEARCH.md is long enough that citing it without a section says nothing. The rebuild's
// docs live on another branch, are cited under `rebuild/` and aren't checked. A date after `Decisions Log` has to be
// the date of an entry there.
const ROOT = join(import.meta.dir, '..')
const SOURCES = new Bun.Glob('{src,harness,scripts,pages}/**/*.{ts,js,html,json,ndjson,txt}')
const DOCS = ['*.md', 'harness/**/*.md', 'pages/**/*.md', 'corpora/**/*.md'].map(pattern => new Bun.Glob(pattern))
const CITATION = /(?<![\w/.-])((?:[a-z]+\/)*[A-Z_]+\.md)`?,[ \t]+([^;()\n]+)/g
const DOC = /(?<![\w/.-])((?:[a-z]+\/)*[A-Z_]+\.md)(?![\w-])/g
const LOG_DATES = /Decisions Log,\s+(\d{4}-\d{2}-\d{2}(?:(?:,| and)\s+\d{4}-\d{2}-\d{2})*)/g
const ANCHOR = /\]\(((?:\.\.?\/)*(?:[a-z]+\/)*[A-Z_]+\.md)#([\w-]+)\)/g

function headings(doc: string): Set<string> | null {
  if (!existsSync(join(ROOT, doc))) return null
  const names = new Set<string>()
  for (const [, name] of readFileSync(join(ROOT, doc), 'utf8').matchAll(/^#{1,6} (.+?)[ \t]*$/gm)) {
    names.add(name!)
    const colon = name!.indexOf(': ')
    if (colon >= 0) {
      names.add(name!.slice(0, colon))
      names.add(name!.slice(colon + 2))
    }
    names.add(name!.replace(/ \([^)]*\)$/, ''))
  }
  return names
}

function slugs(names: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const name of names) out.add(name.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-'))
  return out
}

// Whether a citation's section names no heading. Its parts, split at commas, have to name headings, each one that starts
// in upper case; one that starts otherwise, such as a Decisions Log entry's date, is prose and ends the citation. A heading
// can hold a comma itself (`Caching, State And API Designs`), so the longest run of parts that names one wins.
function namesNoHeading(section: string, names: Set<string>): boolean {
  const end = section.search(/\.(?=\s|$|\*|`)/)
  const parts = (end < 0 ? section : section.slice(0, end)).replace(/"/g, '').trim().split(/,\s+/)
  let i = 0
  while (i < parts.length) {
    let next = -1
    for (let k = parts.length; k > i && next < 0; k--) {
      const name = parts.slice(i, k).join(', ')
      const colon = name.indexOf(': ')
      if (names.has(name) || (colon >= 0 && names.has(name.slice(0, colon)))) next = k
    }
    if (next < 0) return /^\p{Lu}/u.test(parts[i]!)
    i = next
  }
  return false
}

test('every doc a citation names is in the repository, every section it names is a heading of that doc, and a Decisions Log date is an entry\'s: a removed doc, a renamed heading or a wrong date would strand its citations', () => {
  const docs = new Map<string, Set<string> | null>()
  const headingsOf = (doc: string): Set<string> | null => {
    if (!docs.has(doc)) docs.set(doc, headings(doc))
    return docs.get(doc)!
  }
  const research = readFileSync(join(ROOT, 'RESEARCH.md'), 'utf8')
  const logDates = new Set<string>()
  for (const [, date] of research.slice(research.indexOf('\n## Part 3: Decisions Log')).matchAll(/^- \*\*(\d{4}-\d{2}-\d{2})/gm)) logDates.add(date!)
  const wrong: string[] = []
  const paths = [...SOURCES.scanSync({ cwd: ROOT })]
  for (let d = 0; d < DOCS.length; d++) paths.push(...DOCS[d]!.scanSync({ cwd: ROOT }))
  for (let p = 0; p < paths.length; p++) {
    const path = paths[p]!
    const isDoc = path.endsWith('.md')
    let text = readFileSync(join(ROOT, path), 'utf8')
    if (isDoc) {
      for (const [, link, anchor] of text.matchAll(ANCHOR)) {
        const doc = relative(ROOT, normalize(join(ROOT, dirname(path), link!)))
        const names = headingsOf(doc)
        if (names === null || !slugs(names).has(anchor!)) wrong.push(`${path}: ${link}#${anchor}`)
      }
    }
    // A comment's or a paragraph's lines read as one, since a citation can wrap. In a doc, a link reads as its text, and
    // HTML comments, notes to its editors, and code blocks aren't read.
    text = isDoc
      ? text.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\n(?![ \t]*\n)[ \t]*/g, ' ')
      : text.replace(/\n[ \t]*\/\/[ \t]*/g, ' ')
    for (const [, doc, section] of text.matchAll(CITATION)) {
      if (doc!.startsWith('rebuild/')) continue
      const names = headingsOf(doc!)
      if (names === null || namesNoHeading(section!, names)) wrong.push(`${path}: ${doc}, ${section!.trim()}`)
    }
    for (const [, doc] of text.matchAll(DOC)) {
      if (!doc!.startsWith('rebuild/') && headingsOf(doc!) === null) wrong.push(`${path}: ${doc} isn't in the repository`)
    }
    for (const [, cited] of text.matchAll(LOG_DATES)) {
      for (const [date] of cited!.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
        if (!logDates.has(date)) wrong.push(`${path}: Decisions Log, ${date} is no entry's date`)
      }
    }
    if (/\(RESEARCH\.md\)/.test(text)) wrong.push(`${path}: RESEARCH.md without a section`)
  }
  expect(wrong).toEqual([])
})
