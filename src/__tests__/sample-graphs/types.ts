/**
 * Shared type for sample graphs that travel between layout tests and the
 * sample-comparison tooling. Keep these in `sample-graphs/` modules — adding
 * a new module (re-exported from `index.ts`) makes the scenario appear in
 * both the test suite and the comparison page automatically.
 */
export interface SampleGraph {
  /** Kebab-case identifier; used as the SVG filename and DOM id. */
  slug: string
  /** Human-readable name shown in the comparison page. */
  title: string
  /** Why this scenario exists — what shape of layout it stresses. */
  description: string
  /** Mermaid source. The test asserts against the layout produced from this string. */
  source: string
}
