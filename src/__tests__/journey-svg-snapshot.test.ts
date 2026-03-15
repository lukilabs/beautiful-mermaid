/**
 * Golden-file regression test for journey SVG rendering.
 */
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderMermaidSVG } from '../index.ts'

const snapshotDir = join(import.meta.dir, 'testdata', 'svg')

function normalizeSvg(svg: string): string {
  return svg
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim()
}

describe('renderMermaidSVG – journey snapshots', () => {
  it('matches the representative journey golden SVG', () => {
    const actual = renderMermaidSVG(`journey
      title Product journey
      section Discover
      Interview users: 4: PM, Research
      section Deliver
      Prototype<br>review: 3: Design, Eng
      Ship: 5: Eng, QA`)

    const expected = readFileSync(join(snapshotDir, 'journey-representative.svg'), 'utf-8')

    expect(normalizeSvg(actual)).toBe(normalizeSvg(expected))
  })

  it('matches the Mermaid docs journey example SVG', () => {
    const actual = renderMermaidSVG(`journey
      title My working day
      section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      Do work: 1: Me, Cat
      section Go home
      Go downstairs: 5: Me
      Sit down: 3: Me`)

    const expected = readFileSync(join(snapshotDir, 'journey-mermaid-docs-example.svg'), 'utf-8')

    expect(normalizeSvg(actual)).toBe(normalizeSvg(expected))
  })
})
