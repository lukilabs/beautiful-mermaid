// ============================================================================
// Rounded rectangle shape renderer — uses rounded corner decorators
// ============================================================================

import { getCorners } from "./corners.ts";
import {
	getBoxAttachmentPoint,
	getBoxDimensions,
	renderBox,
} from "./rectangle.ts";
import type { ShapeRenderer } from "./types.ts";

/**
 * Rounded rectangle shape renderer.
 * Uses rounded corner markers (╭╮╰╯) to indicate soft edges.
 *
 * Renders as:
 *   ╭─────────╮
 *   │  Label  │
 *   ╰─────────╯
 */
export const roundedRenderer: ShapeRenderer = {
	getDimensions: getBoxDimensions,

	render(label, dimensions, options) {
		const corners = getCorners("rounded", options.useAscii);
		return renderBox(label, dimensions, corners, options.useAscii);
	},

	getAttachmentPoint: getBoxAttachmentPoint,
};
