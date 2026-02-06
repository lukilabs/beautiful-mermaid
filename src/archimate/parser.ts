import type {
  ArchiMateDiagram,
  ArchiMateElement,
  ArchiMateElementType,
  ArchiMateLayer,
  ArchiMateRelationship,
  ArchiMateRelationshipType,
} from './types.ts'

// ============================================================================
// ArchiMate diagram parser
//
// Parses the archimate-layered DSL syntax into an ArchiMateDiagram structure.
//
// Supported syntax:
//   archimate-layered
//     business:
//       actor Customer
//       service "Online Banking" as OB
//     application:
//       component "Web App" as WA
//     Customer -->|serves| OB
//     OB -->|realizes| WA
//
// Layer blocks: business:, application:, technology:, strategy:,
//               motivation:, physical:, implementation:
//
// Element syntax:
//   elementType alias                    → id=alias, label=alias
//   elementType "Label" as alias         → id=alias, label=Label
//   elementType "Label"                  → id=Label (spaces → _), label=Label
//
// Relationship syntax:
//   source -->|type| target              → typed relationship
//   source --> target                    → association (default)
// ============================================================================

/** Valid element types per layer */
const LAYER_ELEMENT_TYPES: Record<ArchiMateLayer, ReadonlySet<string>> = {
  business: new Set([
    'actor', 'role', 'process', 'function', 'service', 'object',
    'event', 'interface', 'collaboration', 'interaction',
    'contract', 'representation', 'product',
  ]),
  application: new Set([
    'component', 'collaboration', 'interface', 'function', 'interaction',
    'process', 'event', 'service', 'dataObject',
  ]),
  technology: new Set([
    'node', 'device', 'systemSoftware', 'artifact',
    'communicationNetwork', 'path', 'interface', 'function',
    'process', 'interaction', 'event', 'service',
  ]),
  strategy: new Set([
    'resource', 'capability', 'valueStream', 'courseOfAction',
  ]),
  motivation: new Set([
    'stakeholder', 'driver', 'assessment', 'goal', 'outcome',
    'principle', 'requirement', 'constraint', 'meaning', 'value',
  ]),
  physical: new Set([
    'equipment', 'facility', 'distributionNetwork', 'material',
  ]),
  implementation: new Set([
    'workPackage', 'deliverable', 'implementationEvent', 'plateau', 'gap',
  ]),
}

/** All valid relationship type names */
const RELATIONSHIP_TYPES: ReadonlySet<string> = new Set([
  'composition', 'aggregation', 'assignment', 'realization',
  'serving', 'access', 'influence', 'triggering', 'flow',
  'specialization', 'association',
])

/** All valid layer names */
const LAYER_NAMES: ReadonlySet<string> = new Set([
  'business', 'application', 'technology', 'strategy',
  'motivation', 'physical', 'implementation',
])

/** Build a set of all valid element type names across all layers */
function buildAllElementTypes(): ReadonlySet<string> {
  const all = new Set<string>()
  for (const types of Object.values(LAYER_ELEMENT_TYPES)) {
    for (const t of types) all.add(t)
  }
  return all
}

const ALL_ELEMENT_TYPES = buildAllElementTypes()

/**
 * Parse a Mermaid ArchiMate diagram.
 * Expects the first non-empty, non-comment line to be "archimate-layered".
 */
export function parseArchimate(lines: string[]): ArchiMateDiagram {
  const diagram: ArchiMateDiagram = {
    layers: new Map(),
    elements: new Map(),
    relationships: [],
  }

  let currentLayer: ArchiMateLayer | null = null

  // Start from index 1 — skip the "archimate-layered" header
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!
    const trimmed = raw.trim()

    // Skip empty lines and comments
    if (trimmed.length === 0 || trimmed.startsWith('%%')) continue

    // Check for layer block header (e.g., "business:", "application:")
    const layerMatch = trimmed.match(/^(\w+):$/)
    if (layerMatch && LAYER_NAMES.has(layerMatch[1]!)) {
      currentLayer = layerMatch[1]! as ArchiMateLayer
      if (!diagram.layers.has(currentLayer)) {
        diagram.layers.set(currentLayer, [])
      }
      continue
    }

    // Try to parse a relationship (can appear anywhere)
    const rel = parseRelationship(trimmed)
    if (rel) {
      diagram.relationships.push(rel)
      continue
    }

    // Try to parse an element declaration (only valid inside a layer block)
    if (currentLayer) {
      const element = parseElement(trimmed, currentLayer)
      if (element) {
        diagram.elements.set(element.id, element)
        const layerElements = diagram.layers.get(currentLayer)
        if (layerElements) {
          layerElements.push(element)
        } else {
          diagram.layers.set(currentLayer, [element])
        }
        continue
      }
    }

    // Lines outside a layer block that aren't relationships are ignored.
    // If we're inside a layer block and the line doesn't match any pattern,
    // check if it could be a top-level construct that resets the layer context.
    if (currentLayer && !raw.match(/^\s/) && !layerMatch) {
      // Non-indented line that's not a layer header — we're leaving the block
      currentLayer = null
      // Re-try as a relationship
      const topRel = parseRelationship(trimmed)
      if (topRel) {
        diagram.relationships.push(topRel)
      }
    }
  }

  return diagram
}

/**
 * Parse an element declaration line.
 *
 * Formats:
 *   elementType alias                    → id=alias, label=alias
 *   elementType "Label" as alias         → id=alias, label=Label
 *   elementType "Label"                  → id=Label (spaces→_), label=Label
 */
function parseElement(line: string, layer: ArchiMateLayer): ArchiMateElement | null {
  // Try: elementType "Label" as alias
  const quotedAliasMatch = line.match(/^(\w+)\s+"([^"]+)"\s+as\s+(\w+)$/)
  if (quotedAliasMatch) {
    const typeName = quotedAliasMatch[1]!
    if (!isValidElementType(typeName, layer)) return null
    return {
      id: quotedAliasMatch[3]!,
      label: quotedAliasMatch[2]!,
      type: typeName as ArchiMateElementType,
      layer,
    }
  }

  // Try: elementType "Label"
  const quotedMatch = line.match(/^(\w+)\s+"([^"]+)"$/)
  if (quotedMatch) {
    const typeName = quotedMatch[1]!
    if (!isValidElementType(typeName, layer)) return null
    const label = quotedMatch[2]!
    return {
      id: label.replace(/\s+/g, '_'),
      label,
      type: typeName as ArchiMateElementType,
      layer,
    }
  }

  // Try: elementType alias
  const simpleMatch = line.match(/^(\w+)\s+(\w+)$/)
  if (simpleMatch) {
    const typeName = simpleMatch[1]!
    if (!isValidElementType(typeName, layer)) return null
    const alias = simpleMatch[2]!
    return {
      id: alias,
      label: alias,
      type: typeName as ArchiMateElementType,
      layer,
    }
  }

  return null
}

/** Check if a type name is a valid element type for the given layer */
function isValidElementType(typeName: string, layer: ArchiMateLayer): boolean {
  // Check layer-specific types first, then fall back to all types
  // (some types like 'service', 'interface', 'function' appear in multiple layers)
  const layerTypes = LAYER_ELEMENT_TYPES[layer]
  if (layerTypes && layerTypes.has(typeName)) return true
  // Also accept any valid element type — the layer just provides context
  return ALL_ELEMENT_TYPES.has(typeName)
}

/**
 * Parse a relationship line.
 *
 * Formats:
 *   source -->|type| target        → typed relationship
 *   source --> target              → association (default)
 */
function parseRelationship(line: string): ArchiMateRelationship | null {
  // Try: source -->|type| target
  const typedMatch = line.match(/^(\w+)\s+-->\|(\w+)\|\s+(\w+)$/)
  if (typedMatch) {
    const relType = typedMatch[2]!
    if (!RELATIONSHIP_TYPES.has(relType)) return null
    return {
      source: typedMatch[1]!,
      target: typedMatch[3]!,
      type: relType as ArchiMateRelationshipType,
    }
  }

  // Try: source --> target (default association)
  const simpleMatch = line.match(/^(\w+)\s+-->\s+(\w+)$/)
  if (simpleMatch) {
    return {
      source: simpleMatch[1]!,
      target: simpleMatch[2]!,
      type: 'association',
    }
  }

  return null
}
