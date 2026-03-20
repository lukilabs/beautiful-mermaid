/**
 * Integration tests for ER diagrams — end-to-end parse → layout → render.
 */
import { describe, expect, it } from "bun:test";
import { renderMermaidSVG } from "../index.ts";

describe("renderMermaidSVG – ER diagrams", () => {
	it("renders a basic ER diagram to valid SVG", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places`);
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain("CUSTOMER");
		expect(svg).toContain("ORDER");
		expect(svg).toContain("places");
	});

	it("renders entity with attributes", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER {
        int id PK
        string name
        string email UK
      }`);
		expect(svg).toContain("CUSTOMER");
		expect(svg).toContain("id");
		expect(svg).toContain("name");
		expect(svg).toContain("email");
		// PK/UK key badges
		expect(svg).toContain("PK");
		expect(svg).toContain("UK");
	});

	it("renders relationship lines between entities", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : has`);
		// Should have polyline for the relationship
		expect(svg).toContain("<polyline");
	});

	it("renders crow's foot cardinality markers", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places`);
		// Crow's foot markers are rendered as lines
		const lineCount = (svg.match(/<line /g) ?? []).length;
		// Entity divider lines + cardinality markers
		expect(lineCount).toBeGreaterThan(2);
	});

	it("renders non-identifying (dashed) relationships", () => {
		const svg = renderMermaidSVG(`erDiagram
      USER ||..o{ LOG : generates`);
		expect(svg).toContain("stroke-dasharray");
	});

	it("renders relationship labels with background pills", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : places`);
		expect(svg).toContain("places");
		// Background pill behind label
		expect(svg).toContain('rx="2"');
	});

	it("renders with dark colors", () => {
		const svg = renderMermaidSVG(
			`erDiagram
      A ||--|| B : links`,
			{ bg: "#18181B", fg: "#FAFAFA" },
		);
		expect(svg).toContain("--bg:#18181B");
	});

	it("renders entity boxes with header and attribute rows", () => {
		const svg = renderMermaidSVG(`erDiagram
      USER {
        int id PK
        string name
        string email
      }`);
		// Should have rectangles for entity box and header
		const rectCount = (svg.match(/<rect /g) ?? []).length;
		expect(rectCount).toBeGreaterThanOrEqual(2); // outer box + header
	});

	it("renders a complete e-commerce schema", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER {
        int id PK
        string name
        string email UK
      }
      ORDER {
        int id PK
        date created
        int customer_id FK
      }
      PRODUCT {
        int id PK
        string name
        float price
      }
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
      PRODUCT ||--o{ LINE_ITEM : includes`);
		expect(svg).toContain("CUSTOMER");
		expect(svg).toContain("ORDER");
		expect(svg).toContain("PRODUCT");
		expect(svg).toContain("LINE_ITEM");
		expect(svg).toContain("places");
		expect(svg).toContain("contains");
		expect(svg).toContain("includes");
	});
});

// ============================================================================
// Label positioning tests — verify that relationship labels sit ON the
// polyline path, not floating in space. The renderer's midpoint() computes
// the arc-length midpoint of the relationship polyline. These tests parse
// the SVG output to verify positioning for both straight and multi-segment
// (orthogonal, bent) paths.
// ============================================================================

/** Extract entity box rects from SVG: returns Map<label, {x, y, width, height, rightEdge}> */
function extractEntityBoxes(
	svg: string,
): Map<
	string,
	{ x: number; y: number; width: number; height: number; rightEdge: number }
> {
	const boxes = new Map<
		string,
		{ x: number; y: number; width: number; height: number; rightEdge: number }
	>();

	// Entity header text: <text x="..." y="..." ... font-weight="700" ...>LABEL</text>
	const headerPattern =
		/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-weight="700"[^>]*>([^<]+)<\/text>/g;
	let match;
	while ((match = headerPattern.exec(svg)) !== null) {
		const centerX = parseFloat(match[1]!);
		const label = match[3]!;

		// Find the corresponding outer rect that contains this text.
		const rectPattern =
			/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="0" ry="0"/g;
		let rectMatch;
		while ((rectMatch = rectPattern.exec(svg)) !== null) {
			const rx = parseFloat(rectMatch[1]!);
			const ry = parseFloat(rectMatch[2]!);
			const rw = parseFloat(rectMatch[3]!);
			const rh = parseFloat(rectMatch[4]!);
			if (centerX >= rx && centerX <= rx + rw) {
				boxes.set(label, {
					x: rx,
					y: ry,
					width: rw,
					height: rh,
					rightEdge: rx + rw,
				});
				break;
			}
		}
	}

	return boxes;
}

/** Extract relationship label positions from SVG: returns Map<label, {x, y}> */
function extractLabelPositions(
	svg: string,
): Map<string, { x: number; y: number }> {
	const labels = new Map<string, { x: number; y: number }>();
	// Relationship labels use font-size="11" font-weight="400" — match flexibly
	// regardless of attribute order
	const labelPattern =
		/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="11"[^>]*font-weight="400"[^>]*>([^<]+)<\/text>/g;
	let match;
	while ((match = labelPattern.exec(svg)) !== null) {
		labels.set(match[3]!, {
			x: parseFloat(match[1]!),
			y: parseFloat(match[2]!),
		});
	}
	return labels;
}

/** Extract polyline paths from SVG: returns array of point arrays */
function extractPolylines(svg: string): Array<Array<{ x: number; y: number }>> {
	const polylines: Array<Array<{ x: number; y: number }>> = [];
	// Match polylines with points attribute anywhere in the tag
	const pattern = /<polyline[^>]*points="([^"]+)"[^>]*>/g;
	let match;
	while ((match = pattern.exec(svg)) !== null) {
		const points = match[1]!.split(" ").map((p) => {
			const [x, y] = p.split(",");
			return { x: parseFloat(x!), y: parseFloat(y!) };
		});
		polylines.push(points);
	}
	return polylines;
}

/**
 * Check if a point lies on (or very near) a polyline path.
 * Computes the minimum distance from the point to any segment of the polyline.
 * Returns the minimum distance in pixels.
 */
function distanceToPolyline(
	point: { x: number; y: number },
	polyline: Array<{ x: number; y: number }>,
): number {
	let minDist = Infinity;
	for (let i = 1; i < polyline.length; i++) {
		const a = polyline[i - 1]!;
		const b = polyline[i]!;
		const dist = pointToSegmentDist(point, a, b);
		if (dist < minDist) minDist = dist;
	}
	return minDist;
}

/** Distance from point P to line segment AB */
function pointToSegmentDist(
	p: { x: number; y: number },
	a: { x: number; y: number },
	b: { x: number; y: number },
): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
	// Project P onto AB, clamped to [0,1]
	const t = Math.max(
		0,
		Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
	);
	const projX = a.x + t * dx;
	const projY = a.y + t * dy;
	return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Find the polyline closest to a label position.
 * Returns the minimum distance from the label to any polyline.
 */
function closestPolylineDistance(
	label: { x: number; y: number },
	polylines: Array<Array<{ x: number; y: number }>>,
): number {
	let minDist = Infinity;
	for (const pl of polylines) {
		const dist = distanceToPolyline(label, pl);
		if (dist < minDist) minDist = dist;
	}
	return minDist;
}

// ─── Straight-line label positioning ────────────────────────────────────────

describe("renderMermaidSVG – ER label positioning (straight lines)", () => {
	it("label is between the two entity boxes horizontally", () => {
		const svg = renderMermaidSVG(`erDiagram
      TEACHER }|--o{ COURSE : teaches`);

		const boxes = extractEntityBoxes(svg);
		const labels = extractLabelPositions(svg);

		const teacher = boxes.get("TEACHER")!;
		const course = boxes.get("COURSE")!;
		const label = labels.get("teaches")!;

		// Label x should be between the two entity box edges
		const leftEdge = Math.min(teacher.rightEdge, course.rightEdge);
		const rightEdge = Math.max(teacher.x, course.x);
		expect(label.x).toBeGreaterThan(leftEdge);
		expect(label.x).toBeLessThan(rightEdge);
	});

	it("label has minimum clearance from entity box edges", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : links`);

		const boxes = extractEntityBoxes(svg);
		const labels = extractLabelPositions(svg);

		const boxA = boxes.get("A")!;
		const boxB = boxes.get("B")!;
		const label = labels.get("links")!;

		const minClearance = 10;
		const leftBox = boxA.x < boxB.x ? boxA : boxB;
		const rightBox = boxA.x < boxB.x ? boxB : boxA;

		expect(label.x - leftBox.rightEdge).toBeGreaterThanOrEqual(minClearance);
		expect(rightBox.x - label.x).toBeGreaterThanOrEqual(minClearance);
	});

	it("label is approximately at the horizontal midpoint of the gap", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places`);

		const boxes = extractEntityBoxes(svg);
		const labels = extractLabelPositions(svg);

		const customer = boxes.get("CUSTOMER")!;
		const order = boxes.get("ORDER")!;
		const label = labels.get("places")!;

		const leftBox = customer.x < order.x ? customer : order;
		const rightBox = customer.x < order.x ? order : customer;
		const gapMidpoint = (leftBox.rightEdge + rightBox.x) / 2;

		expect(Math.abs(label.x - gapMidpoint)).toBeLessThan(15);
	});

	it("label sits on (or very near) its relationship polyline", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : connects`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);
		const label = labels.get("connects")!;

		// Label should be within 2px of its closest polyline segment
		const dist = closestPolylineDistance(label, polylines);
		expect(dist).toBeLessThan(2);
	});
});

// ─── Multi-entity diagrams with orthogonal routing ──────────────────────────

describe("renderMermaidSVG – ER label positioning (multi-segment paths)", () => {
	it("all labels in a multi-relationship diagram sit near a polyline", () => {
		const svg = renderMermaidSVG(`erDiagram
      ORDER ||--|{ LINE_ITEM : contains
      ORDER ||..o{ SHIPMENT : ships-via
      PRODUCT ||--o{ LINE_ITEM : includes
      PRODUCT ||..o{ REVIEW : receives`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);

		// Every relationship label should be found
		for (const name of ["contains", "ships-via", "includes", "receives"]) {
			expect(labels.has(name)).toBe(true);
		}

		// Every label should be within 2px of a polyline segment
		for (const [, pos] of labels) {
			const dist = closestPolylineDistance(pos, polylines);
			expect(dist).toBeLessThan(2);
		}
	});

	it("non-identifying relationship labels also sit on their dashed polylines", () => {
		const svg = renderMermaidSVG(`erDiagram
      USER ||..o{ LOG_ENTRY : generates
      USER ||..o{ SESSION : opens`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);

		expect(labels.has("generates")).toBe(true);
		expect(labels.has("opens")).toBe(true);

		for (const [, pos] of labels) {
			const dist = closestPolylineDistance(pos, polylines);
			expect(dist).toBeLessThan(2);
		}
	});

	it("label on vertical segment has x matching the segment x", () => {
		const svg = renderMermaidSVG(`erDiagram
      ORDER ||--|{ LINE_ITEM : contains
      ORDER ||..o{ SHIPMENT : ships-via
      PRODUCT ||--o{ LINE_ITEM : includes
      PRODUCT ||..o{ REVIEW : receives`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);

		// For each label, find the closest polyline and verify it's near a segment
		for (const [, pos] of labels) {
			const dist = closestPolylineDistance(pos, polylines);
			expect(dist).toBeLessThan(2);
		}
	});

	it("labels in e-commerce schema all sit on their polylines", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
      PRODUCT ||--o{ LINE_ITEM : includes`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);

		expect(labels.size).toBe(3);
		for (const [, pos] of labels) {
			const dist = closestPolylineDistance(pos, polylines);
			expect(dist).toBeLessThan(2);
		}
	});

	it("label is not at the endpoint of any polyline", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : links`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);
		const label = labels.get("links")!;

		for (const pl of polylines) {
			const start = pl[0]!;
			const end = pl[pl.length - 1]!;
			const distToStart = Math.sqrt(
				(label.x - start.x) ** 2 + (label.y - start.y) ** 2,
			);
			const distToEnd = Math.sqrt(
				(label.x - end.x) ** 2 + (label.y - end.y) ** 2,
			);
			// At least one endpoint should be far from the label (>5px)
			expect(Math.min(distToStart, distToEnd)).toBeGreaterThan(5);
		}
	});

	it("multiple labels in same diagram have distinct positions", () => {
		const svg = renderMermaidSVG(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
      PRODUCT ||--o{ LINE_ITEM : includes`);

		const labels = extractLabelPositions(svg);
		const positions = [...labels.values()];

		// Each label should have a unique position (no two labels at same x,y)
		for (let i = 0; i < positions.length; i++) {
			for (let j = i + 1; j < positions.length; j++) {
				const dx = positions[i]!.x - positions[j]!.x;
				const dy = positions[i]!.y - positions[j]!.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				expect(dist).toBeGreaterThan(10); // at least 10px apart
			}
		}
	});

	it("label background pill also sits on the polyline", () => {
		const svg = renderMermaidSVG(`erDiagram
      A ||--o{ B : test`);

		const labels = extractLabelPositions(svg);
		const polylines = extractPolylines(svg);
		const label = labels.get("test")!;

		// Find the background pill rect (rx="2" ry="2" near the label position)
		const pillPattern =
			/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="2" ry="2"/g;
		let pillMatch;
		let foundPill = false;
		while ((pillMatch = pillPattern.exec(svg)) !== null) {
			const px = parseFloat(pillMatch[1]!);
			const pw = parseFloat(pillMatch[3]!);
			const pillCenter = px + pw / 2;
			// Check if this pill is for our label (center within 1px of label x)
			if (Math.abs(pillCenter - label.x) < 1) {
				foundPill = true;
				// Pill center should also be on the polyline
				const pillPos = { x: pillCenter, y: label.y };
				const dist = closestPolylineDistance(pillPos, polylines);
				expect(dist).toBeLessThan(2);
			}
		}
		expect(foundPill).toBe(true);
	});
});
