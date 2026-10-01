import type { QuadrantChart } from './types.ts'
import type { PositionedQuadrant } from './renderer.ts'
import type { RenderOptions } from '../types.ts'

// ============================================================================
// Quadrant chart layout — 2×2 grid
//
// Plot area with quadrants 1-4 (top-right, top-left, bottom-left,
// bottom-right). Axis labels float at the four edges (no tick marks).
// Points are plotted normalized to [min..max] on each axis.
// ============================================================================

const Q = {
  padding: 40,
  titleGap: 44,
  plotW: 480,
  plotH: 400,
  quadrantPad: 16,
  pointLabelGap: 10,
} as const

export function layoutQuadrantDiagram(chart: QuadrantChart, _options: RenderOptions = {}): PositionedQuadrant {
  const hasTitle = !!chart.title
  const titleH = hasTitle ? Q.titleGap : 0

  const width = Q.padding + Q.plotW + Q.padding
  const height = Q.padding + titleH + Q.plotH + Q.padding

  const plot = { x: Q.padding, y: Q.padding + titleH, width: Q.plotW, height: Q.plotH }

  const norm = (v: number, axis: { min: number; max: number }): number => {
    const span = axis.max - axis.min || 1
    return (v - axis.min) / span
  }

  const points = chart.points.map(p => {
    const nx = norm(p.x, chart.xAxis ?? { min: 0, max: 1 })
    const ny = 1 - norm(p.y, chart.yAxis ?? { min: 0, max: 1 })
    const x = plot.x + nx * plot.width
    const y = plot.y + ny * plot.height
    return {
      label: p.label,
      x,
      y,
      labelX: x + Q.pointLabelGap,
      labelY: y,
      anchor: 'start' as const,
    }
  })

  const quadrantLabels = [
    { text: chart.quadrantLabels[0]!, x: plot.x + plot.width - Q.quadrantPad, y: plot.y + Q.quadrantPad + 8, anchor: 'end' as const },
    { text: chart.quadrantLabels[1]!, x: plot.x + Q.quadrantPad, y: plot.y + Q.quadrantPad + 8, anchor: 'start' as const },
    { text: chart.quadrantLabels[2]!, x: plot.x + Q.quadrantPad, y: plot.y + plot.height - Q.quadrantPad, anchor: 'start' as const },
    { text: chart.quadrantLabels[3]!, x: plot.x + plot.width - Q.quadrantPad, y: plot.y + plot.height - Q.quadrantPad, anchor: 'end' as const },
  ]

  return {
    width,
    height,
    ...(chart.title ? { title: { text: chart.title, x: width / 2, y: Q.padding + 16 } } : {}),
    plot,
    ...(chart.xAxis ? { xAxis: chart.xAxis } : {}),
    ...(chart.yAxis ? { yAxis: chart.yAxis } : {}),
    quadrantLabels,
    points,
  }
}
