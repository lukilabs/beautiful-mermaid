/** Half-width of the arc drawn at a hop-over crossing. */
export const HOP_RADIUS = 5

/** Maximum bump height of the hop-over arc above the segment. */
export const HOP_HEIGHT = 10

/** Distance from segment endpoint inside which a crossing is filtered out (avoids drawing hops too close to a node boundary). */
export const HOP_ENDPOINT_PAD = HOP_RADIUS + 1

/**
 * Coordinate-equality tolerance. Two coordinates within this distance are
 * treated as equal — used to decide if a segment is axis-aligned (`|dy| <
 * TOLERANCE` ⇒ horizontal), if two points coincide (vertex deduplication),
 * and if a crossing falls inside a segment's interior. Value ≈ half a pixel.
 */
export const COORDINATE_EQUALITY_TOLERANCE = 0.5
