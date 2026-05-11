/**
 * Shape of a sample graph shared by the layout test suite and the
 * sample-comparison tooling. Concrete samples live in the per-category
 * `sample-graphs/` modules; `index.ts` aggregates them.
 *
 * The optional fields below drive the parameterised assertions in
 * `layout-samples.test.ts`: every sample iterated by `ALL_SAMPLE_GRAPHS`
 * gets one `it` per applicable field. A sample only declares the
 * properties it wants checked; missing fields skip their assertion.
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

  /** Maximum acceptable right-angle crossings between distinct edges. Defaults to 0. */
  maxCrossings?: number

  /** Map of leaf id → expected subgraph id or label. */
  containment?: Record<string, string>

  /**
   * Each entry asserts a strict ordering along one axis: for every
   * consecutive pair of `items`, the second sits further along that
   * axis than the first. Items can be either leaf ids or subgraph
   * labels — the test resolves whichever matches.
   */
  expectedAxisOrder?: Array<{ axis: 'x' | 'y'; items: string[] }>

  /**
   * Each entry is a nesting chain: every label/id (except the last)
   * must geometrically contain the next. Labels resolve to subgraphs;
   * the last entry can be a leaf. Used to assert deep nesting structure.
   */
  expectedNesting?: string[][]

  /**
   * Aspect-ratio expectations on specific subgraphs: `taller: true`
   * asserts height > width (a TB stack), `wider: true` asserts the
   * opposite (an LR row). Pick one per entry.
   */
  expectedSubgraphAspect?: Array<{ subgraph: string; taller?: boolean; wider?: boolean }>

  /**
   * Cross-hier edges whose polyline must end on its target's bounding
   * box. Catches the failure mode where ELK leaves the port → leaf
   * section empty and the assembled polyline stops short of the target.
   */
  expectedEdgesReachTargets?: Array<{ source: string; target: string }>

  /** When true, asserts no two distinct edges share a colinear segment longer than 6px (i.e. no arrows drawn on top of each other). */
  expectNoColinearOverlap?: boolean

  /** When set, asserts the diagram's overall `height / width` is at least this value — used to catch graphs that should be tall but flip horizontal. */
  minGraphHeightOverWidth?: number
}
