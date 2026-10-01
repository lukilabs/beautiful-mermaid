// ============================================================================
// Pie chart — type definitions
// ============================================================================

export interface PieSlice {
  label: string
  value: number
}

export interface PieChart {
  title?: string
  /** When true, render values next to percentages on slices. */
  showData: boolean
  slices: PieSlice[]
}
