/**
 * Tests for the timeline diagram parser.
 *
 * Covers: title, sections, implicit sections, multi-event periods,
 * continuation lines, and error cases.
 */
import { describe, it, expect } from 'bun:test'
import { parseTimelineDiagram } from '../timeline/parser.ts'

function parse(text: string) {
  return parseTimelineDiagram(text.split('\n').map(line => line.trim()).filter(Boolean))
}

describe('parseTimelineDiagram', () => {
  it('parses a basic timeline with a title', () => {
    const diagram = parse(`timeline
      title Product history
      2022 : Private alpha
      2023 : Public launch`)

    expect(diagram.title).toBe('Product history')
    expect(diagram.sections).toHaveLength(1)
    expect(diagram.sections[0]!.periods).toHaveLength(2)
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2022')
    expect(diagram.sections[0]!.periods[0]!.events[0]!.text).toBe('Private alpha')
  })

  it('parses named sections in order', () => {
    const diagram = parse(`timeline
      section Foundation
      2020 : Prototype
      2021 : Beta
      section Growth
      2022 : Launch`)

    expect(diagram.sections).toHaveLength(2)
    expect(diagram.sections[0]!.label).toBe('Foundation')
    expect(diagram.sections[1]!.label).toBe('Growth')
    expect(diagram.sections[1]!.periods[0]!.label).toBe('2022')
  })

  it('creates an implicit section for periods before the first section', () => {
    const diagram = parse(`timeline
      2021 : Quiet alpha
      section Public
      2022 : Launch`)

    expect(diagram.sections).toHaveLength(2)
    expect(diagram.sections[0]!.label).toBeUndefined()
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2021')
    expect(diagram.sections[1]!.label).toBe('Public')
  })

  it('parses multiple events on a single period line', () => {
    const diagram = parse(`timeline
      2024 : Design refresh : Timeline support`)

    expect(diagram.sections[0]!.periods[0]!.events.map(event => event.text)).toEqual([
      'Design refresh',
      'Timeline support',
    ])
  })

  it('parses continuation lines onto the previous period', () => {
    const diagram = parse(`timeline
      2024 : Design refresh
           : Timeline support
           : Craft polish`)

    expect(diagram.sections[0]!.periods[0]!.events.map(event => event.text)).toEqual([
      'Design refresh',
      'Timeline support',
      'Craft polish',
    ])
  })

  it('normalizes <br> tags in title, section labels, periods, and events', () => {
    const diagram = parse(`timeline
      title Platform<br>History
      section Product<br>Work
      2024<br>Q1 : Soft<br>launch`)

    expect(diagram.title).toBe('Platform\nHistory')
    expect(diagram.sections[0]!.label).toBe('Product\nWork')
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2024\nQ1')
    expect(diagram.sections[0]!.periods[0]!.events[0]!.text).toBe('Soft\nlaunch')
  })


  it('parses accessibility metadata without turning it into timeline content', () => {
    const diagram = parse(`timeline
      accTitle: Accessible roadmap
      accDescr: Product launch plan
      2024 : Private alpha`)

    expect(diagram.accessibilityTitle).toBe('Accessible roadmap')
    expect(diagram.accessibilityDescription).toBe('Product launch plan')
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2024')
  })

  it('parses multiline accDescr blocks', () => {
    const diagram = parse(`timeline
      accDescr {
      First line
      Second line
      }
      2024 : Launch`)

    expect(diagram.accessibilityDescription).toBe('First line\nSecond line')
  })

  it('preserves colons inside event text when they are not event separators', () => {
    const diagram = parse(`timeline
      2024 : 10:30 launch : api:v2`)

    expect(diagram.sections[0]!.periods[0]!.events.map(event => event.text)).toEqual([
      '10:30 launch',
      'api:v2',
    ])
  })

  it('ignores hash-style comment lines supported by Mermaid timeline syntax', () => {
    const diagram = parse(`timeline
      # release milestones
      2024 : Launch`)

    expect(diagram.sections[0]!.periods[0]!.label).toBe('2024')
  })

  it('throws when a continuation appears before any period', () => {
    expect(() => parse(`timeline
      : orphaned event`)).toThrow('Timeline continuation found before any period was declared')
  })

  it('throws on unsupported timeline syntax instead of silently ignoring it', () => {
    expect(() => parse(`timeline
      release now`)).toThrow('Unsupported timeline syntax: "release now"')
  })

  it('throws when the diagram has no periods', () => {
    expect(() => parse(`timeline
      title Empty`)).toThrow('Timeline diagram must include at least one period with events')
  })
})
