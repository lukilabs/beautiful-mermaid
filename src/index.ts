// ============================================================================
// beautiful-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//   - C4 diagrams (C4Context / C4Container / C4Component / C4Dynamic / C4Deployment)
//   - ArchiMate diagrams (archimate-layered)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'beautiful-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export { parseArchimate } from "./archimate/parser.ts";
export type {
	ArchiMateDiagram,
	ArchiMateElement,
	ArchiMateLayer,
	ArchiMateRelationship,
} from "./archimate/types.ts";
export type { AsciiRenderOptions } from "./ascii/index.ts";
export { renderMermaidASCII, renderMermaidAscii } from "./ascii/index.ts";
export { parseC4 } from "./c4/parser.ts";
export type {
	C4Boundary,
	C4Diagram,
	C4DiagramType,
	C4Element,
	C4Relationship,
} from "./c4/types.ts";
export { parseMermaid } from "./parser.ts";
export type { DiagramColors, ThemeName } from "./theme.ts";
export { DEFAULTS, fromShikiTheme, THEMES } from "./theme.ts";
export type { MermaidGraph, PositionedGraph, RenderOptions } from "./types.ts";

import { decodeXML } from "entities";
import { layoutClassDiagramSync } from "./class/layout.ts";
import { parseClassDiagram } from "./class/parser.ts";
import { renderClassSvg } from "./class/renderer.ts";
import { layoutErDiagramSync } from "./er/layout.ts";
import { parseErDiagram } from "./er/parser.ts";
import { renderErSvg } from "./er/renderer.ts";
import { layoutGraphSync } from "./layout.ts";
import { parseMermaid } from "./parser.ts";
import { renderSvg } from "./renderer.ts";
import { layoutSequenceDiagram } from "./sequence/layout.ts";
import { parseSequenceDiagram } from "./sequence/parser.ts";
import { renderSequenceSvg } from "./sequence/renderer.ts";
import type { DiagramColors } from "./theme.ts";
import { DEFAULTS } from "./theme.ts";
import type { RenderOptions } from "./types.ts";
import { layoutXYChart } from "./xychart/layout.ts";
import { parseXYChart } from "./xychart/parser.ts";
import { renderXYChartSvg } from "./xychart/renderer.ts";

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 */
function detectDiagramType(
	text: string,
): "flowchart" | "sequence" | "class" | "er" | "xychart" | "c4" | "archimate" {
	const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? "";

	if (/^xychart(-beta)?\b/.test(firstLine)) return "xychart";
	if (/^sequencediagram\s*$/.test(firstLine)) return "sequence";
	if (/^classdiagram\s*$/.test(firstLine)) return "class";
	if (/^erdiagram\s*$/.test(firstLine)) return "er";
	if (
		/^c4(context|container|component|dynamic|deployment)\s*$/i.test(firstLine)
	)
		return "c4";
	if (/^archimate-layered\s*$/i.test(firstLine)) return "archimate";

	// Default: flowchart/state (handled by parseMermaid internally)
	return "flowchart";
}

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
	return {
		bg: options.bg ?? DEFAULTS.bg,
		fg: options.fg ?? DEFAULTS.fg,
		line: options.line,
		accent: options.accent,
		muted: options.muted,
		surface: options.surface,
		border: options.border,
	};
}

/**
 * Render Mermaid diagram text to an SVG string — synchronously.
 *
 * Uses elk.bundled.js with a direct FakeWorker bypass (no setTimeout(0) delay).
 * The ELK singleton is created lazily on first use and cached forever.
 *
 * Use this in React components with useMemo() to avoid flash:
 *   const svg = useMemo(() => renderMermaidSVG(code, opts), [code])
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * const svg = renderMermaidSVG('graph TD\n  A --> B')
 *
 * // With theme
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // With CSS variables (for live theme switching)
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: 'var(--background)', fg: 'var(--foreground)', transparent: true
 * })
 * ```
 */
export function renderMermaidSVG(
	text: string,
	options: RenderOptions = {},
): string {
	// Decode XML entities that may leak from markdown parsers (e.g. rehype-raw).
	// Without this, escapeXml() double-encodes them: &lt; → &amp;lt; → literal "&lt;" in SVG.
	text = decodeXML(text);

	const colors = buildColors(options);
	const font = options.font ?? "Inter";
	const transparent = options.transparent ?? false;
	const diagramType = detectDiagramType(text);

	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));

	switch (diagramType) {
		case "sequence": {
			const diagram = parseSequenceDiagram(lines);
			const positioned = layoutSequenceDiagram(diagram, options);
			return renderSequenceSvg(positioned, colors, font, transparent);
		}
		case "class": {
			const diagram = parseClassDiagram(lines);
			const positioned = layoutClassDiagramSync(diagram, options);
			return renderClassSvg(positioned, colors, font, transparent);
		}
		case "er": {
			const diagram = parseErDiagram(lines);
			const positioned = layoutErDiagramSync(diagram, options);
			return renderErSvg(positioned, colors, font, transparent);
		}
		case "xychart": {
			const chart = parseXYChart(lines);
			const positioned = layoutXYChart(chart, options);
			return renderXYChartSvg(
				positioned,
				colors,
				font,
				transparent,
				options.interactive ?? false,
			);
		}
		default: {
			const graph = parseMermaid(text);
			const positioned = layoutGraphSync(graph, options);
			return renderSvg(positioned, colors, font, transparent);
		}
		case "c4": {
			throw new Error(
				"C4 diagrams require async rendering — use renderMermaidSVGAsync() instead of renderMermaidSVG().",
			);
		}
		case "archimate": {
			throw new Error(
				"ArchiMate diagrams require async rendering — use renderMermaidSVGAsync() instead of renderMermaidSVG().",
			);
		}
	}
}

/**
 * Render Mermaid diagram text to an SVG string — async.
 *
 * Required for C4 and ArchiMate diagrams (which use dagre layout).
 * Also works for all other diagram types (delegates to the sync path).
 */
export async function renderMermaidSVGAsync(
	text: string,
	options: RenderOptions = {},
): Promise<string> {
	text = decodeXML(text);

	const colors = buildColors(options);
	const font = options.font ?? "Inter";
	const transparent = options.transparent ?? false;
	const diagramType = detectDiagramType(text);

	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));

	switch (diagramType) {
		case "c4": {
			// Dynamic imports — dagre is an optional dependency
			const { parseC4 } = await import("./c4/parser.ts");
			const { layoutC4Diagram } = await import("./c4/layout.ts");
			const { renderC4Svg } = await import("./c4/renderer.ts");
			const diagram = parseC4(lines);
			const positioned = await layoutC4Diagram(diagram, options);
			return renderC4Svg(positioned, colors, font, transparent);
		}
		case "archimate": {
			// Dynamic imports — dagre is an optional dependency
			const { parseArchimate } = await import("./archimate/parser.ts");
			const { layoutArchiMateDiagram } = await import("./archimate/layout.ts");
			const { renderArchiMateSvg } = await import("./archimate/renderer.ts");
			const diagram = parseArchimate(lines);
			const positioned = await layoutArchiMateDiagram(diagram, options);
			return renderArchiMateSvg(positioned, colors, font, transparent);
		}
		default:
			return renderMermaidSVG(text, options);
	}
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `renderMermaidSVG` */
export const renderMermaidSync = renderMermaidSVG;

/** @deprecated Use `renderMermaidSVGAsync` */
export const renderMermaid = renderMermaidSVGAsync;
