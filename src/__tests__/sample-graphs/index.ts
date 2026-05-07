/**
 * Single-import surface for every layout-stressing sample diagram.
 *
 * Both the test suite and the comparison-page tooling read from here. To add
 * a new scenario: append to the appropriate category file (or create a new
 * one and register it below). It will appear in the comparison page on the
 * next render.
 */
import { BUG_REPRO_SAMPLES } from './bug-repro.ts'
import { DIRECTION_PERMUTATION_SAMPLES } from './direction-permutations.ts'
import { MULTI_LEVEL_WORKFLOW_SAMPLES } from './multi-level-workflows.ts'
import { STRESS_SUITE_SAMPLES } from './stress-suite.ts'
import type { SampleGraph } from './types.ts'

export type { SampleGraph } from './types.ts'

/** Every sample, in render order. */
export const ALL_SAMPLE_GRAPHS: ReadonlyArray<SampleGraph> = [
  ...BUG_REPRO_SAMPLES,
  ...DIRECTION_PERMUTATION_SAMPLES,
  ...MULTI_LEVEL_WORKFLOW_SAMPLES,
  ...STRESS_SUITE_SAMPLES,
]

/** O(1) lookup by slug, for tests that only care about a single sample. */
export const SAMPLE_GRAPHS: Readonly<Record<string, SampleGraph>> =
  Object.freeze(Object.fromEntries(ALL_SAMPLE_GRAPHS.map(s => [s.slug, s])))

export {
  BUG_REPRO_SAMPLES,
  DIRECTION_PERMUTATION_SAMPLES,
  MULTI_LEVEL_WORKFLOW_SAMPLES,
  STRESS_SUITE_SAMPLES,
}
