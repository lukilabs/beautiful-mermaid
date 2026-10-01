// ============================================================================
// Mindmap — type definitions
// ============================================================================

export type MindmapShape = 'default' | 'rounded' | 'square' | 'circle' | 'hexagon'

export interface MindmapNode {
  text: string
  shape: MindmapShape
  children: MindmapNode[]
}

export interface Mindmap {
  title?: string
  root: MindmapNode
}
