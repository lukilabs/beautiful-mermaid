// ============================================================================
// Timeline diagram types
//
// Models Mermaid timeline diagrams in parsed and positioned form.
// Timeline diagrams show chronological milestones grouped into optional sections.
// ============================================================================

/** Parsed timeline diagram — logical structure from Mermaid text */
export interface TimelineDiagram {
  /** Optional timeline title */
  title?: string
  /** Optional accessibility title (Mermaid accTitle) */
  accessibilityTitle?: string
  /** Optional accessibility description (Mermaid accDescr) */
  accessibilityDescription?: string
  /** Ordered sections in input order */
  sections: TimelineSection[]
}

export interface TimelineSection {
  id: string
  /** Optional section label. Undefined means "ungrouped" / implicit section. */
  label?: string
  periods: TimelinePeriod[]
}

export interface TimelinePeriod {
  id: string
  label: string
  events: TimelineEvent[]
}

export interface TimelineEvent {
  id: string
  text: string
}

// ============================================================================
// Positioned timeline diagram — ready for SVG rendering
// ============================================================================

export interface PositionedTimelineDiagram {
  width: number
  height: number
  title?: PositionedTimelineTitle
  accessibilityTitle?: string
  accessibilityDescription?: string
  rail: TimelineRail
  sections: PositionedTimelineSection[]
}

export interface PositionedTimelineTitle {
  text: string
  x: number
  y: number
}

export interface TimelineRail {
  x1: number
  x2: number
  y: number
}

export interface PositionedTimelineSection {
  id: string
  label?: string
  x: number
  y: number
  width: number
  height: number
  /** Whether to render a framed background for this section. */
  framed: boolean
  /** Height of the section header band. 0 when there is no visible header row. */
  headerHeight: number
  periods: PositionedTimelinePeriod[]
}

export interface PositionedTimelinePeriod {
  id: string
  sectionId: string
  label: string
  centerX: number
  markerY: number
  pillX: number
  pillY: number
  pillWidth: number
  pillHeight: number
  stemTopY: number
  stemBottomY: number
  events: PositionedTimelineEvent[]
}

export interface PositionedTimelineEvent {
  id: string
  sectionId: string
  periodId: string
  periodLabel: string
  text: string
  x: number
  y: number
  width: number
  height: number
}
