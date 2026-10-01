import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'
import type { MindmapNode } from '../mindmap/types.ts'
import { parseMindmapDiagram } from '../mindmap/parser.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from '../xychart/colors.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// ASCII renderer — Mindmap
//
// Indented tree with box-drawing connectors:
//   root
//   ├─ Origins
//   │  └─ Long history
//   └─ Research
// ============================================================================

export function renderMindmapAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = { fg: '', border: '', line: '', arrow: '' },
): string {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim().length > 0 && !l.trim().startsWith('%%'))
  const mindmap = parseMindmapDiagram(lines)

  const branch = config.useAscii ? '+-' : '├─'
  const lastBranch = config.useAscii ? '`-' : '└─'
  const pipe = config.useAscii ? '|' : '│'
  const space = '  '

  const rows: string[] = []
  if (mindmap.title) rows.push(mindmap.title)

  const accent = theme.accent ?? CHART_ACCENT_FALLBACK
  const bg = theme.bg
  const colored = (s: string, depth: number): string => {
    if (colorMode === 'none') return s
    const hex = depth === 0 ? accent : getSeriesColor(depth, accent, bg)
    return colorizeText(s, hex, colorMode)
  }

  const walk = (node: MindmapNode, prefix: string, isLast: boolean, isRoot: boolean): void => {
    if (isRoot) {
      rows.push(colored(node.text, 0))
    } else {
      const connector = isLast ? lastBranch : branch
      rows.push(`${prefix}${connector} ${colored(node.text, nodeDepth(node))}`)
    }
    const childPrefix = isRoot ? '' : `${prefix}${isLast ? space : pipe}  `
    node.children.forEach((child, i) => {
      walk(child, childPrefix, i === node.children.length - 1, false)
    })
  }

  const nodeDepth = (() => {
    const depths = new Map<MindmapNode, number>()
    const compute = (node: MindmapNode, d: number): number => {
      depths.set(node, d)
      node.children.forEach(c => compute(c, d + 1))
      return d
    }
    compute(mindmap.root, 0)
    return (node: MindmapNode): number => depths.get(node) ?? 0
  })()

  walk(mindmap.root, '', true, true)
  return rows.join('\n')
}
