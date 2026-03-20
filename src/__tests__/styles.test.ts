/**
 * Tests for styles module — text measurement and constants.
 * Theme resolution tests are in theme.test.ts (CSS custom property system).
 */
import { describe, expect, it } from "bun:test";
import {
	ARROW_HEAD,
	estimateTextWidth,
	FONT_SIZES,
	FONT_WEIGHTS,
	NODE_PADDING,
	STROKE_WIDTHS,
} from "../styles.ts";
import type { DiagramColors } from "../theme.ts";
import {
	buildStyleBlock,
	DEFAULTS,
	fromShikiTheme,
	svgOpenTag,
	THEMES,
} from "../theme.ts";

// ============================================================================
// Theme system (CSS custom properties)
// ============================================================================

describe("THEMES", () => {
	it("contains well-known theme palettes", () => {
		expect(THEMES["zinc-light"]).toBeDefined();
		expect(THEMES["zinc-dark"]).toBeDefined();
		expect(THEMES["tokyo-night"]).toBeDefined();
		expect(THEMES["catppuccin-mocha"]).toBeDefined();
		expect(THEMES.nord).toBeDefined();
	});

	it("each theme has valid bg and fg colors", () => {
		for (const [_name, colors] of Object.entries(THEMES)) {
			expect(colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
			expect(colors.fg).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});
});

describe("DEFAULTS", () => {
	it("provides zinc-light bg/fg", () => {
		expect(DEFAULTS.bg).toBe("#FFFFFF");
		expect(DEFAULTS.fg).toBe("#27272A");
	});
});

describe("svgOpenTag", () => {
	it("sets --bg and --fg CSS variables in inline style", () => {
		const tag = svgOpenTag(400, 300, { bg: "#1a1b26", fg: "#a9b1d6" });
		expect(tag).toContain("--bg:#1a1b26");
		expect(tag).toContain("--fg:#a9b1d6");
		expect(tag).toContain("background:var(--bg)");
	});

	it("includes optional enrichment variables when provided", () => {
		const colors: DiagramColors = {
			bg: "#1a1b26",
			fg: "#a9b1d6",
			line: "#3d59a1",
			accent: "#7aa2f7",
		};
		const tag = svgOpenTag(400, 300, colors);
		expect(tag).toContain("--line:#3d59a1");
		expect(tag).toContain("--accent:#7aa2f7");
	});

	it("omits unset enrichment variables", () => {
		const tag = svgOpenTag(400, 300, { bg: "#fff", fg: "#000" });
		expect(tag).not.toContain("--line");
		expect(tag).not.toContain("--accent");
		expect(tag).not.toContain("--muted");
	});
});

describe("buildStyleBlock", () => {
	it("includes derived CSS variable declarations", () => {
		const style = buildStyleBlock("Inter", false);
		expect(style).toContain("--_text");
		expect(style).toContain("--_line");
		expect(style).toContain("--_arrow");
		expect(style).toContain("--_node-fill");
		expect(style).toContain("--_node-stroke");
	});

	it("includes mono font class when requested", () => {
		const withMono = buildStyleBlock("Inter", true);
		expect(withMono).toContain(".mono");
		expect(withMono).toContain("JetBrains Mono");

		const withoutMono = buildStyleBlock("Inter", false);
		expect(withoutMono).not.toContain(".mono");
	});
});

describe("fromShikiTheme", () => {
	it("extracts bg/fg from editor colors", () => {
		const colors = fromShikiTheme({
			type: "dark",
			colors: {
				"editor.background": "#1a1b26",
				"editor.foreground": "#a9b1d6",
			},
		});
		expect(colors.bg).toBe("#1a1b26");
		expect(colors.fg).toBe("#a9b1d6");
	});

	it("falls back for missing editor colors", () => {
		const dark = fromShikiTheme({ type: "dark" });
		expect(dark.bg).toBe("#1e1e1e");
		expect(dark.fg).toBe("#d4d4d4");

		const light = fromShikiTheme({ type: "light" });
		expect(light.bg).toBe("#ffffff");
		expect(light.fg).toBe("#333333");
	});
});

// ============================================================================
// Text width estimation
// ============================================================================

describe("estimateTextWidth", () => {
	it("returns a positive number for non-empty text", () => {
		const width = estimateTextWidth("Hello", 13, 500);
		expect(width).toBeGreaterThan(0);
	});

	it("returns minimum padding for empty text", () => {
		// Empty text still returns minimum padding (fontSize * 0.15) for layout safety
		expect(estimateTextWidth("", 13, 500)).toBeCloseTo(1.95, 1);
	});

	it("scales with text length", () => {
		const short = estimateTextWidth("Hi", 13, 500);
		const long = estimateTextWidth("Hello World", 13, 500);
		expect(long).toBeGreaterThan(short);
	});

	it("scales with font size", () => {
		const small = estimateTextWidth("Text", 11, 500);
		const large = estimateTextWidth("Text", 16, 500);
		expect(large).toBeGreaterThan(small);
	});

	it("heavier weights produce wider estimates", () => {
		const regular = estimateTextWidth("Text", 13, 400);
		const bold = estimateTextWidth("Text", 13, 600);
		expect(bold).toBeGreaterThan(regular);
	});

	it("produces reasonable widths for typical node labels", () => {
		// A 5-character label at 13px/500w should be roughly 35px (5 * 13 * 0.55)
		const width = estimateTextWidth(
			"Hello",
			FONT_SIZES.nodeLabel,
			FONT_WEIGHTS.nodeLabel,
		);
		expect(width).toBeGreaterThan(25);
		expect(width).toBeLessThan(60);
	});
});

// ============================================================================
// Exported constants
// ============================================================================

describe("constants", () => {
	it("FONT_SIZES has expected values", () => {
		expect(FONT_SIZES.nodeLabel).toBe(13);
		expect(FONT_SIZES.edgeLabel).toBe(11);
		expect(FONT_SIZES.groupHeader).toBe(12);
	});

	it("FONT_WEIGHTS has expected values", () => {
		expect(FONT_WEIGHTS.nodeLabel).toBe(500);
		expect(FONT_WEIGHTS.edgeLabel).toBe(400);
		expect(FONT_WEIGHTS.groupHeader).toBe(600);
	});

	it("NODE_PADDING has expected values", () => {
		expect(NODE_PADDING.horizontal).toBe(20);
		expect(NODE_PADDING.vertical).toBe(10);
		expect(NODE_PADDING.diamondExtra).toBe(24);
	});

	it("STROKE_WIDTHS has expected values", () => {
		expect(STROKE_WIDTHS.outerBox).toBe(1);
		expect(STROKE_WIDTHS.innerBox).toBe(0.75);
		expect(STROKE_WIDTHS.connector).toBe(1);
	});

	it("ARROW_HEAD has expected values", () => {
		expect(ARROW_HEAD.width).toBe(8);
		expect(ARROW_HEAD.height).toBe(5);
	});
});
