// ============================================================================
// ASCII renderer — multi-line text utilities
//
// Shared utilities for handling multi-line labels (containing \n from <br> tags)
// in ASCII/Unicode rendering. Provides consistent text splitting, sizing, and
// centered rendering across all diagram types.
// ============================================================================

import type { Canvas } from './types.ts'
import { drawText } from './canvas.ts'

/**
 * Split a label into lines.
 * Labels are already normalized by parsers (br tags → \n).
 */
export function splitLines(label: string): string[] {
  return label.split('\n')
}

/**
 * Return the terminal column width of a single character.
 * CJK and other fullwidth Unicode code points occupy 2 columns;
 * all other characters occupy 1.
 */
export function charVisualWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    code >= 0x20000
  ) ? 2 : 1
}

/**
 * Return the total terminal column width of a string.
 * Each fullwidth (CJK) character counts as 2 columns.
 */
export function visualWidth(str: string): number {
  let w = 0
  for (const ch of str) w += charVisualWidth(ch)
  return w
}

/**
 * Get the maximum line width for sizing calculations.
 * Uses visual (terminal column) width so CJK characters are measured correctly.
 */
export function maxLineWidth(label: string): number {
  const lines = splitLines(label)
  return Math.max(...lines.map(l => visualWidth(l)), 0)
}

/**
 * Get the number of lines for height calculations.
 * Used to determine row heights for multi-line labels.
 */
export function lineCount(label: string): number {
  return splitLines(label).length
}

/**
 * Draw multi-line text centered at (cx, cy).
 * Expands vertically from the center point.
 * Each line is horizontally centered independently.
 */
export function drawMultilineTextCentered(
  canvas: Canvas,
  label: string,
  cx: number,
  cy: number
): void {
  const lines = splitLines(label)
  const totalHeight = lines.length
  // Center vertically: start y positions lines evenly around cy
  const startY = cy - Math.floor((totalHeight - 1) / 2)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Center each line horizontally using visual (column) width for CJK support
    const startX = cx - Math.floor(visualWidth(line) / 2)
    // Force overwrite for node labels (they take priority)
    drawText(canvas, { x: startX, y: startY + i }, line, true)
  }
}

/**
 * Draw multi-line text left-aligned starting at (x, y).
 * Each subsequent line is placed one row below.
 */
export function drawMultilineTextLeft(
  canvas: Canvas,
  label: string,
  x: number,
  y: number
): void {
  const lines = splitLines(label)
  for (let i = 0; i < lines.length; i++) {
    // Force overwrite for node labels (they take priority)
    drawText(canvas, { x, y: y + i }, lines[i]!, true)
  }
}
