// ============================================================================
// ASCII renderer — ArchiMate diagrams
//
// Renders archimate-layered text to ASCII/Unicode art.
// Each element is a box with label and type indicator.
// Layer bands are horizontal sections with layer name labels.
// Relationships are drawn as lines between elements with type markers.
//
// Layout: elements are placed in layer bands from top to bottom.
// Within each layer, elements are arranged horizontally.
// Relationship lines use Manhattan routing between element boxes.
// ============================================================================

import { parseArchimate } from '../archimate/parser.ts'
import type {
  ArchiMateDiagram,
  ArchiMateElement,
  ArchiMateLayer,
  ArchiMateRelationshipType,
} from '../archimate/types.ts'
import type { Canvas, AsciiConfig } from './types.ts'
import { mkCanvas, canvasToString, increaseSize } from './canvas.ts'
import { drawMultiBox } from './draw.ts'

// ============================================================================
// Constants
// ============================================================================

/** Canonical layer ordering from top to bottom */
const LAYER_ORDER: readonly ArchiMateLayer[] = [
  'strategy',
  'motivation',
  'business',
  'application',
  'technology',
  'physical',
  'implementation',
]

/** Human-readable layer display names */
const LAYER_LABELS: Record<ArchiMateLayer, string> = {
  business:       'Business',
  application:    'Application',
  technology:     'Technology',
  strategy:       'Strategy',
  motivation:     'Motivation',
  physical:       'Physical',
  implementation: 'Implementation',
}

// ============================================================================
// Element box content
// ============================================================================

/** Convert camelCase type names to human-readable form */
function formatTypeName(type: string): string {
  const spaced = type.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Build sections for an element box: [header with type] */
function buildElementSections(element: ArchiMateElement): string[][] {
  const typeLabel = `<<${formatTypeName(element.type)}>>`
  return [[typeLabel, element.label]]
}

// ============================================================================
// Relationship markers
// ============================================================================

/** Get ASCII relationship line character and arrow marker */
function getRelationshipMarker(
  type: ArchiMateRelationshipType,
  useAscii: boolean,
  direction: 'up' | 'down' | 'left' | 'right'
): { lineH: string; lineV: string; startMarker: string; endMarker: string } {
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  const arrowUp = useAscii ? '^' : '▲'
  const arrowDown = useAscii ? 'v' : '▼'
  const arrowLeft = useAscii ? '<' : '◄'
  const arrowRight = useAscii ? '>' : '►'

  const openUp = useAscii ? '^' : '△'
  const openDown = useAscii ? 'v' : '▽'
  const openLeft = useAscii ? '<' : '◁'
  const openRight = useAscii ? '>' : '▷'

  const diamond = useAscii ? '*' : '◆'
  const openDiamond = useAscii ? 'o' : '◇'
  const circle = useAscii ? 'o' : '●'

  function dirArrow(up: string, down: string, left: string, right: string): string {
    switch (direction) {
      case 'up': return up
      case 'down': return down
      case 'left': return left
      case 'right': return right
    }
  }

  switch (type) {
    case 'composition':
      return { lineH: H, lineV: V, startMarker: diamond, endMarker: '' }
    case 'aggregation':
      return { lineH: H, lineV: V, startMarker: openDiamond, endMarker: '' }
    case 'assignment':
      return {
        lineH: H, lineV: V,
        startMarker: circle,
        endMarker: dirArrow(arrowUp, arrowDown, arrowLeft, arrowRight),
      }
    case 'realization':
      return {
        lineH: dashH, lineV: dashV,
        startMarker: '',
        endMarker: dirArrow(openUp, openDown, openLeft, openRight),
      }
    case 'serving':
      return {
        lineH: H, lineV: V,
        startMarker: '',
        endMarker: dirArrow(openUp, openDown, openLeft, openRight),
      }
    case 'access':
      return {
        lineH: dashH, lineV: dashV,
        startMarker: '',
        endMarker: dirArrow(arrowUp, arrowDown, arrowLeft, arrowRight),
      }
    case 'influence':
      return {
        lineH: dashH, lineV: dashV,
        startMarker: '',
        endMarker: dirArrow(openUp, openDown, openLeft, openRight),
      }
    case 'triggering':
      return {
        lineH: H, lineV: V,
        startMarker: '',
        endMarker: dirArrow(arrowUp, arrowDown, arrowLeft, arrowRight),
      }
    case 'flow':
      return {
        lineH: dashH, lineV: dashV,
        startMarker: '',
        endMarker: dirArrow(arrowUp, arrowDown, arrowLeft, arrowRight),
      }
    case 'specialization':
      return {
        lineH: H, lineV: V,
        startMarker: '',
        endMarker: dirArrow(openUp, openDown, openLeft, openRight),
      }
    case 'association':
      return { lineH: H, lineV: V, startMarker: '', endMarker: '' }
  }
}

// ============================================================================
// Positioned element
// ============================================================================

interface PlacedElement {
  element: ArchiMateElement
  sections: string[][]
  x: number
  y: number
  width: number
  height: number
}

interface PlacedLayerBand {
  name: ArchiMateLayer
  label: string
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Layout and rendering
// ============================================================================

/**
 * Render a Mermaid ArchiMate diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → build boxes → layer layout → draw layers → draw boxes → draw relationships → string.
 */
export function renderArchimateAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseArchimate(lines)

  if (diagram.elements.size === 0) return ''

  const useAscii = config.useAscii
  const hGap = 4   // horizontal gap between element boxes
  const vGap = 3   // vertical gap between layers
  const layerPadX = 2 // horizontal padding inside layer band
  const layerPadY = 2 // vertical padding inside layer band (below label)
  const layerLabelHeight = 1 // rows for the layer label

  // --- Determine present layers in order ---
  const presentLayers: ArchiMateLayer[] = LAYER_ORDER.filter(
    layer => diagram.layers.has(layer) && diagram.layers.get(layer)!.length > 0
  )

  // --- Build element box dimensions ---
  const elementSections = new Map<string, string[][]>()
  const elementBoxW = new Map<string, number>()
  const elementBoxH = new Map<string, number>()

  for (const [id, element] of diagram.elements) {
    const sections = buildElementSections(element)
    elementSections.set(id, sections)

    let maxTextW = 0
    for (const section of sections) {
      for (const line of section) maxTextW = Math.max(maxTextW, line.length)
    }
    const boxW = maxTextW + 4 // 2 border + 2 padding

    let totalLines = 0
    for (const section of sections) totalLines += Math.max(section.length, 1)
    const boxH = totalLines + (sections.length - 1) + 2

    elementBoxW.set(id, boxW)
    elementBoxH.set(id, boxH)
  }

  // --- Layout: place elements in layer bands ---
  const placed = new Map<string, PlacedElement>()
  const layerBands: PlacedLayerBand[] = []
  let currentY = 0

  for (const layer of presentLayers) {
    const layerElements = diagram.layers.get(layer) ?? []
    if (layerElements.length === 0) continue

    const bandStartY = currentY
    // Layer label row
    const elementsStartY = bandStartY + layerLabelHeight + layerPadY

    let currentX = layerPadX
    let maxRowH = 0

    for (const element of layerElements) {
      const w = elementBoxW.get(element.id)!
      const h = elementBoxH.get(element.id)!

      placed.set(element.id, {
        element,
        sections: elementSections.get(element.id)!,
        x: currentX,
        y: elementsStartY,
        width: w,
        height: h,
      })

      currentX += w + hGap
      maxRowH = Math.max(maxRowH, h)
    }

    const bandWidth = currentX - hGap + layerPadX
    const bandHeight = layerLabelHeight + layerPadY + maxRowH + layerPadY

    layerBands.push({
      name: layer,
      label: LAYER_LABELS[layer],
      x: 0,
      y: bandStartY,
      width: bandWidth,
      height: bandHeight,
    })

    currentY = bandStartY + bandHeight + vGap
  }

  // Normalize layer band widths to the maximum
  const maxBandWidth = Math.max(...layerBands.map(b => b.width), 0)
  for (const band of layerBands) {
    band.width = maxBandWidth
  }

  // --- Create canvas ---
  let totalW = maxBandWidth + 4
  let totalH = currentY + 2

  // Account for elements that may extend beyond layer bands
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width + 2)
    totalH = Math.max(totalH, p.y + p.height + 2)
  }

  const canvas = mkCanvas(totalW - 1, totalH - 1)

  // --- Draw layer bands ---
  for (const band of layerBands) {
    drawLayerBand(canvas, band, useAscii)
  }

  // --- Draw element boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii)
    for (let bx = 0; bx < boxCanvas.length; bx++) {
      for (let by = 0; by < boxCanvas[0]!.length; by++) {
        const ch = boxCanvas[bx]![by]!
        if (ch !== ' ') {
          const cx = p.x + bx
          const cy = p.y + by
          if (cx < totalW && cy < totalH) {
            canvas[cx]![cy] = ch
          }
        }
      }
    }
  }

  // --- Draw relationships ---
  for (const rel of diagram.relationships) {
    const srcP = placed.get(rel.source)
    const tgtP = placed.get(rel.target)
    if (!srcP || !tgtP) continue

    drawRelationship(canvas, srcP, tgtP, rel.type, rel.label, useAscii, totalW, totalH)
  }

  return canvasToString(canvas)
}

// ============================================================================
// Drawing helpers
// ============================================================================

/** Draw a layer band border on the canvas */
function drawLayerBand(canvas: Canvas, band: PlacedLayerBand, useAscii: boolean): void {
  const { x, y, width, height, label } = band
  const right = x + width - 1
  const bottom = y + height - 1

  // Ensure canvas is large enough
  increaseSize(canvas, right + 1, bottom + 1)

  const hLine = useAscii ? '-' : '─'
  const vLine = useAscii ? '|' : '│'
  const tl = useAscii ? '+' : '┌'
  const tr = useAscii ? '+' : '┐'
  const bl = useAscii ? '+' : '└'
  const br = useAscii ? '+' : '┘'

  // Top border
  canvas[x]![y] = tl
  for (let cx = x + 1; cx < right; cx++) canvas[cx]![y] = hLine
  canvas[right]![y] = tr

  // Bottom border
  canvas[x]![bottom] = bl
  for (let cx = x + 1; cx < right; cx++) canvas[cx]![bottom] = hLine
  canvas[right]![bottom] = br

  // Left and right borders
  for (let cy = y + 1; cy < bottom; cy++) {
    canvas[x]![cy] = vLine
    canvas[right]![cy] = vLine
  }

  // Layer label (inside the band, near top-left)
  const labelX = x + 2
  const labelY = y + 1
  for (let i = 0; i < label.length; i++) {
    if (labelX + i < right) {
      canvas[labelX + i]![labelY] = label[i]!
    }
  }
}

/** Draw a relationship line between two placed elements */
function drawRelationship(
  canvas: Canvas,
  srcP: PlacedElement,
  tgtP: PlacedElement,
  type: ArchiMateRelationshipType,
  label: string | undefined,
  useAscii: boolean,
  totalW: number,
  totalH: number,
): void {
  const srcCX = srcP.x + Math.floor(srcP.width / 2)
  const srcCY = srcP.y + Math.floor(srcP.height / 2)
  const tgtCX = tgtP.x + Math.floor(tgtP.width / 2)
  const tgtCY = tgtP.y + Math.floor(tgtP.height / 2)

  // Determine primary direction
  const dx = Math.abs(tgtCX - srcCX)
  const dy = Math.abs(tgtCY - srcCY)

  if (dy >= dx) {
    // Primarily vertical connection
    const goingDown = tgtCY > srcCY
    const direction = goingDown ? 'down' : 'up'
    const marker = getRelationshipMarker(type, useAscii, direction)

    const startY = goingDown ? srcP.y + srcP.height : srcP.y - 1
    const endY = goingDown ? tgtP.y - 1 : tgtP.y + tgtP.height

    // Vertical line from source
    if (goingDown) {
      for (let y = startY; y <= endY; y++) {
        if (y >= 0 && y < totalH) canvas[srcCX]![y] = marker.lineV
      }
    } else {
      for (let y = startY; y >= endY; y--) {
        if (y >= 0 && y < totalH) canvas[srcCX]![y] = marker.lineV
      }
    }

    // Horizontal segment if needed
    if (srcCX !== tgtCX) {
      const midY = Math.floor((startY + endY) / 2)
      const lx = Math.min(srcCX, tgtCX)
      const rx = Math.max(srcCX, tgtCX)
      for (let x = lx; x <= rx; x++) {
        if (x < totalW && midY >= 0 && midY < totalH) canvas[x]![midY] = marker.lineH
      }
      // Vertical from midY to target
      if (goingDown) {
        for (let y = midY + 1; y <= endY; y++) {
          if (y >= 0 && y < totalH) canvas[tgtCX]![y] = marker.lineV
        }
      } else {
        for (let y = midY - 1; y >= endY; y--) {
          if (y >= 0 && y < totalH) canvas[tgtCX]![y] = marker.lineV
        }
      }
    }

    // Start marker
    if (marker.startMarker) {
      if (startY >= 0 && startY < totalH) {
        canvas[srcCX]![startY] = marker.startMarker
      }
    }

    // End marker
    if (marker.endMarker) {
      if (endY >= 0 && endY < totalH) {
        canvas[tgtCX]![endY] = marker.endMarker
      }
    }

    // Label
    if (label) {
      const midY = Math.floor((startY + endY) / 2)
      const labelX = (srcCX !== tgtCX ? Math.floor((srcCX + tgtCX) / 2) : srcCX) + 2
      for (let i = 0; i < label.length; i++) {
        const lx = labelX + i
        if (lx >= 0 && midY >= 0) {
          increaseSize(canvas, lx + 1, midY + 1)
          canvas[lx]![midY] = label[i]!
        }
      }
    }
  } else {
    // Primarily horizontal connection
    const goingRight = tgtCX > srcCX
    const direction = goingRight ? 'right' : 'left'
    const marker = getRelationshipMarker(type, useAscii, direction)

    const startX = goingRight ? srcP.x + srcP.width : srcP.x - 1
    const endX = goingRight ? tgtP.x - 1 : tgtP.x + tgtP.width
    const lineY = srcCY

    // Horizontal line
    if (goingRight) {
      for (let x = startX; x <= endX; x++) {
        if (x >= 0 && x < totalW && lineY < totalH) canvas[x]![lineY] = marker.lineH
      }
    } else {
      for (let x = startX; x >= endX; x--) {
        if (x >= 0 && x < totalW && lineY < totalH) canvas[x]![lineY] = marker.lineH
      }
    }

    // Vertical segment if needed
    if (srcCY !== tgtCY) {
      const midX = Math.floor((startX + endX) / 2)
      const ly = Math.min(srcCY, tgtCY)
      const ry = Math.max(srcCY, tgtCY)
      for (let y = ly; y <= ry; y++) {
        if (midX >= 0 && midX < totalW && y < totalH) canvas[midX]![y] = marker.lineV
      }
      // Horizontal from midX to target
      const targetY = tgtCY
      if (goingRight) {
        for (let x = midX + 1; x <= endX; x++) {
          if (x >= 0 && x < totalW && targetY < totalH) canvas[x]![targetY] = marker.lineH
        }
      } else {
        for (let x = midX - 1; x >= endX; x--) {
          if (x >= 0 && x < totalW && targetY < totalH) canvas[x]![targetY] = marker.lineH
        }
      }
    }

    // Start marker
    if (marker.startMarker) {
      if (startX >= 0 && startX < totalW && lineY < totalH) {
        canvas[startX]![lineY] = marker.startMarker
      }
    }

    // End marker
    if (marker.endMarker) {
      const targetY = srcCY !== tgtCY ? tgtCY : lineY
      if (endX >= 0 && endX < totalW && targetY < totalH) {
        canvas[endX]![targetY] = marker.endMarker
      }
    }

    // Label
    if (label) {
      const midX = Math.floor((startX + endX) / 2)
      const labelStart = midX - Math.floor(label.length / 2)
      const labelY = lineY - 1
      if (labelY >= 0) {
        for (let i = 0; i < label.length; i++) {
          const lx = labelStart + i
          if (lx >= 0 && lx < totalW) {
            canvas[lx]![labelY] = label[i]!
          }
        }
      }
    }
  }
}
