/**
 * Tests for the ArchiMate diagram parser.
 *
 * Covers: layer blocks, element declarations (all formats), relationship
 * parsing (typed and default association), multi-layer diagrams, and
 * edge cases around layer context switching.
 */
import { describe, expect, it } from "bun:test";
import { parseArchimate } from "../archimate/parser.ts";

/** Helper — preprocesses text the same way src/index.ts does */
function parse(text: string) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));
	return parseArchimate(lines);
}

// ============================================================================
// Layer blocks
// ============================================================================

describe("parseArchimate – layer blocks", () => {
	it("parses business layer with elements", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer`);
		expect(d.layers.has("business")).toBe(true);
		expect(d.layers.get("business")).toHaveLength(1);
	});

	it("parses application layer", () => {
		const d = parse(`archimate-layered
      application:
        component WebApp`);
		expect(d.layers.has("application")).toBe(true);
		expect(d.layers.get("application")![0]!.type).toBe("component");
	});

	it("parses technology layer", () => {
		const d = parse(`archimate-layered
      technology:
        node Server`);
		expect(d.layers.has("technology")).toBe(true);
		expect(d.layers.get("technology")![0]!.type).toBe("node");
	});

	it("parses strategy layer", () => {
		const d = parse(`archimate-layered
      strategy:
        capability Planning`);
		expect(d.layers.has("strategy")).toBe(true);
	});

	it("parses motivation layer", () => {
		const d = parse(`archimate-layered
      motivation:
        goal Profitability`);
		expect(d.layers.has("motivation")).toBe(true);
	});

	it("parses physical layer", () => {
		const d = parse(`archimate-layered
      physical:
        equipment Printer`);
		expect(d.layers.has("physical")).toBe(true);
	});

	it("parses implementation layer", () => {
		const d = parse(`archimate-layered
      implementation:
        workPackage Migration`);
		expect(d.layers.has("implementation")).toBe(true);
	});

	it("parses multiple layers in one diagram", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
      application:
        component WebApp
      technology:
        node Server`);
		expect(d.layers.size).toBe(3);
		expect(d.elements.size).toBe(3);
	});
});

// ============================================================================
// Element declarations
// ============================================================================

describe("parseArchimate – element declarations", () => {
	it("parses simple element: type alias", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer`);
		const el = d.elements.get("Customer");
		expect(el).toBeDefined();
		expect(el!.id).toBe("Customer");
		expect(el!.label).toBe("Customer");
		expect(el!.type).toBe("actor");
		expect(el!.layer).toBe("business");
	});

	it("parses quoted label with alias: type \"Label\" as alias", () => {
		const d = parse(`archimate-layered
      application:
        component "Web Application" as WA`);
		const el = d.elements.get("WA");
		expect(el).toBeDefined();
		expect(el!.id).toBe("WA");
		expect(el!.label).toBe("Web Application");
		expect(el!.type).toBe("component");
	});

	it("parses quoted label without alias: type \"Label\"", () => {
		const d = parse(`archimate-layered
      business:
        service "Online Banking"`);
		// Spaces in label are replaced with underscores for the id
		const el = d.elements.get("Online_Banking");
		expect(el).toBeDefined();
		expect(el!.label).toBe("Online Banking");
		expect(el!.type).toBe("service");
	});

	it("parses multiple elements in same layer", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
        process "Account Management" as AM`);
		expect(d.layers.get("business")).toHaveLength(3);
		expect(d.elements.size).toBe(3);
	});

	it("stores elements in the elements map by id", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
      application:
        component "Web App" as WA`);
		expect(d.elements.has("Customer")).toBe(true);
		expect(d.elements.has("WA")).toBe(true);
	});
});

// ============================================================================
// Relationships
// ============================================================================

describe("parseArchimate – relationships", () => {
	it("parses typed relationship: source -->|type| target", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
      Customer -->|serving| OB`);
		expect(d.relationships).toHaveLength(1);
		expect(d.relationships[0]!.source).toBe("Customer");
		expect(d.relationships[0]!.target).toBe("OB");
		expect(d.relationships[0]!.type).toBe("serving");
	});

	it("parses default association: source --> target", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
      Customer --> OB`);
		expect(d.relationships[0]!.type).toBe("association");
	});

	it("parses composition relationship", () => {
		const d = parse(`archimate-layered
      business:
        process Parent
        process Child
      Parent -->|composition| Child`);
		expect(d.relationships[0]!.type).toBe("composition");
	});

	it("parses aggregation relationship", () => {
		const d = parse(`archimate-layered
      business:
        process Parent
        process Child
      Parent -->|aggregation| Child`);
		expect(d.relationships[0]!.type).toBe("aggregation");
	});

	it("parses realization relationship", () => {
		const d = parse(`archimate-layered
      business:
        service Svc
      application:
        component Comp
      Comp -->|realization| Svc`);
		expect(d.relationships[0]!.type).toBe("realization");
	});

	it("parses assignment relationship", () => {
		const d = parse(`archimate-layered
      business:
        actor User
        role Admin
      User -->|assignment| Admin`);
		expect(d.relationships[0]!.type).toBe("assignment");
	});

	it("parses access relationship", () => {
		const d = parse(`archimate-layered
      business:
        process Proc
        object Data
      Proc -->|access| Data`);
		expect(d.relationships[0]!.type).toBe("access");
	});

	it("parses influence relationship", () => {
		const d = parse(`archimate-layered
      motivation:
        driver Growth
        goal Revenue
      Growth -->|influence| Revenue`);
		expect(d.relationships[0]!.type).toBe("influence");
	});

	it("parses triggering relationship", () => {
		const d = parse(`archimate-layered
      business:
        process StepA
        process StepB
      StepA -->|triggering| StepB`);
		expect(d.relationships[0]!.type).toBe("triggering");
	});

	it("parses flow relationship", () => {
		const d = parse(`archimate-layered
      business:
        process StepA
        process StepB
      StepA -->|flow| StepB`);
		expect(d.relationships[0]!.type).toBe("flow");
	});

	it("parses specialization relationship", () => {
		const d = parse(`archimate-layered
      business:
        process General
        process Specific
      Specific -->|specialization| General`);
		expect(d.relationships[0]!.type).toBe("specialization");
	});

	it("parses multiple relationships", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
      application:
        component "Web App" as WA
      Customer -->|serving| OB
      OB -->|realization| WA`);
		expect(d.relationships).toHaveLength(2);
	});

	it("ignores invalid relationship types", () => {
		const d = parse(`archimate-layered
      business:
        actor A
        actor B
      A -->|invalidType| B`);
		expect(d.relationships).toHaveLength(0);
	});
});

// ============================================================================
// Cross-layer relationships
// ============================================================================

describe("parseArchimate – cross-layer relationships", () => {
	it("parses relationships between elements in different layers", () => {
		const d = parse(`archimate-layered
      business:
        service "Online Banking" as OB
      application:
        component "Web App" as WA
      technology:
        node Server
      OB -->|realization| WA
      WA -->|assignment| Server`);
		expect(d.relationships).toHaveLength(2);
		expect(d.relationships[0]!.source).toBe("OB");
		expect(d.relationships[0]!.target).toBe("WA");
		expect(d.relationships[1]!.source).toBe("WA");
		expect(d.relationships[1]!.target).toBe("Server");
	});
});

// ============================================================================
// Full diagram
// ============================================================================

describe("parseArchimate – full diagram", () => {
	it("parses a complete multi-layer enterprise architecture", () => {
		const d = parse(`archimate-layered
      business:
        actor Customer
        service "Online Banking" as OB
        process "Account Management" as AM
      application:
        component "Web App" as WA
        component "API Gateway" as AG
      technology:
        node "App Server" as AS
        artifact "Docker Image" as DI
      Customer -->|serving| OB
      OB -->|realization| WA
      WA -->|serving| AG
      AG -->|assignment| AS
      DI -->|realization| WA`);

		expect(d.layers.size).toBe(3);
		expect(d.elements.size).toBe(7);
		expect(d.relationships).toHaveLength(5);

		// Verify layer membership
		expect(d.layers.get("business")).toHaveLength(3);
		expect(d.layers.get("application")).toHaveLength(2);
		expect(d.layers.get("technology")).toHaveLength(2);

		// Verify specific elements
		const customer = d.elements.get("Customer");
		expect(customer).toBeDefined();
		expect(customer!.layer).toBe("business");

		const webApp = d.elements.get("WA");
		expect(webApp).toBeDefined();
		expect(webApp!.label).toBe("Web App");
		expect(webApp!.layer).toBe("application");
	});
});

// ============================================================================
// Edge cases
// ============================================================================

describe("parseArchimate – edge cases", () => {
	it("handles empty diagram (no layers)", () => {
		const d = parse(`archimate-layered`);
		expect(d.layers.size).toBe(0);
		expect(d.elements.size).toBe(0);
		expect(d.relationships).toHaveLength(0);
	});

	it("handles layer with no elements", () => {
		const d = parse(`archimate-layered
      business:`);
		// Layer header parsed but no elements added
		expect(d.elements.size).toBe(0);
	});

	it("skips comment lines", () => {
		const d = parse(`archimate-layered
      %% This is a comment
      business:
        actor Customer`);
		expect(d.elements.size).toBe(1);
	});
});
