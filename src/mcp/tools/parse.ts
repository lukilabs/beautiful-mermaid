// ============================================================================
// parse_mermaid tool handler
//
// Wraps parseMermaid() to return a JSON graph structure.
// Handles Map serialization (nodes, classDefs, etc.) for JSON output.
// ============================================================================

import { parseMermaid } from '../../index.ts'
import { formatError } from '../errors.ts'

/**
 * Serialize a MermaidGraph to a plain JSON-safe object.
 * Converts Map fields (nodes, classDefs, classAssignments, nodeStyles, linkStyles)
 * to nested objects for JSON serialization.
 */
function serializeGraph(graph: ReturnType<typeof parseMermaid>): Record<string, unknown> {
  return {
    direction: graph.direction,
    nodes: Object.fromEntries(graph.nodes),
    edges: graph.edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label,
      style: e.style,
      hasArrowStart: e.hasArrowStart,
      hasArrowEnd: e.hasArrowEnd,
    })),
    subgraphs: graph.subgraphs.map(sg => ({
      id: sg.id,
      label: sg.label,
      nodeIds: sg.nodeIds,
      children: sg.children.map(child => ({
        id: child.id,
        label: child.label,
        nodeIds: child.nodeIds,
        children: child.children,
        direction: child.direction,
      })),
      direction: sg.direction,
    })),
    classDefs: Object.fromEntries(graph.classDefs),
    classAssignments: Object.fromEntries(graph.classAssignments),
    nodeStyles: Object.fromEntries(graph.nodeStyles),
    linkStyles: Object.fromEntries(
      Array.from(graph.linkStyles.entries()).map(([k, v]) => [String(k), v])
    ),
  }
}

/**
 * MCP tool handler for `parse_mermaid`.
 * Parses Mermaid text and returns the graph structure as JSON.
 */
export function handleParseMermaid(args: { mermaid_code: string }): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
} {
  try {
    const graph = parseMermaid(args.mermaid_code)
    const serialized = serializeGraph(graph)
    return {
      content: [{ type: 'text', text: JSON.stringify(serialized, null, 2) }],
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatError(error) }],
      isError: true,
    }
  }
}
