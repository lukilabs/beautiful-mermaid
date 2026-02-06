import type {
  C4Diagram,
  C4DiagramType,
  C4Element,
  C4ElementKind,
  C4Relationship,
  C4Boundary,
  C4BoundaryKind,
} from './types.ts'

// ============================================================================
// C4 diagram parser
//
// Parses Mermaid C4 diagram syntax into a C4Diagram structure.
//
// Supported syntax:
//   C4Context / C4Container / C4Component / C4Dynamic / C4Deployment
//
//   Person(alias, "label", "description")
//   Person_Ext(alias, "label", "description")
//   System(alias, "label", "description")
//   System_Ext(alias, "label", "description")
//   Container(alias, "label", "technology", "description")
//   ContainerDb(alias, "label", "technology", "description")
//   ContainerQueue(alias, "label", "technology", "description")
//   Component(alias, "label", "technology", "description")
//   ComponentDb(alias, "label", "technology", "description")
//   ComponentQueue(alias, "label", "technology", "description")
//   *_Ext variants for external elements
//
//   System_Boundary(alias, "label") { ... }
//   Container_Boundary(alias, "label") { ... }
//   Enterprise_Boundary(alias, "label") { ... }
//   Boundary(alias, "label") { ... }
//   Deployment_Node(alias, "label", "technology") { ... }
//
//   Rel(from, to, "label", "technology")
//   Rel_D / Rel_U / Rel_L / Rel_R / Rel_Back(from, to, "label", "technology")
//   BiRel(from, to, "label", "technology")
// ============================================================================

const DIAGRAM_TYPES: ReadonlySet<string> = new Set([
  'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment',
])

/** Element keywords mapped to their kind and argument order */
interface ElementSpec {
  kind: C4ElementKind
  /** Whether args are (alias, label, desc) or (alias, label, tech, desc) */
  hasTechnology: boolean
}

const ELEMENT_SPECS: ReadonlyMap<string, ElementSpec> = new Map([
  // Person variants
  ['Person',           { kind: 'Person',         hasTechnology: false }],
  ['Person_Ext',       { kind: 'Person',         hasTechnology: false }],
  // System variants
  ['System',           { kind: 'System',         hasTechnology: false }],
  ['System_Ext',       { kind: 'System',         hasTechnology: false }],
  // Container variants
  ['Container',        { kind: 'Container',      hasTechnology: true }],
  ['Container_Ext',    { kind: 'Container',      hasTechnology: true }],
  ['ContainerDb',      { kind: 'ContainerDb',    hasTechnology: true }],
  ['ContainerDb_Ext',  { kind: 'ContainerDb',    hasTechnology: true }],
  ['ContainerQueue',   { kind: 'ContainerQueue', hasTechnology: true }],
  ['ContainerQueue_Ext', { kind: 'ContainerQueue', hasTechnology: true }],
  // Component variants
  ['Component',        { kind: 'Component',      hasTechnology: true }],
  ['Component_Ext',    { kind: 'Component',      hasTechnology: true }],
  ['ComponentDb',      { kind: 'ComponentDb',     hasTechnology: true }],
  ['ComponentDb_Ext',  { kind: 'ComponentDb',     hasTechnology: true }],
  ['ComponentQueue',   { kind: 'ComponentQueue',  hasTechnology: true }],
  ['ComponentQueue_Ext', { kind: 'ComponentQueue', hasTechnology: true }],
])

const BOUNDARY_KINDS: ReadonlyMap<string, C4BoundaryKind> = new Map([
  ['Boundary',             'Boundary'],
  ['System_Boundary',      'System_Boundary'],
  ['Container_Boundary',   'Container_Boundary'],
  ['Enterprise_Boundary',  'Enterprise_Boundary'],
  ['Deployment_Node',      'Deployment_Node'],
])

/** Direction suffixes for Rel variants */
const REL_DIRECTIONS: ReadonlyMap<string, C4Relationship['direction']> = new Map([
  ['Rel_D',    'D'],
  ['Rel_U',    'U'],
  ['Rel_L',    'L'],
  ['Rel_R',    'R'],
  ['Rel_Back', 'Back'],
])

/**
 * Parse a Mermaid C4 diagram.
 * Expects the first line to be a C4 diagram type keyword.
 */
export function parseC4(lines: string[]): C4Diagram {
  const firstLine = lines[0]?.trim() ?? ''
  const diagramType = (DIAGRAM_TYPES.has(firstLine) ? firstLine : 'C4Context') as C4DiagramType

  const diagram: C4Diagram = {
    type: diagramType,
    elements: [],
    relationships: [],
    boundaries: [],
  }

  // Boundary nesting stack — the current scope for elements
  const boundaryStack: C4Boundary[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // --- Title ---
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      diagram.title = unquote(titleMatch[1]!.trim())
      continue
    }

    // --- Closing brace ---
    if (line === '}') {
      boundaryStack.pop()
      continue
    }

    // --- Boundary opening ---
    const boundaryMatch = line.match(/^(\w+)\s*\(([^)]*)\)\s*\{$/)
    if (boundaryMatch) {
      const keyword = boundaryMatch[1]!
      const boundaryKind = BOUNDARY_KINDS.get(keyword)
      if (boundaryKind) {
        const args = parseArgs(boundaryMatch[2]!)
        const alias = unquote(args[0] ?? '')
        const label = unquote(args[1] ?? alias)
        const parentAlias = boundaryStack.length > 0
          ? boundaryStack[boundaryStack.length - 1]!.alias
          : undefined

        const boundary: C4Boundary = {
          alias,
          label,
          kind: boundaryKind,
          elements: [],
          childBoundaries: [],
          parentBoundary: parentAlias,
        }

        if (boundaryStack.length > 0) {
          boundaryStack[boundaryStack.length - 1]!.childBoundaries.push(boundary)
        } else {
          diagram.boundaries.push(boundary)
        }

        boundaryStack.push(boundary)
        continue
      }
    }

    // --- Element declaration ---
    const elementMatch = line.match(/^(\w+)\s*\(([^)]*)\)$/)
    if (elementMatch) {
      const keyword = elementMatch[1]!
      const spec = ELEMENT_SPECS.get(keyword)
      if (spec) {
        const element = parseElement(keyword, spec, elementMatch[2]!, boundaryStack)
        if (boundaryStack.length > 0) {
          boundaryStack[boundaryStack.length - 1]!.elements.push(element)
        }
        diagram.elements.push(element)
        continue
      }

      // --- Relationship declaration ---
      const rel = parseRelationship(keyword, elementMatch[2]!)
      if (rel) {
        diagram.relationships.push(rel)
        continue
      }
    }
  }

  return diagram
}

// ============================================================================
// Argument parsing
// ============================================================================

/**
 * Parse a comma-separated argument list, handling quoted strings.
 * Supports both quoted ("value") and unquoted (value) arguments.
 */
function parseArgs(argsStr: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]!

    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === ',' && !inQuotes) {
      args.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }

  if (current.trim().length > 0) {
    args.push(current.trim())
  }

  return args
}

/** Remove surrounding quotes from a string */
function unquote(s: string): string {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1)
  }
  return s
}

// ============================================================================
// Element parsing
// ============================================================================

function parseElement(
  keyword: string,
  spec: ElementSpec,
  argsStr: string,
  boundaryStack: C4Boundary[],
): C4Element {
  const args = parseArgs(argsStr)
  const external = keyword.endsWith('_Ext')
  const parentBoundary = boundaryStack.length > 0
    ? boundaryStack[boundaryStack.length - 1]!.alias
    : undefined

  if (spec.hasTechnology) {
    // (alias, label, technology, description)
    return {
      kind: spec.kind,
      alias: unquote(args[0] ?? ''),
      label: unquote(args[1] ?? ''),
      technology: args[2] ? unquote(args[2]) : undefined,
      description: args[3] ? unquote(args[3]) : undefined,
      external,
      parentBoundary,
    }
  }

  // (alias, label, description)
  return {
    kind: spec.kind,
    alias: unquote(args[0] ?? ''),
    label: unquote(args[1] ?? ''),
    description: args[2] ? unquote(args[2]) : undefined,
    external,
    parentBoundary,
  }
}

// ============================================================================
// Relationship parsing
// ============================================================================

function parseRelationship(keyword: string, argsStr: string): C4Relationship | null {
  const isRel = keyword === 'Rel'
  const isBiRel = keyword === 'BiRel'
  const direction = REL_DIRECTIONS.get(keyword)

  if (!isRel && !isBiRel && direction === undefined) {
    return null
  }

  const args = parseArgs(argsStr)
  if (args.length < 3) return null

  const from = unquote(args[0]!)
  const to = unquote(args[1]!)
  const label = unquote(args[2]!)
  const technology = args[3] ? unquote(args[3]) : undefined

  const rel: C4Relationship = { from, to, label, technology, direction }

  if (isBiRel) {
    // BiRel is undirected — no direction, but we can note it is bidirectional
    // by omitting direction (the renderer can handle it)
    return rel
  }

  return rel
}
