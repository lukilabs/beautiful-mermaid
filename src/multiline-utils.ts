// ============================================================================
// Multi-line Text Rendering Utilities
//
// Shared utilities for rendering multi-line text in SVG using <tspan> elements.
// Supports inline formatting: <b>, <i>, <u>, <s> mapped to SVG attributes.
// Used across all diagram types (flowcharts, state, sequence, class, ER).
// ============================================================================

import { LINE_HEIGHT_RATIO } from './text-metrics.ts';
import { f } from './render-utils.ts';

/**
 * Normalize label text: strip surrounding quotes, convert <br> tags and
 * literal \n sequences to newline characters. Strips unsupported HTML tags
 * but preserves formatting tags (<b>, <i>, <u>, <s>) for SVG rendering.
 */
export function normalizeBrTags(label: string): string {
  // Strip surrounding double quotes (Mermaid uses them for special chars in labels)
  const unquoted = label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label;
  return (
    unquoted
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\\n/g, '\n')
      .replace(/<\/?(?:sub|sup|small|mark)\s*>/gi, '')
      // Markdown formatting → HTML tags (order matters: ** before *)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*(?!\*)/g, '<i>$1</i>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
  );
}

/**
 * Strip all inline formatting tags from text, keeping only plain text.
 * Used for text measurement where tag characters shouldn't affect width.
 */
export function stripFormattingTags(text: string): string {
  return text.replace(/<\/?(?:b|strong|i|em|u|s|del)\s*>/gi, '');
}

/**
 * Escape special XML characters in text content.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Inline formatting: <b>, <i>, <u>, <s> → SVG tspan attributes
// ============================================================================

interface StyledSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

/** Regex to match opening/closing formatting tags */
const FORMAT_TAG_REGEX = /<(\/)?(?:(b|strong)|(i|em)|(u)|(s|del))\s*>/gi;

/**
 * Parse a line of text into styled segments based on inline formatting tags.
 * Supports nesting: `<b>bold <i>both</i> bold</b>`.
 */
function parseInlineFormatting(line: string): StyledSegment[] {
  const segments: StyledSegment[] = [];
  let bold = false,
    italic = false,
    underline = false,
    strikethrough = false;
  let lastIndex = 0;

  // Reset lastIndex for global regex
  FORMAT_TAG_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FORMAT_TAG_REGEX.exec(line)) !== null) {
    // Capture text before this tag
    if (match.index > lastIndex) {
      segments.push({
        text: line.slice(lastIndex, match.index),
        bold,
        italic,
        underline,
        strikethrough,
      });
    }
    lastIndex = match.index + match[0].length;

    const isClosing = Boolean(match[1]);
    // match[2] = b|strong, match[3] = i|em, match[4] = u, match[5] = s|del
    if (match[2]) bold = !isClosing;
    else if (match[3]) italic = !isClosing;
    else if (match[4]) underline = !isClosing;
    else if (match[5]) strikethrough = !isClosing;
  }

  // Remaining text after last tag
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold, italic, underline, strikethrough });
  }

  return segments;
}

/** Check if a line contains any formatting tags */
const HAS_FORMAT_TAGS = /<\/?(?:b|strong|i|em|u|s|del)\s*>/i;

/**
 * Render a line's content as SVG, with inline formatting applied as tspan attributes.
 * Returns raw SVG content (no wrapping tspan — caller provides positioning).
 */
function renderLineContent(line: string): string {
  // Fast path: no formatting tags
  if (!HAS_FORMAT_TAGS.test(line)) return escapeXml(line);

  const segments = parseInlineFormatting(line);
  if (segments.length === 0) return '';

  // If all segments are unstyled, just escape
  const allPlain = segments.every((s) => !s.bold && !s.italic && !s.underline && !s.strikethrough);
  if (allPlain) return segments.map((s) => escapeXml(s.text)).join('');

  return segments
    .map((seg) => {
      const escaped = escapeXml(seg.text);
      if (!seg.bold && !seg.italic && !seg.underline && !seg.strikethrough) return escaped;

      const attrs: string[] = [];
      if (seg.bold) attrs.push('font-weight="bold"');
      if (seg.italic) attrs.push('font-style="italic"');
      // SVG text-decoration can combine values
      const deco: string[] = [];
      if (seg.underline) deco.push('underline');
      if (seg.strikethrough) deco.push('line-through');
      if (deco.length) attrs.push(`text-decoration="${deco.join(' ')}"`);

      return `<tspan ${attrs.join(' ')}>${escaped}</tspan>`;
    })
    .join('');
}

// ============================================================================
// Multi-line text rendering
// ============================================================================

/**
 * Render a multi-line text element with proper vertical centering.
 *
 * For single-line text, returns a simple <text> element.
 * For multi-line text (containing \n), returns <text> with <tspan> children.
 * Inline formatting tags (<b>, <i>, <u>, <s>) are rendered as SVG attributes.
 *
 * @param text - The text to render (may contain \n and formatting tags)
 * @param cx - Center x coordinate
 * @param cy - Center y coordinate
 * @param fontSize - Font size in pixels
 * @param attrs - Additional SVG attributes (e.g., 'text-anchor="middle" fill="var(--_text)"')
 * @param baselineShift - Baseline shift for vertical alignment (default 0.35)
 * @returns SVG text element string
 */
export function renderMultilineText(
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
  attrs: string,
  baselineShift: number = 0.35,
): string {
  const lines = text.split('\n');

  // Single line — simple text element
  if (lines.length === 1) {
    const dy = fontSize * baselineShift;
    return f`<text x="${cx}" y="${cy}" ${attrs} dy="${dy}">${renderLineContent(text)}</text>`;
  }

  // Multi-line — use tspan elements with vertical centering
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  // First line dy: shift up by (n-1)/2 line heights, then add baseline shift
  const firstDy = -((lines.length - 1) / 2) * lineHeight + fontSize * baselineShift;

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? firstDy : lineHeight;
      return f`<tspan x="${cx}" dy="${dy}">${renderLineContent(line)}</tspan>`;
    })
    .join('');

  return f`<text x="${cx}" y="${cy}" ${attrs}>${tspans}</text>`;
}

/**
 * Render a multi-line text element with a background rectangle (pill).
 *
 * Used for edge labels that need a background for readability.
 *
 * @param text - The text to render (may contain \n)
 * @param cx - Center x coordinate
 * @param cy - Center y coordinate
 * @param textWidth - Pre-calculated text width (max line width)
 * @param textHeight - Pre-calculated text height (lines × lineHeight)
 * @param fontSize - Font size in pixels
 * @param padding - Padding around text
 * @param textAttrs - SVG attributes for the text element
 * @param bgAttrs - SVG attributes for the background rect
 * @returns SVG elements string (rect + text)
 */
export function renderMultilineTextWithBackground(
  text: string,
  cx: number,
  cy: number,
  textWidth: number,
  textHeight: number,
  fontSize: number,
  padding: number,
  textAttrs: string,
  bgAttrs: string,
): string {
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding * 2;

  const rect =
    f`<rect x="${cx - bgWidth / 2}" y="${cy - bgHeight / 2}" ` +
    f`width="${bgWidth}" height="${bgHeight}" ${bgAttrs} />`;

  const textEl = renderMultilineText(text, cx, cy, fontSize, textAttrs);

  return `${rect}\n${textEl}`;
}
