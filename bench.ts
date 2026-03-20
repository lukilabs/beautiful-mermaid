/**
 * Performance benchmark for beautiful-mermaid.
 *
 * Runs all sample definitions through both renderers (SVG + ASCII) in Bun
 * and prints a table with per-sample timing and aggregate stats.
 *
 * Usage: bun run packages/mermaid/bench.ts
 */

import { samples } from "./samples-data.ts";
import { renderMermaidAscii } from "./src/ascii/index.ts";
import { renderMermaid } from "./src/index.ts";

// ============================================================================
// Types
// ============================================================================

interface Result {
	index: number;
	title: string;
	category: string;
	svgMs: number;
	asciiMs: number;
	svgError: string | null;
	asciiError: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Pad/truncate a string to exactly `width` characters, right-aligned if numeric. */
function col(
	value: string,
	width: number,
	align: "left" | "right" = "left",
): string {
	const truncated =
		value.length > width ? value.slice(0, width - 1) + "\u2026" : value;
	return align === "right"
		? truncated.padStart(width)
		: truncated.padEnd(width);
}

function fmtMs(ms: number): string {
	return ms.toFixed(1);
}

// ============================================================================
// Main
// ============================================================================

const results: Result[] = [];
const totalStart = performance.now();

console.log(`\nbeautiful-mermaid — Benchmark (${samples.length} samples)`);
console.log("═".repeat(90));
console.log(
	`${col("#", 4, "right")}  ${col("Title", 38)}  ${col("Category", 15)}  ${col("SVG (ms)", 10, "right")}  ${col("ASCII (ms)", 10, "right")}  ${col("Total", 10, "right")}`,
);
console.log("─".repeat(90));

for (let i = 0; i < samples.length; i++) {
	const sample = samples[i]!;
	const category = sample.category ?? "Other";
	let svgMs = 0;
	let asciiMs = 0;
	let svgError: string | null = null;
	let asciiError: string | null = null;

	// Render SVG (async — uses dagre layout for flowcharts/state/class/ER)
	try {
		const t0 = performance.now();
		await renderMermaid(sample.source, sample.options);
		svgMs = performance.now() - t0;
	} catch (err) {
		svgError = String(err);
		svgMs = -1;
	}

	// Render ASCII (sync — custom text layout, no dagre)
	try {
		const t0 = performance.now();
		renderMermaidAscii(sample.source);
		asciiMs = performance.now() - t0;
	} catch (err) {
		asciiError = String(err);
		asciiMs = -1;
	}

	const totalMs = (svgMs >= 0 ? svgMs : 0) + (asciiMs >= 0 ? asciiMs : 0);

	results.push({
		index: i,
		title: sample.title,
		category,
		svgMs,
		asciiMs,
		svgError,
		asciiError,
	});

	// Print row
	const svgStr = svgMs >= 0 ? fmtMs(svgMs) : "ERR";
	const asciiStr = asciiMs >= 0 ? fmtMs(asciiMs) : "N/A";
	console.log(
		`${col(String(i + 1), 4, "right")}  ${col(sample.title, 38)}  ${col(category, 15)}  ${col(svgStr, 10, "right")}  ${col(asciiStr, 10, "right")}  ${col(fmtMs(totalMs), 10, "right")}`,
	);
}

const totalElapsed = performance.now() - totalStart;

// ============================================================================
// Aggregates
// ============================================================================

console.log("═".repeat(90));

const svgTimes = results.filter((r) => r.svgMs >= 0).map((r) => r.svgMs);
const asciiTimes = results.filter((r) => r.asciiMs >= 0).map((r) => r.asciiMs);
const svgTotal = svgTimes.reduce((a, b) => a + b, 0);
const asciiTotal = asciiTimes.reduce((a, b) => a + b, 0);

console.log(
	`Total: ${fmtMs(totalElapsed)}ms (SVG: ${fmtMs(svgTotal)}ms, ASCII: ${fmtMs(asciiTotal)}ms)`,
);
console.log(
	`Average: ${fmtMs((svgTotal + asciiTotal) / results.length)}ms per sample`,
);

// Find slowest SVG and ASCII
if (svgTimes.length > 0) {
	const slowestSvg = results
		.filter((r) => r.svgMs >= 0)
		.sort((a, b) => b.svgMs - a.svgMs)[0]!;
	console.log(
		`Slowest SVG:   #${slowestSvg.index + 1} ${slowestSvg.title} (${fmtMs(slowestSvg.svgMs)}ms)`,
	);
}
if (asciiTimes.length > 0) {
	const slowestAscii = results
		.filter((r) => r.asciiMs >= 0)
		.sort((a, b) => b.asciiMs - a.asciiMs)[0]!;
	console.log(
		`Slowest ASCII: #${slowestAscii.index + 1} ${slowestAscii.title} (${fmtMs(slowestAscii.asciiMs)}ms)`,
	);
}

// Report errors
const svgErrors = results.filter((r) => r.svgError);
const asciiErrors = results.filter((r) => r.asciiError);
if (svgErrors.length > 0) {
	console.log(`\nSVG errors (${svgErrors.length}):`);
	for (const r of svgErrors) {
		console.log(`  #${r.index + 1} ${r.title}: ${r.svgError}`);
	}
}
if (asciiErrors.length > 0) {
	console.log(`\nASCII unsupported (${asciiErrors.length}):`);
	for (const r of asciiErrors) {
		console.log(`  #${r.index + 1} ${r.title}`);
	}
}

// Category breakdown
console.log("\n── By Category ──");
const catMap = new Map<string, Result[]>();
for (const r of results) {
	if (!catMap.has(r.category)) catMap.set(r.category, []);
	catMap.get(r.category)!.push(r);
}
for (const [cat, catResults] of catMap) {
	const catSvg = catResults
		.filter((r) => r.svgMs >= 0)
		.reduce((a, r) => a + r.svgMs, 0);
	const catAscii = catResults
		.filter((r) => r.asciiMs >= 0)
		.reduce((a, r) => a + r.asciiMs, 0);
	console.log(
		`  ${col(cat, 16)} ${col(String(catResults.length), 3, "right")} samples  SVG: ${col(fmtMs(catSvg), 8, "right")}ms  ASCII: ${col(fmtMs(catAscii), 8, "right")}ms  Total: ${col(fmtMs(catSvg + catAscii), 8, "right")}ms`,
	);
}

console.log();
