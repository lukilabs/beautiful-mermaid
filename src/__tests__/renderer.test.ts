/**
 * Tests for the SVG renderer.
 *
 * Uses hand-crafted PositionedGraph data to test SVG output without
 * depending on the layout engine.
 */
import { describe, it, expect } from 'bun:test'
import { renderSvg } from '../renderer.ts'
import type { DiagramColors } from '../theme.ts'
import type { PositionedGraph, PositionedNode, PositionedEdge, PositionedGroup } from '../types.ts'

/** Minimal positioned graph for testing */
function makeGraph(overrides: Partial<PositionedGraph> = {}): PositionedGraph {
  return {
    width: 400,
    height: 300,
    nodes: [],
    edges: [],
    groups: [],
    ...overrides,
  }
}

/** Helper to build a positioned node */
function makeNode(overrides: Partial<PositionedNode> = {}): PositionedNode {
  return {
    id: 'A',
    label: 'Test',
    shape: 'rectangle',
    x: 100,
    y: 100,
    width: 80,
    height: 40,
    ...overrides,
  }
}

/** Helper to build a positioned edge with arrow defaults */
function makeEdge(overrides: Partial<PositionedEdge> = {}): PositionedEdge {
  return {
    source: 'A',
    target: 'B',
    style: 'solid',
    hasArrowStart: false,
    hasArrowEnd: true,
    points: [{ x: 100, y: 120 }, { x: 100, y: 200 }],
    ...overrides,
  }
}

/** Default light colors — CSS custom properties handle actual styling */
const lightColors: DiagramColors = { bg: '#FFFFFF', fg: '#27272A' }
const darkColors: DiagramColors = { bg: '#18181B', fg: '#FAFAFA' }

// ============================================================================
// SVG structure
// ============================================================================

describe('renderSvg – SVG structure', () => {
  it('produces a valid SVG root element', () => {
    const svg = renderSvg(makeGraph(), lightColors)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 400 300"')
    expect(svg).toContain('width="400"')
    expect(svg).toContain('height="300"')
    expect(svg).toContain('</svg>')
  })

  it('includes <defs> with arrow markers', () => {
    const svg = renderSvg(makeGraph(), lightColors)
    expect(svg).toContain('<defs>')
    expect(svg).toContain('<marker id="arrowhead"')
    expect(svg).toContain('<marker id="arrowhead-start"')
    expect(svg).toContain('</defs>')
  })

  it('includes embedded Google Fonts import', () => {
    const svg = renderSvg(makeGraph(), lightColors, 'Inter')
    expect(svg).toContain('fonts.googleapis.com')
    expect(svg).toContain('Inter')
  })

  it('uses custom font name when specified', () => {
    const svg = renderSvg(makeGraph(), lightColors, 'Roboto Mono')
    // encodeURIComponent turns spaces into %20
    expect(svg).toContain('Roboto%20Mono')
    expect(svg).toContain("'Roboto Mono'")
  })

  it('sets CSS color variables in inline style', () => {
    const light = renderSvg(makeGraph(), lightColors)
    expect(light).toContain('--bg:#FFFFFF')
    expect(light).toContain('--fg:#27272A')

    const dark = renderSvg(makeGraph(), darkColors)
    expect(dark).toContain('--bg:#18181B')
    expect(dark).toContain('--fg:#FAFAFA')
  })
})

// ============================================================================
// Original node shapes
// ============================================================================

describe('renderSvg – node shapes', () => {
  it('renders rectangle with rx=0', () => {
    const graph = makeGraph({ nodes: [makeNode({ shape: 'rectangle' })] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('rx="0" ry="0"')
  })

  it('renders rounded rectangle with rx=6', () => {
    const graph = makeGraph({ nodes: [makeNode({ shape: 'rounded' })] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('rx="6" ry="6"')
  })

  it('renders stadium with rx=height/2', () => {
    const node = makeNode({ shape: 'stadium', height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('rx="20" ry="20"')
  })

  it('renders circle with <circle> element', () => {
    const node = makeNode({ shape: 'circle', width: 60, height: 60 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<circle')
    expect(svg).toContain('r="30"')
  })

  it('renders diamond with <polygon>', () => {
    const node = makeNode({ shape: 'diamond', width: 80, height: 80 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polygon')
    expect(svg).toContain('points="140,100 180,140 140,180 100,140"')
  })

  it('renders node labels as <text> elements', () => {
    const graph = makeGraph({ nodes: [makeNode({ label: 'My Node' })] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('>My Node</text>')
  })
})

// ============================================================================
// New Batch 1 shapes
// ============================================================================

describe('renderSvg – new shapes (Batch 1)', () => {
  it('renders subroutine with outer rect and inset vertical lines', () => {
    const node = makeNode({ shape: 'subroutine', width: 100, height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    // Outer rect
    expect(svg).toContain('<rect x="100" y="100" width="100" height="40"')
    // Left inset line at x=108 (100+8)
    expect(svg).toContain('x1="108"')
    // Right inset line at x=192 (100+100-8)
    expect(svg).toContain('x1="192"')
    expect(svg).toContain('<line')
  })

  it('renders double circle with two <circle> elements', () => {
    const node = makeNode({ shape: 'doublecircle', width: 80, height: 80 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    const circleMatches = svg.match(/<circle/g) ?? []
    expect(circleMatches.length).toBe(2)
    // Outer radius: min(80,80)/2 = 40, inner = 35
    expect(svg).toContain('r="40"')
    expect(svg).toContain('r="35"')
  })

  it('renders hexagon with 6-point <polygon>', () => {
    const node = makeNode({ shape: 'hexagon', width: 100, height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polygon')
    // 6 points means 6 coordinate pairs separated by spaces
    const polygonMatch = svg.match(/points="([^"]+)"/)
    const points = polygonMatch?.[1]?.split(' ') ?? []
    expect(points.length).toBe(6)
  })
})

// ============================================================================
// New Batch 2 shapes
// ============================================================================

describe('renderSvg – new shapes (Batch 2)', () => {
  it('renders cylinder with ellipses and body rect', () => {
    const node = makeNode({ shape: 'cylinder', width: 80, height: 50 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    // Should contain ellipses for top and bottom caps
    const ellipseMatches = svg.match(/<ellipse/g) ?? []
    expect(ellipseMatches.length).toBe(2)
    // Body rect
    expect(svg).toContain('<rect')
  })

  it('renders asymmetric / flag with 5-point <polygon>', () => {
    const node = makeNode({ shape: 'asymmetric', width: 100, height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polygon')
    // Match the shape polygon (comma-separated "x,y" pairs), not the arrowhead polygons
    // Arrowhead polygons use space-separated "x y," format, while shape polygons use "x,y x,y" format
    const allPolygons = [...svg.matchAll(/points="([^"]+)"/g)]
    // The shape polygon is the last one (rendered after defs/arrowheads)
    const shapePolygon = allPolygons[allPolygons.length - 1]
    const points = shapePolygon?.[1]?.split(' ') ?? []
    expect(points.length).toBe(5)
  })

  it('renders trapezoid with 4-point <polygon>', () => {
    const node = makeNode({ shape: 'trapezoid', width: 100, height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polygon')
    const allPolygons = [...svg.matchAll(/points="([^"]+)"/g)]
    const shapePolygon = allPolygons[allPolygons.length - 1]
    const points = shapePolygon?.[1]?.split(' ') ?? []
    expect(points.length).toBe(4)
  })

  it('renders trapezoid-alt with 4-point <polygon>', () => {
    const node = makeNode({ shape: 'trapezoid-alt', width: 100, height: 40 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polygon')
    const allPolygons = [...svg.matchAll(/points="([^"]+)"/g)]
    const shapePolygon = allPolygons[allPolygons.length - 1]
    const points = shapePolygon?.[1]?.split(' ') ?? []
    expect(points.length).toBe(4)
  })
})

// ============================================================================
// Batch 3: State diagram pseudostates
// ============================================================================

describe('renderSvg – state pseudostates', () => {
  it('renders state-start as a filled circle', () => {
    const node = makeNode({ shape: 'state-start', label: '', width: 28, height: 28 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<circle')
    expect(svg).toContain('fill="var(--_text)"')
    expect(svg).toContain('stroke="none"')
  })

  it('renders state-end as bullseye (two circles)', () => {
    const node = makeNode({ shape: 'state-end', label: '', width: 28, height: 28 })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    const circleMatches = svg.match(/<circle/g) ?? []
    expect(circleMatches.length).toBe(2)
    // Outer is stroked, inner is filled
    expect(svg).toContain('fill="none"')
    expect(svg).toContain('fill="var(--_text)"')
  })
})

// ============================================================================
// Edge rendering
// ============================================================================

describe('renderSvg – edges', () => {
  it('renders a solid edge as <polyline> with end arrow', () => {
    const edge = makeEdge({ style: 'solid', hasArrowEnd: true })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polyline')
    expect(svg).toContain('points="100,120 100,200"')
    expect(svg).toContain('marker-end="url(#arrowhead)"')
  })

  it('renders dotted edges with stroke-dasharray', () => {
    const edge = makeEdge({ style: 'dotted' })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('stroke-dasharray="4 4"')
  })

  it('renders thick edges with doubled stroke width', () => {
    const edge = makeEdge({ style: 'thick' })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('stroke-width="1.5"')
  })

  it('does not add dasharray to solid edges', () => {
    const edge = makeEdge({ style: 'solid' })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('dasharray')
  })

  it('skips edges with fewer than 2 points', () => {
    const edge = makeEdge({ points: [{ x: 0, y: 0 }] })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('<polyline')
  })

  it('renders no-arrow edge without marker-end', () => {
    const edge = makeEdge({ hasArrowEnd: false, hasArrowStart: false })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('<polyline')
    expect(svg).not.toContain('marker-end')
    expect(svg).not.toContain('marker-start')
  })

  it('renders bidirectional edge with both markers', () => {
    const edge = makeEdge({ hasArrowStart: true, hasArrowEnd: true })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('marker-end="url(#arrowhead)"')
    expect(svg).toContain('marker-start="url(#arrowhead-start)"')
  })
})

// ============================================================================
// Edge labels
// ============================================================================

describe('renderSvg – edge labels', () => {
  it('renders edge label with background pill', () => {
    const edge = makeEdge({ label: 'Yes' })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('>Yes</text>')
    expect(svg).toContain('rx="2" ry="2"')
  })

  it('does not render label elements for edges without labels', () => {
    const edge = makeEdge({ label: undefined })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    const textMatches = svg.match(/<text[^>]*>.*?<\/text>/g) ?? []
    expect(textMatches).toHaveLength(0)
  })

  it('uses labelPosition when provided instead of edge midpoint', () => {
    // Edge midpoint would be at (100, 160) given these points.
    // labelPosition overrides to (50, 80) — verify the SVG uses that coordinate.
    const edge = makeEdge({
      label: 'Go',
      points: [{ x: 100, y: 120 }, { x: 100, y: 200 }],
      labelPosition: { x: 50, y: 80 },
    })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)

    // The label text should be centered at the labelPosition (x=50, y=80)
    expect(svg).toContain('x="50" y="80"')
    // The midpoint y=160 should NOT appear in any label-related element
    expect(svg).not.toContain('y="160"')
  })
})

// ============================================================================
// Group rendering (subgraphs)
// ============================================================================

describe('renderSvg – groups', () => {
  it('renders group with outer rectangle and header band', () => {
    const group: PositionedGroup = {
      id: 'sg1', label: 'Backend',
      x: 20, y: 20, width: 200, height: 150, children: [],
    }
    const graph = makeGraph({ groups: [group] })
    const svg = renderSvg(graph, lightColors)
    const rectCount = (svg.match(/x="20" y="20"/g) ?? []).length
    expect(rectCount).toBeGreaterThanOrEqual(2)
    expect(svg).toContain('>Backend</text>')
  })

  it('renders nested groups recursively', () => {
    const inner: PositionedGroup = {
      id: 'inner', label: 'Inner',
      x: 40, y: 60, width: 120, height: 80, children: [],
    }
    const outer: PositionedGroup = {
      id: 'outer', label: 'Outer',
      x: 20, y: 20, width: 200, height: 150, children: [inner],
    }
    const graph = makeGraph({ groups: [outer] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('>Outer</text>')
    expect(svg).toContain('>Inner</text>')
  })
})

// ============================================================================
// Inline style support
// ============================================================================

describe('renderSvg – inline styles', () => {
  it('applies inline fill override', () => {
    const node = makeNode({ inlineStyle: { fill: '#ff0000' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('fill="#ff0000"')
  })

  it('applies inline stroke override', () => {
    const node = makeNode({ inlineStyle: { stroke: '#00ff00' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('stroke="#00ff00"')
  })

  it('applies inline text color override', () => {
    const node = makeNode({ inlineStyle: { color: '#0000ff' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('fill="#0000ff"')
  })

  it('falls back to theme when no inline style', () => {
    const node = makeNode()
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('fill="var(--_node-fill)"')
  })
})

// ============================================================================
// XML escaping
// ============================================================================

describe('renderSvg – XML escaping', () => {
  it('escapes special characters in node labels', () => {
    const node = makeNode({ label: '<script> & "quotes" \'apos\'' })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&quot;quotes&quot;')
    expect(svg).toContain('&#39;apos&#39;')
  })

  it('escapes special characters in edge labels', () => {
    const edge = makeEdge({ label: 'A & B > C' })
    const graph = makeGraph({ edges: [edge] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('A &amp; B &gt; C')
  })

  it('escapes special characters in group labels', () => {
    const group: PositionedGroup = {
      id: 'g1', label: 'A < B',
      x: 0, y: 0, width: 100, height: 100, children: [],
    }
    const graph = makeGraph({ groups: [group] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).toContain('A &lt; B')
  })

  it('escapes attribute injection in inline style fill', () => {
    const node = makeNode({ inlineStyle: { fill: 'red" onmouseover="alert(1)' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('onmouseover="alert')
    expect(svg).toContain('red&quot; onmouseover=&quot;alert(1)')
  })

  it('escapes element injection in inline style fill', () => {
    const node = makeNode({ inlineStyle: { fill: 'red"/><svg onload="alert(1)"><rect fill="x' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('<svg onload')
    expect(svg).toContain('&lt;svg onload=')
  })

  it('escapes injection in inline style stroke', () => {
    const node = makeNode({ inlineStyle: { stroke: 'blue" onclick="alert(1)' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('onclick="alert')
    expect(svg).toContain('blue&quot; onclick=&quot;alert(1)')
  })

  it('escapes injection in inline style stroke-width', () => {
    const node = makeNode({ inlineStyle: { 'stroke-width': '2" onmouseover="alert(1)' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('onmouseover="alert')
    expect(svg).toContain('2&quot; onmouseover=&quot;alert(1)')
  })

  it('escapes injection in inline style color', () => {
    const node = makeNode({ inlineStyle: { color: 'green" onfocus="alert(1)' } })
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    expect(svg).not.toContain('onfocus="alert')
    expect(svg).toContain('green&quot; onfocus=&quot;alert(1)')
  })
})

// ============================================================================
// Theme application
// ============================================================================

describe('renderSvg – CSS variable theming', () => {
  it('uses CSS variables for styling (light colors)', () => {
    const node = makeNode()
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, lightColors)
    // SVG uses CSS custom property references, not hardcoded colors
    expect(svg).toContain('var(--_node-fill)')
    expect(svg).toContain('var(--_node-stroke)')
    expect(svg).toContain('var(--_text)')
  })

  it('uses same CSS variables with dark colors', () => {
    const node = makeNode()
    const graph = makeGraph({ nodes: [node] })
    const svg = renderSvg(graph, darkColors)
    // Same CSS variable structure — colors differ via --bg/--fg on the SVG tag
    expect(svg).toContain('var(--_node-fill)')
    expect(svg).toContain('var(--_node-stroke)')
    expect(svg).toContain('var(--_text)')
    expect(svg).toContain('--bg:#18181B')
  })

  it('arrow marker uses CSS variable for fill', () => {
    const svg = renderSvg(makeGraph(), lightColors)
    expect(svg).toContain('fill="var(--_arrow)"')
  })
})
