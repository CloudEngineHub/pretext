// Generates src/generated/engine-break-data.ts, the tables behind Chrome's and Safari's
// break scans in src/line-breaks.ts and Firefox's in src/gecko-line-breaks.ts, from the
// engine files in scripts/engine-data/, and checks each table against its source. Refresh
// those files by hand when a browser's tables change, then run this. `--check` compares
// instead of writing.
//
// chrome-153/, from Chrome 153.0.8010.37:
// - line_normal.brk: the brkitr/line_normal.brk entry of Chrome's icudtl.dat (ICU 78.2).
// - line_normal_cj.brk: the brkitr/line_normal_cj.brk entry of Chrome 153.0.8010.48's
//   icudtl.dat (sha256 6202891a...), which Chrome opens for zh content.
// - break_iterator_data_inline_header.h: the header Chromium's build generates for
//   kFastLineBreakTable (character_property_data_generator.cc:422-551).
// safari-27.0/, from Safari 27.0 on macOS 27:
// - line.brk, line_normal.brk, line_cj.brk: brkitr entries of /usr/share/icu/icudt78l.dat,
//   the data libicucore 78.1 reads, the same bytes as on macOS 26.5.2.
// - BreakablePositions.cpp: WebKit's checked-in pair table (safari-7625.1.29.11-branch,
//   unchanged since Safari 26.5.2's safari-7624.2.5.11-branch).
// - locales.json: for every locale uloc_getAvailable lists, the line table ubrk_open(UBRK_LINE)
//   opens (its ubrk_getBinaryRules bytes matched against the three tables) and the four
//   quotation delimiters ulocdata_getDelimiter reports under uloc_getName's name. Dumped on
//   macOS 26.5.2 by a small C program against libicucore; macOS 27 lists a few locales more
//   or fewer, all with root's table and delimiters, which generate the same module.
// - quotation.json: the code points libicucore's u_getIntPropertyValue gives Line_Break=QU.
// firefox-156/, from Firefox 155.0.1's source tree. Firefox 156.0's XUL holds the same line
// data and icu_properties Bidi_Class data byte for byte:
// - segmenter_break_line_v1.rs.data: intl/icu_segmenter_data/data/, Firefox's baked ICU4X
//   line data (icuexport release-78.1, CLDR 48), databake output for RuleBreakData
//   (icu_segmenter 2.1.2 src/provider/mod.rs:151-180).
// - properties.json: icu_properties 2.1.2's compiled data (Unicode 17), the crate Firefox
//   vendors, as [first, last, value] ranges over every code point: Bidi_Class and
//   East_Asian_Width in ICU4C numbering (CodePointMapData::get32(cp).to_icu4c_value()),
//   General_Category Ps, and every Bidi_Mirroring_Glyph pair. Dumped by a small Rust
//   program that depends on that crate alone.
// - property_enum_script_v1.rs.data and property_name_short_script_v1.rs.data:
//   third_party/rust/icu_properties_data/data/, icu_properties 2.1.2's baked Script values and
//   their short names, the Unicode 17 data ICU4C 78.3's uscript_getScript answers from.
// - bidi_pairs_table.rs: servo/unicode-bidi ca612daf's bracket table,
//   src/char_data/tables.rs:519-535.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { getBreakLanguage, getSmallTrieValue, parseBreakRules, unpackTable, type BreakRules } from '../src/line-breaks.ts'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const dataDir = join(scriptsDir, 'engine-data')
const outputPath = join(scriptsDir, '..', 'src', 'generated', 'engine-break-data.ts')
const readData = (path: string) => new Uint8Array(readFileSync(join(dataDir, path)))
const readText = (path: string) => readFileSync(join(dataDir, path), 'utf8')
const gzipSize = (text: string) => gzipSync(Buffer.from(text), { level: 9 }).length
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

// unpackTable's form: greedy LZ77 over the dictionary and the table, matching at least four
// bytes among the last 64 positions with the same next four, checked to unpack exactly.
function packTable(bytes: Uint8Array, dictionary: Uint8Array | null = null): string {
  const dict = dictionary ?? new Uint8Array(0)
  const all = new Uint8Array(dict.length + bytes.length)
  all.set(dict)
  all.set(bytes, dict.length)
  const out: number[] = []
  const varint = (value: number) => {
    for (; value >= 0x80; value = Math.floor(value / 0x80)) out.push((value & 0x7f) | 0x80)
    out.push(value)
  }
  const chains = new Map<number, number[]>()
  const key = (i: number) => all[i]! | (all[i + 1]! << 8) | (all[i + 2]! << 16) | (all[i + 3]! * 0x1000000)
  const remember = (i: number) => {
    if (i + 4 > all.length) return
    const k = key(i)
    let chain = chains.get(k)
    if (chain === undefined) chains.set(k, chain = [])
    chain.push(i)
    if (chain.length > 64) chain.shift()
  }
  for (let i = 0; i < dict.length; i++) remember(i)
  varint(bytes.length)
  let literals: number[] = []
  for (let i = dict.length; i < all.length;) {
    let length = 0
    let distance = 0
    const chain = i + 4 <= all.length ? chains.get(key(i)) : undefined
    if (chain !== undefined) {
      for (let c = chain.length - 1; c >= 0; c--) {
        const j = chain[c]!
        let n = 0
        while (i + n < all.length && all[j + n] === all[i + n]) n++
        if (n > length) { length = n; distance = i - j }
      }
    }
    if (length >= 4) {
      varint(literals.length)
      out.push(...literals)
      literals = []
      varint(length - 4)
      varint(distance)
      for (let k = 0; k < length; k++) remember(i + k)
      i += length
    } else {
      literals.push(all[i]!)
      remember(i)
      i++
    }
  }
  varint(literals.length)
  out.push(...literals)
  const packed = base64(new Uint8Array(out))
  const unpacked = unpackTable(packed, dictionary)
  if (unpacked.length !== bytes.length || unpacked.some((byte, i) => byte !== bytes[i])) throw new Error('A table packs lossily')
  return packed
}

// 223 rows of 28 bytes, a bit per U+0021..U+00FF pair, as B(a, b, c, d, e, f, g, h) =
// a | b << 1 | ... | h << 7.
function parsePairTable(source: string, marker: string): Uint8Array {
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`Missing ${marker}`)
  const groups = source.slice(start).match(/B\(\s*[01]\s*,\s*[01]\s*,\s*[01]\s*,\s*[01]\s*,\s*[01]\s*,\s*[01]\s*,\s*[01]\s*,\s*[01]\s*\)/g) ?? []
  const bytes = new Uint8Array(223 * 28)
  if (groups.length < bytes.length) throw new Error(`Expected ${bytes.length} pair bytes after ${marker}, got ${groups.length}`)
  for (let i = 0; i < bytes.length; i++) {
    const bits = groups[i]!.match(/[01]/g)!
    let byte = 0
    for (let k = 0; k < 8; k++) byte |= Number(bits[k]) << k
    bytes[i] = byte
  }
  return bytes
}

// An entry cut from an ICU data package starts with a DataHeader (unicode/udata.h:116-153),
// which rbbidata.cpp:49-62 checks and skips.
function withoutDataHeader(bytes: Uint8Array): Uint8Array {
  const headerSize = bytes[0]! | (bytes[1]! << 8)
  if (bytes[2] !== 0xda || bytes[3] !== 0x27 || headerSize < 20 || bytes[8] !== 0 || bytes[9] !== 0 ||
    bytes[12] !== 0x42 || bytes[13] !== 0x72 || bytes[14] !== 0x6b || bytes[15] !== 0x20 || bytes[16] !== 6) {
    throw new Error('Expected a little-endian ASCII "Brk " entry, format version 6')
  }
  return bytes.subarray(headerSize)
}

// The RBBIDataHeader (rbbidata.h:67-94), forward state table, trie and status table,
// without the reverse table and rule source, which the iterator never reads.
function compactBreakRules(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u32 = (offset: number) => view.getUint32(offset, true)
  const align = (n: number) => (n + 3) & ~3
  const [table, tableLength, trie, trieLength, status, statusLength] = [u32(16), u32(20), u32(32), u32(36), u32(48), u32(52)]
  const newTable = 80
  const newTrie = align(newTable + tableLength)
  const newStatus = align(newTrie + trieLength)
  const total = align(newStatus + statusLength)
  const out = new Uint8Array(total)
  out.set(bytes.subarray(0, 80), 0)
  const o = new DataView(out.buffer)
  o.setUint32(8, total, true)
  o.setUint32(16, newTable, true)
  o.setUint32(24, 0, true)
  o.setUint32(28, 0, true)
  o.setUint32(32, newTrie, true)
  o.setUint32(40, 0, true)
  o.setUint32(44, 0, true)
  o.setUint32(48, newStatus, true)
  out.set(bytes.subarray(table, table + tableLength), newTable)
  out.set(bytes.subarray(trie, trie + trieLength), newTrie)
  out.set(bytes.subarray(status, status + statusLength), newStatus)
  return out
}

function sameRules(a: BreakRules, b: BreakRules): boolean {
  const same = (x: ArrayLike<number>, y: ArrayLike<number>) => {
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
    return true
  }
  return a.catCount === b.catCount && a.dictCategoriesStart === b.dictCategoriesStart && a.flags === b.flags &&
    a.rowWidth === b.rowWidth && a.lookAheadResultsSize === b.lookAheadResultsSize && a.trieDataLength === b.trieDataLength &&
    a.trieHighStart === b.trieHighStart && same(a.rows, b.rows) && same(a.statusTable, b.statusTable) &&
    same(a.trieIndex, b.trieIndex) && same(a.trieData, b.trieData)
}

// A line table cut from an ICU data package, compacted and checked to parse the same.
function readCompactBreakRules(path: string): Uint8Array {
  const bytes = withoutDataHeader(readData(path))
  const compact = compactBreakRules(bytes)
  if (!sameRules(parseBreakRules(bytes), parseBreakRules(compact))) throw new Error(`The compact ${path} parses differently`)
  return compact
}

// Pair tables.
const blinkPairs = parsePairTable(readText('chrome-153/break_iterator_data_inline_header.h'), 'kFastLineBreakTable[')
const webkitPairs = parsePairTable(readText('safari-27.0/BreakablePositions.cpp'), 'LineBreakTable::breakTable')
let differingPairs = 0
for (let i = 0; i < blinkPairs.length; i++) for (let k = 0; k < 8; k++) if (((blinkPairs[i]! ^ webkitPairs[i]!) >> k) & 1) differingPairs++

// Line tables. The five come from nearly the same rules, so each packs against the earlier table
// that packs it shortest, or alone where none does.
const lineTableSources = [
  ['chromium/line_normal', 'chrome-153/line_normal.brk'],
  ['chromium/line_normal_cj', 'chrome-153/line_normal_cj.brk'],
  ['apple/line_normal', 'safari-27.0/line_normal.brk'],
  ['apple/line', 'safari-27.0/line.brk'],
  ['apple/line_cj', 'safari-27.0/line_cj.brk'],
] as const
const lineTableBytes: Uint8Array[] = []
const lineTablesPacked: Record<string, [string | null, string]> = {}
for (let t = 0; t < lineTableSources.length; t++) {
  const bytes = readCompactBreakRules(lineTableSources[t]![1])
  lineTableBytes.push(bytes)
  let entry: [string | null, string] = [null, packTable(bytes)]
  for (let r = 0; r < t; r++) {
    const packed = packTable(bytes, lineTableBytes[r]!)
    if (packed.length < entry[1].length) entry = [lineTableSources[r]![0], packed]
  }
  lineTablesPacked[lineTableSources[t]![0]] = entry
}

// Quotation remaps per locale, setCategoryOverrides in apple-rbbi.cpp:406-487.
const quotation = new Set(JSON.parse(readText('safari-27.0/quotation.json')) as number[])
const locales = JSON.parse(readText('safari-27.0/locales.json')) as Record<string, [string, number, number, number, number]>
function getQuoteRemap(language: string, delimiters: readonly number[]): number[] {
  const remap: number[] = []
  if (language === 'da') return remap
  for (let pair = 0; pair < 2; pair++) {
    const open = delimiters[pair * 2]!
    let close = delimiters[pair * 2 + 1]!
    if (close === 0x201c) close = 0x201d
    if (close === 0x2018) close = 0
    if (open === close) continue
    if (quotation.has(open) && open !== 0x2019) remap.push(open, 0)
    if (quotation.has(close) && close !== 0x2019) remap.push(close, 1)
  }
  return remap
}
const ownRemaps = new Map<string, number[]>()
for (const [name, [table, ...delimiters]] of Object.entries(locales)) {
  const language = getBreakLanguage(name)
  const expected = language === 'ja' || language === 'ko' ? 'line_normal.brk' : language === 'zh' ? 'line_cj.brk' : 'line.brk'
  if (table !== expected) throw new Error(`libicucore opens ${table} for ${name}, where the scan opens ${expected}`)
  ownRemaps.set(name, getQuoteRemap(name.split('_')[0]!, delimiters))
}
const appleQuoteRemaps: Record<string, number[]> = { '': ownRemaps.get('')! }
const lookUpRemap = (name: string): number[] => {
  for (;;) {
    const remap = appleQuoteRemaps[name]
    if (remap !== undefined) return remap
    const cut = name.lastIndexOf('_')
    name = cut < 0 ? '' : name.slice(0, cut)
  }
}
const names = Array.from(ownRemaps.keys()).sort((x, y) => x.split('_').length - y.split('_').length || (x < y ? -1 : 1))
for (const name of names) {
  if (JSON.stringify(lookUpRemap(name)) !== JSON.stringify(ownRemaps.get(name))) appleQuoteRemaps[name] = ownRemaps.get(name)!
}
for (const [name, remap] of ownRemaps) {
  if (JSON.stringify(lookUpRemap(name)) !== JSON.stringify(remap)) throw new Error(`Remap lookup misses ${name}`)
}

// Firefox's line data: three Rust byte string literals, the trie index as u16
// little-endian, the trie data and the break states as u8, and header fields.
const geckoLineSource = readText('firefox-156/segmenter_break_line_v1.rs.data')
const rustEscapes: Record<string, number> = { '0': 0, n: 10, r: 13, t: 9, '\\': 92, '"': 34, "'": 39 }
const parseRustByteString = (literal: string): Uint8Array => {
  const bytes: number[] = []
  for (let i = 0; i < literal.length; i++) {
    if (literal[i] !== '\\') { bytes.push(literal.charCodeAt(i)); continue }
    const escape = literal[++i]!
    if (escape === 'x') { bytes.push(parseInt(literal.slice(i + 1, i + 3), 16)); i += 2 }
    else if (escape in rustEscapes) bytes.push(rustEscapes[escape]!)
    else throw new Error(`Unknown Rust escape \\${escape}`)
  }
  return new Uint8Array(bytes)
}
const geckoLineLiterals = Array.from(geckoLineSource.matchAll(/b"((?:[^"\\]|\\.)*)"/g), match => parseRustByteString(match[1]!))
const geckoLineField = (name: string): number => {
  const match = geckoLineSource.match(new RegExp(`${name} : (\\d+)u`))
  if (match === null) throw new Error(`Missing ${name} in segmenter_break_line_v1.rs.data`)
  return Number(match[1])
}
if (geckoLineLiterals.length !== 3) throw new Error(`Expected 3 byte strings in segmenter_break_line_v1.rs.data, got ${geckoLineLiterals.length}`)
const [geckoLineIndex, geckoLineData, geckoLineStates] = geckoLineLiterals as [Uint8Array, Uint8Array, Uint8Array]
const geckoLinePropertyCount = geckoLineField('property_count')
if (!/trie_type : icu :: collections :: codepointtrie :: TrieType :: Small/.test(geckoLineSource)) throw new Error('Expected a small trie')
if (!/\) \} , 0u8\) \} , break_state_table/.test(geckoLineSource)) throw new Error('Expected trie error value 0')
if (geckoLineIndex.length % 2 !== 0 || geckoLineStates.length !== geckoLinePropertyCount ** 2) throw new Error('Unexpected line data sizes')
// src/gecko-line-breaks.ts reads Line_Break values by number (icu_segmenter line.rs:18-128).
if (geckoLineField('complex_property') !== 46) throw new Error('Expected SA to be Line_Break value 46')

// Firefox's Script values: a small CodePointTrie (icu_collections 2.1.1) of ICU4C script codes,
// index and data as u16 little-endian, and each code's four-letter short name.
const geckoScriptSource = readText('firefox-156/property_enum_script_v1.rs.data')
const geckoScriptLiterals = Array.from(geckoScriptSource.matchAll(/b"((?:[^"\\]|\\.)*)"/g), match => parseRustByteString(match[1]!))
if (geckoScriptLiterals.length !== 2) throw new Error(`Expected 2 byte strings in property_enum_script_v1.rs.data, got ${geckoScriptLiterals.length}`)
if (!/trie_type\s*:\s*icu\s*::\s*collections\s*::\s*codepointtrie\s*::\s*TrieType\s*::\s*Small/.test(geckoScriptSource)) throw new Error('Expected a small script trie')
const geckoScriptHighStart = Number(geckoScriptSource.match(/high_start\s*:\s*(\d+)u32/)![1])
const [geckoScriptIndexBytes, geckoScriptDataBytes] = geckoScriptLiterals as [Uint8Array, Uint8Array]
if (geckoScriptIndexBytes.length % 2 !== 0 || geckoScriptDataBytes.length % 2 !== 0) throw new Error('Expected u16 script trie arrays')
const geckoScriptIndex = new Uint16Array(geckoScriptIndexBytes.length >> 1)
for (let i = 0; i < geckoScriptIndex.length; i++) geckoScriptIndex[i] = geckoScriptIndexBytes[2 * i]! | (geckoScriptIndexBytes[2 * i + 1]! << 8)
// Every script code fits a byte, so the data ships as u8.
const geckoScriptData = new Uint8Array(geckoScriptDataBytes.length >> 1)
for (let i = 0; i < geckoScriptData.length; i++) {
  if (geckoScriptDataBytes[2 * i + 1] !== 0) throw new Error('Expected script codes below 256')
  geckoScriptData[i] = geckoScriptDataBytes[2 * i]!
}
const geckoScriptNameLiterals = Array.from(readText('firefox-156/property_name_short_script_v1.rs.data').matchAll(/b"((?:[^"\\]|\\.)*)"/g), match => parseRustByteString(match[1]!))
if (geckoScriptNameLiterals.length !== 1 || geckoScriptNameLiterals[0]!.length % 4 !== 0) throw new Error('Expected one byte string of four-letter script names')
const geckoScriptNames = new TextDecoder().decode(geckoScriptNameLiterals[0]!)
if (!/^(?:[A-Z][a-z]{3})+$/.test(geckoScriptNames)) throw new Error('Unexpected script short names')
const scriptCode = (name: string): number => {
  const at = geckoScriptNames.indexOf(name)
  if (at < 0 || at % 4 !== 0) throw new Error(`Missing script ${name}`)
  return at / 4
}
// src/gecko-line-breaks.ts reads these codes (uscript.h).
for (const [name, code] of [['Zyyy', 0], ['Zinh', 1], ['Hang', 18], ['Hira', 20], ['Kana', 22], ['Latn', 25], ['Zzzz', 103]] as const) {
  if (scriptCode(name) !== code) throw new Error(`Expected ${name} to be script ${code}`)
}
// The code points whose Script this JavaScript engine's RegExp answers differently, a check on
// the decoding: they should only be ones the two Unicode versions assign differently.
let geckoScriptRegExpDifferences = 0
{
  const scriptOf = (cp: number) => getSmallTrieValue(geckoScriptIndex, geckoScriptData, geckoScriptHighStart, cp)
  const regExps = new Map<number, RegExp | null>()
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue
    const code = scriptOf(cp)
    if (code === 103) continue
    let re = regExps.get(code)
    if (re === undefined) {
      try { re = new RegExp(`^\\p{sc=${geckoScriptNames.slice(code * 4, code * 4 + 4)}}$`, 'u') } catch { re = null }
      regExps.set(code, re)
    }
    if (re !== null && !re.test(String.fromCodePoint(cp))) geckoScriptRegExpDifferences++
  }
  if (scriptOf(0x41) !== 25 || scriptOf(0x627) !== scriptCode('Arab') || scriptOf(0x4e2d) !== scriptCode('Hani') || scriptOf(0x301) !== 1 || scriptOf(0x20) !== 0) {
    throw new Error('Script trie lookups disagree with known values')
  }
}

// Firefox's Unicode properties.
type Ranges = [number, number, number][]
const properties = JSON.parse(readText('firefox-156/properties.json')) as {
  bidiClass: Ranges, eastAsianWidth: Ranges, openPunctuation: [number, number][], mirroringGlyph: [number, number][]
}
// Flat [start - previous end - 1, end - start, value] triples of the kept values, from ranges
// that cover every code point in order.
const deltaRanges = (ranges: Ranges, keep: (value: number) => boolean): number[] => {
  const flat: number[] = []
  let previousEnd = -1
  for (let i = 0; i < ranges.length; i++) {
    const [start, end, value] = ranges[i]!
    if (start !== (i === 0 ? 0 : ranges[i - 1]![1] + 1) || end < start) throw new Error(`Ranges out of order at U+${start.toString(16)}`)
    if (!keep(value)) continue
    flat.push(start - previousEnd - 1, end - start, value)
    previousEnd = end
  }
  if (ranges[ranges.length - 1]![1] !== 0x10ffff) throw new Error('Ranges stop before U+10FFFF')
  return flat
}
const geckoBidiClassRanges = deltaRanges(properties.bidiClass, value => value !== 0)
const geckoEastAsianWidthRanges = deltaRanges(properties.eastAsianWidth, value => value === 2 || value === 3 || value === 5)

// unicode-bidi's bracket pairs: [opening, closing, normalized opening or 0].
const geckoBidiPairs: number[] = []
const pairsSource = readText('firefox-156/bidi_pairs_table.rs')
for (const match of pairsSource.matchAll(/\(\s*'\\u\{([0-9a-f]+)\}',\s*'\\u\{([0-9a-f]+)\}',\s*(?:None|Some\(\s*'\\u\{([0-9a-f]+)\}'\s*\))\s*\)/g)) {
  geckoBidiPairs.push(parseInt(match[1]!, 16), parseInt(match[2]!, 16), match[3] === undefined ? 0 : parseInt(match[3], 16))
}
if (geckoBidiPairs.length / 3 !== (pairsSource.match(/None|Some\(/g) ?? []).length) throw new Error('Unparsed bidi pairs')
// Gecko's script itemizer pairs an Open_Punctuation code point at or above U+0F3A with its
// mirror (gfxScriptItemizer.cpp:167-185). The scan takes that mirror from the bracket table.
const mirrors = new Map(properties.mirroringGlyph)
const openMirrors = new Map<number, number>()
for (const [start, end] of properties.openPunctuation) {
  for (let c = Math.max(start, 0x0f3a); c <= end; c++) if (mirrors.has(c)) openMirrors.set(c, mirrors.get(c)!)
}
const bracketMirrors = new Map<number, number>()
for (let k = 0; k < geckoBidiPairs.length; k += 3) if (geckoBidiPairs[k]! >= 0x0f3a) bracketMirrors.set(geckoBidiPairs[k]!, geckoBidiPairs[k + 1]!)
if (openMirrors.size !== bracketMirrors.size || Array.from(openMirrors).some(([open, close]) => bracketMirrors.get(open) !== close)) {
  throw new Error('Open_Punctuation mirrors differ from the bidi bracket table')
}

const lineTablesJson = JSON.stringify(lineTablesPacked)
const remapsJson = JSON.stringify(appleQuoteRemaps)
const geckoPropertiesJson = JSON.stringify([geckoBidiClassRanges, geckoEastAsianWidthRanges, geckoBidiPairs])
const nextSource = `// Generated by scripts/generate-engine-break-data.ts from scripts/engine-data/.
// Do not edit by hand. Regenerate with \`bun run generate:engine-break-data\`.

// Every table below is packed (unpackTable in src/line-breaks.ts).

// Chrome 153's line_normal.brk and line_normal_cj.brk (ICU 78.2) and libicucore 78.1's
// line.brk, line_normal.brk and line_cj.brk, without their reverse tables and rule source:
// each as the table it packs against, if any, and its packed bytes.
export type LineTable = ${lineTableSources.map(([name]) => `'${name}'`).join(' | ')}
export const lineTablesPacked: Record<LineTable, readonly [LineTable | null, string]> = ${lineTablesJson}

// Chromium's generated kFastLineBreakTable, a bit per U+0021..U+00FF pair where a line may
// start between them (character_property_data_generator.cc:422-551).
export const blinkLinePairsPacked = '${packTable(blinkPairs)}'

// WebKit's LineBreakTable, BreakablePositions.cpp:42-269.
export const webkitLinePairsPacked = '${packTable(webkitPairs)}'

// libicucore's quotation remaps by locale name (apple-rbbi.cpp:406-487): a code point, then
// 0 for the category of U+007B or 1 for U+007D. A locale without an entry takes its parent's.
export const appleQuoteRemaps: Record<string, readonly number[]> = ${remapsJson}

// Firefox's baked ICU4X line data: a small CodePointTrie of Line_Break values (icu_collections
// 2.1.1 codepointtrie), with the index as u16 little-endian, and the BreakState byte of each pair
// of properties (icu_segmenter 2.1.2 src/provider/mod.rs:288-310).
export const geckoLineTrieHighStart = ${geckoLineField('high_start')}
export const geckoLinePropertyCount = ${geckoLinePropertyCount}
export const geckoLineLastCodepointProperty = ${geckoLineField('last_codepoint_property')}
export const geckoLineEotProperty = ${geckoLineField('eot_property')}
export const geckoLineTrieIndexPacked = '${packTable(geckoLineIndex)}'
export const geckoLineTrieDataPacked = '${packTable(geckoLineData)}'
export const geckoLineBreakStatesPacked = '${packTable(geckoLineStates)}'

// icu_properties 2.1.2's Bidi_Class other than L, and its East_Asian_Width H (2), F (3) and W (5),
// in ICU4C numbering, as flat [start - previous end - 1, end - start, value] triples.
export const geckoBidiClassRanges: readonly number[] = ${JSON.stringify(geckoBidiClassRanges)}
export const geckoEastAsianWidthRanges: readonly number[] = ${JSON.stringify(geckoEastAsianWidthRanges)}

// unicode-bidi's bracket pairs (Unicode 15): [opening, closing, normalized opening or 0].
export const geckoBidiPairs: readonly number[] = ${JSON.stringify(geckoBidiPairs)}

// icu_properties 2.1.2's Script values as a small CodePointTrie of ICU4C script codes, with the
// index as u16 little-endian and the data as u8, and the four-letter short name of each code, for
// RegExp \\p{scx=...}.
export const geckoScriptTrieHighStart = ${geckoScriptHighStart}
export const geckoScriptTrieIndexPacked = '${packTable(new Uint8Array(geckoScriptIndex.buffer))}'
export const geckoScriptTrieDataPacked = '${packTable(geckoScriptData)}'
export const geckoScriptNames = '${geckoScriptNames}'
`

const summary = [
  `line tables packed ${Object.entries(lineTablesPacked).map(([table, [reference, data]]) => `${table} ${data.length} B${reference === null ? '' : ` against ${reference}`}`).join(', ')}`,
  `pair tables differ in ${differingPairs} pairs`,
  `quotation remaps ${Object.keys(appleQuoteRemaps).length} of ${ownRemaps.size} locales (${gzipSize(remapsJson)} B gzipped)`,
  `Firefox line data ${geckoLineIndex.length + geckoLineData.length + geckoLineStates.length} B`,
  `Firefox properties ${gzipSize(geckoPropertiesJson)} B gzipped`,
  `Firefox scripts ${geckoScriptIndexBytes.length + geckoScriptData.length} B, ${geckoScriptRegExpDifferences} code points this RegExp engine gives another script`,
  `module ${nextSource.length} B, ${gzipSize(nextSource)} B gzipped`,
].join('; ')

if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== nextSource) throw new Error(`Generated engine break data is stale: ${outputPath}`)
  console.log(`Generated engine break data is up to date: ${summary}.`)
} else {
  await Bun.write(outputPath, nextSource)
  console.log(`Wrote ${outputPath}: ${summary}.`)
}
