import { describe, expect, it } from 'bun:test'
import { parseMermaid } from '../parser.ts'
import { layoutGraphSync } from '../layout.ts'
import type { Point, PositionedNode, PositionedEdge } from '../types.ts'

const EPSILON = 1.5

function onRectBoundary(point: Point, node: PositionedNode): boolean {
  const left = node.x
  const right = node.x + node.width
  const top = node.y
  const bottom = node.y + node.height
  const onHorizontal = (Math.abs(point.y - top) <= EPSILON || Math.abs(point.y - bottom) <= EPSILON)
    && point.x >= left - EPSILON && point.x <= right + EPSILON
  const onVertical = (Math.abs(point.x - left) <= EPSILON || Math.abs(point.x - right) <= EPSILON)
    && point.y >= top - EPSILON && point.y <= bottom + EPSILON
  return onHorizontal || onVertical
}

function expectEdgesMeetNodes(
  result: ReturnType<typeof layoutGraphSync>,
  edgeIds: string[] = result.edges.map((_, index) => String(index)),
): void {
  const nodes = new Map(result.nodes.map(node => [node.id, node]))
  for (const id of edgeIds) {
    const edge = result.edges[Number(id)] as PositionedEdge | undefined
    expect(edge, `missing edge ${id}`).toBeDefined()
    const source = nodes.get(edge!.source)
    const target = nodes.get(edge!.target)
    expect(source, `missing source ${edge!.source}`).toBeDefined()
    expect(target, `missing target ${edge!.target}`).toBeDefined()
    expect(onRectBoundary(edge!.points[0]!, source!), `${id} starts off ${edge!.source}`).toBe(true)
    expect(onRectBoundary(edge!.points.at(-1)!, target!), `${id} ends off ${edge!.target}`).toBe(true)
  }
}

function nestedDiagram(direction: string): string {
  return `flowchart ${direction}
    subgraph outer["Outer"]
      a["A"]
      subgraph inner["Inner"]
        b["B"]
      end
    end
    a -->|yes| b`
}

describe('ELK edge container offsets', () => {
  it('converts nested cross-container points and labels into root coordinates', () => {
    const result = layoutGraphSync(parseMermaid(nestedDiagram('LR')))
    expectEdgesMeetNodes(result)

    const edge = result.edges[0]!
    expect(edge.labelPosition).toBeDefined()
    expect(edge.labelPosition!.x).toBeGreaterThan(result.nodes[0]!.x + result.nodes[0]!.width)
    expect(Math.abs(edge.labelPosition!.y - edge.points[0]!.y)).toBeLessThan(1)
  })

  it('keeps cross-container endpoints on node boundaries in every root direction', () => {
    for (const direction of ['LR', 'RL', 'TD', 'BT']) {
      const result = layoutGraphSync(parseMermaid(nestedDiagram(direction)))
      expectEdgesMeetNodes(result)
    }
  })

  it('handles three nested containers and edges crossing one, two, and three levels', () => {
    const source = `flowchart LR
      p["Parent"]
      subgraph outer["Outer"]
        m["Middle"]
        subgraph inner["Inner"]
          i["Inner"]
          subgraph deepest["Deepest"]
            d["Deep"]
          end
        end
      end
      p --> m
      p --> i
      p --> d
      m --> i
      i --> d`
    const result = layoutGraphSync(parseMermaid(source))
    expect(result.edges).toHaveLength(5)
    expectEdgesMeetNodes(result)
  })

  it('handles parent-child and sibling container connections', () => {
    const source = `flowchart LR
      subgraph outer["Outer"]
        a["A"]
        subgraph left["Left"]
          b["B"]
        end
        subgraph right["Right"]
          c["C"]
        end
      end
      a --> b
      b --> c`
    const result = layoutGraphSync(parseMermaid(source))
    expect(result.edges).toHaveLength(2)
    expectEdgesMeetNodes(result)
  })

  it('preserves ordinary root-level graph geometry', () => {
    const result = layoutGraphSync(parseMermaid('flowchart LR\n  a["A"] -->|yes| b["B"]'))
    expectEdgesMeetNodes(result)
    expect(result.nodes[0]).toMatchObject({ id: 'a', x: 40, y: 40, width: 60 })
    expect(result.edges[0]!.labelPosition).toBeDefined()
  })
})
