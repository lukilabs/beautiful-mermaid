// ============================================================================
// Pie Chart types
//
// Models the parsed (AST) and positioned representations of a Mermaid pie
// chart diagram.
// ============================================================================

/** A single slice in the parsed pie chart */
export interface PieSlice {
  /** Slice category label (e.g. "Dogs", "Calcium") */
  label: string
  /** Raw numeric value */
  value: number
}

/** Parsed Pie chart — logical structure from mermaid text */
export interface PieChart {
  /** Optional chart title */
  title?: string
  /** Whether to show raw data values alongside labels */
  showData: boolean
  /** List of data slices */
  slices: PieSlice[]
}

// ============================================================================
// Positioned Pie chart — ready for SVG rendering
// ============================================================================

/** Callout line coordinates for slices that are too narrow for inside labels */
export interface CalloutLine {
  /** Start point on slice arc */
  x1: number
  y1: number
  /** Elbow / knee point */
  x2: number
  y2: number
  /** End point near label */
  x3: number
  y3: number
}

/** A positioned slice ready for SVG rendering */
export interface PositionedSlice {
  /** Slice label */
  label: string
  /** Original numeric value */
  value: number
  /** Percentage of total (0 to 1, e.g. 0.4296 for 42.96%) */
  percentage: number
  /** Formatted percentage text (e.g. "43%" or "42.96%") */
  percentageText: string
  /** Start angle in radians */
  startAngle: number
  /** End angle in radians */
  endAngle: number
  /** Mid-angle of the slice in radians */
  midAngle: number
  /** SVG path `d` string */
  pathData: string
  /** Resolved color hex */
  color: string
  /** Color index for CSS variable mapping (`--pie-color-N`) */
  colorIndex: number
  /** Label position */
  labelX: number
  labelY: number
  /** Text anchor for label ('middle' for inside slice, 'start'/'end' for callouts) */
  textAnchor: 'start' | 'middle' | 'end'
  /** Text to render for the label (empty if label is omitted) */
  labelText?: string
  /** Whether this slice uses an external callout line */
  hasCallout: boolean
  /** Coordinates for the callout line if hasCallout is true */
  calloutLine?: CalloutLine
}

/** Legend item for pie chart */
export interface PieLegendItem {
  /** Display label text */
  label: string
  /** Raw slice value */
  value: number
  /** Percentage of total (0 to 1) */
  percentage: number
  /** X coordinate of swatch */
  x: number
  /** Y coordinate (center line of swatch and text) */
  y: number
  /** Color index matching slice */
  colorIndex: number
}

/** Chart title positioned in SVG coordinates */
export interface PositionedTitle {
  text: string
  x: number
  y: number
}

/** Positioned Pie chart */
export interface PositionedPieChart {
  /** Total canvas width */
  width: number
  /** Total canvas height */
  height: number
  /** Center X of pie */
  cx: number
  /** Center Y of pie */
  cy: number
  /** Pie radius */
  radius: number
  /** Optional chart title */
  title?: PositionedTitle
  /** Positioned slices */
  slices: PositionedSlice[]
  /** Legend items */
  legend: PieLegendItem[]
  /** Whether raw data values are enabled */
  showData: boolean
  /** Sum of all slice values */
  totalValue: number
}
