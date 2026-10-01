import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import { parseQuadrantDiagram } from '../quadrant/parser.ts'
import { mkCanvas, mkRoleCanvas, canvasToString, drawText, setRole } from './canvas.ts'

// ============================================================================
// ASCII renderer — Quadrant chart
//
// 2×2 grid with divider lines, floating axis labels, and points.
// ============================================================================

const QW = 40
const QH = 8

export function renderQuadrantAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = { fg: '', border: '', line: '', arrow: '' },
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parseQuadrantDiagram(lines)

  const H = config.useAscii ? '-' : '─'
  const V = config.useAscii ? '|' : '│'
  const X = config.useAscii ? '+' : '┼'

  const hasTitle = !!chart.title
  const titleRows = hasTitle ? 2 : 0

  const yHigh = chart.yAxis?.high ?? ''
  const yLow = chart.yAxis?.low ?? ''
  const yGutter = Math.max(yHigh.length, yLow.length) + 1
  const plotLeft = yGutter + 1

  const width = plotLeft + QW * 2 + 2
  const height = titleRows + QH * 2 + 3

  const canvas = mkCanvas(width - 1, height - 1)
  const roles = mkRoleCanvas(width - 1, height - 1)

  if (chart.title) {
    drawText(canvas, { x: Math.floor((width - chart.title.length) / 2), y: 0 }, chart.title)
  }

  const plotTop = titleRows
  const plotBottom = plotTop + QH * 2 + 1
  const plotRight = width - 2
  const midX = plotLeft + QW + 1
  const midY = plotTop + QH + 1

  for (let x = plotLeft; x <= plotRight; x++) {
    canvas[x]![plotTop] = H
    canvas[x]![plotBottom] = H
    canvas[x]![midY] = H
    setRole(roles, x, midY, 'line')
  }
  for (let y = plotTop; y <= plotBottom; y++) {
    canvas[plotLeft]![y] = V
    canvas[plotRight]![y] = V
    canvas[midX]![y] = V
    setRole(roles, midX, y, 'line')
  }
  canvas[midX]![midY] = X

  const placeQuadrant = (text: string, x: number, y: number) => {
    if (!text) return
    drawText(canvas, { x, y }, text)
  }
  placeQuadrant(chart.quadrantLabels[0]!, midX + 2, plotTop + 1)
  placeQuadrant(chart.quadrantLabels[1]!, plotLeft + 2, plotTop + 1)
  placeQuadrant(chart.quadrantLabels[2]!, plotLeft + 2, midY + 1)
  placeQuadrant(chart.quadrantLabels[3]!, midX + 2, midY + 1)

  if (chart.xAxis) {
    if (chart.xAxis.low) drawText(canvas, { x: plotLeft + 2, y: plotBottom + 1 }, chart.xAxis.low)
    if (chart.xAxis.high) drawText(canvas, { x: plotRight - chart.xAxis.high.length - 1, y: plotBottom + 1 }, chart.xAxis.high)
  }
  if (chart.yAxis) {
    if (yHigh) drawText(canvas, { x: plotLeft - yHigh.length - 1, y: plotTop + 1 }, yHigh)
    if (yLow) drawText(canvas, { x: plotLeft - yLow.length - 1, y: plotBottom - 1 }, yLow)
  }

  const span = (chart.xAxis?.max ?? 1) - (chart.xAxis?.min ?? 0) || 1
  for (const p of chart.points) {
    const nx = (p.x - (chart.xAxis?.min ?? 0)) / span
    const ny = (p.y - (chart.yAxis?.min ?? 0)) / ((chart.yAxis?.max ?? 1) - (chart.yAxis?.min ?? 0) || 1)
    const px = Math.round(plotLeft + 1 + nx * (plotRight - plotLeft - 2))
    const py = Math.round(plotBottom - 1 - ny * (plotBottom - plotTop - 2))
    const marker = p.label[0] ?? '*'
    canvas[px]![py] = marker
    setRole(roles, px, py, 'text')
  }

  return canvasToString(canvas, { roleCanvas: roles, colorMode, theme })
}
