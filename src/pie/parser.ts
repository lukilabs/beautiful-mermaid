import type { PieChart, PieSlice } from './types.ts'

// ============================================================================
// Pie chart parser
//
// Supported syntax:
//   pie [showData] [title <text>]   — title may be inline and unquoted
//   title <text>                    — standalone title line (quoted or not)
//   "Label" : value
// ============================================================================

function stripQuotes(text: string): string {
  return text.length >= 2 && text.startsWith('"') && text.endsWith('"')
    ? text.slice(1, -1)
    : text
}

export function parsePieDiagram(lines: string[]): PieChart {
  const chart: PieChart = { showData: false, slices: [] }

  for (const line of lines) {
    // Header: pie [showData] [title <text>]
    if (/^pie(?:\s|$)/i.test(line)) {
      const rest = line.replace(/^pie\s*/i, '').trim()
      if (rest) {
        if (/\bshowData\b/i.test(rest)) chart.showData = true
        const titleAt = rest.search(/title\s+/i)
        if (titleAt !== -1) {
          chart.title = stripQuotes(rest.slice(titleAt).replace(/^title\s+/i, '').trim())
        } else if (!/^showData\s*$/i.test(rest)) {
          throw new Error(`Invalid pie diagram line: "${line}"`)
        }
      }
      continue
    }

    // Title: title <text>
    const titleMatch = line.match(/^title\s+(.+)$/)
    if (titleMatch) {
      chart.title = stripQuotes(titleMatch[1]!.trim())
      continue
    }

    // Section: "Label" : value
    const sliceMatch = line.match(/^"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)\s*$/)
    if (sliceMatch) {
      const slice: PieSlice = { label: sliceMatch[1]!, value: parseFloat(sliceMatch[2]!) }
      chart.slices.push(slice)
      continue
    }

    throw new Error(`Invalid pie diagram line: "${line}"`)
  }

  if (chart.slices.length === 0) {
    throw new Error('Pie diagram requires at least one section')
  }

  return chart
}
