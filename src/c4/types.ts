// ============================================================================
// C4 diagram types
//
// Models C4 model diagrams: System Context, Container, Component, Dynamic, Deployment.
// Compatible with Mermaid.js C4 syntax.
// ============================================================================

/** C4 diagram type keywords */
export type C4DiagramType = 'C4Context' | 'C4Container' | 'C4Component' | 'C4Dynamic' | 'C4Deployment'

/** Parsed C4 diagram */
export interface C4Diagram {
  type: C4DiagramType
  title?: string
  elements: C4Element[]
  relationships: C4Relationship[]
  boundaries: C4Boundary[]
}

/** A C4 element: Person, System, Container, Component, or Deployment Node */
export interface C4Element {
  kind: C4ElementKind
  alias: string
  label: string
  description?: string
  technology?: string
  /** Whether this is an external element (_Ext suffix) */
  external: boolean
  /** Parent boundary alias (if nested inside a boundary) */
  parentBoundary?: string
}

export type C4ElementKind =
  | 'Person'
  | 'System'
  | 'Container'
  | 'ContainerDb'
  | 'ContainerQueue'
  | 'Component'
  | 'ComponentDb'
  | 'ComponentQueue'
  | 'Deployment_Node'

/** A boundary (grouping box) in the diagram */
export interface C4Boundary {
  alias: string
  label: string
  kind: C4BoundaryKind
  elements: C4Element[]
  childBoundaries: C4Boundary[]
  parentBoundary?: string
}

export type C4BoundaryKind =
  | 'Boundary'
  | 'System_Boundary'
  | 'Container_Boundary'
  | 'Enterprise_Boundary'
  | 'Deployment_Node'

/** A relationship between elements */
export interface C4Relationship {
  from: string
  to: string
  label: string
  technology?: string
  direction?: 'D' | 'U' | 'L' | 'R' | 'Back'
}

// ============================================================================
// Positioned C4 diagram — ready for SVG rendering
// ============================================================================

export interface PositionedC4Diagram {
  width: number
  height: number
  title?: string
  elements: PositionedC4Element[]
  relationships: PositionedC4Relationship[]
  boundaries: PositionedC4Boundary[]
}

export interface PositionedC4Element {
  kind: C4ElementKind
  alias: string
  label: string
  description?: string
  technology?: string
  external: boolean
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedC4Relationship {
  from: string
  to: string
  label: string
  technology?: string
  points: Array<{ x: number; y: number }>
}

export interface PositionedC4Boundary {
  alias: string
  label: string
  kind: C4BoundaryKind
  x: number
  y: number
  width: number
  height: number
  children: PositionedC4Boundary[]
}
