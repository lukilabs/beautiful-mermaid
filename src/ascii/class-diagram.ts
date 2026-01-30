// ============================================================================
// ASCII renderer — class diagrams
//
// Renders classDiagram text to ASCII/Unicode art.
// Each class is a multi-compartment box (header | attributes | methods).
// Relationships are drawn as lines between classes with UML markers.
//
// Layout: level-based top-down. "From" classes are placed above "to" classes
// for all relationship types, matching dagre/mermaid.com behavior.
// Relationship lines use simple Manhattan routing (vertical + horizontal).
// ============================================================================

import { parseClassDiagram } from '../class/parser.ts'
import type { ClassDiagram, ClassNode, ClassMember, ClassRelationship, RelationshipType } from '../class/types.ts'
import type { Canvas, AsciiConfig } from './types.ts'
import { mkCanvas, canvasToString, increaseSize, drawText, drawTextClipped } from './canvas.ts'
import { drawMultiBox } from './draw.ts'
import { stringWidth } from './text-width.ts'

// ============================================================================
// Class member formatting
// ============================================================================

/** Format a class member as a display string: visibility + name + optional type */
function formatMember(m: ClassMember): string {
  const vis = m.visibility || ''
  const type = m.type ? `: ${m.type}` : ''
  return `${vis}${m.name}${type}`
}

/** Build the text sections for a class box: [header], [attributes], [methods] */
function buildClassSections(cls: ClassNode): string[][] {
  // Header section: optional annotation + class name (centered later by drawMultiBox)
  const header: string[] = []
  if (cls.annotation) header.push(`<<${cls.annotation}>>`)
  header.push(cls.label)

  // Attributes section
  const attrs = cls.attributes.map(formatMember)

  // Methods section
  const methods = cls.methods.map(formatMember)

  // If no attrs and no methods, just return header (1-section box)
  if (attrs.length === 0 && methods.length === 0) return [header]
  // If no methods, return header + attrs (2-section box)
  if (methods.length === 0) return [header, attrs]
  // Full 3-section box
  return [header, attrs, methods]
}

// ============================================================================
// Relationship marker characters
// ============================================================================

interface RelMarker {
  /** Relationship type (determines marker shape) */
  type: RelationshipType
  /** Which end the marker is placed at */
  markerAt: 'from' | 'to'
  /** Whether the line is dashed */
  dashed: boolean
}

/**
 * Build the marker metadata for a relationship.
 * The actual marker character will be determined at placement time based on line direction.
 */
function getRelMarker(type: RelationshipType, markerAt: 'from' | 'to'): RelMarker {
  const dashed = type === 'dependency' || type === 'realization'
  return { type, markerAt, dashed }
}

/**
 * Get the UML marker shape character for a relationship type.
 * For directional arrows (association/dependency), the direction parameter
 * specifies which way the arrow should point.
 */
function getMarkerShape(
  type: RelationshipType,
  useAscii: boolean,
  direction?: 'up' | 'down' | 'left' | 'right'
): string {
  switch (type) {
    case 'inheritance':
    case 'realization':
      // Hollow triangle - rotate based on line direction
      // Triangle points TOWARD the parent class
      if (direction === 'down') {
        // Line goes down (parent above, child below) - triangle points UP
        return useAscii ? '^' : '△'
      } else if (direction === 'up') {
        // Line goes up (parent below, child above) - triangle points DOWN
        return useAscii ? 'v' : '▽'
      } else if (direction === 'left') {
        // Line goes left - triangle points LEFT
        return useAscii ? '>' : '◁'
      } else {
        // Default: line goes right - triangle points RIGHT
        return useAscii ? '<' : '▷'
      }
    case 'composition':
      // Filled diamond - omnidirectional shape
      return useAscii ? '*' : '◆'
    case 'aggregation':
      // Hollow diamond - omnidirectional shape
      return useAscii ? 'o' : '◇'
    case 'association':
    case 'dependency':
      // Directional arrow - rotate based on line direction
      if (direction === 'down') {
        return useAscii ? 'v' : '▼'
      } else if (direction === 'up') {
        return useAscii ? '^' : '▲'
      } else if (direction === 'left') {
        return useAscii ? '<' : '◀'
      } else {
        // Default to right (or when direction not specified)
        return useAscii ? '>' : '▶'
      }
  }
}

// ============================================================================
// Layout and rendering
// ============================================================================

/** Positioned class node on the canvas */
interface PlacedClass {
  cls: ClassNode
  sections: string[][]
  x: number
  y: number
  width: number
  height: number
}

/**
 * Render a Mermaid class diagram to ASCII/Unicode text.
 *
 * Pipeline: parse → build boxes → level-based layout → draw boxes → draw relationships → string.
 */
export function renderClassAscii(text: string, config: AsciiConfig): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseClassDiagram(lines)

  if (diagram.classes.length === 0) return ''

  const useAscii = config.useAscii
  const hGap = 4  // horizontal gap between class boxes
  const vGap = 3  // vertical gap between levels (enough for relationship lines)

  // --- Build box dimensions for each class ---
  const classSections = new Map<string, string[][]>()
  const classBoxW = new Map<string, number>()
  const classBoxH = new Map<string, number>()

  for (const cls of diagram.classes) {
    const sections = buildClassSections(cls)
    classSections.set(cls.id, sections)

    // Compute box dimensions from drawMultiBox logic
    let maxTextW = 0
    for (const section of sections) {
      for (const line of section) maxTextW = Math.max(maxTextW, stringWidth(line))
    }
    const boxW = maxTextW + 4 // 2 border + 2 padding

    let totalLines = 0
    for (const section of sections) totalLines += Math.max(section.length, 1)
    const boxH = totalLines + (sections.length - 1) + 2 // section lines + dividers + top/bottom border

    classBoxW.set(cls.id, boxW)
    classBoxH.set(cls.id, boxH)
  }

  // --- Assign levels: topological sort based on directed relationships ---
  // All relationship types place "from" above "to" in the layout, matching
  // dagre's layered algorithm and the official mermaid.com renderer behavior.
  // For "Animal <|-- Dog": from="Animal", to="Dog" → Animal above Dog.
  //
  // Every relationship type (including association and dependency) forces nodes
  // to different levels. Same-row routing for mixed diagrams causes collisions:
  // detour lines overlap with cross-level routing, and labels overwrite box borders.

  const classById = new Map<string, ClassNode>()
  for (const cls of diagram.classes) classById.set(cls.id, cls)

  const parents = new Map<string, Set<string>>()  // child → set of parent IDs
  const children = new Map<string, Set<string>>() // parent → set of child IDs

  for (const rel of diagram.relationships) {
    // For inheritance/realization, the marker (hollow triangle) points to the parent.
    // - `Animal <|-- Dog` (markerAt='from'): Animal is parent, Dog is child
    // - `Bird ..|> Flyable` (markerAt='to'): Flyable is parent, Bird is child
    // For other relationships, use the default from→to direction.
    const isHierarchical = rel.type === 'inheritance' || rel.type === 'realization'
    const parentId = isHierarchical && rel.markerAt === 'to' ? rel.to : rel.from
    const childId = isHierarchical && rel.markerAt === 'to' ? rel.from : rel.to

    if (!parents.has(childId)) parents.set(childId, new Set())
    parents.get(childId)!.add(parentId)
    if (!children.has(parentId)) children.set(parentId, new Set())
    children.get(parentId)!.add(childId)
  }

  // BFS from roots (classes that have no parents) to assign levels.
  // Cap at classes.length - 1 to prevent infinite loops on cyclic graphs
  // (e.g. View --> Model and Model ..> View would otherwise push levels
  // upward forever). In a DAG the longest path has at most N-1 edges.
  const level = new Map<string, number>()
  const roots = diagram.classes.filter(c => !parents.has(c.id) || parents.get(c.id)!.size === 0)
  const queue: string[] = roots.map(c => c.id)
  for (const id of queue) level.set(id, 0)

  const levelCap = diagram.classes.length - 1
  let qi = 0
  while (qi < queue.length) {
    const id = queue[qi++]!
    const childSet = children.get(id)
    if (!childSet) continue
    for (const childId of childSet) {
      const newLevel = (level.get(id) ?? 0) + 1
      if (newLevel > levelCap) continue // cycle detected — skip to prevent infinite loop
      if (!level.has(childId) || level.get(childId)! < newLevel) {
        level.set(childId, newLevel)
        queue.push(childId)
      }
    }
  }

  // Assign remaining (unconnected) classes to level 0
  for (const cls of diagram.classes) {
    if (!level.has(cls.id)) level.set(cls.id, 0)
  }

  // --- Position classes by level ---
  // Group classes by level
  const maxLevel = Math.max(...[...level.values()], 0)
  const levelGroups: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const cls of diagram.classes) {
    levelGroups[level.get(cls.id)!]!.push(cls.id)
  }

  // Compute positions: each level is a row, classes in a row are spaced horizontally
  const placed = new Map<string, PlacedClass>()
  let currentY = 0

  for (let lv = 0; lv <= maxLevel; lv++) {
    const group = levelGroups[lv]!
    if (group.length === 0) continue

    let currentX = 0
    let maxH = 0

    for (const id of group) {
      const cls = classById.get(id)!
      const w = classBoxW.get(id)!
      const h = classBoxH.get(id)!
      placed.set(id, {
        cls,
        sections: classSections.get(id)!,
        x: currentX,
        y: currentY,
        width: w,
        height: h,
      })
      currentX += w + hGap
      maxH = Math.max(maxH, h)
    }

    currentY += maxH + vGap
  }

  // --- Create canvas ---
  let totalW = 0
  let totalH = 0
  for (const p of placed.values()) {
    totalW = Math.max(totalW, p.x + p.width)
    totalH = Math.max(totalH, p.y + p.height)
  }

  // Extra space for relationship lines that may go below/beside
  totalW += 4
  totalH += 2

  const canvas = mkCanvas(totalW - 1, totalH - 1)

  // --- Draw class boxes ---
  for (const p of placed.values()) {
    const boxCanvas = drawMultiBox(p.sections, useAscii)
    // Copy box onto main canvas at (p.x, p.y)
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

  // --- Draw relationship lines ---
  const H = useAscii ? '-' : '─'
  const V = useAscii ? '|' : '│'
  const dashH = useAscii ? '.' : '╌'
  const dashV = useAscii ? ':' : '┊'

  for (const rel of diagram.relationships) {
    const fromP = placed.get(rel.from)
    const toP = placed.get(rel.to)
    if (!fromP || !toP) continue

    const marker = getRelMarker(rel.type, rel.markerAt)
    const lineH = marker.dashed ? dashH : H
    const lineV = marker.dashed ? dashV : V

    // Connection points: center-bottom of source → center-top of target
    const fromCX = fromP.x + Math.floor(fromP.width / 2)
    const fromBY = fromP.y + fromP.height - 1
    const toCX = toP.x + Math.floor(toP.width / 2)
    const toTY = toP.y

    // Route: simple Manhattan routing
    // If target is below source: vertical down from source, horizontal if needed, vertical down to target
    // If same row: horizontal line with a small vertical detour above or below
    if (fromBY < toTY) {
      // Target is below source — simple vertical-first routing
      const midY = fromBY + Math.floor((toTY - fromBY) / 2)

      // Vertical from source bottom to midY
      for (let y = fromBY + 1; y <= midY; y++) {
        if (y < totalH) canvas[fromCX]![y] = lineV
      }

      // Horizontal from fromCX to toCX at midY
      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX)
        const rx = Math.max(fromCX, toCX)
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY < totalH) canvas[x]![midY] = lineH
        }
        // Corner characters
        if (!useAscii && midY < totalH) {
          if (fromCX < toCX) {
            canvas[fromCX]![midY] = '└'
            canvas[toCX]![midY] = '┐'
          } else {
            canvas[fromCX]![midY] = '┘'
            canvas[toCX]![midY] = '┌'
          }
        }
      }

      // Vertical from midY to target top
      for (let y = midY + 1; y < toTY; y++) {
        if (y < totalH) canvas[toCX]![y] = lineV
      }

      // Draw markers - arrows point in the direction of the vertical segment
      if (marker.markerAt === 'to') {
        // Marker at target (pointing down into the target box)
        const markerChar = getMarkerShape(marker.type, useAscii, 'down')
        const my = toTY - 1
        const markerWidth = stringWidth(markerChar)
        if (my >= 0 && my < totalH) {
          const mx = toCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
      if (marker.markerAt === 'from') {
        // Marker at source (pointing down away from source box)
        const markerChar = getMarkerShape(marker.type, useAscii, 'down')
        const my = fromBY + 1
        const markerWidth = stringWidth(markerChar)
        if (my < totalH) {
          const mx = fromCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
    } else if (toP.y + toP.height - 1 < fromP.y) {
      // Target is ABOVE source — draw upward from source top to target bottom
      const fromTY = fromP.y
      const toBY = toP.y + toP.height - 1
      const midY = toBY + Math.floor((fromTY - toBY) / 2)

      for (let y = fromTY - 1; y >= midY; y--) {
        if (y >= 0 && y < totalH) canvas[fromCX]![y] = lineV
      }

      if (fromCX !== toCX) {
        const lx = Math.min(fromCX, toCX)
        const rx = Math.max(fromCX, toCX)
        for (let x = lx; x <= rx; x++) {
          if (x < totalW && midY >= 0 && midY < totalH) canvas[x]![midY] = lineH
        }
        if (!useAscii && midY >= 0 && midY < totalH) {
          if (fromCX < toCX) {
            canvas[fromCX]![midY] = '┌'
            canvas[toCX]![midY] = '┘'
          } else {
            canvas[fromCX]![midY] = '┐'
            canvas[toCX]![midY] = '└'
          }
        }
      }

      for (let y = midY - 1; y > toBY; y--) {
        if (y >= 0 && y < totalH) canvas[toCX]![y] = lineV
      }

      // Draw markers - arrows point in the direction of the vertical segment (upward)
      if (marker.markerAt === 'from') {
        // Marker at source (pointing up away from source box)
        const markerChar = getMarkerShape(marker.type, useAscii, 'up')
        const my = fromTY - 1
        const markerWidth = stringWidth(markerChar)
        if (my >= 0 && my < totalH) {
          const mx = fromCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
      if (marker.markerAt === 'to') {
        // Marker at target (pointing up into the target box from below)
        // For inheritance/realization, triangle points toward parent - use 'down' to get △
        // For association/dependency, arrow points in line direction - use 'up' to get ▲
        const isHierarchical = marker.type === 'inheritance' || marker.type === 'realization'
        const markerDir = isHierarchical ? 'down' : 'up'
        const markerChar = getMarkerShape(marker.type, useAscii, markerDir)
        const my = toBY + 1
        const markerWidth = stringWidth(markerChar)
        if (my < totalH) {
          const mx = toCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
    } else {
      // Same level — draw horizontal line with a detour below both boxes
      const detourY = Math.max(fromBY, toP.y + toP.height - 1) + 2
      increaseSize(canvas, totalW, detourY + 1)

      // Vertical down from source
      for (let y = fromBY + 1; y <= detourY; y++) {
        canvas[fromCX]![y] = lineV
      }
      // Horizontal
      const lx = Math.min(fromCX, toCX)
      const rx = Math.max(fromCX, toCX)
      for (let x = lx; x <= rx; x++) {
        canvas[x]![detourY] = lineH
      }
      // Vertical up to target
      for (let y = detourY - 1; y >= toP.y + toP.height; y--) {
        canvas[toCX]![y] = lineV
      }

      // Draw markers - same-level routing uses vertical segments at both ends
      if (marker.markerAt === 'from') {
        // Marker at source (pointing down away from source box)
        const markerChar = getMarkerShape(marker.type, useAscii, 'down')
        const my = fromBY + 1
        const markerWidth = stringWidth(markerChar)
        if (my < totalH) {
          const mx = fromCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
      if (marker.markerAt === 'to') {
        // Marker at target bottom (pointing up into the target box)
        const markerChar = getMarkerShape(marker.type, useAscii, 'up')
        const my = toP.y + toP.height
        const markerWidth = stringWidth(markerChar)
        if (my < totalH) {
          const mx = toCX - Math.floor(markerWidth / 2)
          if (mx >= 0) drawText(canvas, { x: mx, y: my }, markerChar)
        }
      }
    }

    // Draw relationship label at midpoint if present
    // Add padding around the label for readability
    if (rel.label) {
      const paddedLabel = ` ${rel.label} `  // Add space padding on both sides
      const midX = Math.floor((fromCX + toCX) / 2)
      // Calculate midY based on routing direction
      let midY: number
      if (fromBY < toTY) {
        // Target below source: midpoint between source bottom and target top
        midY = Math.floor((fromBY + 1 + toTY - 1) / 2)
      } else if (toP.y + toP.height - 1 < fromP.y) {
        // Target above source: midpoint between target bottom and source top
        const toBY = toP.y + toP.height - 1
        midY = Math.floor((toBY + 1 + fromP.y - 1) / 2)
      } else {
        // Same level: place label at midpoint of the detour line
        midY = Math.max(fromBY, toP.y + toP.height - 1) + 2
      }
      const labelWidth = stringWidth(paddedLabel)
      const labelStart = midX - Math.floor(labelWidth / 2)
      if (midY >= 0 && midY < totalH) {
        drawTextClipped(canvas, { x: labelStart, y: midY }, paddedLabel, 0, totalW - 1)
      }
    }
  }

  return canvasToString(canvas, !config.preserveDisplayWidth)
}
