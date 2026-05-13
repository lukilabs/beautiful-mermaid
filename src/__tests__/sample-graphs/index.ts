/**
 * Aggregates every layout-stress sample graph from the per-category modules
 * into a flat list and a slug-keyed lookup. Both the test suite and the
 * sample-comparison tooling import from here.
 */
import { REAL_SAMPLES } from './real-samples.ts'
import { DIRECTION_PERMUTATION_SAMPLES } from './direction-permutations.ts'
import { MULTI_LEVEL_WORKFLOW_SAMPLES } from './multi-level-workflows.ts'
import { STRESS_SUITE_SAMPLES } from './stress-suite.ts'
import { SEPARATE_CHILDREN_REASON_2_SAMPLES } from './separate-children-reason-2-leaf-migration.ts'
import { SEPARATE_CHILDREN_REASON_3_SAMPLES } from './separate-children-reason-3-port-passthrough.ts'
import type { SampleGraph } from './types.ts'

export type { SampleGraph } from './types.ts'

/** Every sample in render order — real-world repros, direction permutations, multi-level workflows, stress suite, isolated SEPARATE_CHILDREN reason samples. */
export const ALL_SAMPLE_GRAPHS: ReadonlyArray<SampleGraph> = [
  ...REAL_SAMPLES,
  ...DIRECTION_PERMUTATION_SAMPLES,
  ...MULTI_LEVEL_WORKFLOW_SAMPLES,
  ...STRESS_SUITE_SAMPLES,
  ...SEPARATE_CHILDREN_REASON_2_SAMPLES,
  ...SEPARATE_CHILDREN_REASON_3_SAMPLES,
]

/** Slug-keyed lookup; tests use this to grab a single sample by id. */
export const SAMPLE_GRAPHS: Readonly<Record<string, SampleGraph>> =
  Object.freeze(Object.fromEntries(ALL_SAMPLE_GRAPHS.map(s => [s.slug, s])))

export {
  REAL_SAMPLES,
  DIRECTION_PERMUTATION_SAMPLES,
  MULTI_LEVEL_WORKFLOW_SAMPLES,
  STRESS_SUITE_SAMPLES,
  SEPARATE_CHILDREN_REASON_2_SAMPLES,
  SEPARATE_CHILDREN_REASON_3_SAMPLES,
}
