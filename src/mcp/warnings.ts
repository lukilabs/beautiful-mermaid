// ============================================================================
// CJK detection for ASCII rendering warnings
//
// Detects CJK (Chinese/Japanese/Korean) characters in rendered output
// and emits warnings. Does NOT attempt width correction — CJK characters
// may misalign in fixed-width terminal output.
//
// Covered Unicode blocks:
//   U+4E00–U+9FFF  CJK Unified Ideographs (Chinese/Kanji)
//   U+3400–U+4DBF  CJK Unified Ideographs Extension A
//   U+F900–U+FAFF  CJK Compatibility Ideographs
//   U+3040–U+309F  Hiragana (Japanese)
//   U+30A0–U+30FF  Katakana (Japanese)
//   U+AC00–U+D7AF  Hangul Syllables (Korean)
//   U+1100–U+11FF  Hangul Jamo (Korean)
//   U+3130–U+318F  Hangul Compatibility Jamo (Korean)
// ============================================================================

/** Regex matching all CJK character ranges that are double-width in terminals */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/

/**
 * Check text for CJK characters and return warnings if found.
 * Returns empty array if no CJK characters are present.
 */
export function checkCJK(text: string): string[] {
  if (CJK_REGEX.test(text)) {
    return ['Diagram contains CJK (Chinese/Japanese/Korean) characters which may misalign in fixed-width terminal output.']
  }
  return []
}
