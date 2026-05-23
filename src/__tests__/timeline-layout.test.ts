/**
 * Layout tests for timeline diagrams — verify spacing, bounds, and section framing.
 */
import { describe, it, expect } from 'bun:test'
import { parseTimelineDiagram } from '../timeline/parser.ts'
import { layoutTimelineDiagram } from '../timeline/layout.ts'

function layout(source: string) {
  const lines = source.split('\n').map(line => line.trim()).filter(Boolean)
  return layoutTimelineDiagram(parseTimelineDiagram(lines))
}

describe('timeline layout', () => {
  it('extends the rail beyond a single period marker and keeps the event below it', () => {
    const diagram = layout(`timeline
      2024 : Launch`)
    const section = diagram.sections[0]!
    const period = section.periods[0]!
    const event = period.events[0]!

    expect(diagram.rail.x1).toBeLessThan(period.centerX)
    expect(diagram.rail.x2).toBeGreaterThan(period.centerX)
    expect(period.pillX + period.pillWidth / 2).toBe(period.centerX)
    expect(period.stemBottomY).toBeLessThan(event.y)
    expect(event.y + event.height).toBeLessThanOrEqual(section.y + section.height)
  })

  it('keeps period columns in order without overlapping event cards', () => {
    const diagram = layout(`timeline
      2022 : Alpha
      2023 : Beta release
      2024 : General availability`)
    const periods = diagram.sections[0]!.periods

    expect(periods).toHaveLength(3)
    expect(periods[0]!.centerX).toBeLessThan(periods[1]!.centerX)
    expect(periods[1]!.centerX).toBeLessThan(periods[2]!.centerX)

    const firstEvent = periods[0]!.events[0]!
    const secondEvent = periods[1]!.events[0]!
    const thirdEvent = periods[2]!.events[0]!

    expect(firstEvent.x + firstEvent.width).toBeLessThan(secondEvent.x)
    expect(secondEvent.x + secondEvent.width).toBeLessThan(thirdEvent.x)
  })

  it('adds framed section bounds and header space for named sections', () => {
    const diagram = layout(`timeline
      title Delivery plan
      section Foundation
      2023 : Prototype
      section Launch
      2024 : GA`)
    const firstSection = diagram.sections[0]!
    const secondSection = diagram.sections[1]!

    expect(firstSection.framed).toBe(true)
    expect(firstSection.headerHeight).toBeGreaterThan(0)
    expect(secondSection.headerHeight).toBeGreaterThan(0)
    expect(firstSection.x + firstSection.width).toBeLessThan(secondSection.x)
    expect(firstSection.periods[0]!.centerX).toBeGreaterThan(firstSection.x)
    expect(firstSection.periods[0]!.centerX).toBeLessThan(firstSection.x + firstSection.width)
    expect(secondSection.periods[0]!.centerX).toBeGreaterThan(secondSection.x)
    expect(secondSection.periods[0]!.centerX).toBeLessThan(secondSection.x + secondSection.width)
    expect(diagram.title!.y).toBeLessThan(firstSection.y + firstSection.headerHeight)
  })

  it('wraps long labels instead of letting a single event force unbounded width', () => {
    const diagram = layout(`timeline
      2024 : This is a deliberately long event label that should wrap onto multiple lines in the positioned timeline output`)
    const period = diagram.sections[0]!.periods[0]!
    const event = period.events[0]!

    expect(period.label).toBe('2024')
    expect(event.text).toContain('\n')
    expect(event.width).toBeLessThan(220)
  })

  it('carries accessibility metadata through layout for the renderer', () => {
    const diagram = layout(`timeline
      accTitle: Accessible roadmap
      accDescr: Public milestones
      2024 : Launch`)

    expect(diagram.accessibilityTitle).toBe('Accessible roadmap')
    expect(diagram.accessibilityDescription).toBe('Public milestones')
  })
})
