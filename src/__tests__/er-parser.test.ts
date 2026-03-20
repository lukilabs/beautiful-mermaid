/**
 * Tests for the ER diagram parser.
 *
 * Covers: entity definitions, attribute parsing (types, names, keys, comments),
 * relationships with all cardinality types, identifying/non-identifying lines.
 */
import { describe, expect, it } from "bun:test";
import { parseErDiagram } from "../er/parser.ts";

/** Helper to parse — preprocesses text the same way index.ts does */
function parse(text: string) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));
	return parseErDiagram(lines);
}

// ============================================================================
// Entity definitions
// ============================================================================

describe("parseErDiagram – entity definitions", () => {
	it("parses an entity with attributes", () => {
		const d = parse(`erDiagram
      CUSTOMER {
        string name
        int age
        string email
      }`);
		expect(d.entities).toHaveLength(1);
		expect(d.entities[0]!.id).toBe("CUSTOMER");
		expect(d.entities[0]!.attributes).toHaveLength(3);
		expect(d.entities[0]!.attributes[0]!.type).toBe("string");
		expect(d.entities[0]!.attributes[0]!.name).toBe("name");
	});

	it("parses attributes with PK key", () => {
		const d = parse(`erDiagram
      USER {
        int id PK
        string name
      }`);
		expect(d.entities[0]!.attributes[0]!.keys).toContain("PK");
	});

	it("parses attributes with FK key", () => {
		const d = parse(`erDiagram
      ORDER {
        int id PK
        int customer_id FK
      }`);
		expect(d.entities[0]!.attributes[1]!.keys).toContain("FK");
	});

	it("parses attributes with UK key", () => {
		const d = parse(`erDiagram
      USER {
        string email UK
      }`);
		expect(d.entities[0]!.attributes[0]!.keys).toContain("UK");
	});

	it("parses attributes with comment", () => {
		const d = parse(`erDiagram
      USER {
        string email UK "user email address"
      }`);
		expect(d.entities[0]!.attributes[0]!.comment).toBe("user email address");
	});

	it("parses multiple entities", () => {
		const d = parse(`erDiagram
      CUSTOMER {
        int id PK
        string name
      }
      ORDER {
        int id PK
        date created
      }`);
		expect(d.entities).toHaveLength(2);
	});

	it("auto-creates entities from relationships", () => {
		const d = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places`);
		expect(d.entities).toHaveLength(2);
		expect(d.entities.find((e) => e.id === "CUSTOMER")).toBeDefined();
		expect(d.entities.find((e) => e.id === "ORDER")).toBeDefined();
	});
});

// ============================================================================
// Relationships
// ============================================================================

describe("parseErDiagram – relationships", () => {
	it("parses exactly-one to zero-or-many: ||--o{", () => {
		const d = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places`);
		expect(d.relationships).toHaveLength(1);
		expect(d.relationships[0]!.entity1).toBe("CUSTOMER");
		expect(d.relationships[0]!.entity2).toBe("ORDER");
		expect(d.relationships[0]!.cardinality1).toBe("one");
		expect(d.relationships[0]!.cardinality2).toBe("zero-many");
		expect(d.relationships[0]!.label).toBe("places");
		expect(d.relationships[0]!.identifying).toBe(true);
	});

	it("parses zero-or-one to one-or-more: |o--|{", () => {
		const d = parse(`erDiagram
      A |o--|{ B : connects`);
		expect(d.relationships[0]!.cardinality1).toBe("zero-one");
		expect(d.relationships[0]!.cardinality2).toBe("many");
	});

	it("parses exactly-one to exactly-one: ||--||", () => {
		const d = parse(`erDiagram
      PERSON ||--|| PASSPORT : has`);
		expect(d.relationships[0]!.cardinality1).toBe("one");
		expect(d.relationships[0]!.cardinality2).toBe("one");
	});

	it("parses non-identifying relationship (dotted): ||..o{", () => {
		const d = parse(`erDiagram
      USER ||..o{ LOG : generates`);
		expect(d.relationships[0]!.identifying).toBe(false);
	});

	it("parses one-or-more to zero-or-many: }|--o{", () => {
		const d = parse(`erDiagram
      PRODUCT }|--o{ TAG : has`);
		expect(d.relationships[0]!.cardinality1).toBe("many");
		expect(d.relationships[0]!.cardinality2).toBe("zero-many");
	});

	it("handles multiple relationships", () => {
		const d = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
      PRODUCT ||--o{ LINE_ITEM : appears_in`);
		expect(d.relationships).toHaveLength(3);
	});
});

// ============================================================================
// Full diagram
// ============================================================================

describe("parseErDiagram – full diagram", () => {
	it("parses a complete e-commerce schema", () => {
		const d = parse(`erDiagram
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
      LINE_ITEM {
        int id PK
        int quantity
        int order_id FK
        int product_id FK
      }
      PRODUCT {
        int id PK
        string name
        float price
      }
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ LINE_ITEM : contains
      PRODUCT ||--o{ LINE_ITEM : includes`);

		expect(d.entities).toHaveLength(4);
		expect(d.relationships).toHaveLength(3);

		const customer = d.entities.find((e) => e.id === "CUSTOMER")!;
		expect(customer.attributes).toHaveLength(3);
		expect(customer.attributes[0]!.keys).toContain("PK");
		expect(customer.attributes[2]!.keys).toContain("UK");

		const lineItem = d.entities.find((e) => e.id === "LINE_ITEM")!;
		expect(
			lineItem.attributes.filter((a) => a.keys.includes("FK")),
		).toHaveLength(2);
	});
});
