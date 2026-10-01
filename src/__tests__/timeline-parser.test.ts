import { describe, it, expect } from 'bun:test'
import { parseTimelineDiagram } from '../timeline/parser.ts'

const preprocess = (text: string): string[] =>
  text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

describe('parseTimelineDiagram', () => {
  it('defaults to LR direction', () => {
    const d = parseTimelineDiagram(preprocess('timeline\n  2002 : LinkedIn'))
    expect(d.direction).toBe('LR')
  })

  it('parses TD direction keyword', () => {
    const d = parseTimelineDiagram(preprocess('timeline TD\n  2002 : LinkedIn'))
    expect(d.direction).toBe('TD')
  })

  it('parses title', () => {
    const d = parseTimelineDiagram(preprocess('timeline\n  title History of Social Media'))
    expect(d.title).toBe('History of Social Media')
  })

  it('parses periods with multiple colon-separated events', () => {
    const d = parseTimelineDiagram(preprocess('timeline\n  2004 : Facebook : Instagram'))
    expect(d.sections[0]!.periods).toEqual([
      { label: '2004', events: ['Facebook', 'Instagram'] },
    ])
  })

  it('parses continuation events starting with colon', () => {
    const d = parseTimelineDiagram(preprocess('timeline\n  2006 : Twitter\n        : Mastodon'))
    expect(d.sections[0]!.periods[0]!.events).toEqual(['Twitter', 'Mastodon'])
  })

  it('groups periods into sections', () => {
    const d = parseTimelineDiagram(preprocess(`
      timeline
        section Platforms
          2002 : LinkedIn
        section US Platforms
          2004 : Facebook
    `))
    expect(d.sections.map(s => s.name)).toEqual(['Platforms', 'US Platforms'])
    expect(d.sections[0]!.periods[0]!.label).toBe('2002')
    expect(d.sections[1]!.periods[0]!.label).toBe('2004')
  })

  it('treats a stray line leniently instead of throwing', () => {
    const d = parseTimelineDiagram(preprocess('timeline\n  random text'))
    expect(d.sections).toHaveLength(1)
  })

  it('keeps consecutive section headers as separate sections', () => {
    const d = parseTimelineDiagram(preprocess(`
      timeline
        section A
        section B
          2002 : LinkedIn
    `))
    expect(d.sections.map(s => s.name)).toEqual(['A', 'B'])
    expect(d.sections[1]!.periods[0]!.label).toBe('2002')
  })
})
