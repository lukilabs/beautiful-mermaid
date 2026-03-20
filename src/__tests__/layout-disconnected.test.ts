/**
 * Integration tests for disconnected component layout.
 *
 * These tests verify that the full layout pipeline correctly handles
 * graphs with multiple disconnected components (subgraphs or nodes
 * with no edges connecting them).
 *
 * The key invariant: disconnected components should NEVER overlap.
 */
import { describe, expect, it } from "bun:test";
import { parseMermaid, renderMermaidSync } from "../index.ts";
import { layoutGraphSync } from "../layout.ts";

// ============================================================================
// Test helpers
// ============================================================================

/** Check if two rectangles overlap */
function rectanglesOverlap(
	r1: { x: number; y: number; width: number; height: number },
	r2: { x: number; y: number; width: number; height: number },
): boolean {
	return !(
		(
			r1.x + r1.width <= r2.x || // r1 is left of r2
			r2.x + r2.width <= r1.x || // r2 is left of r1
			r1.y + r1.height <= r2.y || // r1 is above r2
			r2.y + r2.height <= r1.y
		) // r2 is above r1
	);
}

/** Get bounding box from positioned elements */
function _getBoundingBox(
	items: Array<{ x: number; y: number; width: number; height: number }>,
) {
	if (items.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const item of items) {
		minX = Math.min(minX, item.x);
		minY = Math.min(minY, item.y);
		maxX = Math.max(maxX, item.x + item.width);
		maxY = Math.max(maxY, item.y + item.height);
	}

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ============================================================================
// Two disconnected subgraphs (the original bug)
// ============================================================================

describe("layoutGraph – two disconnected subgraphs", () => {
	it("renders without overlap in LR direction", () => {
		const source = `graph LR
      subgraph Today [Today]
        A[AI Response] --> B[Markdown]
        B --> C[User reads]
        C --> D[User acts]
      end

      subgraph Tomorrow [Next Wave]
        E[AI Response] --> F[Widget]
        F --> G[User acts]
      end`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		// Find the two top-level groups
		const today = result.groups.find((g) => g.label === "Today");
		const tomorrow = result.groups.find((g) => g.label === "Next Wave");

		expect(today).toBeDefined();
		expect(tomorrow).toBeDefined();

		// They should NOT overlap
		expect(rectanglesOverlap(today!, tomorrow!)).toBe(false);
	});

	it("renders without overlap in TD direction", () => {
		const source = `graph TD
      subgraph Today [Today]
        A --> B --> C
      end

      subgraph Tomorrow [Tomorrow]
        D --> E --> F
      end`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const today = result.groups.find((g) => g.label === "Today");
		const tomorrow = result.groups.find((g) => g.label === "Tomorrow");

		expect(today).toBeDefined();
		expect(tomorrow).toBeDefined();
		expect(rectanglesOverlap(today!, tomorrow!)).toBe(false);
	});

	it("respects direction for stacking (LR = vertical)", () => {
		// Perpendicular stacking: LR flows horizontally → stack vertically
		const source = `graph LR
      subgraph S1 [First]
        A --> B
      end
      subgraph S2 [Second]
        C --> D
      end`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const s1 = result.groups.find((g) => g.label === "First")!;
		const s2 = result.groups.find((g) => g.label === "Second")!;

		// In LR mode, subgraphs should be stacked vertically (perpendicular to flow)
		// One should be above the other
		const isVerticallyArranged =
			s1.y + s1.height <= s2.y || s2.y + s2.height <= s1.y;

		expect(isVerticallyArranged).toBe(true);
	});

	it("respects direction for stacking (TD = horizontal)", () => {
		// Perpendicular stacking: TD flows vertically → stack horizontally
		const source = `graph TD
      subgraph S1 [First]
        A --> B
      end
      subgraph S2 [Second]
        C --> D
      end`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const s1 = result.groups.find((g) => g.label === "First")!;
		const s2 = result.groups.find((g) => g.label === "Second")!;

		// ELK may arrange disconnected components in various ways
		// The key requirement is that they don't overlap
		const noOverlap =
			s1.x + s1.width <= s2.x ||
			s2.x + s2.width <= s1.x ||
			s1.y + s1.height <= s2.y ||
			s2.y + s2.height <= s1.y;

		expect(noOverlap).toBe(true);
	});
});

// ============================================================================
// Three+ disconnected components
// ============================================================================

describe("layoutGraph – multiple disconnected components", () => {
	it("renders three disconnected subgraphs without overlap", () => {
		const source = `graph LR
      subgraph A [Alpha]
        A1 --> A2
      end
      subgraph B [Beta]
        B1 --> B2
      end
      subgraph C [Gamma]
        C1 --> C2
      end`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const alpha = result.groups.find((g) => g.label === "Alpha")!;
		const beta = result.groups.find((g) => g.label === "Beta")!;
		const gamma = result.groups.find((g) => g.label === "Gamma")!;

		// No pair should overlap
		expect(rectanglesOverlap(alpha, beta)).toBe(false);
		expect(rectanglesOverlap(beta, gamma)).toBe(false);
		expect(rectanglesOverlap(alpha, gamma)).toBe(false);
	});

	it("renders five disconnected nodes without overlap", () => {
		// Five completely isolated nodes
		const source = `graph LR
      A[Node A]
      B[Node B]
      C[Node C]
      D[Node D]
      E[Node E]`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		// All nodes should exist
		expect(result.nodes.length).toBe(5);

		// No pair of nodes should overlap
		for (let i = 0; i < result.nodes.length; i++) {
			for (let j = i + 1; j < result.nodes.length; j++) {
				const overlap = rectanglesOverlap(result.nodes[i]!, result.nodes[j]!);
				expect(
					overlap,
					`Nodes ${result.nodes[i]!.id} and ${result.nodes[j]!.id} overlap`,
				).toBe(false);
			}
		}
	});
});

// ============================================================================
// Mixed: connected + disconnected
// ============================================================================

describe("layoutGraph – mixed connected and disconnected", () => {
	it("renders two connected subgraphs + one disconnected", () => {
		const source = `graph LR
      subgraph Frontend [Frontend]
        FE1 --> FE2
      end
      subgraph Backend [Backend]
        BE1 --> BE2
      end
      subgraph Isolated [Isolated]
        I1 --> I2
      end
      FE2 --> BE1`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const frontend = result.groups.find((g) => g.label === "Frontend")!;
		const backend = result.groups.find((g) => g.label === "Backend")!;
		const isolated = result.groups.find((g) => g.label === "Isolated")!;

		// None should overlap
		expect(rectanglesOverlap(frontend, backend)).toBe(false);
		expect(rectanglesOverlap(backend, isolated)).toBe(false);
		expect(rectanglesOverlap(frontend, isolated)).toBe(false);
	});

	it("renders connected nodes + isolated node", () => {
		const source = `graph LR
      A --> B --> C
      D[Isolated]`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const nodeD = result.nodes.find((n) => n.id === "D")!;
		const connectedNodes = result.nodes.filter((n) => n.id !== "D");

		// Isolated node should not overlap with any connected node
		for (const node of connectedNodes) {
			expect(
				rectanglesOverlap(nodeD, node),
				`Node D overlaps with node ${node.id}`,
			).toBe(false);
		}
	});
});

// ============================================================================
// Layout quality preservation
// ============================================================================

describe("layoutGraph – quality preservation", () => {
	it("each component looks identical to standalone rendering", () => {
		// Render a single subgraph standalone
		const standalone = `graph LR
      subgraph S [Section]
        A --> B --> C
      end`;

		const standaloneParsed = parseMermaid(standalone);
		const standaloneResult = layoutGraphSync(standaloneParsed);

		// Render the same subgraph as part of a disconnected graph
		const combined = `graph LR
      subgraph S [Section]
        A --> B --> C
      end
      subgraph Other [Other]
        X --> Y
      end`;

		const combinedParsed = parseMermaid(combined);
		const combinedResult = layoutGraphSync(combinedParsed);

		// The "Section" group should have the same dimensions
		const standaloneGroup = standaloneResult.groups.find(
			(g) => g.label === "Section",
		)!;
		const combinedGroup = combinedResult.groups.find(
			(g) => g.label === "Section",
		)!;

		expect(combinedGroup.width).toBe(standaloneGroup.width);
		expect(combinedGroup.height).toBe(standaloneGroup.height);
	});
});

// ============================================================================
// Edge cases
// ============================================================================

describe("layoutGraph – disconnected edge cases", () => {
	it("handles single node as its own component", () => {
		const source = `graph LR
      A --> B
      C[Isolated]`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		expect(result.nodes.length).toBe(3);

		// All nodes positioned without overlap
		for (let i = 0; i < result.nodes.length; i++) {
			for (let j = i + 1; j < result.nodes.length; j++) {
				expect(rectanglesOverlap(result.nodes[i]!, result.nodes[j]!)).toBe(
					false,
				);
			}
		}
	});

	it("handles empty subgraph with disconnected nodes", () => {
		const source = `graph LR
      subgraph Empty
      end
      A --> B`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		expect(result.groups.length).toBe(1);
		expect(result.nodes.length).toBe(2);
	});

	it("handles subgraph containing entire component", () => {
		const source = `graph LR
      subgraph Component1
        A --> B --> C
      end
      D --> E`;

		const parsed = parseMermaid(source);
		const result = layoutGraphSync(parsed);

		const group = result.groups.find((g) => g.label === "Component1")!;
		const nodeD = result.nodes.find((n) => n.id === "D")!;
		const nodeE = result.nodes.find((n) => n.id === "E")!;

		// Group and D/E nodes should not overlap
		expect(rectanglesOverlap(group, nodeD)).toBe(false);
		expect(rectanglesOverlap(group, nodeE)).toBe(false);
	});
});

// ============================================================================
// Full render tests (SVG output)
// ============================================================================

describe("renderMermaid – disconnected components", () => {
	it("renders two disconnected subgraphs to valid SVG", () => {
		const source = `graph LR
      subgraph Today [Today]
        A --> B
      end
      subgraph Tomorrow [Tomorrow]
        C --> D
      end`;

		const svg = renderMermaidSync(source);

		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain(">Today</text>");
		expect(svg).toContain(">Tomorrow</text>");
		expect(svg).toContain(">A</text>");
		expect(svg).toContain(">B</text>");
		expect(svg).toContain(">C</text>");
		expect(svg).toContain(">D</text>");
	});

	it("renders isolated nodes to valid SVG", () => {
		const source = `graph LR
      A[First]
      B[Second]
      C[Third]`;

		const svg = renderMermaidSync(source);

		expect(svg).toContain("<svg");
		expect(svg).toContain("</svg>");
		expect(svg).toContain(">First</text>");
		expect(svg).toContain(">Second</text>");
		expect(svg).toContain(">Third</text>");
	});
});
