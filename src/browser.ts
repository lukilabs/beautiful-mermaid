// ============================================================================
// Browser entry point for beautiful-mermaid
//
// Exposes renderMermaid and renderMermaidAscii on window.__mermaid so they
// can be called from inline <script> tags in samples.html.
//
// Bundled via `Bun.build({ target: 'browser' })` in index.ts.
// ============================================================================

import { diagramColorsToAsciiTheme, renderMermaidASCII } from './ascii/index.ts'
import { renderMermaidSVGAsync } from './index.ts'
import { THEMES } from './theme.ts'
import { CHART_ACCENT_FALLBACK, getSeriesColor } from './xychart/colors.ts'

declare const window: unknown

;(window as Record<string, unknown>).__mermaid = {
  renderMermaidSVGAsync,
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
  THEMES,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
}
