import type {
  PositionedErDiagram,
  PositionedErEntity,
  PositionedErRelationship,
  ErAttribute,
  Cardinality,
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
import { renderMultilineText, escapeXml as escapeXmlUtil } from '../multiline-utils.ts';
import { measureMultilineText } from '../text-metrics.ts';
import { f } from '../render-utils.ts';

// ============================================================================
// ER diagram SVG renderer
//
// Renders positioned ER diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Relationship lines (behind boxes)
//   2. Entity boxes (header + attribute rows)
//   3. Cardinality markers (crow's foot notation)
//   4. Relationship labels
// ============================================================================

/** Font sizes specific to ER diagrams */
const ER_FONT = {
  attrSize: 11,
  attrWeight: 400,
  keySize: 9,
  keyWeight: 600,
} as const;

/**
 * Render a positioned ER diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 */
export function renderErSvg(
  diagram: PositionedErDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = [];

  // SVG root with CSS variables + style block (with mono font) + defs
  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent));
  parts.push(buildStyleBlock(font, true));
  parts.push('<defs>');
  parts.push('</defs>'); // No marker defs — we draw crow's foot inline

  // 1. Relationship lines
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLine(rel));
  }

  // 2. Entity boxes
  for (const entity of diagram.entities) {
    parts.push(renderEntityBox(entity));
  }

  // 3. Cardinality markers at relationship endpoints
  for (const rel of diagram.relationships) {
    parts.push(renderCardinality(rel));
  }

  // 4. Relationship labels
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabel(rel));
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// ============================================================================
// Entity box rendering
// ============================================================================

/**
 * Render an entity box with header and attribute rows.
 * Wrapped in <g class="entity"> with semantic data attributes.
 */
function renderEntityBox(entity: PositionedErEntity): string {
  const { id, x, y, width, height, headerHeight, rowHeight, label, attributes } = entity;
  const parts: string[] = [];

  // Semantic wrapper with entity metadata
  parts.push(`<g class="entity" data-id="${escapeAttr(id)}" data-label="${escapeAttr(label)}">`);

  // Outer rectangle
  parts.push(
    f`  <rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
      `rx="0" ry="0" fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  );

  // Header background
  parts.push(
    f`  <rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" ` +
      `rx="0" ry="0" fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  );

  // Entity name (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        label,
        x + width / 2,
        y + headerHeight / 2,
        FONT_SIZES.nodeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="var(--_text)"`,
      ),
  );

  // Divider
  const attrTop = y + headerHeight;
  parts.push(
    f`  <line x1="${x}" y1="${attrTop}" x2="${x + width}" y2="${attrTop}" ` +
      `stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  );

  // Attribute rows
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i]!;
    const rowY = attrTop + i * rowHeight + rowHeight / 2;
    parts.push('  ' + renderAttribute(attr, x, rowY, width).replace(/\n/g, '\n  '));
  }

  // Empty row placeholder when no attributes
  if (attributes.length === 0) {
    parts.push(
      f`  <text x="${x + width / 2}" y="${attrTop + rowHeight / 2}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        `font-size="${ER_FONT.attrSize}" fill="var(--_text-faint)" font-style="italic">(no attributes)</text>`,
    );
  }

  parts.push('</g>');
  return parts.join('\n');
}

/**
 * Render a single attribute row with monospace syntax highlighting.
 * Layout: [PK badge]  type  name  (left-aligned in mono, name right-aligned)
 * Uses <tspan> elements for per-part coloring, matching the class diagram style.
 *
 * Key badge uses var(--_key-badge) for background tint.
 * Comments are shown as tooltips via SVG <title> element.
 */
function renderAttribute(attr: ErAttribute, boxX: number, y: number, boxWidth: number): string {
  const parts: string[] = [];

  // Wrap in a group if there's a comment (for tooltip support)
  const hasComment = attr.comment && attr.comment.length > 0;
  if (hasComment) {
    // Replace <br> with newlines for tooltip display
    const tooltipText = attr.comment!.replace(/<br\s*\/?>/gi, '\n');
    parts.push(`<g><title>${escapeXml(tooltipText)}</title>`);
  }

  // Key badges on the left (keep proportional font — they're visual tags, not code)
  let keyWidth = 0;
  if (attr.keys.length > 0) {
    const keyText = attr.keys.join(',');
    keyWidth = estimateTextWidth(keyText, ER_FONT.keySize, ER_FONT.keyWeight) + 8;
    parts.push(
      f`<rect x="${boxX + 6}" y="${y - 7}" width="${keyWidth}" height="14" rx="2" ry="2" ` +
        `fill="var(--_key-badge)" />`,
    );
    parts.push(
      f`<text x="${boxX + 6 + keyWidth / 2}" y="${y}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        `font-size="${ER_FONT.keySize}" font-weight="${ER_FONT.keyWeight}" fill="var(--_text-sec)">${attr.keys.join(',')}</text>`,
    );
  }

  // Type (left-aligned after keys, monospace with syntax highlighting)
  const typeX = boxX + 8 + (keyWidth > 0 ? keyWidth + 6 : 0);
  parts.push(
    `<text x="${typeX}" y="${y}" class="mono" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${ER_FONT.attrSize}" font-weight="${ER_FONT.attrWeight}">` +
      `<tspan fill="var(--_text-muted)">${escapeXml(attr.type)}</tspan></text>`,
  );

  // Name (right-aligned, monospace with syntax highlighting)
  const nameX = boxX + boxWidth - 8;
  parts.push(
    `<text x="${nameX}" y="${y}" class="mono" text-anchor="end" dy="${TEXT_BASELINE_SHIFT}" ` +
      `font-size="${ER_FONT.attrSize}" font-weight="${ER_FONT.attrWeight}">` +
      `<tspan fill="var(--_text-sec)">${escapeXml(attr.name)}</tspan></text>`,
  );

  // Close the group if we opened one
  if (hasComment) {
    parts.push('</g>');
  }

  return parts.join('\n');
}

// ============================================================================
// Relationship rendering
// ============================================================================

/**
 * Render a relationship line with semantic data attributes.
 */
function renderRelationshipLine(rel: PositionedErRelationship): string {
  if (rel.points.length < 2) return '';

  const pathData = rel.points.map((p) => f`${p.x},${p.y}`).join(' ');
  const dashArray = !rel.identifying ? ' stroke-dasharray="6 4"' : '';

  // Semantic data attributes for relationship inspection
  const labelAttr = rel.label ? ` data-label="${escapeAttr(rel.label)}"` : '';
  const dataAttrs = [
    'class="er-relationship"',
    `data-entity1="${escapeAttr(rel.entity1)}"`,
    `data-entity2="${escapeAttr(rel.entity2)}"`,
    `data-cardinality1="${rel.cardinality1}"`,
    `data-cardinality2="${rel.cardinality2}"`,
    `data-identifying="${rel.identifying}"`,
  ];

  return (
    `<polyline ${dataAttrs.join(' ')}${labelAttr} points="${pathData}" fill="none" stroke="var(--_line)" ` +
    `stroke-width="${STROKE_WIDTHS.connector}"${dashArray} />`
  );
}

/** Render a relationship label at the midpoint (supports multi-line) */
function renderRelationshipLabel(rel: PositionedErRelationship): string {
  if (!rel.label || rel.points.length < 2) return '';

  const mid = midpoint(rel.points);
  const metrics = measureMultilineText(rel.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel);

  // Background pill for readability
  const bgW = metrics.width + 8;
  const bgH = metrics.height + 6;

  return (
    f`<rect x="${mid.x - bgW / 2}" y="${mid.y - bgH / 2}" width="${bgW}" height="${bgH}" rx="2" ry="2" ` +
    `fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.5" />` +
    `\n${renderMultilineText(
      rel.label,
      mid.x,
      mid.y,
      FONT_SIZES.edgeLabel,
      `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
    )}`
  );
}

/**
 * Render crow's foot cardinality markers at both endpoints of a relationship.
 *
 * Crow's foot notation:
 *   'one':       ─║─   (single vertical line)
 *   'zero-one':  ─o║─  (circle + single line)
 *   'many':      ─╢─   (crow's foot + single line)
 *   'zero-many': ─o╣─  (circle + crow's foot)
 */
function renderCardinality(rel: PositionedErRelationship): string {
  if (rel.points.length < 2) return '';
  const parts: string[] = [];

  // Entity1 side (first point, direction toward second point)
  const p1 = rel.points[0]!;
  const p2 = rel.points[1]!;
  parts.push(renderCrowsFoot(p1, p2, rel.cardinality1));

  // Entity2 side (last point, direction toward second-to-last point)
  const pN = rel.points[rel.points.length - 1]!;
  const pN1 = rel.points[rel.points.length - 2]!;
  parts.push(renderCrowsFoot(pN, pN1, rel.cardinality2));

  return parts.join('\n');
}

/**
 * Render a crow's foot marker at a given endpoint.
 * `point` is the endpoint, `toward` gives the direction the line comes from.
 */
function renderCrowsFoot(
  point: { x: number; y: number },
  toward: { x: number; y: number },
  cardinality: Cardinality,
): string {
  const parts: string[] = [];
  const sw = STROKE_WIDTHS.connector + 0.25;

  // Calculate direction from toward → point (unit vector)
  const dx = point.x - toward.x;
  const dy = point.y - toward.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return '';
  const ux = dx / len;
  const uy = dy / len;

  // Perpendicular direction
  const px = -uy;
  const py = ux;

  // Marker sits 4px from the endpoint, extending 12px back along the edge
  const tipX = point.x - ux * 4;
  const tipY = point.y - uy * 4;
  const backX = point.x - ux * 16;
  const backY = point.y - uy * 16;

  // Single line: always present for 'one' and part of others
  const hasOneLine = cardinality === 'one' || cardinality === 'zero-one';
  const hasCrowsFoot = cardinality === 'many' || cardinality === 'zero-many';
  const hasCircle = cardinality === 'zero-one' || cardinality === 'zero-many';

  // Draw single vertical line (perpendicular to edge) at the tip
  if (hasOneLine) {
    const halfW = 6;
    parts.push(
      f`<line x1="${tipX + px * halfW}" y1="${tipY + py * halfW}" ` +
        f`x2="${tipX - px * halfW}" y2="${tipY - py * halfW}" ` +
        f`stroke="var(--_line)" stroke-width="${sw}" />`,
    );
    // Second line slightly back for "exactly one" emphasis
    const line2X = tipX - ux * 4;
    const line2Y = tipY - uy * 4;
    parts.push(
      f`<line x1="${line2X + px * halfW}" y1="${line2Y + py * halfW}" ` +
        f`x2="${line2X - px * halfW}" y2="${line2Y - py * halfW}" ` +
        f`stroke="var(--_line)" stroke-width="${sw}" />`,
    );
  }

  // Crow's foot (three lines fanning out from tip)
  if (hasCrowsFoot) {
    const fanW = 7;
    // Center line
    const cfTipX = tipX;
    const cfTipY = tipY;
    // Three lines from tip to back, fanning out
    parts.push(
      // Top fan line
      f`<line x1="${cfTipX + px * fanW}" y1="${cfTipY + py * fanW}" ` +
        f`x2="${backX}" y2="${backY}" ` +
        f`stroke="var(--_line)" stroke-width="${sw}" />`,
    );
    parts.push(
      // Center line
      f`<line x1="${cfTipX}" y1="${cfTipY}" ` +
        f`x2="${backX}" y2="${backY}" ` +
        f`stroke="var(--_line)" stroke-width="${sw}" />`,
    );
    parts.push(
      // Bottom fan line
      f`<line x1="${cfTipX - px * fanW}" y1="${cfTipY - py * fanW}" ` +
        f`x2="${backX}" y2="${backY}" ` +
        f`stroke="var(--_line)" stroke-width="${sw}" />`,
    );
  }

  // Circle (for zero variants)
  if (hasCircle) {
    const circleOffset = hasCrowsFoot ? 20 : 12;
    const circleX = point.x - ux * circleOffset;
    const circleY = point.y - uy * circleOffset;
    parts.push(
      f`<circle cx="${circleX}" cy="${circleY}" r="4" ` +
        f`fill="var(--bg)" stroke="var(--_line)" stroke-width="${sw}" />`,
    );
  }

  return parts.join('\n');
}

/** Compute the arc-length midpoint of a polyline path.
 *  Walks along each segment, finds the point at exactly 50% of total path length.
 *  This ensures the label sits ON the path even for orthogonal routes with bends,
 *  unlike the naive first/last geometric center which floats in space for L/Z shapes. */
function midpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;

  // Compute total path length
  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
  }

  if (totalLen === 0) return points[0]!;

  // Walk to 50% of total length, interpolating within the segment that crosses the halfway mark
  const halfLen = totalLen / 2;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (walked + segLen >= halfLen) {
      const t = segLen > 0 ? (halfLen - walked) / segLen : 0;
      return {
        x: points[i - 1]!.x + dx * t,
        y: points[i - 1]!.y + dy * t,
      };
    }
    walked += segLen;
  }

  return points[points.length - 1]!;
}

// ============================================================================
// Utilities
// ============================================================================

// Use shared escapeXml from multiline-utils
const escapeXml = escapeXmlUtil;

/**
 * Escape a string for use as an XML/HTML attribute value.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
