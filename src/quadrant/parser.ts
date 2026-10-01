import type { QuadrantAxis, QuadrantChart, QuadrantPoint } from './types.ts'

// ============================================================================
// Quadrant chart parser
//
// Supported syntax:
//   quadrantChart
//   title <text>
//   x-axis Low --> High          — optional quoted labels: "Low" --> "High"
//   y-axis Low --> High
//   quadrant-1 <label>           — quadrants 1..4
//   "Label": [x, y]              — points
// ============================================================================

export function parseQuadrantDiagram(lines: string[]): QuadrantChart {
  const chart: QuadrantChart = { quadrantLabels: ['', '', '', ''], points: [] }
  let xAxis: QuadrantAxis = { min: 0, max: 1 }
  let yAxis: QuadrantAxis = { min: 0, max: 1 }

  for (const line of lines) {
    if (/^quadrantChart(?:\s|$)/i.test(line)) continue

    const titleMatch = line.match(/^title\s+(.+)$/)
    if (titleMatch) {
      chart.title = titleMatch[1]!.trim()
      continue
    }

    const axisMatch = line.match(/^(x|y)-axis\s+([^\[]*?)\s*-->\s*(.*)$/)
    if (axisMatch) {
      const isX = axisMatch[1]!.toLowerCase() === 'x'
      const lowRaw = axisMatch[2]!.trim()
      const highRaw = axisMatch[3]!.trim()
      const axis: QuadrantAxis = {
        low: stripQuotes(lowRaw) || undefined,
        high: stripQuotes(highRaw) || undefined,
        min: 0,
        max: 1,
      }
      if (isX) xAxis = axis; else yAxis = axis
      continue
    }

    const quadrantMatch = line.match(/^quadrant-([1-4])\s+(.+)$/)
    if (quadrantMatch) {
      const idx = parseInt(quadrantMatch[1]!, 10) - 1
      chart.quadrantLabels[idx] = quadrantMatch[2]!.trim()
      continue
    }

    const pointMatch = line.match(/^"?(.+?)"?\s*:\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]$/)
    if (pointMatch) {
      const point: QuadrantPoint = {
        label: pointMatch[1]!.trim(),
        x: parseFloat(pointMatch[2]!),
        y: parseFloat(pointMatch[3]!),
      }
      chart.points.push(point)
      continue
    }

    throw new Error(`Invalid quadrant chart line: "${line}"`)
  }

  chart.xAxis = xAxis
  chart.yAxis = yAxis
  return chart
}

function stripQuotes(s: string): string {
  return s.replace(/^"|"$/g, '').trim()
}
