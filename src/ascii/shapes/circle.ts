// ============================================================================
// Circle shape renderer — uses corner decorators instead of curves
// ============================================================================

import { getCorners } from './corners.ts'
import { getBoxAttachmentPoint, getBoxDimensions, renderBox } from './rectangle.ts'
import type { ShapeRenderer } from './types.ts'

/**
 * Circle shape renderer.
 * Uses circle markers (◯) at corners to indicate circular shape semantics.
 *
 * Renders as:
 *   ◯─────────◯
 *   │  Label  │
 *   ◯─────────◯
 */
export const circleRenderer: ShapeRenderer = {
  getDimensions: getBoxDimensions,

  render(label, dimensions, options) {
    const corners = getCorners('circle', options.useAscii)
    return renderBox(label, dimensions, corners, options.useAscii)
  },

  getAttachmentPoint: getBoxAttachmentPoint,
}
