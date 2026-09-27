import '../harness/watchdog.ts'
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Code and data cite a doc's section as `<DOC>.md, <Section>` when a reason is longer than a comment. Each citation has
// to name a heading of that doc, so a heading renamed or a doc removed fails here instead of leaving readers searching.
// A heading's text after its colon counts too (`Part 3: Decisions Log`, `Firefox: the late family names`). RESEARCH.md
// is long enough that citing it without a section says nothing.
const ROOT = join(import.meta.dir, '..')
const SOURCES = new Bun.Glob('{src,harness,scripts,pages}/**/*.{ts,js,html,json,ndjson,txt}')
const CITATION = /(?<![\w/.-])((?:[a-z]+\/)*[A-Z_]+\.md),[ \t]+([^,.;:()\n]+)/g

function headings(doc: string): Set<string> | null {
  if (!existsSync(join(ROOT, doc))) return null
  const names = new Set<string>()
  for (const [, name] of readFileSync(join(ROOT, doc), 'utf8').matchAll(/^#{1,6} (.+?)[ \t]*$/gm)) {
    names.add(name!)
    names.add(name!.slice(name!.indexOf(': ') + 2))
  }
  return names
}

test('every section a doc citation in code names is a heading of that doc: a renamed heading would strand its citations', () => {
  const docs = new Map<string, Set<string> | null>()
  const wrong: string[] = []
  for (const path of SOURCES.scanSync({ cwd: ROOT })) {
    // A comment's lines read as one, since a citation can wrap.
    const text = readFileSync(join(ROOT, path), 'utf8').replace(/\n[ \t]*\/\/[ \t]*/g, ' ')
    for (const [, doc, section] of text.matchAll(CITATION)) {
      if (!docs.has(doc!)) docs.set(doc!, headings(doc!))
      if (docs.get(doc!)?.has(section!.trim()) !== true) wrong.push(`${path}: ${doc}, ${section!.trim()}`)
    }
    if (/\(RESEARCH\.md\)/.test(text)) wrong.push(`${path}: RESEARCH.md without a section`)
  }
  expect(wrong).toEqual([])
})
