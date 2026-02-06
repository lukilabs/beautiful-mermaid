// ============================================================================
// ASCII renderer — 2D text canvas
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/draw.go.
// The canvas is a column-major 2D array of single-character strings.
// canvas[x][y] gives the character at column x, row y.
// ============================================================================

import type { Canvas, DrawingCoord } from './types.ts'
import { displayWidth, drawTextWide, WIDE_CHAR_PAD } from './display-width.ts'

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

/** Convert the canvas to a multi-line string (row by row, left to right). */
export function canvasToString(canvas: Canvas): string {
  const [maxX, maxY] = getCanvasSize(canvas)
  const lines: string[] = []
  for (let y = 0; y <= maxY; y++) {
    let line = ''
    for (let x = 0; x <= maxX; x++) {
      // Skip padding cells that follow a wide (CJK) character
      if (canvas[x]![y]! === WIDE_CHAR_PAD) continue
      line += canvas[x]![y]!
    }
    lines.push(line)
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

/** Draw text string onto the canvas starting at the given coordinate. */
export function drawText(canvas: Canvas, start: DrawingCoord, text: string): void {
  increaseSize(canvas, start.x + displayWidth(text), start.y)
  drawTextWide(canvas, start.x, start.y, text)
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
