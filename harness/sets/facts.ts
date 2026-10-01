// main's engine facts as browser cases. src/layout.test.ts pins 36 rules main learned about the engines (research/TESTS.md
// §1c in the rebuild), each against a fake Canvas and one engine profile, and 33 of them use texts no browser case holds.
// data/engine-facts.json keeps the texts of the 28 whose tests lay out plain text, taken from the tests once, with the
// white-space and word-break modes and page languages each test names. The ones that lay out rich items are in rich.ts,
// and three read only the user agent. A fact added since goes at the end, under its test's line as of the commit that
// added it, which harness/README.md names (Adding a case), and names the paragraph directions it runs in where a
// browser's lines turn on them (left-to-right otherwise). Here each text runs in 16px Arial, and widths.ts finds where
// each browser's lines change.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { font, paragraph } from './build.ts'
import type { Template } from './widths.ts'

type Fact = { test: string; texts: string[]; modes: Array<'normal' | 'pre-wrap' | 'keep-all'>; pageLangs: string[]; directions?: Array<'ltr' | 'rtl'> }

export function factTemplates(): Template[] {
  const facts = JSON.parse(readFileSync(join(import.meta.dir, 'data/engine-facts.json'), 'utf8')) as Fact[]
  const out: Template[] = []
  for (let f = 0; f < facts.length; f++) {
    const fact = facts[f]!
    const line = /:(\d+) /.exec(fact.test)![1]!
    const directions = fact.directions ?? ['ltr']
    for (let d = 0; d < directions.length; d++) for (let t = 0; t < fact.texts.length; t++) for (let m = 0; m < fact.modes.length; m++) for (let l = 0; l < fact.pageLangs.length; l++) {
      const mode = fact.modes[m]!
      const lang = fact.pageLangs[l]!
      out.push({
        family: `facts/layout.test.ts:${line}`, origin: fact.test, pageLang: lang, widths: [], grid: true,
        paragraph: paragraph({ font: font('Arial', 16), lang, whiteSpace: mode === 'pre-wrap' ? 'pre-wrap' : 'normal', wordBreak: mode === 'keep-all' ? 'keep-all' : 'normal', direction: directions[d]! }, [fact.texts[t]!]),
      })
    }
  }
  return out
}
