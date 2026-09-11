// ============================================================================
// Pie Chart parser
//
// Parses Mermaid pie chart syntax into a typed PieChart structure.
//
// Supported syntax:
//   pie [showData] [title <title>]
//   title "Chart Title" | title Chart Title
//   showData
//   "Label 1" : 42.96
//   'Label 2' : 50.05
//   Label 3 : 10.01
// ============================================================================

import type { PieChart, PieSlice } from './types.ts'

/**
 * Parse a Mermaid pie chart from preprocessed lines.
 * Lines should already be trimmed and comment-stripped.
 */
export function parsePieChart(lines: string[]): PieChart {
  let title: string | undefined
  let showData = false
  const slices: PieSlice[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!.trim()
    if (!rawLine || rawLine.startsWith('%%')) continue

    // Header line: pie [showData] [title <title>]
    if (/^pie\b/i.test(rawLine)) {
      let rest = rawLine.replace(/^pie\b/i, '').trim()

      if (/^showdata\b/i.test(rest)) {
        showData = true
        rest = rest.replace(/^showdata\b/i, '').trim()
      }

      // Check for inline title: title[: ] "..." or title[: ] '...' or title[: ] ...
      const titleMatch = rest.match(/^title(?:\s*:\s*|\s+)(?:"([^"]+)"|'([^']+)'|(.+))$/i)
      if (titleMatch) {
        title = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '').trim()
      }
      continue
    }

    // Standalone title directive: title "..." or title '...' or title: ... or title ...
    const titleDirective = rawLine.match(/^title(?:\s*:\s*|\s+)(?:"([^"]+)"|'([^']+)'|(.+))$/i)
    if (titleDirective) {
      title = (titleDirective[1] ?? titleDirective[2] ?? titleDirective[3] ?? '').trim()
      continue
    }

    // Standalone showData directive
    if (/^showdata\b/i.test(rawLine)) {
      showData = true
      continue
    }

    // Ignore accessibility metadata directives
    if (/^acc(?:Title|Descr)\b/i.test(rawLine)) {
      continue
    }

    // Slice line: "Label" : 42.96 or 'Label' : 42.96 or Label : 42.96
    // Handles labels containing colons when quoted (e.g. "Ratio 1:2" : 50)
    let label: string | undefined
    let valueStr: string | undefined

    const quotedMatch = rawLine.match(/^(?:"([^"]+)"|'([^']+)')\s*:\s*([+-]?\d+(?:\.\d+)?|\.\d+)\s*$/)
    if (quotedMatch) {
      label = quotedMatch[1] ?? quotedMatch[2]
      valueStr = quotedMatch[3]
    } else {
      // Unquoted label: split on the last colon
      const colonIdx = rawLine.lastIndexOf(':')
      if (colonIdx !== -1) {
        const potentialLabel = rawLine.substring(0, colonIdx).trim()
        const potentialVal = rawLine.substring(colonIdx + 1).trim()
        if (/^[+-]?\d+(?:\.\d+)?$/.test(potentialVal) || /^\.\d+$/.test(potentialVal)) {
          label = potentialLabel
          valueStr = potentialVal
        }
      }
    }

    if (label !== undefined && valueStr !== undefined) {
      const val = parseFloat(valueStr)
      if (!isNaN(val) && val >= 0) {
        slices.push({
          label,
          value: val,
        })
      }
    }
  }

  return {
    title,
    showData,
    slices,
  }
}
