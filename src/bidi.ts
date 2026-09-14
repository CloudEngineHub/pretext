// Bidi classes and paired brackets from the generated Unicode data. prepare()
// reads them for WebKit's following-space kerning, which depends on how the
// characters around a space resolve. Pretext doesn't resolve bidi levels; see
// RESEARCH.md.

import {
  bidiPairedBrackets,
  latin1BidiTypes,
  nonLatin1BidiRanges,
  type GeneratedBidiType as BidiType,
} from './generated/bidi-data.js'

// Paired brackets resolve together (UAX #9 N0), so they can take the paragraph
// direction instead of the direction of the text around them.
export function isBidiPairedBracket(codePoint: number): boolean {
  let lo = 0
  let hi = bidiPairedBrackets.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const value = bidiPairedBrackets[mid]!
    if (codePoint === value) return true
    if (codePoint < value) hi = mid - 1
    else lo = mid + 1
  }
  return false
}

export function classifyCodePoint(codePoint: number): BidiType {
  if (codePoint <= 0x00FF) return latin1BidiTypes[codePoint]!

  let lo = 0
  let hi = nonLatin1BidiRanges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const range = nonLatin1BidiRanges[mid]!
    if (codePoint < range[0]) {
      hi = mid - 1
      continue
    }
    if (codePoint > range[1]) {
      lo = mid + 1
      continue
    }
    return range[2]
  }

  return 'L'
}
