/**
 * Integration tests for C4 diagrams — parse + render pipeline.
 *
 * Tests the parser and SVG renderer directly with hand-crafted positioned
 * data. The layout engine (dagre) is bypassed because it's an optional
 * dependency that may not be installed in all environments.
 */
import { describe, expect, it } from "bun:test";
import { parseC4 } from "../c4/parser.ts";
import { renderC4Svg } from "../c4/renderer.ts";
import type {
	PositionedC4Boundary,
	PositionedC4Diagram,
	PositionedC4Element,
	PositionedC4Relationship,
} from "../c4/types.ts";
import { DEFAULTS } from "../theme.ts";

const COLORS = { bg: DEFAULTS.bg, fg: DEFAULTS.fg };

/** Build a minimal positioned diagram for renderer tests */
function buildPositioned(overrides: Partial<PositionedC4Diagram> = {}): PositionedC4Diagram {
	return {
		width: 600,
		height: 400,
		elements: [],
		relationships: [],
		boundaries: [],
		...overrides,
	};
}

/** Build a positioned element */
function elem(overrides: Partial<PositionedC4Element>): PositionedC4Element {
	return {
		kind: "System",
		alias: "sys",
		label: "System",
		external: false,
		x: 50,
		y: 50,
		width: 160,
		height: 80,
		...overrides,
	};
}

/** Build a positioned relationship */
function rel(overrides: Partial<PositionedC4Relationship>): PositionedC4Relationship {
	return {
		from: "a",
		to: "b",
		label: "Uses",
		points: [
			{ x: 130, y: 130 },
			{ x: 130, y: 250 },
		],
		...overrides,
	};
}

// ============================================================================
// Basic SVG structure
// ============================================================================

describe("C4 integration – basic SVG output", () => {
	it("renders an empty diagram to valid SVG", () => {
		const svg = renderC4Svg(buildPositioned(), COLORS);
		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
	});

	it("contains element labels in SVG text", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "user", label: "User", kind: "Person" }),
					elem({ alias: "sys", label: "Banking System", x: 250 }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("User");
		expect(svg).toContain("Banking System");
	});

	it("contains relationship labels", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "user", label: "User" }),
					elem({ alias: "sys", label: "System", x: 250 }),
				],
				relationships: [rel({ from: "user", to: "sys", label: "Makes API calls" })],
			}),
			COLORS,
		);
		expect(svg).toContain("Makes API calls");
	});

	it("renders title when present", () => {
		const svg = renderC4Svg(
			buildPositioned({
				title: "System Context Diagram",
				elements: [elem({ alias: "user", label: "User" })],
			}),
			COLORS,
		);
		expect(svg).toContain("System Context Diagram");
	});
});

// ============================================================================
// Person elements
// ============================================================================

describe("C4 integration – person elements", () => {
	it("renders person with circle head", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [elem({ alias: "user", label: "User", kind: "Person", height: 180 })],
			}),
			COLORS,
		);
		expect(svg).toContain("<circle");
		expect(svg).toContain("User");
	});

	it("renders person description", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({
						alias: "user",
						label: "User",
						kind: "Person",
						description: "A person who uses the system",
						height: 180,
					}),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("A person who uses the system");
	});
});

// ============================================================================
// Element types
// ============================================================================

describe("C4 integration – element types", () => {
	it("renders Container with technology in brackets", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({
						alias: "web",
						label: "Web App",
						kind: "Container",
						technology: "Java/Spring",
						description: "Serves pages",
					}),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Web App");
		expect(svg).toContain("[Java/Spring]");
	});

	it("renders ContainerDb element", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "db", label: "Database", kind: "ContainerDb", technology: "PostgreSQL" }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Database");
		expect(svg).toContain("[PostgreSQL]");
	});

	it("renders Component element", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "ctrl", label: "Controller", kind: "Component", technology: "Spring MVC" }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Controller");
		expect(svg).toContain("[Spring MVC]");
	});

	it("renders external elements with muted fill", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "ext", label: "External System", external: true }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("External System");
		expect(svg).toContain("var(--_text-muted)");
	});
});

// ============================================================================
// Boundaries
// ============================================================================

describe("C4 integration – boundaries", () => {
	it("renders boundary with dashed border", () => {
		const boundary: PositionedC4Boundary = {
			alias: "sb",
			label: "Banking System",
			kind: "System_Boundary",
			x: 20,
			y: 20,
			width: 400,
			height: 300,
			children: [],
		};
		const svg = renderC4Svg(
			buildPositioned({
				elements: [elem({ alias: "web", label: "Web App", x: 50, y: 80 })],
				boundaries: [boundary],
			}),
			COLORS,
		);
		expect(svg).toContain("stroke-dasharray");
		expect(svg).toContain("Banking System");
	});

	it("renders boundary kind label in brackets", () => {
		const boundary: PositionedC4Boundary = {
			alias: "sb",
			label: "My System",
			kind: "System_Boundary",
			x: 20,
			y: 20,
			width: 400,
			height: 300,
			children: [],
		};
		const svg = renderC4Svg(
			buildPositioned({ boundaries: [boundary] }),
			COLORS,
		);
		// Kind label: underscores replaced with spaces
		expect(svg).toContain("[System Boundary]");
	});

	it("renders nested boundaries", () => {
		const inner: PositionedC4Boundary = {
			alias: "sb",
			label: "Core System",
			kind: "System_Boundary",
			x: 40,
			y: 60,
			width: 300,
			height: 200,
			children: [],
		};
		const outer: PositionedC4Boundary = {
			alias: "eb",
			label: "Enterprise",
			kind: "Enterprise_Boundary",
			x: 20,
			y: 20,
			width: 400,
			height: 300,
			children: [inner],
		};
		const svg = renderC4Svg(
			buildPositioned({ boundaries: [outer] }),
			COLORS,
		);
		expect(svg).toContain("Enterprise");
		expect(svg).toContain("Core System");
	});
});

// ============================================================================
// Relationships
// ============================================================================

describe("C4 integration – relationships", () => {
	it("renders relationship arrows with polyline", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "user", label: "User" }),
					elem({ alias: "sys", label: "System", y: 200 }),
				],
				relationships: [rel({ from: "user", to: "sys", label: "Uses" })],
			}),
			COLORS,
		);
		expect(svg).toContain("<polyline");
		expect(svg).toContain("marker-end");
	});

	it("renders relationship technology in brackets", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [
					elem({ alias: "user", label: "User" }),
					elem({ alias: "sys", label: "System", y: 200 }),
				],
				relationships: [
					rel({ from: "user", to: "sys", label: "Calls", technology: "HTTPS" }),
				],
			}),
			COLORS,
		);
		expect(svg).toContain("Calls");
		expect(svg).toContain("[HTTPS]");
	});

	it("renders arrow marker definition", () => {
		const svg = renderC4Svg(
			buildPositioned({
				elements: [elem({ alias: "a", label: "A" })],
				relationships: [rel({})],
			}),
			COLORS,
		);
		expect(svg).toContain('id="c4-arrow"');
	});
});

// ============================================================================
// Parser → renderer round-trip (no layout)
// ============================================================================

describe("C4 integration – parser round-trip", () => {
	it("parses and verifies a full context diagram structure", () => {
		const text = `C4Context
      title Internet Banking System
      Person(customer, "Customer", "A bank customer")
      System(banking, "Internet Banking", "Online banking portal")
      System_Ext(email, "E-mail System", "Sends notifications")
      Rel(customer, banking, "Views accounts", "HTTPS")
      Rel(banking, email, "Sends emails", "SMTP")`;

		const lines = text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("%%"));
		const diagram = parseC4(lines);

		expect(diagram.title).toBe("Internet Banking System");
		expect(diagram.elements).toHaveLength(3);
		expect(diagram.relationships).toHaveLength(2);

		// Verify the parsed data can be used to build positioned diagram for rendering
		const positioned = buildPositioned({
			title: diagram.title,
			elements: diagram.elements.map((e, i) => elem({
				alias: e.alias,
				label: e.label,
				kind: e.kind,
				description: e.description,
				technology: e.technology,
				external: e.external,
				x: 50,
				y: 50 + i * 150,
				width: 160,
				height: e.kind === "Person" ? 180 : 80,
			})),
			relationships: diagram.relationships.map((r) => rel({
				from: r.from,
				to: r.to,
				label: r.label,
				technology: r.technology,
			})),
		});

		const svg = renderC4Svg(positioned, COLORS);
		expect(svg).toContain("<svg");
		expect(svg).toContain("Internet Banking System");
		expect(svg).toContain("Customer");
		expect(svg).toContain("Internet Banking");
		expect(svg).toContain("E-mail System");
		expect(svg).toContain("Views accounts");
		expect(svg).toContain("[HTTPS]");
		expect(svg).toContain("<circle"); // Person head
		expect(svg).toContain('id="c4-arrow"');
	});
});
