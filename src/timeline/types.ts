// ============================================================================
// Timeline — type definitions
// ============================================================================

export type TimelineDirection = 'LR' | 'TD'

export interface TimelinePeriod {
  label: string
  events: string[]
}

export interface TimelineSection {
  name: string
  periods: TimelinePeriod[]
}

export interface TimelineDiagram {
  title?: string
  direction: TimelineDirection
  sections: TimelineSection[]
}
