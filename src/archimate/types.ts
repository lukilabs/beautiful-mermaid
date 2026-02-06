// ============================================================================
// ArchiMate diagram types
//
// Models ArchiMate 3.2 enterprise architecture diagrams.
// Supports layered views with Business, Application, Technology, Strategy,
// Motivation, Physical, and Implementation & Migration layers.
// ============================================================================

/** ArchiMate layer names */
export type ArchiMateLayer =
  | 'business'
  | 'application'
  | 'technology'
  | 'strategy'
  | 'motivation'
  | 'physical'
  | 'implementation'

/** ArchiMate element type (union of all layer-specific element types) */
export type ArchiMateElementType =
  // Business
  | 'actor' | 'role' | 'process' | 'function' | 'service' | 'object'
  | 'event' | 'interface' | 'collaboration' | 'interaction'
  | 'contract' | 'representation' | 'product'
  // Application
  | 'component' | 'dataObject'
  // Technology
  | 'node' | 'device' | 'systemSoftware' | 'artifact'
  | 'communicationNetwork' | 'path'
  // Strategy
  | 'resource' | 'capability' | 'valueStream' | 'courseOfAction'
  // Motivation
  | 'stakeholder' | 'driver' | 'assessment' | 'goal' | 'outcome'
  | 'principle' | 'requirement' | 'constraint' | 'meaning' | 'value'
  // Physical
  | 'equipment' | 'facility' | 'distributionNetwork' | 'material'
  // Implementation & Migration
  | 'workPackage' | 'deliverable' | 'implementationEvent' | 'plateau' | 'gap'

/** ArchiMate relationship types */
export type ArchiMateRelationshipType =
  | 'composition' | 'aggregation' | 'assignment' | 'realization'
  | 'serving' | 'access' | 'influence' | 'triggering' | 'flow'
  | 'specialization' | 'association'

/** An element in the ArchiMate diagram */
export interface ArchiMateElement {
  id: string
  label: string
  type: ArchiMateElementType
  layer: ArchiMateLayer
}

/** A relationship between elements */
export interface ArchiMateRelationship {
  source: string
  target: string
  type: ArchiMateRelationshipType
  label?: string
}

/** Parsed ArchiMate diagram */
export interface ArchiMateDiagram {
  layers: Map<ArchiMateLayer, ArchiMateElement[]>
  elements: Map<string, ArchiMateElement>
  relationships: ArchiMateRelationship[]
}

// ============================================================================
// Positioned ArchiMate diagram — ready for SVG rendering
// ============================================================================

export interface PositionedArchiMateDiagram {
  width: number
  height: number
  layers: PositionedArchiMateLayer[]
  elements: PositionedArchiMateElement[]
  relationships: PositionedArchiMateRelationship[]
}

export interface PositionedArchiMateLayer {
  name: ArchiMateLayer
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedArchiMateElement {
  id: string
  label: string
  type: ArchiMateElementType
  layer: ArchiMateLayer
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedArchiMateRelationship {
  source: string
  target: string
  type: ArchiMateRelationshipType
  label?: string
  points: Array<{ x: number; y: number }>
}
