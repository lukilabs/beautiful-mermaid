import type { Mindmap, MindmapNode, MindmapShape } from './types.ts'

// ============================================================================
// Mindmap parser
//
// Indentation-based tree. Root is the first node at depth 0.
// Shapes:
//   plain text   → default
//   (text)       → rounded
//   [text]       → square
//   ((text))     → circle
//   {{text}}     → hexagon
// Icons (::icon(...)) are kept as plain text (not rendered as icons).
//
// Shape markers may carry an id prefix (e.g. `root((Circle))`); the prefix is
// dropped and the node text is the marker's content. A node may be indented at
// most one indentation unit below its parent; deeper jumps are rejected.
// ============================================================================

const SHAPE_RE: Array<[MindmapShape, RegExp]> = [
  ['circle', /\(\((.+)\)\)/],
  ['hexagon', /\{\{(.+)\}\}/],
  ['square', /\[(.+)\]/],
  ['rounded', /\((.+)\)/],
]

export function parseMindmapDiagram(lines: string[]): Mindmap {
  const nodes: Array<{ depth: number; text: string; shape: MindmapShape }> = []
  let title: string | undefined
  let headerDepth = -1

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^mindmap(?:\s|$)/i.test(trimmed)) {
      headerDepth = line.length - line.trimStart().length
      continue
    }

    const titleMatch = trimmed.match(/^title\s+(.+)$/)
    if (titleMatch) {
      title = titleMatch[1]!.trim()
      continue
    }

    const depth = line.length - line.trimStart().length
    const shape = detectShape(trimmed)
    nodes.push({ depth, text: trimmed, shape })
  }

  if (nodes.length === 0) throw new Error('Mindmap requires at least one node')

  const rootDepth = nodes[0]!.depth
  const unit = Math.max(1, rootDepth - headerDepth)
  const root = buildTree(nodes, unit)
  return { ...(title ? { title } : {}), root }
}

function detectShape(text: string): MindmapShape {
  if (text.startsWith('::')) return 'default'
  for (const [shape, re] of SHAPE_RE) {
    const m = text.match(re)
    if (m) return shape
  }
  return 'default'
}

function stripShape(text: string): string {
  if (text.startsWith('::')) return text
  return text
    .replace(/.*\(\((.+)\)\).*/, '$1')
    .replace(/.*\{\{(.+)\}\}.*/, '$1')
    .replace(/.*\[(.+)\].*/, '$1')
    .replace(/.*\((.+)\).*/, '$1')
}

function buildTree(entries: Array<{ depth: number; text: string; shape: MindmapShape }>, unit: number): MindmapNode {
  const rootDepth = entries[0]!.depth
  const root = makeNode(entries[0]!)
  const stack: Array<{ depth: number; node: MindmapNode }> = [{ depth: rootDepth, node: root }]

  for (const entry of entries.slice(1)) {
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= entry.depth) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    if (!parent || entry.depth <= rootDepth || entry.depth - parent.depth > unit) {
      throw new Error(`Mindmap node "${entry.text}" is more indented than its parent`)
    }
    const node = makeNode(entry)
    parent.node.children.push(node)
    stack.push({ depth: entry.depth, node })
  }

  return root
}

function makeNode(entry: { text: string; shape: MindmapShape }): MindmapNode {
  return { text: stripShape(entry.text), shape: entry.shape, children: [] }
}
