/**
 * Renders comparison samples through beautiful-mermaid itself — i.e. the
 * code under test. Run twice (against two different checkouts) to get a
 * before/after pair the comparison page can diff.
 */
import { renderMermaidSVG } from '../../../src/index.ts'
import type { RenderBackend } from './types.ts'

export const bmBackend: RenderBackend = {
  name: 'beautiful-mermaid',
  render(source) {
    return renderMermaidSVG(source, { bg: '#ffffff', fg: '#1f2937' })
  },
}
