// ============================================================================
// Browser entry point for beautiful-mermaid
//
// Exposes renderMermaid and renderMermaidAscii on window.__mermaid so they
// can be called from inline <script> tags in samples.html.
//
// Bundled via `Bun.build({ target: 'browser' })` in index.ts.
// ============================================================================

import { renderMermaidSVGAsync } from './index.ts'
import { renderMermaidASCII, diagramColorsToAsciiTheme } from './ascii/index.ts'
import { THEMES } from './theme.ts'
import { getSeriesColor, CHART_ACCENT_FALLBACK } from './xychart/colors.ts'

declare const window: unknown

;(window as Record<string, unknown>).__mermaid = {
  renderMermaidSVGAsync,
  renderMermaidASCII,
  diagramColorsToAsciiTheme,
  THEMES,
  getSeriesColor,
  CHART_ACCENT_FALLBACK,
}
