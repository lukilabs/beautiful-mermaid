// ============================================================================
// Hexagon shape renderer — uses corner decorators instead of diagonals
// ============================================================================

import { getCorners } from './corners.ts'
import { getBoxAttachmentPoint, getBoxDimensions, renderBox } from './rectangle.ts'
import type { ShapeRenderer } from './types.ts'

/**
 * Hexagon shape renderer.
 * Uses hexagon markers (⬡) at corners to indicate process node semantics.
 *
 * Renders as:
 *   ⬡─────────⬡
 *   │  Label  │
 *   ⬡─────────⬡
 */
export const hexagonRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('hexagon', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
