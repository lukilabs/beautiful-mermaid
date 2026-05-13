/**
 * Pluggable rendering backend used by compare-render.ts. Each backend
 * converts a mermaid source string to an SVG; the comparison pipeline
 * wraps that with the iteration loop, output writing, and failure
 * tracking common to every backend.
 */
export interface RenderBackend {
  /** Identifier shown in logs and used as the `--backend=<name>` flag value. */
  name: string
  /**
   * Optional one-time setup. May exit the process if the backend cannot
   * run (for example, if a required external binary is unavailable).
   */
  init?(): void
  /** Converts a mermaid source string to SVG. Throws with a one-line message on failure. */
  render(source: string): string
  /** Optional one-time teardown for any resources init() acquired. */
  cleanup?(): void
}
