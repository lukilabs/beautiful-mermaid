// ============================================================================
// ASCII renderer — drawing operations
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/draw.go + cmd/arrow.go.
// Contains all visual rendering: boxes, lines, arrows, corners,
// subgraphs, labels, and the top-level draw orchestrator.
// ============================================================================

import type {
  Canvas, DrawingCoord, GridCoord, Direction,
  AsciiGraph, AsciiNode, AsciiEdge, AsciiSubgraph,
} from './types.ts'
import {
  Up, Down, Left, Right, UpperLeft, UpperRight, LowerLeft, LowerRight, Middle,
  drawingCoordEquals,
} from './types.ts'
import { mkCanvas, copyCanvas, getCanvasSize, mergeCanvases, drawText } from './canvas.ts'
import { determineDirection, dirEquals } from './edge-routing.ts'
import { getDisplayWidth } from './cjk-width.ts'
import { gridToDrawingCoord, lineToDrawing } from './grid.ts'

// ============================================================================
// Box drawing — renders a node as a bordered rectangle
// ============================================================================

/**
 * Draw a node box with centered label text.
 * Returns a standalone canvas containing just the box.
 * Box size is determined by the grid column/row sizes for the node's position.
 */
export function drawBox(node: AsciiNode, graph: AsciiGraph): Canvas {
  const gc = node.gridCoord!
  const useAscii = graph.config.useAscii

  // Width spans 2 columns (border + content)
  let w = 0
  for (let i = 0; i < 2; i++) {
    w += graph.columnWidth.get(gc.x + i) ?? 0
  }
  // Height spans 2 rows (border + content)
  let h = 0
  for (let i = 0; i < 2; i++) {
    h += graph.rowHeight.get(gc.y + i) ?? 0
  }

  const from: DrawingCoord = { x: 0, y: 0 }
  const to: DrawingCoord = { x: w, y: h }
  const box = mkCanvas(Math.max(from.x, to.x), Math.max(from.y, to.y))

  if (!useAscii) {
    // Unicode box-drawing characters
    for (let x = from.x + 1; x < to.x; x++) box[x]![from.y] = '─'
    for (let x = from.x + 1; x < to.x; x++) box[x]![to.y] = '─'
    for (let y = from.y + 1; y < to.y; y++) box[from.x]![y] = '│'
    for (let y = from.y + 1; y < to.y; y++) box[to.x]![y] = '│'
    box[from.x]![from.y] = '┌'
    box[to.x]![from.y] = '┐'
    box[from.x]![to.y] = '└'
    box[to.x]![to.y] = '┘'
  } else {
    // ASCII characters
    for (let x = from.x + 1; x < to.x; x++) box[x]![from.y] = '-'
    for (let x = from.x + 1; x < to.x; x++) box[x]![to.y] = '-'
    for (let y = from.y + 1; y < to.y; y++) box[from.x]![y] = '|'
    for (let y = from.y + 1; y < to.y; y++) box[to.x]![y] = '|'
    box[from.x]![from.y] = '+'
    box[to.x]![from.y] = '+'
    box[from.x]![to.y] = '+'
    box[to.x]![to.y] = '+'
  }

  // Center the display label inside the box
  const label = node.displayLabel
  const textY = from.y + Math.floor(h / 2)
  const labelWidth = getDisplayWidth(label)
  const textX = from.x + Math.floor((w - labelWidth) / 2) + 1
  for (let i = 0; i < label.length; i++) {
    box[textX + i]![textY] = label[i]!
  }

  return box
}

// ============================================================================
// Multi-section box drawing — for class and ER diagram nodes
// ============================================================================

/**
 * Draw a multi-section box with horizontal dividers between sections.
 * Used by class diagrams (header | attributes | methods) and ER diagrams (header | attributes).
 * Each section is an array of text lines to render left-aligned with padding.
 *
 * @param sections - Array of sections, each section is an array of text lines
 * @param useAscii - true for ASCII chars, false for Unicode box-drawing
 * @param padding - horizontal padding inside the box (default 1)
 * @returns A standalone Canvas containing the multi-section box
 */
export function drawMultiBox(
  sections: string[][],
  useAscii: boolean,
  padding: number = 1,
): Canvas {
  // Compute width: widest line across all sections + 2*padding + 2 border chars
  let maxTextWidth = 0
  for (const section of sections) {
    for (const line of section) {
      maxTextWidth = Math.max(maxTextWidth, getDisplayWidth(line))
    }
  }
  const innerWidth = maxTextWidth + 2 * padding
  const boxWidth = innerWidth + 2 // +2 for left/right border

  // Compute height: sum of all section line counts + dividers + 2 border rows
  let totalLines = 0
  for (const section of sections) {
    totalLines += Math.max(section.length, 1) // at least 1 row per section
  }
  const numDividers = sections.length - 1
  const boxHeight = totalLines + numDividers + 2 // +2 for top/bottom border

  // Box-drawing characters
  const hLine = useAscii ? '-' : '─'
  const vLine = useAscii ? '|' : '│'
  const tl = useAscii ? '+' : '┌'
  const tr = useAscii ? '+' : '┐'
  const bl = useAscii ? '+' : '└'
  const br = useAscii ? '+' : '┘'
  const divL = useAscii ? '+' : '├'
  const divR = useAscii ? '+' : '┤'

  const canvas = mkCanvas(boxWidth - 1, boxHeight - 1)

  // Top border
  canvas[0]![0] = tl
  for (let x = 1; x < boxWidth - 1; x++) canvas[x]![0] = hLine
  canvas[boxWidth - 1]![0] = tr

  // Bottom border
  canvas[0]![boxHeight - 1] = bl
  for (let x = 1; x < boxWidth - 1; x++) canvas[x]![boxHeight - 1] = hLine
  canvas[boxWidth - 1]![boxHeight - 1] = br

  // Left and right borders (full height)
  for (let y = 1; y < boxHeight - 1; y++) {
    canvas[0]![y] = vLine
    canvas[boxWidth - 1]![y] = vLine
  }

  // Render sections with dividers
  let row = 1 // current y position (starts after top border)
  for (let s = 0; s < sections.length; s++) {
    const section = sections[s]!
    const lines = section.length > 0 ? section : ['']

    // Draw section text lines
    for (const line of lines) {
      const startX = 1 + padding
      for (let i = 0; i < line.length; i++) {
        canvas[startX + i]![row] = line[i]!
      }
      row++
    }

    // Draw divider after each section except the last
    if (s < sections.length - 1) {
      canvas[0]![row] = divL
      for (let x = 1; x < boxWidth - 1; x++) canvas[x]![row] = hLine
      canvas[boxWidth - 1]![row] = divR
      row++
    }
  }

  return canvas
}

// ============================================================================
// Line drawing — 8-directional lines on the canvas
// ============================================================================

/**
 * Draw a line between two drawing coordinates.
 * Returns the list of coordinates that were drawn on.
 * offsetFrom/offsetTo control how many cells to skip at the start/end.
 */
export function drawLine(
  canvas: Canvas,
  from: DrawingCoord,
  to: DrawingCoord,
  offsetFrom: number,
  offsetTo: number,
  useAscii: boolean,
): DrawingCoord[] {
  const dir = determineDirection(from, to)
  const drawnCoords: DrawingCoord[] = []

  // Horizontal/vertical/diagonal character pairs: [unicode, ascii]
  const hChar = useAscii ? '-' : '─'
  const vChar = useAscii ? '|' : '│'
  const bslash = useAscii ? '\\' : '╲'
  const fslash = useAscii ? '/' : '╱'

  if (dirEquals(dir, Up)) {
    for (let y = from.y - offsetFrom; y >= to.y - offsetTo; y--) {
      drawnCoords.push({ x: from.x, y })
      canvas[from.x]![y] = vChar
    }
  } else if (dirEquals(dir, Down)) {
    for (let y = from.y + offsetFrom; y <= to.y + offsetTo; y++) {
      drawnCoords.push({ x: from.x, y })
      canvas[from.x]![y] = vChar
    }
  } else if (dirEquals(dir, Left)) {
    for (let x = from.x - offsetFrom; x >= to.x - offsetTo; x--) {
      drawnCoords.push({ x, y: from.y })
      canvas[x]![from.y] = hChar
    }
  } else if (dirEquals(dir, Right)) {
    for (let x = from.x + offsetFrom; x <= to.x + offsetTo; x++) {
      drawnCoords.push({ x, y: from.y })
      canvas[x]![from.y] = hChar
    }
  } else if (dirEquals(dir, UpperLeft)) {
    for (let x = from.x, y = from.y - offsetFrom; x >= to.x - offsetTo && y >= to.y - offsetTo; x--, y--) {
      drawnCoords.push({ x, y })
      canvas[x]![y] = bslash
    }
  } else if (dirEquals(dir, UpperRight)) {
    for (let x = from.x, y = from.y - offsetFrom; x <= to.x + offsetTo && y >= to.y - offsetTo; x++, y--) {
      drawnCoords.push({ x, y })
      canvas[x]![y] = fslash
    }
  } else if (dirEquals(dir, LowerLeft)) {
    for (let x = from.x, y = from.y + offsetFrom; x >= to.x - offsetTo && y <= to.y + offsetTo; x--, y++) {
      drawnCoords.push({ x, y })
      canvas[x]![y] = fslash
    }
  } else if (dirEquals(dir, LowerRight)) {
    for (let x = from.x, y = from.y + offsetFrom; x <= to.x + offsetTo && y <= to.y + offsetTo; x++, y++) {
      drawnCoords.push({ x, y })
      canvas[x]![y] = bslash
    }
  }

  return drawnCoords
}

// ============================================================================
// Arrow drawing — path, corners, arrowheads, box-start junctions, labels
// ============================================================================

/**
 * Draw a complete arrow (edge) between two nodes.
 * Returns 5 separate canvases for layered compositing:
 * [path, boxStart, arrowHead, corners, label]
 */
export function drawArrow(
  graph: AsciiGraph,
  edge: AsciiEdge,
): [Canvas, Canvas, Canvas, Canvas, Canvas] {
  if (edge.path.length === 0) {
    const empty = copyCanvas(graph.canvas)
    return [empty, empty, empty, empty, empty]
  }

  const labelCanvas = drawArrowLabel(graph, edge)
  const [pathCanvas, linesDrawn, lineDirs] = drawPath(graph, edge.path)
  const boxStartCanvas = drawBoxStart(graph, edge.path, linesDrawn[0]!)
  const arrowHeadCanvas = drawArrowHead(
    graph,
    linesDrawn[linesDrawn.length - 1]!,
    lineDirs[lineDirs.length - 1]!,
  )
  const cornersCanvas = drawCorners(graph, edge.path)

  return [pathCanvas, boxStartCanvas, arrowHeadCanvas, cornersCanvas, labelCanvas]
}

/**
 * Draw the path lines for an edge.
 * Returns the canvas, the coordinates drawn for each segment, and the direction of each segment.
 */
function drawPath(
  graph: AsciiGraph,
  path: GridCoord[],
): [Canvas, DrawingCoord[][], Direction[]] {
  const canvas = copyCanvas(graph.canvas)
  let previousCoord = path[0]!
  const linesDrawn: DrawingCoord[][] = []
  const lineDirs: Direction[] = []

  for (let i = 1; i < path.length; i++) {
    const nextCoord = path[i]!
    const prevDC = gridToDrawingCoord(graph, previousCoord)
    const nextDC = gridToDrawingCoord(graph, nextCoord)

    if (drawingCoordEquals(prevDC, nextDC)) {
      previousCoord = nextCoord
      continue
    }

    const dir = determineDirection(previousCoord, nextCoord)
    const segment = drawLine(canvas, prevDC, nextDC, 1, -1, graph.config.useAscii)
    if (segment.length === 0) segment.push(prevDC)
    linesDrawn.push(segment)
    lineDirs.push(dir)
    previousCoord = nextCoord
  }

  return [canvas, linesDrawn, lineDirs]
}

/**
 * Draw the junction character where an edge exits the source node's box.
 * Only applies to Unicode mode (ASCII mode just uses the line characters).
 */
function drawBoxStart(
  graph: AsciiGraph,
  path: GridCoord[],
  firstLine: DrawingCoord[],
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (graph.config.useAscii) return canvas

  const from = firstLine[0]!
  const dir = determineDirection(path[0]!, path[1]!)

  if (dirEquals(dir, Up)) canvas[from.x]![from.y + 1] = '┴'
  else if (dirEquals(dir, Down)) canvas[from.x]![from.y - 1] = '┬'
  else if (dirEquals(dir, Left)) canvas[from.x + 1]![from.y] = '┤'
  else if (dirEquals(dir, Right)) canvas[from.x - 1]![from.y] = '├'

  return canvas
}

/**
 * Draw the arrowhead at the end of an edge path.
 * Uses triangular Unicode symbols (▲▼◄►) or ASCII symbols (^v<>).
 */
function drawArrowHead(
  graph: AsciiGraph,
  lastLine: DrawingCoord[],
  fallbackDir: Direction,
): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (lastLine.length === 0) return canvas

  const from = lastLine[0]!
  const lastPos = lastLine[lastLine.length - 1]!
  let dir = determineDirection(from, lastPos)
  if (lastLine.length === 1 || dirEquals(dir, Middle)) dir = fallbackDir

  let char: string

  if (!graph.config.useAscii) {
    if (dirEquals(dir, Up)) char = '▲'
    else if (dirEquals(dir, Down)) char = '▼'
    else if (dirEquals(dir, Left)) char = '◄'
    else if (dirEquals(dir, Right)) char = '►'
    else if (dirEquals(dir, UpperRight)) char = '◥'
    else if (dirEquals(dir, UpperLeft)) char = '◤'
    else if (dirEquals(dir, LowerRight)) char = '◢'
    else if (dirEquals(dir, LowerLeft)) char = '◣'
    else {
      // Fallback
      if (dirEquals(fallbackDir, Up)) char = '▲'
      else if (dirEquals(fallbackDir, Down)) char = '▼'
      else if (dirEquals(fallbackDir, Left)) char = '◄'
      else if (dirEquals(fallbackDir, Right)) char = '►'
      else if (dirEquals(fallbackDir, UpperRight)) char = '◥'
      else if (dirEquals(fallbackDir, UpperLeft)) char = '◤'
      else if (dirEquals(fallbackDir, LowerRight)) char = '◢'
      else if (dirEquals(fallbackDir, LowerLeft)) char = '◣'
      else char = '●'
    }
  } else {
    if (dirEquals(dir, Up)) char = '^'
    else if (dirEquals(dir, Down)) char = 'v'
    else if (dirEquals(dir, Left)) char = '<'
    else if (dirEquals(dir, Right)) char = '>'
    else {
      if (dirEquals(fallbackDir, Up)) char = '^'
      else if (dirEquals(fallbackDir, Down)) char = 'v'
      else if (dirEquals(fallbackDir, Left)) char = '<'
      else if (dirEquals(fallbackDir, Right)) char = '>'
      else char = '*'
    }
  }

  canvas[lastPos.x]![lastPos.y] = char
  return canvas
}

/**
 * Draw corner characters at path bends (where the direction changes).
 * Uses ┌┐└┘ in Unicode mode, + in ASCII mode.
 */
function drawCorners(graph: AsciiGraph, path: GridCoord[]): Canvas {
  const canvas = copyCanvas(graph.canvas)

  for (let idx = 1; idx < path.length - 1; idx++) {
    const coord = path[idx]!
    const dc = gridToDrawingCoord(graph, coord)
    const prevDir = determineDirection(path[idx - 1]!, coord)
    const nextDir = determineDirection(coord, path[idx + 1]!)

    let corner: string
    if (!graph.config.useAscii) {
      if ((dirEquals(prevDir, Right) && dirEquals(nextDir, Down)) ||
          (dirEquals(prevDir, Up) && dirEquals(nextDir, Left))) {
        corner = '┐'
      } else if ((dirEquals(prevDir, Right) && dirEquals(nextDir, Up)) ||
                 (dirEquals(prevDir, Down) && dirEquals(nextDir, Left))) {
        corner = '┘'
      } else if ((dirEquals(prevDir, Left) && dirEquals(nextDir, Down)) ||
                 (dirEquals(prevDir, Up) && dirEquals(nextDir, Right))) {
        corner = '┌'
      } else if ((dirEquals(prevDir, Left) && dirEquals(nextDir, Up)) ||
                 (dirEquals(prevDir, Down) && dirEquals(nextDir, Right))) {
        corner = '└'
      } else {
        corner = '+'
      }
    } else {
      corner = '+'
    }

    canvas[dc.x]![dc.y] = corner
  }

  return canvas
}

/** Draw edge label text centered on the widest path segment. */
function drawArrowLabel(graph: AsciiGraph, edge: AsciiEdge): Canvas {
  const canvas = copyCanvas(graph.canvas)
  if (edge.text.length === 0) return canvas

  const drawingLine = lineToDrawing(graph, edge.labelLine)
  drawTextOnLine(canvas, drawingLine, edge.text)
  return canvas
}

/** Draw text centered on a line segment defined by two drawing coordinates. */
function drawTextOnLine(canvas: Canvas, line: DrawingCoord[], label: string): void {
  if (line.length < 2) return
  const minX = Math.min(line[0]!.x, line[1]!.x)
  const maxX = Math.max(line[0]!.x, line[1]!.x)
  const minY = Math.min(line[0]!.y, line[1]!.y)
  const maxY = Math.max(line[0]!.y, line[1]!.y)
  const middleX = minX + Math.floor((maxX - minX) / 2)
  const middleY = minY + Math.floor((maxY - minY) / 2)
  const startX = middleX - Math.floor(label.length / 2)
  drawText(canvas, { x: startX, y: middleY }, label)
}

// ============================================================================
// Subgraph drawing
// ============================================================================

/** Draw a subgraph border rectangle. */
export function drawSubgraphBox(sg: AsciiSubgraph, graph: AsciiGraph): Canvas {
  const width = sg.maxX - sg.minX
  const height = sg.maxY - sg.minY
  if (width <= 0 || height <= 0) return mkCanvas(0, 0)

  const from: DrawingCoord = { x: 0, y: 0 }
  const to: DrawingCoord = { x: width, y: height }
  const canvas = mkCanvas(width, height)

  if (!graph.config.useAscii) {
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![from.y] = '─'
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![to.y] = '─'
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x]![y] = '│'
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x]![y] = '│'
    canvas[from.x]![from.y] = '┌'
    canvas[to.x]![from.y] = '┐'
    canvas[from.x]![to.y] = '└'
    canvas[to.x]![to.y] = '┘'
  } else {
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![from.y] = '-'
    for (let x = from.x + 1; x < to.x; x++) canvas[x]![to.y] = '-'
    for (let y = from.y + 1; y < to.y; y++) canvas[from.x]![y] = '|'
    for (let y = from.y + 1; y < to.y; y++) canvas[to.x]![y] = '|'
    canvas[from.x]![from.y] = '+'
    canvas[to.x]![from.y] = '+'
    canvas[from.x]![to.y] = '+'
    canvas[to.x]![to.y] = '+'
  }

  return canvas
}

/** Draw a subgraph label centered in its header area. */
export function drawSubgraphLabel(sg: AsciiSubgraph, graph: AsciiGraph): [Canvas, DrawingCoord] {
  const width = sg.maxX - sg.minX
  const height = sg.maxY - sg.minY
  if (width <= 0 || height <= 0) return [mkCanvas(0, 0), { x: 0, y: 0 }]

  const canvas = mkCanvas(width, height)
  const labelY = 1 // second row inside the subgraph box
  let labelX = Math.floor(width / 2) - Math.floor(sg.name.length / 2)
  if (labelX < 1) labelX = 1

  for (let i = 0; i < sg.name.length; i++) {
    if (labelX + i < width) {
      canvas[labelX + i]![labelY] = sg.name[i]!
    }
  }

  return [canvas, { x: sg.minX, y: sg.minY }]
}

// ============================================================================
// Top-level draw orchestrator
// ============================================================================

/** Sort subgraphs by nesting depth (shallowest first) for correct layered rendering. */
function sortSubgraphsByDepth(subgraphs: AsciiSubgraph[]): AsciiSubgraph[] {
  function getDepth(sg: AsciiSubgraph): number {
    return sg.parent === null ? 0 : 1 + getDepth(sg.parent)
  }
  const sorted = [...subgraphs]
  sorted.sort((a, b) => getDepth(a) - getDepth(b))
  return sorted
}

/**
 * Main draw function — renders the entire graph onto the canvas.
 * Drawing order matters for correct layering:
 * 1. Subgraph borders (bottom layer)
 * 2. Node boxes
 * 3. Edge paths (lines)
 * 4. Edge corners
 * 5. Arrowheads
 * 6. Box-start junctions
 * 7. Edge labels
 * 8. Subgraph labels (top layer)
 */
export function drawGraph(graph: AsciiGraph): Canvas {
  const useAscii = graph.config.useAscii

  // Draw subgraph borders
  const sortedSgs = sortSubgraphsByDepth(graph.subgraphs)
  for (const sg of sortedSgs) {
    const sgCanvas = drawSubgraphBox(sg, graph)
    const offset: DrawingCoord = { x: sg.minX, y: sg.minY }
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, sgCanvas)
  }

  // Draw node boxes
  for (const node of graph.nodes) {
    if (!node.drawn && node.drawingCoord && node.drawing) {
      graph.canvas = mergeCanvases(graph.canvas, node.drawingCoord, useAscii, node.drawing)
      node.drawn = true
    }
  }

  // Collect all edge drawing layers
  const lineCanvases: Canvas[] = []
  const cornerCanvases: Canvas[] = []
  const arrowHeadCanvases: Canvas[] = []
  const boxStartCanvases: Canvas[] = []
  const labelCanvases: Canvas[] = []

  for (const edge of graph.edges) {
    const [pathC, boxStartC, arrowHeadC, cornersC, labelC] = drawArrow(graph, edge)
    lineCanvases.push(pathC)
    cornerCanvases.push(cornersC)
    arrowHeadCanvases.push(arrowHeadC)
    boxStartCanvases.push(boxStartC)
    labelCanvases.push(labelC)
  }

  // Merge edge layers in order
  const zero: DrawingCoord = { x: 0, y: 0 }
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...lineCanvases)
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...cornerCanvases)
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...arrowHeadCanvases)
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...boxStartCanvases)
  graph.canvas = mergeCanvases(graph.canvas, zero, useAscii, ...labelCanvases)

  // Draw subgraph labels last (on top)
  for (const sg of graph.subgraphs) {
    if (sg.nodes.length === 0) continue
    const [labelCanvas, offset] = drawSubgraphLabel(sg, graph)
    graph.canvas = mergeCanvases(graph.canvas, offset, useAscii, labelCanvas)
  }

  return graph.canvas
}
