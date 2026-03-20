/**
 * Integration tests for ArchiMate diagrams — parse + render pipeline.
 *
 * Tests the parser and SVG renderer directly with hand-crafted positioned
 * data. The layout engine (dagre) is bypassed because it's an optional
 * dependency that may not be installed in all environments.
 */
import { describe, expect, it } from "bun:test";
import { parseArchimate } from "../archimate/parser.ts";
import { renderArchiMateSvg } from "../archimate/renderer.ts";
import type {
	PositionedArchiMateDiagram,
	PositionedArchiMateElement,
	PositionedArchiMateLayer,
	PositionedArchiMateRelationship,
} from "../archimate/types.ts";
import { DEFAULTS } from "../theme.ts";

const COLORS = { bg: DEFAULTS.bg, fg: DEFAULTS.fg };

/** Build a minimal positioned diagram for renderer tests */
function buildPositioned(
	overrides: Partial<PositionedArchiMateDiagram> = {},
): PositionedArchiMateDiagram {
	return {
		width: 600,
		height: 400,
		layers: [],
		elements: [],
		relationships: [],
		...overrides,
	};
}

/** Build a positioned element */
function elem(overrides: Partial<PositionedArchiMateElement> = {}): PositionedArchiMateElement {
	return {
		id: "el",
		label: "Element",
		type: "actor",
		layer: "business",
		x: 50,
		y: 80,
		width: 140,
		height: 50,
		...overrides,
	};
}

/** Build a positioned layer band */
function layer(overrides: Partial<PositionedArchiMateLayer> = {}): PositionedArchiMateLayer {
	return {
		name: "business",
		x: 20,
		y: 20,
		width: 560,
		height: 150,
		...overrides,
	};
}

/** Build a positioned relationship */
function rel(overrides: Partial<PositionedArchiMateRelationship> = {}): PositionedArchiMateRelationship {
	return {
		source: "a",
		target: "b",
		type: "association",
		points: [
			{ x: 120, y: 130 },
			{ x: 120, y: 250 },
		],
		...overrides,
	};
}

// ============================================================================
// Basic SVG structure
// ============================================================================

describe("ArchiMate integration – basic SVG output", () => {
	it("renders an empty diagram to valid SVG", () => {
		const svg = renderArchiMateSvg(buildPositioned(), COLORS);
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
	});

	it("contains element labels in SVG text", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "Customer", label: "Customer" }),
					elem({ id: "OB", label: "Online Banking", type: "service", x: 250 }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Customer");
		expect(svg).toContain("Online Banking");
	});
});

// ============================================================================
// Layer bands
// ============================================================================

describe("ArchiMate integration – layer bands", () => {
	it("renders layer band background rectangles", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [elem({ id: "Customer", label: "Customer" })],
			}),
			COLORS,
		);
		expect(svg).toContain("color-mix");
		expect(svg).toContain("<rect");
	});

	it("renders layer label text", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer({ name: "business" })],
				elements: [elem({})],
			}),
			COLORS,
		);
		expect(svg).toContain("Business");
	});

	it("renders multiple layer bands", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [
					layer({ name: "business", y: 20 }),
					layer({ name: "application", y: 200 }),
				],
				elements: [
					elem({ id: "Customer", label: "Customer", layer: "business" }),
					elem({ id: "WA", label: "WebApp", layer: "application", type: "component", y: 230 }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Business");
		expect(svg).toContain("Application");
	});

	it("renders all seven layer labels when present", () => {
		const layers: PositionedArchiMateLayer[] = [
			layer({ name: "strategy", y: 0 }),
			layer({ name: "motivation", y: 160 }),
			layer({ name: "business", y: 320 }),
			layer({ name: "application", y: 480 }),
			layer({ name: "technology", y: 640 }),
			layer({ name: "physical", y: 800 }),
			layer({ name: "implementation", y: 960 }),
		];
		const svg = renderArchiMateSvg(
			buildPositioned({ layers, height: 1200 }),
			COLORS,
		);
		expect(svg).toContain("Strategy");
		expect(svg).toContain("Motivation");
		expect(svg).toContain("Business");
		expect(svg).toContain("Application");
		expect(svg).toContain("Technology");
		expect(svg).toContain("Physical");
		// "Implementation & Migration" is the display label
		expect(svg).toContain("Implementation");
	});
});

// ============================================================================
// Element boxes
// ============================================================================

describe("ArchiMate integration – element boxes", () => {
	it("renders element boxes as rounded rectangles", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [elem({ id: "Customer", label: "Customer" })],
			}),
			COLORS,
		);
		expect(svg).toContain('rx="4"');
	});

	it("renders element type indicator", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer({ name: "application" })],
				elements: [elem({ id: "WA", label: "WebApp", type: "component", layer: "application" })],
			}),
			COLORS,
		);
		expect(svg).toContain("Component");
	});

	it("renders camelCase types as spaced words", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer({ name: "application" })],
				elements: [elem({ id: "DO", label: "Records", type: "dataObject", layer: "application" })],
			}),
			COLORS,
		);
		expect(svg).toContain("Data Object");
	});
});

// ============================================================================
// Relationships
// ============================================================================

describe("ArchiMate integration – relationships", () => {
	it("renders relationship lines as polylines", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "serving" })],
			}),
			COLORS,
		);
		expect(svg).toContain("<polyline");
	});

	it("renders relationship labels at midpoint", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "serving", label: "serving" })],
			}),
			COLORS,
		);
		expect(svg).toContain("serving");
	});

	it("renders dashed lines for realization relationships", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "realization" })],
			}),
			COLORS,
		);
		expect(svg).toContain('stroke-dasharray="6 4"');
	});

	it("renders dashed lines for access relationships", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "access" })],
			}),
			COLORS,
		);
		expect(svg).toContain('stroke-dasharray="6 4"');
	});

	it("renders dashed lines for influence relationships", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "influence" })],
			}),
			COLORS,
		);
		expect(svg).toContain('stroke-dasharray="6 4"');
	});

	it("renders dashed lines for flow relationships", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "flow" })],
			}),
			COLORS,
		);
		expect(svg).toContain('stroke-dasharray="6 4"');
	});

	it("renders solid lines for serving relationships (no dasharray)", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "serving" })],
			}),
			COLORS,
		);
		// Serving uses solid line — the polyline should NOT have stroke-dasharray
		const polylineMatch = svg.match(/<polyline[^>]*>/);
		expect(polylineMatch).toBeDefined();
		expect(polylineMatch![0]).not.toContain("stroke-dasharray");
	});

	it("renders arrow markers in defs", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [elem({ id: "A", label: "A" })],
			}),
			COLORS,
		);
		expect(svg).toContain("<defs>");
		expect(svg).toContain("archimate-arrow-filled");
		expect(svg).toContain("archimate-arrow-open");
		expect(svg).toContain("archimate-diamond-filled");
		expect(svg).toContain("archimate-diamond-open");
		expect(svg).toContain("archimate-triangle-open");
		expect(svg).toContain("archimate-circle-filled");
	});

	it("uses filled diamond marker for composition", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "composition" })],
			}),
			COLORS,
		);
		expect(svg).toContain("archimate-diamond-filled");
	});

	it("uses open diamond marker for aggregation", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "aggregation" })],
			}),
			COLORS,
		);
		expect(svg).toContain("archimate-diamond-open");
	});

	it("uses open triangle marker for specialization", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "specialization" })],
			}),
			COLORS,
		);
		expect(svg).toContain("archimate-triangle-open");
	});

	it("uses filled circle + filled arrow for assignment", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "assignment" })],
			}),
			COLORS,
		);
		expect(svg).toContain("archimate-circle-filled");
		expect(svg).toContain("archimate-arrow-filled");
	});

	it("renders no markers for association", () => {
		const svg = renderArchiMateSvg(
			buildPositioned({
				layers: [layer()],
				elements: [
					elem({ id: "A", label: "A" }),
					elem({ id: "B", label: "B", y: 200 }),
				],
				relationships: [rel({ source: "A", target: "B", type: "association" })],
			}),
			COLORS,
		);
		// Association polyline should have no marker-start or marker-end
		const polylineMatch = svg.match(/<polyline[^>]*>/);
		expect(polylineMatch).toBeDefined();
		expect(polylineMatch![0]).not.toContain("marker-start");
		expect(polylineMatch![0]).not.toContain("marker-end");
	});
});

// ============================================================================
// Parser → renderer round-trip (no layout)
// ============================================================================

describe("ArchiMate integration – parser round-trip", () => {
	it("parses and renders a multi-layer diagram", () => {
		const text = `archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
      application:
        component "Web App" as WA
      technology:
        node "App Server" as AS
      Customer -->|serving| OB
      OB -->|realization| WA
      WA -->|assignment| AS`;

		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("%%"));
		const diagram = parseArchimate(lines);

		expect(diagram.layers.size).toBe(3);
		expect(diagram.elements.size).toBe(4);
		expect(diagram.relationships).toHaveLength(3);

		// Build positioned data from parsed diagram and render
		const elements: PositionedArchiMateElement[] = [];
		let yOffset = 80;
		for (const [, el] of diagram.elements) {
			elements.push({
				id: el.id,
				label: el.label,
				type: el.type,
				layer: el.layer,
				x: 50,
				y: yOffset,
				width: 140,
				height: 50,
			});
			yOffset += 120;
		}

		const positioned = buildPositioned({
			layers: [
				layer({ name: "business", y: 20, height: 280 }),
				layer({ name: "application", y: 310, height: 150 }),
				layer({ name: "technology", y: 470, height: 150 }),
			],
			elements,
			relationships: diagram.relationships.map((r) =>
				rel({ source: r.source, target: r.target, type: r.type }),
			),
			height: 700,
		});

		const svg = renderArchiMateSvg(positioned, COLORS);
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain("Business");
		expect(svg).toContain("Application");
		expect(svg).toContain("Technology");
		expect(svg).toContain("Customer");
		expect(svg).toContain("Online Banking");
		expect(svg).toContain("Web App");
		expect(svg).toContain("App Server");
		expect(svg).toContain("<polyline");
	});
});
