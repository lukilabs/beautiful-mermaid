// ============================================================================
// ASCII renderer — grid-based layout
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/graph.go + cmd/mapping_node.go.
// Places nodes on a logical grid, computes column/row sizes,
// converts grid coordinates to character-level drawing coordinates,
// and handles subgraph bounding boxes.
// ============================================================================

import type {
  GridCoord, DrawingCoord, Direction, AsciiEdge, AsciiGraph, AsciiNode, AsciiSubgraph,
} from './types.ts'
import { gridKey } from './types.ts'
import { mkCanvas, setCanvasSizeToGrid, setRoleCanvasSizeToGrid } from './canvas.ts'
import { determinePath, determineLabelLine } from './edge-routing.ts'
import { analyzeEdgeBundles, processBundles } from './edge-bundling.ts'
import { drawBox } from './draw.ts'
import { maxLineWidth, lineCount } from './multiline-utils.ts'
import { getShapeDimensions } from './shapes/index.ts'

// ============================================================================
// Grid coordinate → drawing coordinate conversion
// ============================================================================

/**
 * Convert a grid coordinate to a drawing (character) coordinate.
 * Sums column widths up to the target column, and row heights up to the target row,
 * then centers within the cell.
 */
export function gridToDrawingCoord(
  graph: AsciiGraph,
  c: GridCoord,
  dir?: Direction,
): DrawingCoord {
  const target: GridCoord = dir
    ? { x: c.x + dir.x, y: c.y + dir.y }
    : c

  let x = 0
  for (let col = 0; col < target.x; col++) {
    x += graph.columnWidth.get(col) ?? 0
  }

  let y = 0
  for (let row = 0; row < target.y; row++) {
    y += graph.rowHeight.get(row) ?? 0
  }

  const colW = graph.columnWidth.get(target.x) ?? 0
  const rowH = graph.rowHeight.get(target.y) ?? 0
  return {
    x: x + Math.floor(colW / 2) + graph.offsetX,
    y: y + Math.floor(rowH / 2) + graph.offsetY,
  }
}

/** Convert a path of grid coords to drawing coords. */
export function lineToDrawing(graph: AsciiGraph, line: GridCoord[]): DrawingCoord[] {
  return line.map(c => gridToDrawingCoord(graph, c))
}

// ============================================================================
// Node placement on the grid
// ============================================================================

/**
 * Reserve a 3x3 block in the grid for a node.
 * If the requested position is occupied, recursively shift by 4 grid units
 * (in the perpendicular direction based on effective direction) until a free spot is found.
 *
 * @param effectiveDir - Optional direction override. If not provided, uses the node's
 *                       effective direction (subgraph direction if in a subgraph with override,
 *                       otherwise graph direction).
 */
export function reserveSpotInGrid(
  graph: AsciiGraph,
  node: AsciiNode,
  requested: GridCoord,
  effectiveDir?: 'LR' | 'TD',
): GridCoord {
  // Determine direction for collision handling
  const dir = effectiveDir ?? getEffectiveDirection(graph, node)

  if (graph.grid.has(gridKey(requested))) {
    // Collision — shift perpendicular to main flow direction
    if (dir === 'LR') {
      return reserveSpotInGrid(graph, node, { x: requested.x, y: requested.y + 4 }, dir)
    } else {
      return reserveSpotInGrid(graph, node, { x: requested.x + 4, y: requested.y }, dir)
    }
  }

  // Reserve the 3x3 block
  for (let dx = 0; dx < 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      const reserved: GridCoord = { x: requested.x + dx, y: requested.y + dy }
      graph.grid.set(gridKey(reserved), node)
    }
  }

  node.gridCoord = requested
  return requested
}

// ============================================================================
// Column width / row height computation
// ============================================================================

/**
 * Set column widths and row heights for a node's 3x3 grid block.
 * Each node occupies 3 columns (border, content, border) and 3 rows.
 * Uses shape-aware dimensions to properly size non-rectangular shapes.
 */
export function setColumnWidth(graph: AsciiGraph, node: AsciiNode): void {
  const gc = node.gridCoord!
  const padding = graph.config.boxBorderPadding

  // Get shape-aware dimensions
  const shapeDims = getShapeDimensions(node.shape, node.displayLabel, {
    useAscii: graph.config.useAscii,
    padding,
  })

  // Use shape-provided grid dimensions
  const colWidths = shapeDims.gridColumns
  const rowHeights = shapeDims.gridRows

  for (let idx = 0; idx < colWidths.length; idx++) {
    const xCoord = gc.x + idx
    const current = graph.columnWidth.get(xCoord) ?? 0
    graph.columnWidth.set(xCoord, Math.max(current, colWidths[idx]!))
  }

  for (let idx = 0; idx < rowHeights.length; idx++) {
    const yCoord = gc.y + idx
    const current = graph.rowHeight.get(yCoord) ?? 0
    graph.rowHeight.set(yCoord, Math.max(current, rowHeights[idx]!))
  }

  // Padding column/row before the node (spacing between nodes)
  if (gc.x > 0) {
    const current = graph.columnWidth.get(gc.x - 1) ?? 0
    graph.columnWidth.set(gc.x - 1, Math.max(current, graph.config.paddingX))
  }

  if (gc.y > 0) {
    let basePadding = graph.config.paddingY
    // Extra vertical padding for nodes with incoming edges from outside their subgraph
    if (hasIncomingEdgeFromOutsideSubgraph(graph, node)) {
      const subgraphOverhead = 4
      basePadding += subgraphOverhead
    }
    const current = graph.rowHeight.get(gc.y - 1) ?? 0
    graph.rowHeight.set(gc.y - 1, Math.max(current, basePadding))
  }
}

/** Ensure grid has width/height entries for all cells along an edge path. */
export function increaseGridSizeForPath(graph: AsciiGraph, path: GridCoord[]): void {
  for (const c of path) {
    if (!graph.columnWidth.has(c.x)) {
      graph.columnWidth.set(c.x, Math.floor(graph.config.paddingX / 2))
    }
    if (!graph.rowHeight.has(c.y)) {
      graph.rowHeight.set(c.y, Math.floor(graph.config.paddingY / 2))
    }
  }
}

// ============================================================================
// Subgraph helpers
// ============================================================================

function isNodeInAnySubgraph(graph: AsciiGraph, node: AsciiNode): boolean {
  return graph.subgraphs.some(sg => sg.nodes.includes(node))
}

/**
 * Get the innermost subgraph that directly contains this node.
 * Returns null if node is not in any subgraph.
 */
export function getNodeSubgraph(graph: AsciiGraph, node: AsciiNode): AsciiSubgraph | null {
  // Find the innermost (most deeply nested) subgraph containing the node
  let innermost: AsciiSubgraph | null = null
  for (const sg of graph.subgraphs) {
    if (sg.nodes.includes(node)) {
      // Check if this subgraph is deeper (more nested) than current innermost
      if (!innermost || isAncestorOrSelf(innermost, sg)) {
        innermost = sg
      }
    }
  }
  return innermost
}

/** Check if `candidate` is the same as or an ancestor of `target`. */
function isAncestorOrSelf(candidate: AsciiSubgraph, target: AsciiSubgraph): boolean {
  let current: AsciiSubgraph | null = target
  while (current !== null) {
    if (current === candidate) return true
    current = current.parent
  }
  return false
}

/**
 * Get the effective direction for a node's layout.
 * Returns the subgraph's direction override if the node is in a subgraph with one,
 * otherwise returns the graph-level direction.
 */
export function getEffectiveDirection(graph: AsciiGraph, node: AsciiNode): 'LR' | 'TD' {
  const sg = getNodeSubgraph(graph, node)
  if (sg?.direction) {
    return sg.direction
  }
  return graph.config.graphDirection
}

/**
 * Check if a node has an incoming edge from outside its subgraph
 * AND is the topmost such node in its subgraph.
 * Used to add extra vertical padding for subgraph borders.
 */
function hasIncomingEdgeFromOutsideSubgraph(graph: AsciiGraph, node: AsciiNode): boolean {
  const nodeSg = getNodeSubgraph(graph, node)
  if (!nodeSg) return false

  let hasExternalEdge = false
  for (const edge of graph.edges) {
    if (edge.to === node) {
      const sourceSg = getNodeSubgraph(graph, edge.from)
      if (sourceSg !== nodeSg) {
        hasExternalEdge = true
        break
      }
    }
  }

  if (!hasExternalEdge) return false

  // Only return true for the topmost node with an external incoming edge
  for (const otherNode of nodeSg.nodes) {
    if (otherNode === node || !otherNode.gridCoord) continue
    let otherHasExternal = false
    for (const edge of graph.edges) {
      if (edge.to === otherNode) {
        const sourceSg = getNodeSubgraph(graph, edge.from)
        if (sourceSg !== nodeSg) {
          otherHasExternal = true
          break
        }
      }
    }
    if (otherHasExternal && otherNode.gridCoord.y < node.gridCoord!.y) {
      return false
    }
  }

  return true
}

// ============================================================================
// Subgraph bounding boxes
// ============================================================================

function calculateSubgraphBoundingBox(graph: AsciiGraph, sg: AsciiSubgraph): void {
  if (sg.nodes.length === 0) return

  let minX = 1_000_000
  let minY = 1_000_000
  let maxX = -1_000_000
  let maxY = -1_000_000

  // Include children's bounding boxes
  for (const child of sg.children) {
    calculateSubgraphBoundingBox(graph, child)
    if (child.nodes.length > 0) {
      minX = Math.min(minX, child.minX)
      minY = Math.min(minY, child.minY)
      maxX = Math.max(maxX, child.maxX)
      maxY = Math.max(maxY, child.maxY)
    }
  }

  // Include node positions
  for (const node of sg.nodes) {
    if (!node.drawingCoord || !node.drawing) continue
    const nodeMinX = node.drawingCoord.x
    const nodeMinY = node.drawingCoord.y
    const nodeMaxX = nodeMinX + node.drawing.length - 1
    const nodeMaxY = nodeMinY + node.drawing[0]!.length - 1
    minX = Math.min(minX, nodeMinX)
    minY = Math.min(minY, nodeMinY)
    maxX = Math.max(maxX, nodeMaxX)
    maxY = Math.max(maxY, nodeMaxY)
  }

  const subgraphPadding = 2
  const subgraphLabelSpace = 2
  sg.minX = minX - subgraphPadding
  sg.minY = minY - subgraphPadding - subgraphLabelSpace
  sg.maxX = maxX + subgraphPadding
  sg.maxY = maxY + subgraphPadding
}

/** Ensure non-overlapping root subgraphs have minimum spacing. */
function ensureSubgraphSpacing(graph: AsciiGraph): void {
  const minSpacing = 1
  const rootSubgraphs = graph.subgraphs.filter(sg => sg.parent === null && sg.nodes.length > 0)

  for (let i = 0; i < rootSubgraphs.length; i++) {
    for (let j = i + 1; j < rootSubgraphs.length; j++) {
      const sg1 = rootSubgraphs[i]!
      const sg2 = rootSubgraphs[j]!

      // Horizontal overlap → adjust vertical
      if (sg1.minX < sg2.maxX && sg1.maxX > sg2.minX) {
        if (sg1.maxY >= sg2.minY - minSpacing && sg1.minY < sg2.minY) {
          sg2.minY = sg1.maxY + minSpacing + 1
        } else if (sg2.maxY >= sg1.minY - minSpacing && sg2.minY < sg1.minY) {
          sg1.minY = sg2.maxY + minSpacing + 1
        }
      }
      // Vertical overlap → adjust horizontal
      if (sg1.minY < sg2.maxY && sg1.maxY > sg2.minY) {
        if (sg1.maxX >= sg2.minX - minSpacing && sg1.minX < sg2.minX) {
          sg2.minX = sg1.maxX + minSpacing + 1
        } else if (sg2.maxX >= sg1.minX - minSpacing && sg2.minX < sg1.minX) {
          sg1.minX = sg2.maxX + minSpacing + 1
        }
      }
    }
  }
}

export function calculateSubgraphBoundingBoxes(graph: AsciiGraph): void {
  for (const sg of graph.subgraphs) {
    calculateSubgraphBoundingBox(graph, sg)
  }
  ensureSubgraphSpacing(graph)
}

/**
 * Offset all drawing coordinates so subgraph borders don't go negative.
 * If any subgraph has negative min coordinates, shift everything positive.
 */
export function offsetDrawingForSubgraphs(graph: AsciiGraph): void {
  if (graph.subgraphs.length === 0) return

  let minX = 0
  let minY = 0
  for (const sg of graph.subgraphs) {
    minX = Math.min(minX, sg.minX)
    minY = Math.min(minY, sg.minY)
  }

  const offsetX = -minX
  const offsetY = -minY
  if (offsetX === 0 && offsetY === 0) return

  graph.offsetX = offsetX
  graph.offsetY = offsetY

  for (const sg of graph.subgraphs) {
    sg.minX += offsetX
    sg.minY += offsetY
    sg.maxX += offsetX
    sg.maxY += offsetY
  }

  for (const node of graph.nodes) {
    if (node.drawingCoord) {
      node.drawingCoord.x += offsetX
      node.drawingCoord.y += offsetY
    }
  }
}

// ============================================================================
// Width-constrained layout
// ============================================================================

function estimateNodeWidth(graph: AsciiGraph, node: AsciiNode): number {
  const dims = getShapeDimensions(node.shape, node.displayLabel, {
    useAscii: graph.config.useAscii,
    padding: graph.config.boxBorderPadding,
  })
  return dims.width
}

function rebuildReservedGrid(graph: AsciiGraph): void {
  graph.grid.clear()
  for (const node of graph.nodes) {
    if (!node.gridCoord) continue
    for (let dx = 0; dx < 3; dx++) {
      for (let dy = 0; dy < 3; dy++) {
        const reserved: GridCoord = { x: node.gridCoord.x + dx, y: node.gridCoord.y + dy }
        graph.grid.set(gridKey(reserved), node)
      }
    }
  }
}

/**
 * Re-pack wide LR layouts into vertical bands before column widths and edge
 * routing are computed. This makes maxWidth influence placement rather than
 * shrinking rendered output after the fact.
 */
function rebalanceLevelsForMaxWidth(graph: AsciiGraph): void {
  const maxW = graph.config.maxWidth
  if (!maxW || maxW <= 0) return

  if (graph.config.graphDirection === 'TD') {
    const levels = new Map<number, AsciiNode[]>()
    for (const node of graph.nodes) {
      if (!node.gridCoord) continue
      const level = node.gridCoord.y
      const nodes = levels.get(level)
      if (nodes) nodes.push(node)
      else levels.set(level, [node])
    }

    const sortedLevels = [...levels.keys()].sort((a, b) => a - b)
    if (sortedLevels.length <= 1) return

    const estimatedGap = graph.config.paddingX
    let levelOffset = 0

    for (const level of sortedLevels) {
      const nodes = (levels.get(level) ?? []).slice().sort((a, b) => (a.gridCoord?.x ?? 0) - (b.gridCoord?.x ?? 0))
      if (nodes.length === 0) continue

      const bands: AsciiNode[][] = []
      let currentBand: AsciiNode[] = []
      let currentBandWidth = 0

      for (const node of nodes) {
        const nodeWidth = estimateNodeWidth(graph, node)
        const nextWidth = currentBandWidth === 0 ? nodeWidth : currentBandWidth + estimatedGap + nodeWidth
        if (currentBand.length > 0 && nextWidth > maxW) {
          bands.push(currentBand)
          currentBand = []
          currentBandWidth = 0
        }

        currentBand.push(node)
        currentBandWidth = currentBandWidth === 0 ? nodeWidth : currentBandWidth + estimatedGap + nodeWidth
      }

      if (currentBand.length > 0) bands.push(currentBand)

      if (bands.length === 1) {
        for (const node of nodes) {
          node.gridCoord!.y = level + levelOffset
        }
        continue
      }

      for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
        const band = bands[bandIdx]!
        for (let idx = 0; idx < band.length; idx++) {
          const node = band[idx]!
          node.gridCoord!.x = idx * 4
          node.gridCoord!.y = level + levelOffset + bandIdx * 4
        }
      }

      levelOffset += (bands.length - 1) * 4
    }

    rebuildReservedGrid(graph)
    return
  }

  if (graph.config.graphDirection !== 'LR') return

  const levels = new Map<number, AsciiNode[]>()
  let maxPerpendicular = 0
  for (const node of graph.nodes) {
    if (!node.gridCoord) continue
    const level = node.gridCoord.x
    const nodes = levels.get(level)
    if (nodes) nodes.push(node)
    else levels.set(level, [node])
    maxPerpendicular = Math.max(maxPerpendicular, node.gridCoord.y)
  }

  const sortedLevels = [...levels.keys()].sort((a, b) => a - b)
  if (sortedLevels.length <= 1) return

  const estimatedGap = graph.config.paddingX
  const bandStep = maxPerpendicular + 8
  let bandIndex = 0
  let bandWidth = 0
  let levelIndexInBand = 0

  for (const level of sortedLevels) {
    const nodes = levels.get(level) ?? []
    let levelWidth = 0
    for (const node of nodes) {
      levelWidth = Math.max(levelWidth, estimateNodeWidth(graph, node))
    }

    const nextWidth = bandWidth === 0 ? levelWidth : bandWidth + estimatedGap + levelWidth
    if (bandWidth > 0 && nextWidth > maxW) {
      bandIndex++
      bandWidth = 0
      levelIndexInBand = 0
    }

    const newLevel = levelIndexInBand * 4
    for (const node of nodes) {
      node.gridCoord!.x = newLevel
      node.gridCoord!.y += bandIndex * bandStep
    }

    bandWidth = bandWidth === 0 ? levelWidth : bandWidth + estimatedGap + levelWidth
    levelIndexInBand++
  }

  rebuildReservedGrid(graph)
}

function computePrimaryLevels(graph: AsciiGraph): Map<string, number> {
  const levels = new Map<string, number>()
  for (const node of graph.nodes) {
    levels.set(node.name, 0)
  }

  const maxIterations = Math.max(0, graph.nodes.length - 1)
  for (let i = 0; i < maxIterations; i++) {
    let changed = false

    for (const edge of graph.edges) {
      const parentSg = getNodeSubgraph(graph, edge.from)
      const childSg = getNodeSubgraph(graph, edge.to)
      const edgeDir = (parentSg && parentSg === childSg && parentSg.direction)
        ? parentSg.direction
        : graph.config.graphDirection

      if (edgeDir !== graph.config.graphDirection) continue

      const nextLevel = (levels.get(edge.from.name) ?? 0) + 4
      if (nextLevel > (levels.get(edge.to.name) ?? 0)) {
        levels.set(edge.to.name, nextLevel)
        changed = true
      }
    }

    if (!changed) break
  }

  return levels
}

function clearGridPlacement(graph: AsciiGraph): void {
  graph.grid.clear()
  graph.columnWidth.clear()
  graph.rowHeight.clear()

  for (const node of graph.nodes) {
    node.gridCoord = null
    node.drawingCoord = null
    node.drawing = null
    node.drawn = false
  }

  for (const edge of graph.edges) {
    edge.path = []
    edge.labelLine = []
    edge.startDir = { x: 0, y: 0 }
    edge.endDir = { x: 0, y: 0 }
    delete edge.bundle
  }

  graph.bundles = []
  graph.offsetX = 0
  graph.offsetY = 0
}

function measurePlacedNodeLayoutWidth(graph: AsciiGraph): number {
  const columnWidth = new Map<number, number>()
  let maxColumn = -1

  for (const node of graph.nodes) {
    if (!node.gridCoord) continue

    const dims = getShapeDimensions(node.shape, node.displayLabel, {
      useAscii: graph.config.useAscii,
      padding: graph.config.boxBorderPadding,
    })

    for (let idx = 0; idx < dims.gridColumns.length; idx++) {
      const xCoord = node.gridCoord.x + idx
      const current = columnWidth.get(xCoord) ?? 0
      columnWidth.set(xCoord, Math.max(current, dims.gridColumns[idx]!))
      maxColumn = Math.max(maxColumn, xCoord)
    }

    if (node.gridCoord.x > 0) {
      const padCoord = node.gridCoord.x - 1
      const current = columnWidth.get(padCoord) ?? 0
      columnWidth.set(padCoord, Math.max(current, graph.config.paddingX))
      maxColumn = Math.max(maxColumn, padCoord)
    }
  }

  let width = 0
  for (let col = 0; col <= maxColumn; col++) {
    width += columnWidth.get(col) ?? 0
  }
  return width
}

function placeNodesOnGrid(
  graph: AsciiGraph,
  primaryLevelByNode: Map<string, number> | null,
): void {
  const dir = graph.config.graphDirection
  const highestPositionPerLevel: number[] = new Array(100).fill(0)

  // Identify root nodes — nodes that aren't the target of any edge
  const nodesFound = new Set<string>()
  const initialRoots: AsciiNode[] = []

  for (const node of graph.nodes) {
    if (!nodesFound.has(node.name)) {
      initialRoots.push(node)
    }
    nodesFound.add(node.name)
    for (const child of getChildren(graph, node)) {
      nodesFound.add(child.name)
    }
  }

  // Filter out subgraph nodes that have incoming edges from external sources.
  // This handles the case where subgraph is declared before external nodes
  // (e.g., `subgraph s; A-->B; end; X-->A` - A shouldn't be a root, X should).
  const rootNodes = initialRoots.filter(node => {
    const nodeSg = getNodeSubgraph(graph, node)
    if (!nodeSg) return true

    for (const edge of graph.edges) {
      if (edge.to === node) {
        const sourceSg = getNodeSubgraph(graph, edge.from)
        if (sourceSg !== nodeSg) {
          return false
        }
      }
    }
    return true
  })

  let hasExternalRoots = false
  let hasSubgraphRootsWithEdges = false
  for (const node of rootNodes) {
    if (isNodeInAnySubgraph(graph, node)) {
      if (getChildren(graph, node).length > 0) hasSubgraphRootsWithEdges = true
    } else {
      hasExternalRoots = true
    }
  }
  const shouldSeparate = dir === 'LR' && hasExternalRoots && hasSubgraphRootsWithEdges

  let externalRootNodes: AsciiNode[]
  let subgraphRootNodes: AsciiNode[] = []

  if (shouldSeparate) {
    externalRootNodes = rootNodes.filter(n => !isNodeInAnySubgraph(graph, n))
    subgraphRootNodes = rootNodes.filter(n => isNodeInAnySubgraph(graph, n))
  } else {
    externalRootNodes = rootNodes
  }

  for (const node of externalRootNodes) {
    const rootLevel = primaryLevelByNode?.get(node.name) ?? 0
    const requested: GridCoord = dir === 'LR'
      ? { x: rootLevel, y: highestPositionPerLevel[rootLevel]! }
      : { x: highestPositionPerLevel[rootLevel]!, y: rootLevel }
    reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
    highestPositionPerLevel[rootLevel] = highestPositionPerLevel[rootLevel]! + 4
  }

  if (shouldSeparate && subgraphRootNodes.length > 0) {
    const subgraphLevel = 4
    for (const node of subgraphRootNodes) {
      const rootLevel = Math.max(subgraphLevel, primaryLevelByNode?.get(node.name) ?? 0)
      const requested: GridCoord = dir === 'LR'
        ? { x: rootLevel, y: highestPositionPerLevel[rootLevel]! }
        : { x: highestPositionPerLevel[rootLevel]!, y: rootLevel }
      reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
      highestPositionPerLevel[rootLevel] = highestPositionPerLevel[rootLevel]! + 4
    }
  }

  let placedCount = externalRootNodes.length + subgraphRootNodes.length
  while (placedCount < graph.nodes.length) {
    const prevCount = placedCount
    for (const node of graph.nodes) {
      if (node.gridCoord === null) continue
      const gc = node.gridCoord

      for (const child of getChildren(graph, node)) {
        if (child.gridCoord !== null) continue

        const parentSg = getNodeSubgraph(graph, node)
        const childSg = getNodeSubgraph(graph, child)
        const edgeDir = (parentSg && parentSg === childSg && parentSg.direction)
          ? parentSg.direction
          : graph.config.graphDirection

        const childLevel = edgeDir === graph.config.graphDirection
          ? (primaryLevelByNode?.get(child.name) ?? (edgeDir === 'LR' ? gc.x + 4 : gc.y + 4))
          : (edgeDir === 'LR' ? gc.x + 4 : gc.y + 4)

        let highestPosition: number
        if (edgeDir !== graph.config.graphDirection) {
          highestPosition = edgeDir === 'LR' ? gc.y : gc.x
        } else {
          highestPosition = highestPositionPerLevel[childLevel]!
        }

        const requested: GridCoord = edgeDir === 'LR'
          ? { x: childLevel, y: highestPosition }
          : { x: highestPosition, y: childLevel }
        reserveSpotInGrid(graph, graph.nodes[child.index]!, requested, edgeDir)

        if (edgeDir === graph.config.graphDirection) {
          highestPositionPerLevel[childLevel] = highestPosition + 4
        }
        placedCount++
      }
    }

    if (placedCount === prevCount) break
  }
}

// ============================================================================
// Main layout orchestrator
// ============================================================================

/**
 * createMapping performs the full grid layout:
 * 1. Place root nodes on the grid
 * 2. Place child nodes level by level
 * 3. Compute column widths and row heights
 * 4. Run A* pathfinding for all edges
 * 5. Determine label placement
 * 6. Convert grid coords → drawing coords
 * 7. Generate node box drawings
 * 8. Calculate subgraph bounding boxes
 */
export function createMapping(graph: AsciiGraph): void {
  const hasStatePseudoNode = graph.nodes.some(node => node.shape === 'state-start' || node.shape === 'state-end')
  placeNodesOnGrid(graph, null)

  if (graph.config.maxWidth && graph.config.maxWidth > 0) {
    const naturalWidth = measurePlacedNodeLayoutWidth(graph)
    if (naturalWidth > graph.config.maxWidth) {
      clearGridPlacement(graph)
      const primaryLevelByNode = hasStatePseudoNode ? null : computePrimaryLevels(graph)
      placeNodesOnGrid(graph, primaryLevelByNode)
      rebalanceLevelsForMaxWidth(graph)
    }
  }

  // Compute column widths and row heights
  for (const node of graph.nodes) {
    setColumnWidth(graph, node)
  }

  // Analyze edges for bundling (parallel links like A & B --> C)
  // This groups edges that share sources or targets for cleaner visualization
  graph.bundles = analyzeEdgeBundles(graph)

  // Route bundled edges through junction points
  processBundles(graph)

  // Seed the occupancy map with any paths produced during bundle processing so the
  // remaining edges can avoid reusing those corridors unless the overlap is intentional.
  const occupiedEdgeCells = new Map<string, AsciiEdge[]>()
  for (const edge of graph.edges) {
    if (edge.path.length > 0) {
      markPathCellsOccupied(occupiedEdgeCells, edge.path, edge)
    }
  }

  // Route non-bundled edges via A* and determine label positions
  for (const edge of graph.edges) {
    // Skip edges that were already routed as part of a bundle
    if (edge.bundle && edge.path.length > 0) {
      increaseGridSizeForPath(graph, edge.path)
      determineLabelLine(graph, edge)
      continue
    }

    determinePath(graph, edge, occupiedEdgeCells)
    increaseGridSizeForPath(graph, edge.path)
    markPathCellsOccupied(occupiedEdgeCells, edge.path, edge)
    determineLabelLine(graph, edge)
  }

  // Convert grid coords → drawing coords and generate box drawings
  for (const node of graph.nodes) {
    node.drawingCoord = gridToDrawingCoord(graph, node.gridCoord!)
    node.drawing = drawBox(node, graph)
  }

  // Set canvas size and compute subgraph bounding boxes
  setCanvasSizeToGrid(graph.canvas, graph.columnWidth, graph.rowHeight)
  setRoleCanvasSizeToGrid(graph.roleCanvas, graph.columnWidth, graph.rowHeight)
  calculateSubgraphBoundingBoxes(graph)
  offsetDrawingForSubgraphs(graph)
}

// ============================================================================
// Graph traversal helpers
// ============================================================================

/** Get all edges originating from a node. */
function getEdgesFromNode(graph: AsciiGraph, node: AsciiNode): AsciiGraph['edges'] {
  return graph.edges.filter(e => e.from.name === node.name)
}

/** Get all direct children of a node (targets of outgoing edges). */
function getChildren(graph: AsciiGraph, node: AsciiNode): AsciiNode[] {
  return getEdgesFromNode(graph, node).map(e => e.to)
}

/**
 * Expand a merged path back into unit grid cells and record every traversed cell except
 * the final attachment point at the destination node. The destination cell stays free so
 * later edges can still enter/leave the same node side when that overlap is legitimate.
 */
function markPathCellsOccupied(
  occupied: Map<string, AsciiEdge[]>,
  path: GridCoord[],
  edge: AsciiEdge,
): void {
  if (path.length < 2) return

  const last = path[path.length - 1]!

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!
    const to = path[i]!
    const dx = Math.sign(to.x - from.x)
    const dy = Math.sign(to.y - from.y)
    let x = from.x + dx
    let y = from.y + dy

    while (true) {
      if (x !== last.x || y !== last.y) {
        appendOccupiedEdge(occupied, gridKey({ x, y }), edge)
      }

      if (x === to.x && y === to.y) {
        break
      }

      x += dx
      y += dy
    }
  }
}

/** Append one routed edge to the occupancy list for a specific grid cell. */
function appendOccupiedEdge(
  occupied: Map<string, AsciiEdge[]>,
  key: string,
  edge: AsciiEdge,
): void {
  const edges = occupied.get(key)
  if (edges) {
    edges.push(edge)
  } else {
    occupied.set(key, [edge])
  }
}
