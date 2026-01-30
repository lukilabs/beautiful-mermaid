// ============================================================================
// ASCII renderer — type definitions
//
// Ported from AlexanderGrooff/mermaid-ascii (Go).
// These types model the grid-based coordinate system, 2D text canvas,
// and graph structures used by the ASCII/Unicode renderer.
// ============================================================================

/** Logical grid coordinate — nodes occupy 3x3 blocks on this grid. */
export interface GridCoord {
  x: number
  y: number
}

/** Character-level coordinate on the 2D text canvas. */
export interface DrawingCoord {
  x: number
  y: number
}

/**
 * Direction constants model positions on a node's 3x3 grid block.
 * Each node occupies grid cells [x..x+2, y..y+2].
 * Directions are offsets into that block, used for edge attachment points.
 *
 *   (0,0) UL   (1,0) Up   (2,0) UR
 *   (0,1) Left (1,1) Mid  (2,1) Right
 *   (0,2) LL   (1,2) Down (2,2) LR
 */
export interface Direction {
  readonly x: number
  readonly y: number
}

export const Up: Direction         = { x: 1, y: 0 }
export const Down: Direction       = { x: 1, y: 2 }
export const Left: Direction       = { x: 0, y: 1 }
export const Right: Direction      = { x: 2, y: 1 }
export const UpperRight: Direction = { x: 2, y: 0 }
export const UpperLeft: Direction  = { x: 0, y: 0 }
export const LowerRight: Direction = { x: 2, y: 2 }
export const LowerLeft: Direction  = { x: 0, y: 2 }
export const Middle: Direction     = { x: 1, y: 1 }

/** All named directions for iteration. */
export const ALL_DIRECTIONS: readonly Direction[] = [
  Up, Down, Left, Right, UpperRight, UpperLeft, LowerRight, LowerLeft, Middle,
]

/**
 * 2D text canvas — column-major (canvas[x][y]).
 * Each cell holds a single character (or space).
 */
export type Canvas = string[][]

/** A node in the ASCII graph, positioned on the grid. */
export interface AsciiNode {
  /** Unique identity key — the original node ID from the parser (e.g. "A", "B"). */
  name: string
  /** Human-readable label for rendering inside the box (e.g. "Web Server"). */
  displayLabel: string
  index: number
  gridCoord: GridCoord | null
  drawingCoord: DrawingCoord | null
  drawing: Canvas | null
  drawn: boolean
  styleClassName: string
  styleClass: AsciiStyleClass
}

/** Style class for colored node text (ported from Go's classDef). */
export interface AsciiStyleClass {
  name: string
  styles: Record<string, string>
}

/** An edge in the ASCII graph, with a routed path. */
export interface AsciiEdge {
  from: AsciiNode
  to: AsciiNode
  text: string
  path: GridCoord[]
  labelLine: GridCoord[]
  startDir: Direction
  endDir: Direction
}

/** A subgraph container with bounding box for rendering. */
export interface AsciiSubgraph {
  name: string
  nodes: AsciiNode[]
  parent: AsciiSubgraph | null
  children: AsciiSubgraph[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Configuration for ASCII rendering. */
export interface AsciiConfig {
  /** true = ASCII chars (+,-,|), false = Unicode box-drawing (┌,─,│). Default: false */
  useAscii: boolean
  /** Horizontal spacing between nodes. Default: 5 */
  paddingX: number
  /** Vertical spacing between nodes. Default: 5 */
  paddingY: number
  /** Padding inside node boxes. Default: 1 */
  boxBorderPadding: number
  /** Preserve zero-width placeholders in output to keep column alignment. Default: false */
  preserveDisplayWidth: boolean
  /** Graph direction: "LR" or "TD". */
  graphDirection: 'LR' | 'TD'
}

/** Full ASCII graph state used during layout and rendering. */
export interface AsciiGraph {
  nodes: AsciiNode[]
  edges: AsciiEdge[]
  canvas: Canvas
  /** Grid occupancy map — maps "x,y" keys to node references. */
  grid: Map<string, AsciiNode>
  columnWidth: Map<number, number>
  rowHeight: Map<number, number>
  subgraphs: AsciiSubgraph[]
  config: AsciiConfig
  /** Offset applied to all drawing coords to accommodate subgraph borders. */
  offsetX: number
  offsetY: number
}

// ============================================================================
// Coordinate helpers
// ============================================================================

export function gridCoordEquals(a: GridCoord, b: GridCoord): boolean {
  return a.x === b.x && a.y === b.y
}

export function drawingCoordEquals(a: DrawingCoord, b: DrawingCoord): boolean {
  return a.x === b.x && a.y === b.y
}

/** Apply a direction offset to a grid coordinate (move into the 3x3 block). */
export function gridCoordDirection(c: GridCoord, dir: Direction): GridCoord {
  return { x: c.x + dir.x, y: c.y + dir.y }
}

/** Key for storing GridCoord in a Map. */
export function gridKey(c: GridCoord): string {
  return `${c.x},${c.y}`
}

/** Default empty style class. */
export const EMPTY_STYLE: AsciiStyleClass = { name: '', styles: {} }
