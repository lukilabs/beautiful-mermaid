import { describe, it, expect } from 'bun:test'
import { parsePieChart } from '../pie/parser.ts'

describe('parsePieChart', () => {
  it('parses basic pie chart with double-quoted labels', () => {
    const text = `pie
      "Dogs" : 386
      "Cats" : 85
      "Rats" : 15`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.showData).toBe(false)
    expect(chart.title).toBeUndefined()
    expect(chart.slices).toHaveLength(3)
    expect(chart.slices[0]).toEqual({ label: 'Dogs', value: 386 })
    expect(chart.slices[1]).toEqual({ label: 'Cats', value: 85 })
    expect(chart.slices[2]).toEqual({ label: 'Rats', value: 15 })
  })

  it('parses title in header line: pie title <title>', () => {
    const text = `pie title Pets adopted by volunteers
      "Dogs" : 386
      "Cats" : 85`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.title).toBe('Pets adopted by volunteers')
    expect(chart.showData).toBe(false)
    expect(chart.slices).toHaveLength(2)
  })

  it('parses title in header line with quotes: pie title "<title>"', () => {
    const text = `pie title "Pets adopted by volunteers"
      "Dogs" : 386
      "Cats" : 85`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.title).toBe('Pets adopted by volunteers')
    expect(chart.showData).toBe(false)
  })

  it('parses standalone title directive', () => {
    const text = `pie
      title "Key Elements in Product X"
      "Calcium" : 42.96
      "Potassium" : 50.05`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.title).toBe('Key Elements in Product X')
    expect(chart.slices).toHaveLength(2)
    expect(chart.slices[0]!.value).toBe(42.96)
  })

  it('parses showData in header and standalone', () => {
    const text1 = `pie showData title Key elements
      "Calcium" : 42.96
      "Potassium" : 50.05`
    const chart1 = parsePieChart(text1.split('\n'))
    expect(chart1.showData).toBe(true)
    expect(chart1.title).toBe('Key elements')

    const text2 = `pie
      showData
      title Elements
      "A" : 10`
    const chart2 = parsePieChart(text2.split('\n'))
    expect(chart2.showData).toBe(true)
  })

  it('parses single quoted and unquoted slice labels', () => {
    const text = `pie
      'Calcium' : 42.96
      Potassium : 50.05
      "Magnesium" : 10.01
      Iron : 5`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.slices).toHaveLength(4)
    expect(chart.slices[0]).toEqual({ label: 'Calcium', value: 42.96 })
    expect(chart.slices[1]).toEqual({ label: 'Potassium', value: 50.05 })
    expect(chart.slices[2]).toEqual({ label: 'Magnesium', value: 10.01 })
    expect(chart.slices[3]).toEqual({ label: 'Iron', value: 5 })
  })

  it('parses quoted labels containing colons', () => {
    const text = `pie
      "Ratio 1:2" : 30
      "Ratio 2:3" : 70`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.slices).toHaveLength(2)
    expect(chart.slices[0]).toEqual({ label: 'Ratio 1:2', value: 30 })
    expect(chart.slices[1]).toEqual({ label: 'Ratio 2:3', value: 70 })
  })

  it('ignores comments and empty lines', () => {
    const text = `pie
      %% This is a comment
      "Slice A" : 10

      %% Another comment
      "Slice B" : 20`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.slices).toHaveLength(2)
  })

  it('preserves title containing the word showdata', () => {
    const text = `pie title "How to showdata properly"
      "A" : 10`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.showData).toBe(false)
    expect(chart.title).toBe('How to showdata properly')
  })

  it('parses title with colon: title: ...', () => {
    const text = `pie
      title: "My Chart"
      "A" : 10`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.title).toBe('My Chart')
  })

  it('ignores accessibility directives accTitle and accDescr', () => {
    const text = `pie title "Accessibility Chart"
      accTitle: 2024 Chart
      accDescr: An accessibility description
      "A" : 10
      "B" : 20`
    const chart = parsePieChart(text.split('\n'))
    expect(chart.slices).toHaveLength(2)
    expect(chart.slices[0]).toEqual({ label: 'A', value: 10 })
    expect(chart.slices[1]).toEqual({ label: 'B', value: 20 })
  })
})
