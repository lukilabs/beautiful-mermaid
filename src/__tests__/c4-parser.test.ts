/**
 * Tests for the C4 diagram parser.
 *
 * Covers: diagram types, element declarations (Person, System, Container,
 * Component variants), external elements, boundaries (nesting), relationships
 * (directional, bidirectional), title, and argument parsing edge cases.
 */
import { describe, expect, it } from "bun:test";
import { parseC4 } from "../c4/parser.ts";

/** Helper — preprocesses text the same way src/index.ts does */
function parse(text: string) {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));
	return parseC4(lines);
}

// ============================================================================
// Diagram type detection
// ============================================================================

describe("parseC4 – diagram types", () => {
	it("parses C4Context as diagram type", () => {
		const d = parse(`C4Context
      Person(user, "User", "A user")`);
		expect(d.type).toBe("C4Context");
	});

	it("parses C4Container as diagram type", () => {
		const d = parse(`C4Container
      Container(web, "Web App", "Java", "Serves pages")`);
		expect(d.type).toBe("C4Container");
	});

	it("parses C4Component as diagram type", () => {
		const d = parse(`C4Component
      Component(ctrl, "Controller", "Spring MVC", "Handles requests")`);
		expect(d.type).toBe("C4Component");
	});

	it("parses C4Dynamic as diagram type", () => {
		const d = parse(`C4Dynamic
      Person(user, "User", "End user")`);
		expect(d.type).toBe("C4Dynamic");
	});

	it("parses C4Deployment as diagram type", () => {
		const d = parse(`C4Deployment
      Deployment_Node(aws, "AWS", "Cloud") {
      }`);
		expect(d.type).toBe("C4Deployment");
	});

	it("defaults to C4Context for unknown header", () => {
		const d = parse(`UnknownDiagram
      Person(user, "User", "A user")`);
		expect(d.type).toBe("C4Context");
	});
});

// ============================================================================
// Element declarations
// ============================================================================

describe("parseC4 – element declarations", () => {
	it("parses Person with alias, label, description", () => {
		const d = parse(`C4Context
      Person(user, "User", "A person who uses the system")`);
		expect(d.elements).toHaveLength(1);
		expect(d.elements[0]!.kind).toBe("Person");
		expect(d.elements[0]!.alias).toBe("user");
		expect(d.elements[0]!.label).toBe("User");
		expect(d.elements[0]!.description).toBe("A person who uses the system");
		expect(d.elements[0]!.external).toBe(false);
	});

	it("parses Person_Ext as external", () => {
		const d = parse(`C4Context
      Person_Ext(admin, "Admin", "External admin")`);
		expect(d.elements[0]!.kind).toBe("Person");
		expect(d.elements[0]!.external).toBe(true);
	});

	it("parses System with alias and label", () => {
		const d = parse(`C4Context
      System(sys, "My System")`);
		expect(d.elements[0]!.kind).toBe("System");
		expect(d.elements[0]!.alias).toBe("sys");
		expect(d.elements[0]!.label).toBe("My System");
		expect(d.elements[0]!.description).toBeUndefined();
	});

	it("parses System_Ext as external", () => {
		const d = parse(`C4Context
      System_Ext(ext, "External System", "Third party")`);
		expect(d.elements[0]!.external).toBe(true);
		expect(d.elements[0]!.label).toBe("External System");
	});

	it("parses Container with technology field", () => {
		const d = parse(`C4Container
      Container(web, "Web App", "Java/Spring", "Serves web pages")`);
		expect(d.elements[0]!.kind).toBe("Container");
		expect(d.elements[0]!.technology).toBe("Java/Spring");
		expect(d.elements[0]!.description).toBe("Serves web pages");
	});

	it("parses ContainerDb with technology", () => {
		const d = parse(`C4Container
      ContainerDb(db, "Database", "PostgreSQL", "Stores data")`);
		expect(d.elements[0]!.kind).toBe("ContainerDb");
		expect(d.elements[0]!.technology).toBe("PostgreSQL");
	});

	it("parses ContainerQueue with technology", () => {
		const d = parse(`C4Container
      ContainerQueue(queue, "Message Queue", "RabbitMQ", "Async messaging")`);
		expect(d.elements[0]!.kind).toBe("ContainerQueue");
		expect(d.elements[0]!.technology).toBe("RabbitMQ");
	});

	it("parses Component with technology", () => {
		const d = parse(`C4Component
      Component(ctrl, "Controller", "Spring MVC", "Handles HTTP")`);
		expect(d.elements[0]!.kind).toBe("Component");
		expect(d.elements[0]!.technology).toBe("Spring MVC");
	});

	it("parses ComponentDb with technology", () => {
		const d = parse(`C4Component
      ComponentDb(repo, "Repository", "JPA", "Data access")`);
		expect(d.elements[0]!.kind).toBe("ComponentDb");
	});

	it("parses ComponentQueue with technology", () => {
		const d = parse(`C4Component
      ComponentQueue(handler, "Event Handler", "Spring AMQP", "Processes events")`);
		expect(d.elements[0]!.kind).toBe("ComponentQueue");
	});

	it("parses _Ext variants for Container types", () => {
		const d = parse(`C4Container
      Container_Ext(ext, "External API", "REST", "Third party")`);
		expect(d.elements[0]!.external).toBe(true);
		expect(d.elements[0]!.kind).toBe("Container");
	});

	it("parses multiple elements", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")
      System(sys, "System", "Main system")
      System_Ext(ext, "Email", "Sends emails")`);
		expect(d.elements).toHaveLength(3);
	});

	it("parses element with minimal args (alias only)", () => {
		const d = parse(`C4Context
      System(sys, "System")`);
		expect(d.elements[0]!.alias).toBe("sys");
		expect(d.elements[0]!.label).toBe("System");
	});
});

// ============================================================================
// Title
// ============================================================================

describe("parseC4 – title", () => {
	it("parses title directive", () => {
		const d = parse(`C4Context
      title System Context Diagram
      Person(user, "User", "End user")`);
		expect(d.title).toBe("System Context Diagram");
	});

	it("parses quoted title", () => {
		const d = parse(`C4Context
      title "My C4 Diagram"
      Person(user, "User", "End user")`);
		expect(d.title).toBe("My C4 Diagram");
	});

	it("has no title when not specified", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")`);
		expect(d.title).toBeUndefined();
	});
});

// ============================================================================
// Boundaries
// ============================================================================

describe("parseC4 – boundaries", () => {
	it("parses System_Boundary with child elements", () => {
		const d = parse(`C4Context
      System_Boundary(sb, "System Boundary") {
        Container(web, "Web App", "Java", "Serves pages")
      }`);
		expect(d.boundaries).toHaveLength(1);
		expect(d.boundaries[0]!.kind).toBe("System_Boundary");
		expect(d.boundaries[0]!.label).toBe("System Boundary");
		expect(d.boundaries[0]!.elements).toHaveLength(1);
		expect(d.boundaries[0]!.elements[0]!.alias).toBe("web");
	});

	it("parses Container_Boundary", () => {
		const d = parse(`C4Container
      Container_Boundary(cb, "API Layer") {
        Component(ctrl, "Controller", "Spring", "Handles requests")
      }`);
		expect(d.boundaries[0]!.kind).toBe("Container_Boundary");
		expect(d.boundaries[0]!.label).toBe("API Layer");
	});

	it("parses Enterprise_Boundary", () => {
		const d = parse(`C4Context
      Enterprise_Boundary(eb, "Enterprise") {
        System(sys, "Internal System", "Core system")
      }`);
		expect(d.boundaries[0]!.kind).toBe("Enterprise_Boundary");
	});

	it("parses generic Boundary", () => {
		const d = parse(`C4Context
      Boundary(b, "Generic Boundary") {
        System(sys, "System", "A system")
      }`);
		expect(d.boundaries[0]!.kind).toBe("Boundary");
	});

	it("parses Deployment_Node boundary", () => {
		const d = parse(`C4Deployment
      Deployment_Node(aws, "AWS") {
        Container(web, "Web App", "Docker", "Runs in container")
      }`);
		expect(d.boundaries[0]!.kind).toBe("Deployment_Node");
	});

	it("parses nested boundaries", () => {
		const d = parse(`C4Context
      Enterprise_Boundary(eb, "Enterprise") {
        System_Boundary(sb, "System") {
          Container(web, "Web App", "Java", "Serves pages")
        }
      }`);
		expect(d.boundaries).toHaveLength(1);
		expect(d.boundaries[0]!.childBoundaries).toHaveLength(1);
		expect(d.boundaries[0]!.childBoundaries[0]!.kind).toBe("System_Boundary");
		expect(d.boundaries[0]!.childBoundaries[0]!.elements).toHaveLength(1);
	});

	it("sets parentBoundary on nested elements", () => {
		const d = parse(`C4Context
      System_Boundary(sb, "System") {
        Container(web, "Web App", "Java", "Serves pages")
      }`);
		// Elements inside a boundary get parentBoundary set
		const webElement = d.elements.find((e) => e.alias === "web");
		expect(webElement).toBeDefined();
		expect(webElement!.parentBoundary).toBe("sb");
	});

	it("sets parentBoundary on child boundaries", () => {
		const d = parse(`C4Context
      Enterprise_Boundary(eb, "Enterprise") {
        System_Boundary(sb, "System") {
          Container(web, "Web", "Java", "App")
        }
      }`);
		expect(d.boundaries[0]!.childBoundaries[0]!.parentBoundary).toBe("eb");
	});
});

// ============================================================================
// Relationships
// ============================================================================

describe("parseC4 – relationships", () => {
	it("parses Rel with from, to, label", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")
      System(sys, "System", "Main system")
      Rel(user, sys, "Uses")`);
		expect(d.relationships).toHaveLength(1);
		expect(d.relationships[0]!.from).toBe("user");
		expect(d.relationships[0]!.to).toBe("sys");
		expect(d.relationships[0]!.label).toBe("Uses");
	});

	it("parses Rel with technology", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")
      System(sys, "System", "Main system")
      Rel(user, sys, "Makes API calls", "JSON/HTTPS")`);
		expect(d.relationships[0]!.technology).toBe("JSON/HTTPS");
	});

	it("parses Rel_D (downward direction)", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")
      System(sys, "System", "Main system")
      Rel_D(user, sys, "Uses")`);
		expect(d.relationships[0]!.direction).toBe("D");
	});

	it("parses Rel_U (upward direction)", () => {
		const d = parse(`C4Context
      System(sys, "System", "Main system")
      Person(user, "User", "End user")
      Rel_U(sys, user, "Notifies")`);
		expect(d.relationships[0]!.direction).toBe("U");
	});

	it("parses Rel_L (left direction)", () => {
		const d = parse(`C4Context
      System(a, "A", "System A")
      System(b, "B", "System B")
      Rel_L(a, b, "Calls")`);
		expect(d.relationships[0]!.direction).toBe("L");
	});

	it("parses Rel_R (right direction)", () => {
		const d = parse(`C4Context
      System(a, "A", "System A")
      System(b, "B", "System B")
      Rel_R(a, b, "Calls")`);
		expect(d.relationships[0]!.direction).toBe("R");
	});

	it("parses Rel_Back", () => {
		const d = parse(`C4Context
      System(a, "A", "System A")
      System(b, "B", "System B")
      Rel_Back(a, b, "Returns")`);
		expect(d.relationships[0]!.direction).toBe("Back");
	});

	it("parses BiRel (bidirectional)", () => {
		const d = parse(`C4Context
      System(a, "A", "System A")
      System(b, "B", "System B")
      BiRel(a, b, "Exchanges data")`);
		expect(d.relationships).toHaveLength(1);
		expect(d.relationships[0]!.from).toBe("a");
		expect(d.relationships[0]!.to).toBe("b");
		expect(d.relationships[0]!.label).toBe("Exchanges data");
	});

	it("parses multiple relationships", () => {
		const d = parse(`C4Context
      Person(user, "User", "End user")
      System(web, "Web", "Frontend")
      System(api, "API", "Backend")
      Rel(user, web, "Visits")
      Rel(web, api, "Calls")
      Rel(api, web, "Returns data")`);
		expect(d.relationships).toHaveLength(3);
	});
});

// ============================================================================
// Full diagram
// ============================================================================

describe("parseC4 – full diagram", () => {
	it("parses a complete C4 context diagram", () => {
		const d = parse(`C4Context
      title System Context Diagram
      Person(customer, "Customer", "A customer of the bank")
      System(banking, "Internet Banking System", "Allows customers to manage accounts")
      System_Ext(email, "E-mail System", "Sends emails")
      System_Ext(mainframe, "Mainframe Banking System", "Stores account info")
      Rel(customer, banking, "Views account balances", "HTTPS")
      Rel(banking, email, "Sends emails using", "SMTP")
      Rel(banking, mainframe, "Gets account info from", "XML/HTTPS")`);

		expect(d.type).toBe("C4Context");
		expect(d.title).toBe("System Context Diagram");
		expect(d.elements).toHaveLength(4);
		expect(d.relationships).toHaveLength(3);

		const customer = d.elements.find((e) => e.alias === "customer");
		expect(customer).toBeDefined();
		expect(customer!.kind).toBe("Person");

		const email = d.elements.find((e) => e.alias === "email");
		expect(email).toBeDefined();
		expect(email!.external).toBe(true);
	});

	it("parses a C4 container diagram with boundaries", () => {
		const d = parse(`C4Container
      Person(user, "User", "End user")
      System_Boundary(sb, "Internet Banking System") {
        Container(web, "Web Application", "Java/Spring", "Delivers content")
        ContainerDb(db, "Database", "PostgreSQL", "Stores user data")
      }
      Rel(user, web, "Visits", "HTTPS")
      Rel(web, db, "Reads/writes", "JDBC")`);

		expect(d.elements).toHaveLength(3);
		expect(d.boundaries).toHaveLength(1);
		expect(d.boundaries[0]!.elements).toHaveLength(2);
		expect(d.relationships).toHaveLength(2);
	});
});
