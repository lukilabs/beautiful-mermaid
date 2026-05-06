// ============================================================================
// ASCII renderer — 2D text canvas
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/draw.go.
// The canvas is a column-major 2D array of single-character strings.
// canvas[x][y] gives the character at column x, row y.
// ============================================================================

import type { Canvas, DrawingCoord, RoleCanvas, CharRole, AsciiTheme, ColorMode } from './types.ts'
import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'
import { displayWidth, drawCJKText, CJK_PAD } from './cjk.ts'

/**
 * Create a blank canvas filled with spaces.
 * Dimensions are inclusive: mkCanvas(3, 2) creates a 4x3 grid (indices 0..3, 0..2).
 */
export function mkCanvas(x: number, y: number): Canvas {
  const canvas: Canvas = []
  for (let i = 0; i <= x; i++) {
    const col: string[] = []
    for (let j = 0; j <= y; j++) {
      col.push(' ')
    }
    canvas.push(col)
  }
  return canvas
}

/** Create a blank canvas with the same dimensions as the given canvas. */
export function copyCanvas(source: Canvas): Canvas {
  const [maxX, maxY] = getCanvasSize(source)
  return mkCanvas(maxX, maxY)
}

// ============================================================================
// Role canvas creation and management
// ============================================================================

/**
 * Create a blank role canvas filled with nulls.
 * Same dimensions as mkCanvas — column-major, roleCanvas[x][y].
 */
export function mkRoleCanvas(x: number, y: number): RoleCanvas {
  const roleCanvas: RoleCanvas = []
  for (let i = 0; i <= x; i++) {
    const col: (CharRole | null)[] = []
    for (let j = 0; j <= y; j++) {
      col.push(null)
    }
    roleCanvas.push(col)
  }
  return roleCanvas
}

/** Create a blank role canvas with the same dimensions as the given role canvas. */
export function copyRoleCanvas(source: RoleCanvas): RoleCanvas {
  const maxX = source.length - 1
  const maxY = (source[0]?.length ?? 1) - 1
  return mkRoleCanvas(maxX, maxY)
}

/**
 * Grow the role canvas to fit at least (newX, newY), preserving existing roles.
 * Mutates the role canvas in place and returns it.
 */
export function increaseRoleCanvasSize(roleCanvas: RoleCanvas, newX: number, newY: number): RoleCanvas {
  const currX = roleCanvas.length - 1
  const currY = (roleCanvas[0]?.length ?? 1) - 1
  const targetX = Math.max(newX, currX)
  const targetY = Math.max(newY, currY)
  const grown = mkRoleCanvas(targetX, targetY)
  for (let x = 0; x < grown.length; x++) {
    for (let y = 0; y < grown[0]!.length; y++) {
      if (x < roleCanvas.length && y < roleCanvas[0]!.length) {
        grown[x]![y] = roleCanvas[x]![y]!
      }
    }
  }
  roleCanvas.length = 0
  roleCanvas.push(...grown)
  return roleCanvas
}

/**
 * Set a role at a specific coordinate.
 * Expands the role canvas if necessary.
 */
export function setRole(roleCanvas: RoleCanvas, x: number, y: number, role: CharRole): void {
  if (x >= roleCanvas.length || y >= (roleCanvas[0]?.length ?? 0)) {
    increaseRoleCanvasSize(roleCanvas, x, y)
  }
  roleCanvas[x]![y] = role
}

/**
 * Merge role canvases — same logic as mergeCanvases but for roles.
 * Non-null roles in overlays overwrite null roles in base.
 */
export function mergeRoleCanvases(
  base: RoleCanvas,
  offset: DrawingCoord,
  ...overlays: RoleCanvas[]
): RoleCanvas {
  let maxX = base.length - 1
  let maxY = (base[0]?.length ?? 1) - 1

  for (const overlay of overlays) {
    const oX = overlay.length - 1
    const oY = (overlay[0]?.length ?? 1) - 1
    maxX = Math.max(maxX, oX + offset.x)
    maxY = Math.max(maxY, oY + offset.y)
  }

  const merged = mkRoleCanvas(maxX, maxY)

  // Copy base
  for (let x = 0; x <= maxX; x++) {
    for (let y = 0; y <= maxY; y++) {
      if (x < base.length && y < base[0]!.length) {
        merged[x]![y] = base[x]![y]!
      }
    }
  }

  // Apply overlays
  for (const overlay of overlays) {
    for (let x = 0; x < overlay.length; x++) {
      for (let y = 0; y < overlay[0]!.length; y++) {
        const role = overlay[x]?.[y]
        if (role !== null && role !== undefined) {
          const mx = x + offset.x
          const my = y + offset.y
          merged[mx]![my] = role
        }
      }
    }
  }

  return merged
}

/** Returns [maxX, maxY] — the highest valid indices in each dimension. */
export function getCanvasSize(canvas: Canvas): [number, number] {
  return [canvas.length - 1, (canvas[0]?.length ?? 1) - 1]
}

/**
 * Grow the canvas to fit at least (newX, newY), preserving existing content.
 * Mutates the canvas in place and returns it.
 */
export function increaseSize(canvas: Canvas, newX: number, newY: number): Canvas {
  const [currX, currY] = getCanvasSize(canvas)
  const targetX = Math.max(newX, currX)
  const targetY = Math.max(newY, currY)
  const grown = mkCanvas(targetX, targetY)
  for (let x = 0; x < grown.length; x++) {
    for (let y = 0; y < grown[0]!.length; y++) {
      if (x < canvas.length && y < canvas[0]!.length) {
        grown[x]![y] = canvas[x]![y]!
      }
    }
  }
  // Mutate in place: splice old contents and replace with grown
  canvas.length = 0
  canvas.push(...grown)
  return canvas
}

// ============================================================================
// Junction merging — Unicode box-drawing character compositing
// ============================================================================

/** All Unicode box-drawing characters that participate in junction merging. */
const JUNCTION_CHARS = new Set([
  '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '╴', '╵', '╶', '╷',
])

export function isJunctionChar(c: string): boolean {
  return JUNCTION_CHARS.has(c)
}

/** Check if a character is alphanumeric (part of a label). */
function isAlphanumeric(c: string): boolean {
  return /^[a-zA-Z0-9]$/.test(c)
}

/**
 * When two junction characters overlap during canvas merging,
 * resolve them to the correct combined junction.
 * E.g., '─' overlapping '│' becomes '┼'.
 */
const JUNCTION_MAP: Record<string, Record<string, string>> = {
  '─': { '│': '┼', '┌': '┬', '┐': '┬', '└': '┴', '┘': '┴', '├': '┼', '┤': '┼', '┬': '┬', '┴': '┴' },
  '│': { '─': '┼', '┌': '├', '┐': '┤', '└': '├', '┘': '┤', '├': '├', '┤': '┤', '┬': '┼', '┴': '┼' },
  '┌': { '─': '┬', '│': '├', '┐': '┬', '└': '├', '┘': '┼', '├': '├', '┤': '┼', '┬': '┬', '┴': '┼' },
  '┐': { '─': '┬', '│': '┤', '┌': '┬', '└': '┼', '┘': '┤', '├': '┼', '┤': '┤', '┬': '┬', '┴': '┼' },
  '└': { '─': '┴', '│': '├', '┌': '├', '┐': '┼', '┘': '┴', '├': '├', '┤': '┼', '┬': '┼', '┴': '┴' },
  '┘': { '─': '┴', '│': '┤', '┌': '┼', '┐': '┤', '└': '┴', '├': '┼', '┤': '┤', '┬': '┼', '┴': '┴' },
  '├': { '─': '┼', '│': '├', '┌': '├', '┐': '┼', '└': '├', '┘': '┼', '┤': '┼', '┬': '┼', '┴': '┼' },
  '┤': { '─': '┼', '│': '┤', '┌': '┼', '┐': '┤', '└': '┼', '┘': '┤', '├': '┼', '┬': '┼', '┴': '┼' },
  '┬': { '─': '┬', '│': '┼', '┌': '┬', '┐': '┬', '└': '┼', '┘': '┼', '├': '┼', '┤': '┼', '┴': '┼' },
  '┴': { '─': '┴', '│': '┼', '┌': '┼', '┐': '┼', '└': '┴', '┘': '┴', '├': '┼', '┤': '┼', '┬': '┼' },
}

export function mergeJunctions(c1: string, c2: string): string {
  return JUNCTION_MAP[c1]?.[c2] ?? c1
}

// ============================================================================
// Canvas merging — composite multiple canvases with offset
// ============================================================================

/**
 * Merge overlay canvases onto a base canvas at the given offset.
 * Non-space characters in overlays overwrite the base.
 * When both characters are Unicode junction chars, they're merged intelligently.
 */
export function mergeCanvases(
  base: Canvas,
  offset: DrawingCoord,
  useAscii: boolean,
  ...overlays: Canvas[]
): Canvas {
  let [maxX, maxY] = getCanvasSize(base)
  for (const overlay of overlays) {
    const [oX, oY] = getCanvasSize(overlay)
    maxX = Math.max(maxX, oX + offset.x)
    maxY = Math.max(maxY, oY + offset.y)
  }

  const merged = mkCanvas(maxX, maxY)

  // Copy base
  for (let x = 0; x <= maxX; x++) {
    for (let y = 0; y <= maxY; y++) {
      if (x < base.length && y < base[0]!.length) {
        merged[x]![y] = base[x]![y]!
      }
    }
  }

  // Apply overlays
  for (const overlay of overlays) {
    for (let x = 0; x < overlay.length; x++) {
      for (let y = 0; y < overlay[0]!.length; y++) {
        const c = overlay[x]![y]!
        if (c !== ' ') {
          const mx = x + offset.x
          const my = y + offset.y
          const current = merged[mx]![my]!
          if (!useAscii && isJunctionChar(c) && isJunctionChar(current)) {
            merged[mx]![my] = mergeJunctions(current, c)
          } else if (isAlphanumeric(current) && isAlphanumeric(c)) {
            // Don't overwrite existing label text with new label text
            // This prevents label collisions (first label wins)
          } else {
            merged[mx]![my] = c
          }
        }
      }
    }
  }

  return merged
}

// ============================================================================
// Canvas → string conversion
// ============================================================================

/** Options for converting canvas to string with optional coloring. */
export interface CanvasToStringOptions {
  /** Role canvas for applying colors. If not provided, output is plain text. */
  roleCanvas?: RoleCanvas
  /** Color mode for terminal output. Default: 'none' */
  colorMode?: ColorMode
  /** Theme colors for ASCII output. Uses default theme if not provided. */
  theme?: AsciiTheme
}

/**
 * Convert the canvas to a multi-line string (row by row, left to right).
 * Optionally applies ANSI color codes based on character roles.
 */
export function canvasToString(canvas: Canvas, options?: CanvasToStringOptions): string {
  const [maxX, maxY] = getCanvasSize(canvas)
  const lines: string[] = []

  const roleCanvas = options?.roleCanvas
  const colorMode = options?.colorMode ?? 'none'
  const theme = options?.theme ?? DEFAULT_ASCII_THEME

  for (let y = 0; y <= maxY; y++) {
    if (colorMode === 'none' || !roleCanvas) {
      // Plain text output — no colors
      let line = ''
      for (let x = 0; x <= maxX; x++) {
        if (canvas[x]![y]! === CJK_PAD) continue
        line += canvas[x]![y]!
      }
      lines.push(line)
    } else {
      // Colored output — collect chars and roles for this row
      const chars: string[] = []
      const roles: (CharRole | null)[] = []
      for (let x = 0; x <= maxX; x++) {
        if (canvas[x]![y]! === CJK_PAD) continue
        chars.push(canvas[x]![y]!)
        roles.push(roleCanvas[x]?.[y] ?? null)
      }
      lines.push(colorizeLine(chars, roles, theme, colorMode))
    }
  }

  return lines.join('\n')
}

// ============================================================================
// Canvas vertical flip — used for BT (bottom-to-top) direction support.
//
// The ASCII renderer lays out graphs top-down (TD). For BT direction, we
// flip the finished canvas vertically and remap directional characters so
// arrows point upward and corners are mirrored correctly.
// ============================================================================

/**
 * Characters that change meaning when the Y-axis is flipped.
 * Symmetric characters (─, │, ├, ┤, ┼) are unchanged.
 */
const VERTICAL_FLIP_MAP: Record<string, string> = {
  // Unicode arrows
  '▲': '▼', '▼': '▲',
  '◤': '◣', '◣': '◤',
  '◥': '◢', '◢': '◥',
  // ASCII arrows
  '^': 'v', 'v': '^',
  // Unicode corners
  '┌': '└', '└': '┌',
  '┐': '┘', '┘': '┐',
  // Unicode junctions (T-pieces flip vertically)
  '┬': '┴', '┴': '┬',
  // Box-start junctions (exit points from node boxes)
  '╵': '╷', '╷': '╵',
}

/**
 * Flip the canvas vertically (mirror across the horizontal center).
 * Reverses row order within each column and remaps directional characters
 * (arrows, corners, junctions) so they point the correct way after flip.
 *
 * Used to transform a TD-rendered canvas into BT output.
 * Mutates the canvas in place and returns it.
 */
export function flipCanvasVertically(canvas: Canvas): Canvas {
  // Reverse each column array (Y-axis flip in column-major layout)
  for (const col of canvas) {
    col.reverse()
  }

  // Remap directional characters that change meaning after vertical flip
  for (const col of canvas) {
    for (let y = 0; y < col.length; y++) {
      const flipped = VERTICAL_FLIP_MAP[col[y]!]
      if (flipped) col[y] = flipped
    }
  }

  return canvas
}

/**
 * Flip the role canvas vertically to match flipCanvasVertically.
 * Mutates the role canvas in place and returns it.
 */
export function flipRoleCanvasVertically(roleCanvas: RoleCanvas): RoleCanvas {
  for (const col of roleCanvas) {
    col.reverse()
  }
  return roleCanvas
}

/**
 * Draw text string onto the canvas starting at the given coordinate.
 * By default, preserves existing non-space characters (labels don't overwrite each other).
 * Set forceOverwrite=true to always overwrite (for box content).
 */
export function drawText(
  canvas: Canvas,
  start: DrawingCoord,
  text: string,
  forceOverwrite = false
): void {
  increaseSize(canvas, start.x + displayWidth(text), start.y)
  drawCJKText(canvas, start.x, start.y, text, forceOverwrite)
}

/**
 * Set the canvas size to fit all grid columns and rows.
 * Called after layout to ensure the canvas covers the full drawing area.
 */
export function setCanvasSizeToGrid(
  canvas: Canvas,
  columnWidth: Map<number, number>,
  rowHeight: Map<number, number>,
): void {
  let maxX = 0
  let maxY = 0
  for (const w of columnWidth.values()) maxX += w
  for (const h of rowHeight.values()) maxY += h
  increaseSize(canvas, maxX - 1, maxY - 1)
}

/**
 * Set the role canvas size to match the grid dimensions.
 * Should be called alongside setCanvasSizeToGrid.
 */
export function setRoleCanvasSizeToGrid(
  roleCanvas: RoleCanvas,
  columnWidth: Map<number, number>,
  rowHeight: Map<number, number>,
): void {
  let maxX = 0
  let maxY = 0
  for (const w of columnWidth.values()) maxX += w
  for (const h of rowHeight.values()) maxY += h
  increaseRoleCanvasSize(roleCanvas, maxX - 1, maxY - 1)
}
