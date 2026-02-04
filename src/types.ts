// ============================================================================
// Parsed graph — logical structure extracted from Mermaid text
// ============================================================================

export interface MermaidGraph {
  direction: Direction
  nodes: Map<string, MermaidNode>
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
  classDefs: Map<string, Record<string, string>>
  /** Maps node IDs to their class names (from `class X className` or `:::className` shorthand) */
  classAssignments: Map<string, string>
  /** Maps node IDs to inline styles (from `style X fill:#f00,stroke:#333`) */
  nodeStyles: Map<string, Record<string, string>>
}

export type Direction = 'TD' | 'TB' | 'LR' | 'BT' | 'RL'

export interface MermaidNode {
  id: string
  label: string
  shape: NodeShape
}

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'diamond'
  | 'stadium'
  | 'circle'
  // Batch 1 additions
  | 'subroutine'     // [[text]]  — double-bordered rectangle
  | 'doublecircle'   // (((text))) — concentric circles
  | 'hexagon'        // {{text}}  — six-sided polygon
  // Batch 2 additions
  | 'cylinder'       // [(text)]  — database cylinder
  | 'asymmetric'     // >text]    — flag/banner shape
  | 'trapezoid'      // [/text\]  — wider bottom
  | 'trapezoid-alt'  // [\text/]  — wider top
  // Batch 3 state diagram pseudostates
  | 'state-start'    // filled circle (start pseudostate)
  | 'state-end'      // bullseye circle (end pseudostate)

export interface MermaidEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  /** Whether to render an arrowhead at the start (source end) of the edge */
  hasArrowStart: boolean
  /** Whether to render an arrowhead at the end (target end) of the edge */
  hasArrowEnd: boolean
}

export type EdgeStyle = 'solid' | 'dotted' | 'thick'

export interface MermaidSubgraph {
  id: string
  label: string
  nodeIds: string[]
  children: MermaidSubgraph[]
  /** Optional direction override for this subgraph's internal layout */
  direction?: Direction
}

// ============================================================================
// Positioned graph — after dagre layout, ready for SVG rendering
// ============================================================================

export interface PositionedGraph {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  groups: PositionedGroup[]
}

export interface PositionedNode {
  id: string
  label: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  /** Inline styles resolved from classDef + explicit `style` statements — override theme defaults */
  inlineStyle?: Record<string, string>
}

export interface PositionedEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  hasArrowStart: boolean
  hasArrowEnd: boolean
  /** Full path including bends — array of {x, y} points */
  points: Point[]
  /** Layout-computed label center position (avoids label-label collisions) */
  labelPosition?: Point
}

export interface Point {
  x: number
  y: number
}

export interface PositionedGroup {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: PositionedGroup[]
}

// ============================================================================
// Render options — user-facing configuration
//
// Color theming uses CSS custom properties: --bg and --fg are required,
// optional enrichment variables (--line, --accent, --muted, --surface,
// --border) add richer color from Shiki themes or custom palettes.
// See src/theme.ts for the full variable system.
// ============================================================================

export interface RenderOptions {
  /** Background color → CSS variable --bg. Default: '#FFFFFF' */
  bg?: string
  /** Foreground / primary text color → CSS variable --fg. Default: '#27272A' */
  fg?: string

  // -- Optional enrichment colors (fall back to color-mix from bg/fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string

  /** Font family for all text. Default: 'Inter' */
  font?: string
  /** Canvas padding in px. Default: 40 */
  padding?: number
  /** Horizontal spacing between sibling nodes. Default: 24 */
  nodeSpacing?: number
  /** Vertical spacing between layers. Default: 40 */
  layerSpacing?: number
  /**
   * Render with transparent background. Default: false.
   *
   * In static mode, uses explicit `background:none` on the SVG root.
   * In dynamic mode, omits the background style entirely.
   */
  transparent?: boolean
  /**
   * Output mode for color handling. Default: 'dynamic'.
   *
   * - `'dynamic'` - colors are set via CSS custom properties on the `<svg>` tag
   *   with `color-mix()` fallbacks in a `<style>` block. Produces compact,
   *   themeable SVG that works in modern browsers.
   *
   * - `'static'` - all colors are resolved to literal hex values at render time.
   *   Produces PDF-compatible SVG for renderers (Typst, WeasyPrint, Inkscape,
   *   librsvg) that don't evaluate CSS custom properties or `color-mix()`.
   */
  output?: 'dynamic' | 'static'

  /**
   * Pre-resolved color palette. When provided, skips resolveColors() computation.
   * Useful for rendering multiple diagrams with the same palette - resolve once,
   * reuse across calls. Implies output: 'static'.
   *
   * @example
   * ```ts
   * const palette = resolveColors({ bg: '#1a1b26', fg: '#a9b1d6' })
   * const svg1 = await renderMermaid(diagram1, { resolvedColors: palette })
   * const svg2 = await renderMermaid(diagram2, { resolvedColors: palette })
   * ```
   */
  resolvedColors?: import('./theme.ts').ResolvedColors

  /**
   * When true, omits the `<style>` block entirely from static SVG output.
   * Font-family attributes are inlined directly on `<text>` elements instead.
   * Only applies when output is 'static' (or resolvedColors is set).
   *
   * Useful for environments that strip `<style>` blocks (email clients,
   * some PDF renderers, SVG sanitizers).
   */
  noStyleBlock?: boolean

  /**
   * Custom marker ID prefix for multi-SVG isolation.
   * When multiple SVGs share a DOM, marker IDs (arrowheads, etc.) can collide.
   * Set this to a unique string per diagram, or leave unset for auto-generation.
   * Pass `false` to disable namespacing (use bare IDs like 'arrowhead').
   */
  markerId?: string | false
}
