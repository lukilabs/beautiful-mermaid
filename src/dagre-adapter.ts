// ============================================================================
// Dagre layout adapter utilities
//
// Shared helpers for converting dagre's center-based coordinate system
// to top-left coordinates, and for post-processing edge paths (orthogonal
// snapping and node-boundary clipping).
//
// Used by C4 and ArchiMate layout engines.
// ============================================================================

interface Point {
	x: number;
	y: number;
}

/**
 * Convert dagre's center-based coordinates to top-left origin.
 * Dagre positions nodes by their center point; renderers need top-left.
 */
export function centerToTopLeft(
	cx: number,
	cy: number,
	width: number,
	height: number,
): Point {
	return { x: cx - width / 2, y: cy - height / 2 };
}

/**
 * Snap a polyline to orthogonal (axis-aligned) segments.
 *
 * Dagre produces edge paths with slight diagonal drift. This function
 * forces each segment to be either horizontal or vertical by inserting
 * a bend point between consecutive points that aren't axis-aligned.
 *
 * @param points - Raw edge points from dagre
 * @param verticalFirst - If true, route vertical then horizontal (TB/BT layouts).
 *                        If false, route horizontal then vertical (LR/RL layouts).
 */
export function snapToOrthogonal(
	points: Point[],
	verticalFirst: boolean,
): Point[] {
	if (points.length < 2) return points;

	const result: Point[] = [points[0]!];

	for (let i = 1; i < points.length; i++) {
		const prev = result[result.length - 1]!;
		const curr = points[i]!;

		const dx = Math.abs(curr.x - prev.x);
		const dy = Math.abs(curr.y - prev.y);

		// Already axis-aligned (within tolerance)
		if (dx < 1 || dy < 1) {
			result.push(curr);
			continue;
		}

		// Insert a bend point to make the path orthogonal
		if (verticalFirst) {
			// Go vertical first, then horizontal
			result.push({ x: prev.x, y: curr.y });
		} else {
			// Go horizontal first, then vertical
			result.push({ x: curr.x, y: prev.y });
		}
		result.push(curr);
	}

	return result;
}

interface NodeRect {
	cx: number;
	cy: number;
	hw: number; // half-width
	hh: number; // half-height
}

/**
 * Clip the first and last points of an edge path to the boundaries
 * of the source and target node rectangles.
 *
 * Dagre routes edges from/to node centers. This function moves the
 * endpoints to the nearest intersection with the node's bounding box,
 * so arrows start/end at the node border rather than the center.
 */
export function clipEndpointsToNodes(
	points: Point[],
	srcNode: NodeRect | null,
	tgtNode: NodeRect | null,
): Point[] {
	if (points.length < 2) return points;

	const result = [...points];

	if (srcNode && result.length >= 2) {
		const clipped = clipPointToRect(result[0]!, result[1]!, srcNode);
		if (clipped) result[0] = clipped;
	}

	if (tgtNode && result.length >= 2) {
		const last = result.length - 1;
		const clipped = clipPointToRect(result[last]!, result[last - 1]!, tgtNode);
		if (clipped) result[last] = clipped;
	}

	return result;
}

/**
 * Find where a line from `inner` toward `outer` intersects a rectangle
 * centered at (rect.cx, rect.cy) with half-dimensions (rect.hw, rect.hh).
 *
 * Returns the intersection point, or null if the inner point is already
 * outside the rectangle.
 */
function clipPointToRect(
	inner: Point,
	outer: Point,
	rect: NodeRect,
): Point | null {
	const dx = outer.x - inner.x;
	const dy = outer.y - inner.y;

	if (dx === 0 && dy === 0) return null;

	// Check each edge of the rectangle for intersection
	const candidates: Point[] = [];

	// Right edge
	if (dx !== 0) {
		const t = (rect.cx + rect.hw - inner.x) / dx;
		if (t >= 0 && t <= 1) {
			const y = inner.y + t * dy;
			if (y >= rect.cy - rect.hh && y <= rect.cy + rect.hh) {
				candidates.push({ x: rect.cx + rect.hw, y });
			}
		}
	}

	// Left edge
	if (dx !== 0) {
		const t = (rect.cx - rect.hw - inner.x) / dx;
		if (t >= 0 && t <= 1) {
			const y = inner.y + t * dy;
			if (y >= rect.cy - rect.hh && y <= rect.cy + rect.hh) {
				candidates.push({ x: rect.cx - rect.hw, y });
			}
		}
	}

	// Bottom edge
	if (dy !== 0) {
		const t = (rect.cy + rect.hh - inner.y) / dy;
		if (t >= 0 && t <= 1) {
			const x = inner.x + t * dx;
			if (x >= rect.cx - rect.hw && x <= rect.cx + rect.hw) {
				candidates.push({ x, y: rect.cy + rect.hh });
			}
		}
	}

	// Top edge
	if (dy !== 0) {
		const t = (rect.cy - rect.hh - inner.y) / dy;
		if (t >= 0 && t <= 1) {
			const x = inner.x + t * dx;
			if (x >= rect.cx - rect.hw && x <= rect.cx + rect.hw) {
				candidates.push({ x, y: rect.cy - rect.hh });
			}
		}
	}

	if (candidates.length === 0) return null;

	// Return the candidate closest to the outer point
	let best = candidates[0]!;
	let bestDist = (best.x - outer.x) ** 2 + (best.y - outer.y) ** 2;
	for (let i = 1; i < candidates.length; i++) {
		const c = candidates[i]!;
		const d = (c.x - outer.x) ** 2 + (c.y - outer.y) ** 2;
		if (d < bestDist) {
			best = c;
			bestDist = d;
		}
	}

	return best;
}
