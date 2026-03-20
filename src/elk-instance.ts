/**
 * Shared ELK instance singleton.
 *
 * Uses elk.bundled.js (pure synchronous JS, ~1.6 MB) for all environments.
 * The singleton is created lazily on first use and cached forever.
 *
 * ELK's FakeWorker wraps both postMessage and onmessage in setTimeout(0),
 * making the normal API fully async. To bypass this:
 *   1. During construction, we capture setTimeout(0) callbacks and flush them
 *      synchronously — this registers the layout algorithms immediately.
 *   2. For layout calls, we call dispatcher.saveDispatch() directly (skipping
 *      the FakeWorker's postMessage setTimeout) and intercept the result via
 *      rawWorker.onmessage (which the dispatcher calls synchronously).
 */

import type { ElkNode } from "elkjs";
// @ts-expect-error — static import of bundled ELK
import ELKBundled from "elkjs/lib/elk.bundled.js";

interface RawFakeWorker {
	postMessage(msg: unknown): void;
	onmessage: ((e: { data: Record<string, unknown> }) => void) | null;
	dispatcher: {
		saveDispatch(msg: { data: Record<string, unknown> }): void;
	};
}

let elk: unknown = null;
let rawWorker: RawFakeWorker | null = null;

/**
 * Ensure the ELK singleton exists.
 *
 * Patches setTimeout during construction to capture and synchronously flush
 * the algorithm registration callback that ELK queues via setTimeout(0).
 * Without this, layout calls fail with "algorithm not found" until the
 * next macrotask.
 */
function ensureElk(): void {
	if (elk) return;

	// Capture setTimeout(0) callbacks queued during ELK construction
	const pending: (() => void)[] = [];
	const origSetTimeout = globalThis.setTimeout;
	// @ts-expect-error — simplified signature for our interception
	globalThis.setTimeout = (fn: () => void, delay?: number) => {
		if (delay === 0) {
			pending.push(fn);
			return 0;
		}
		return origSetTimeout(fn, delay);
	};

	// Bun defines `self` (= globalThis) but not `document`, which tricks
	// elk-worker.min.js into taking the Web Worker branch instead of the
	// CJS branch. Temporarily hide `self` so it exports {Worker: FakeWorker}.
	const g = globalThis as Record<string, unknown>;
	const hadSelf = "self" in g;
	const origSelf = g.self;
	if (hadSelf && typeof g.document === "undefined") {
		delete g.self;
	}

	elk = new ELKBundled();

	// Restore self
	if (hadSelf) g.self = origSelf;

	// Restore setTimeout immediately
	globalThis.setTimeout = origSetTimeout;

	// Flush captured callbacks synchronously — registers layout algorithms
	pending.forEach((fn) => fn());

	// Cache the raw FakeWorker for elkLayoutSync()
	rawWorker = (elk as unknown as { worker: { worker: RawFakeWorker } }).worker
		.worker;
}

/**
 * Run ELK layout synchronously.
 *
 * Bypasses BOTH of ELK's setTimeout(0) wrappers:
 *   - FakeWorker.postMessage wraps dispatch in setTimeout(0) — bypassed by
 *     calling dispatcher.saveDispatch() directly
 *   - PromisedWorker.onmessage wraps receive in setTimeout(0) — bypassed by
 *     replacing rawWorker.onmessage with a direct interceptor
 */
export function elkLayoutSync(graph: ElkNode): ElkNode {
	ensureElk();

	let result: ElkNode | undefined;
	let error: unknown;

	// Replace onmessage to intercept the result synchronously
	// (the dispatcher calls this directly, without setTimeout)
	const origOnmessage = rawWorker!.onmessage;
	rawWorker!.onmessage = (answer: { data: Record<string, unknown> }) => {
		if (answer.data.error) {
			error = answer.data.error;
		} else {
			result = answer.data.data as ElkNode;
		}
	};

	// Call dispatcher.saveDispatch directly — bypasses FakeWorker.postMessage's
	// setTimeout(0) wrapper. The dispatcher processes the layout synchronously
	// and calls rawWorker.onmessage with the result.
	rawWorker!.dispatcher.saveDispatch({
		data: { id: 0, cmd: "layout", graph } as unknown as Record<string, unknown>,
	});

	// Restore original handler
	rawWorker!.onmessage = origOnmessage;

	if (error) throw error;
	if (!result) throw new Error("ELK layout did not return synchronously");
	return result;
}
