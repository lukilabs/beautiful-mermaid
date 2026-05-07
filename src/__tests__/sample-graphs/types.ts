/**
 * Shape of a sample graph shared by the layout test suite and the
 * sample-comparison tooling. Concrete samples live in the per-category
 * `sample-graphs/` modules; `index.ts` aggregates them.
 */
export interface SampleGraph {
  /** Kebab-case identifier; used as the SVG filename and the DOM id on the comparison page. */
  slug: string
  /** Human-readable name shown above the sample on the comparison page. */
  title: string
  /** Short prose describing what shape of layout this scenario stresses. */
  description: string
  /** Mermaid source; tests parse and lay this out and assert on the result. */
  source: string
}
