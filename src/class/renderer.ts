import type {
  PositionedClassDiagram,
  PositionedClassNode,
  PositionedClassRelationship,
  ClassMember,
  RelationshipType,
} from './types.ts';
import type { DiagramColors } from '../theme.ts';
import { svgOpenTag, buildStyleBlock } from '../theme.ts';
import {
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
  estimateTextWidth,
  TEXT_BASELINE_SHIFT,
} from '../styles.ts';
import { CLS } from './layout.ts';
import { renderMultilineText, escapeXml as escapeXmlUtil } from '../multiline-utils.ts';
import { f } from '../render-utils.ts';

// ============================================================================
// Class diagram SVG renderer
//
// Renders positioned class diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Relationship lines (behind boxes)
//   2. Class boxes (header + attributes + methods compartments)
//   3. Relationship endpoint markers (diamonds, triangles)
//   4. Labels and cardinality
// ============================================================================

/** Font sizes specific to class diagrams */
const CLS_FONT = {
  memberSize: 11,
  memberWeight: 400,
  annotationSize: 10,
  annotationWeight: 500,
} as const;

/**
 * Render a positioned class diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 */
export function renderClassSvg(
  diagram: PositionedClassDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = [];

  // SVG root with CSS variables + style block (with mono font) + defs
  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent));
  parts.push(buildStyleBlock(font, true));
  parts.push('<defs>');
  parts.push(relationshipMarkerDefs());
  parts.push('</defs>');

  // 1. Relationship lines (rendered behind boxes)
  for (const rel of diagram.relationships) {
    parts.push(renderRelationship(rel));
  }

  // 2. Class boxes
  for (const cls of diagram.classes) {
    parts.push(renderClassBox(cls));
  }

  // 3. Relationship labels and cardinality
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabels(rel));
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// ============================================================================
// Marker definitions
// ============================================================================

/**
 * Marker definitions for class relationship endpoints.
 * Each relationship type has a distinct marker:
 *   - inheritance: hollow triangle
 *   - composition: filled diamond
 *   - aggregation: hollow diamond
 *   - association: open arrow (simple >)
 *   - dependency: open arrow (simple >)
 *   - realization: hollow triangle (same as inheritance)
 *
 * Uses var(--_arrow) for fill/stroke and var(--bg) for hollow marker fills.
 */
function relationshipMarkerDefs(): string {
  return (
    // Hollow triangle (inheritance, realization) — points at target
    `  <marker id="cls-inherit" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 12 5, 0 10" fill="var(--bg)" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Filled diamond (composition) — points at source
    `\n  <marker id="cls-composition" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="1" />` +
    `\n  </marker>` +
    // Hollow diamond (aggregation) — points at source
    `\n  <marker id="cls-aggregation" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="var(--bg)" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Open arrow (association, dependency)
    `\n  <marker id="cls-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto-start-reverse">` +
    `\n    <polyline points="0 0, 8 3, 0 6" fill="none" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>`
  );
}

// ============================================================================
// Class box rendering
// ============================================================================

/**
 * Render a class box with 3 compartments: header, attributes, methods.
 * Wrapped in <g class="class-node"> with semantic data attributes.
 */
function renderClassBox(cls: PositionedClassNode): string {
  const { x, y, width, height, headerHeight, attrHeight, methodHeight } = cls;
  const parts: string[] = [];

  // Semantic wrapper with class metadata
  // data-id: class identifier
  // data-label: class name
  // data-annotation: stereotype (interface, abstract, etc.)
  const annotationAttr = cls.annotation ? ` data-annotation="${escapeAttr(cls.annotation)}"` : '';
  parts.push(
    `<g class="class-node" data-id="${escapeAttr(cls.id)}" data-label="${escapeAttr(cls.label)}"${annotationAttr}>`,
  );

  // Outer rectangle (full box)
  parts.push(
    f`  <rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
      `rx="0" ry="0" fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  );

  // Header background
  parts.push(
    f`  <rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" ` +
      `rx="0" ry="0" fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  );

  // Annotation (<<interface>>, <<abstract>>, etc.)
  let nameY = y + headerHeight / 2;
  if (cls.annotation) {
    const annotY = y + 12;
    parts.push(
      f`  <text x="${x + width / 2}" y="${annotY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        `font-size="${CLS_FONT.annotationSize}" font-weight="${CLS_FONT.annotationWeight}" ` +
        `font-style="italic" fill="var(--_text-muted)">&lt;&lt;${escapeXml(cls.annotation)}&gt;&gt;</text>`,
    );
    nameY = y + headerHeight / 2 + 6;
  }

  // Class name (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        cls.label,
        x + width / 2,
        nameY,
        FONT_SIZES.nodeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="var(--_text)"`,
      ),
  );

  // Divider line between header and attributes
  const attrTop = y + headerHeight;
  parts.push(
    f`  <line x1="${x}" y1="${attrTop}" x2="${x + width}" y2="${attrTop}" ` +
      `stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  );

  // Attributes
  const memberRowH = 20;
  for (let i = 0; i < cls.attributes.length; i++) {
    const member = cls.attributes[i]!;
    const memberY = attrTop + 4 + i * memberRowH + memberRowH / 2;
    parts.push('  ' + renderMember(member, x + CLS.boxPadX, memberY));
  }

  // Divider line between attributes and methods
  const methodTop = attrTop + attrHeight;
  parts.push(
    f`  <line x1="${x}" y1="${methodTop}" x2="${x + width}" y2="${methodTop}" ` +
      `stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  );

  // Methods
  for (let i = 0; i < cls.methods.length; i++) {
    const member = cls.methods[i]!;
    const memberY = methodTop + 4 + i * memberRowH + memberRowH / 2;
    parts.push('  ' + renderMember(member, x + CLS.boxPadX, memberY));
  }

  parts.push('</g>');

  return parts.join('\n');
}

/**
 * Render a single class member with syntax highlighting.
 * Uses <tspan> elements to color each part of the member differently:
 *   - visibility symbol (+/-/#/~) → textFaint
 *   - member name (incl. parens for methods) → textSecondary
 *   - colon separator → textFaint
 *   - type annotation → textMuted
 */
function renderMember(member: ClassMember, x: number, y: number): string {
  const fontStyle = member.isAbstract ? ' font-style="italic"' : '';
  const decoration = member.isStatic ? ' text-decoration="underline"' : '';

  // Build tspan parts for syntax-highlighted member text
  const spans: string[] = [];

  if (member.visibility) {
    spans.push(`<tspan fill="var(--_text-faint)">${escapeXml(member.visibility)} </tspan>`);
  }

  // Add parentheses for methods to distinguish from attributes, including parameters if present
  const displayName = member.isMethod ? `${member.name}(${member.params || ''})` : member.name;
  spans.push(`<tspan fill="var(--_text-sec)">${escapeXml(displayName)}</tspan>`);

  if (member.type) {
    spans.push(`<tspan fill="var(--_text-faint)">: </tspan>`);
    spans.push(`<tspan fill="var(--_text-muted)">${escapeXml(member.type)}</tspan>`);
  }

  return (
    `<text x="${x}" y="${y}" class="mono" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${CLS_FONT.memberSize}" font-weight="${CLS_FONT.memberWeight}"${fontStyle}${decoration}>` +
    `${spans.join('')}</text>`
  );
}

// ============================================================================
// Relationship rendering
// ============================================================================

/**
 * Render a relationship line with appropriate markers and semantic attributes.
 * Includes data-* attributes for programmatic inspection.
 */
function renderRelationship(rel: PositionedClassRelationship): string {
  if (rel.points.length < 2) return '';

  const pathData = rel.points.map((p) => f`${p.x},${p.y}`).join(' ');
  const isDashed = rel.type === 'dependency' || rel.type === 'realization';
  const dashArray = isDashed ? ' stroke-dasharray="6 4"' : '';

  // Determine markers based on relationship type and which end has the marker
  const markers = getRelationshipMarkers(rel.type, rel.markerAt);

  // Build semantic data attributes for relationship inspection:
  // - class="class-relationship": CSS targeting
  // - data-from/data-to: source and target class IDs
  // - data-type: relationship type (inheritance, composition, etc.)
  // - data-marker-at: which end has the marker (from/to)
  // - data-from-cardinality/data-to-cardinality: multiplicity if present
  // - data-label: relationship label if present
  const dataAttrs = [
    'class="class-relationship"',
    `data-from="${escapeAttr(rel.from)}"`,
    `data-to="${escapeAttr(rel.to)}"`,
    `data-type="${rel.type}"`,
    `data-marker-at="${rel.markerAt}"`,
  ];
  if (rel.label) {
    dataAttrs.push(`data-label="${escapeAttr(rel.label)}"`);
  }
  if (rel.fromCardinality) {
    dataAttrs.push(`data-from-cardinality="${escapeAttr(rel.fromCardinality)}"`);
  }
  if (rel.toCardinality) {
    dataAttrs.push(`data-to-cardinality="${escapeAttr(rel.toCardinality)}"`);
  }

  return (
    `<polyline ${dataAttrs.join(' ')} points="${pathData}" fill="none" stroke="var(--_line)" ` +
    `stroke-width="${STROKE_WIDTHS.connector}"${dashArray}${markers} />`
  );
}

/**
 * Get marker-start/marker-end attributes for a relationship type.
 * Uses `markerAt` from the parser to place the marker on the correct end:
 *   - 'from' → marker-start (prefix arrows like `<|--`, `*--`, `o--`)
 *   - 'to'   → marker-end   (suffix arrows like `..|>`, `-->`, `--*`)
 */
function getRelationshipMarkers(type: RelationshipType, markerAt: 'from' | 'to'): string {
  const markerId = getMarkerDefId(type);
  if (!markerId) return '';

  if (markerAt === 'from') {
    return ` marker-start="url(#${markerId})"`;
  } else {
    return ` marker-end="url(#${markerId})"`;
  }
}

/** Map relationship type to its SVG marker definition ID */
function getMarkerDefId(type: RelationshipType): string | null {
  switch (type) {
    case 'inheritance':
    case 'realization':
      return 'cls-inherit';
    case 'composition':
      return 'cls-composition';
    case 'aggregation':
      return 'cls-aggregation';
    case 'association':
    case 'dependency':
      return 'cls-arrow';
    default:
      return null;
  }
}

/** Render relationship labels and cardinality text (supports multi-line) */
function renderRelationshipLabels(rel: PositionedClassRelationship): string {
  if (!rel.label && !rel.fromCardinality && !rel.toCardinality) return '';
  if (rel.points.length < 2) return '';

  const parts: string[] = [];

  // Label — prefer layout-computed position (collision-aware), fall back to midpoint
  if (rel.label) {
    const pos = rel.labelPosition ?? midpoint(rel.points);
    parts.push(
      renderMultilineText(
        rel.label,
        pos.x,
        pos.y - 8,
        FONT_SIZES.edgeLabel,
        `font-size="${FONT_SIZES.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    );
  }

  // From cardinality (near start)
  if (rel.fromCardinality) {
    const p = rel.points[0]!;
    const next = rel.points[1]!;
    const offset = cardinalityOffset(p, next);
    parts.push(
      renderMultilineText(
        rel.fromCardinality,
        p.x + offset.x,
        p.y + offset.y,
        FONT_SIZES.edgeLabel,
        `font-size="${FONT_SIZES.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    );
  }

  // To cardinality (near end)
  if (rel.toCardinality) {
    const p = rel.points[rel.points.length - 1]!;
    const prev = rel.points[rel.points.length - 2]!;
    const offset = cardinalityOffset(p, prev);
    parts.push(
      renderMultilineText(
        rel.toCardinality,
        p.x + offset.x,
        p.y + offset.y,
        FONT_SIZES.edgeLabel,
        `font-size="${FONT_SIZES.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    );
  }

  return parts.join('\n');
}

/** Get the midpoint of a point array */
function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  const mid = Math.floor(points.length / 2);
  return points[mid]!;
}

/** Calculate offset for cardinality label perpendicular to edge direction */
function cardinalityOffset(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Place label perpendicular to the edge, 14px away
  if (Math.abs(dx) > Math.abs(dy)) {
    // Mostly horizontal — offset vertically
    return { x: dx > 0 ? 14 : -14, y: -10 };
  }
  // Mostly vertical — offset horizontally
  return { x: -14, y: dy > 0 ? 14 : -14 };
}

// ============================================================================
// Utilities
// ============================================================================

// Use shared escapeXml from multiline-utils
const escapeXml = escapeXmlUtil;

/**
 * Escape a string for use as an XML/HTML attribute value.
 * Escapes quotes and ampersands to prevent attribute injection.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
