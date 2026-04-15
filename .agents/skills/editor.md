---
name: beautiful-mermaid-editor
description: >-
  Architecture, patterns, and change guide for the Beautiful Mermaid live editor.
  Use when modifying editor.ts, adding Config options, changing the UI, adding
  export formats, wiring new diagram options, or debugging the editor page.
---

# Beautiful Mermaid — Live Editor

## Key files

| File | Role |
|------|------|
| `editor.ts` | **Source of truth** — generates `editor.html` at build time |
| `editor.html` | Generated output — never edit directly |
| `dev.ts` | Dev server; builds both `editor.html` and `index.html` in parallel, serves `/` → editor, `/samples` → showcase |
| `src/browser.ts` | Bundles the renderer for the browser as `window.__mermaid` |
| `src/types.ts` | `RenderOptions` — all supported render options |
| `src/theme.ts` | `THEMES`, `buildStyleBlock`, `svgOpenTag` — CSS variable system |
| `src/styles.ts` | `STROKE_WIDTHS`, `FONT_SIZES` — hardcoded constants |
| `samples-data.ts` | Sample presets used by the showcase; editor uses its own inline `SAMPLES` array |

## Build cycle

```
editor.ts  ──Bun.build──►  src/browser.ts bundle (inline JS)
           ──template──►   editor.html  (self-contained, ~1.7 MB)
```

Run manually:
```bash
bun run editor   # generates editor.html once
bun run dev      # watches src/ + editor.ts, live-reloads browser
```

**Always rebuild after editing `editor.ts`.** The HTML file is the deployed artifact.

---

## Architecture overview

`editor.ts` is a TypeScript generator that:
1. Calls `Bun.build()` to bundle `src/browser.ts` → inline JS string
2. Constructs the full HTML page as a template literal
3. Writes `editor.html`

The page has **no runtime build step** — everything (renderer, UI logic, CSS) is inlined.

### State model (in the client JS)

```js
state = {
  theme: '',        // active diagram theme key ('' = Default)
  zoom: 1,          // current preview zoom level
  config: {},       // active RenderOptions overrides (from Config panel)
}

cfgColors  = { bg, fg, accent, line, muted, surface }  // color overrides
cfgFont    = ''     // font name (bare, e.g. 'Inter')
cfgPadding = 24     // padding px
cfgEdgeStroke = 1   // edge line stroke width
cfgNodeStroke = 1   // node border stroke width
```

### Render pipeline

```
editor input
  → scheduleRender(debounce ms)
    → doRender()
      → buildOptions()        // merges theme (base) + config (overrides)
      → renderMermaid(source, opts)   // window.__mermaid.renderMermaidSVGAsync
      → previewInner.innerHTML = svg
      → applyStrokeOverrides(svgEl)   // injects <style> for stroke widths
      → applyZoom(state.zoom)         // sets SVG width/height from viewBox × zoom
```

**Important**: `buildOptions()` layers options as `Object.assign(themeBase, state.config)` — config always wins over theme.

---

## How to add a Config option

### Case A: RenderOptions already supports it (colors, font, padding)

1. Add UI in the relevant `config-section` in the HTML template inside `editor.ts`
2. Add a JS state variable (e.g. `var cfgFoo = defaultVal`)
3. Update `readConfig()` to include it in `state.config`
4. Wire input events
5. Rebuild

### Case B: Post-process SVG (stroke widths, opacity, etc.)

Use CSS injection via `applyStrokeOverrides` pattern — no renderer changes needed:

```js
// After render:
var style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
style.id = '__bm-my-override';
style.textContent = 'rect { opacity: 0.8; }';
svgEl.insertBefore(style, svgEl.firstChild);
```

CSS rules override SVG presentation attributes (lower specificity). No `!important` needed.

Call your override function in:
- `doRender()` — after `previewInner.innerHTML = svg`
- Any slider/input `change` handler directly (instant, no re-render)

### Case C: Requires renderer support

Add to `RenderOptions` in `src/types.ts`, thread through `buildColors`/`svgOpenTag` in `src/theme.ts`, and use via CSS variable in `buildStyleBlock`.

---

## Adding a color field

1. Add to `cfgColors` object: `cfgColors.myColor = ''`
2. Add `THEME_COLOR_MAP` entry if the theme has a matching property
3. Add HTML in the Colors section:
```html
<div class="color-field">
  <span class="color-field-label">My Color</span>
  <button class="color-edit-btn" data-cfg="myColor">
    <span class="cfg-hex-label" id="cfg-myColor-label">—</span>
    <span class="color-swatch" id="cfg-myColor-swatch"></span>
  </button>
</div>
```
4. Update `readConfig()`: `if (cfgColors.myColor) cfg.myColor = cfgColors.myColor`
5. Ensure `refreshAllColorUIs()` covers it (it uses `Object.keys(cfgColors)` so automatic)

---

## Adding a slider (Layout section)

```html
<div class="padding-field">
  <div class="padding-row">
    <label>My Setting</label>
    <input class="padding-num" id="cfg-my-val" type="number" min="0" max="100" value="10" />
  </div>
  <input class="padding-slider" id="cfg-my-val-slider" type="range" min="0" max="100" value="10" />
</div>
```

```js
var cfgMyVal = 10;
var myNum    = document.getElementById('cfg-my-val');
var mySlider = document.getElementById('cfg-my-val-slider');

function setMyVal(v) {
  v = Math.max(0, Math.min(100, parseFloat(v) || 10));
  cfgMyVal = v;
  myNum.value    = v;
  mySlider.value = v;
  // apply effect...
}
myNum.addEventListener('input',    function() { setMyVal(myNum.value); });
mySlider.addEventListener('input', function() { setMyVal(mySlider.value); });
```

---

## Adding a sample preset

Edit the `SAMPLES` array near the top of `editor.ts`:

```ts
{
  category: 'Flowchart',   // must match an existing cat or add a new button
  title: 'My Sample',
  source: `graph TD\n  A --> B`,
},
```

If adding a new category, the category button is generated automatically from unique categories in `SAMPLES`.

---

## Zoom system

Zoom sets the SVG's **actual `width`/`height`** attributes (not CSS `transform: scale`), so the scroll container expands correctly.

```js
function applyZoom(z) {
  state.zoom = clamp(z, 0.1, 8);
  var nat = getSvgNaturalSize(svgEl);  // reads viewBox
  svgEl.style.width  = nat.w * z + 'px';
  svgEl.style.height = nat.h * z + 'px';
}
```

Always call `applyZoom(state.zoom)` after inserting a new SVG. Zoom is preserved across re-renders.

---

## Theme ↔ dark mode sync

```
applyColorMode(dark)
  → sets :root.light / removes it (editor UI)
  → if diagramThemeIsAuto: sets state.theme = 'zinc-dark' or ''
  → refreshAllColorUIs()
  → scheduleRender(0)
```

`diagramThemeIsAuto = false` once the user manually picks a theme from the dropdown — their choice is then preserved across dark/light toggles.

---

## CSS variable system (diagram SVG)

The renderer injects a `<style>` block into every SVG with derived vars:

```
--bg, --fg  →  user-provided or defaults
--line, --accent, --muted, --surface, --border  →  optional overrides
--_line, --_arrow, --_node-fill, --_node-stroke  →  internal derived (color-mix)
```

Config overrides work by setting `--bg`, `--fg` etc. on the SVG's inline `style` attribute via `svgOpenTag()`. Theme colors are the base; config values override them in `buildOptions()`.

---

## URL sharing

Source + theme are encoded in the URL hash:

```js
// Encode
btoa(unescape(encodeURIComponent(JSON.stringify({ source, theme }))))

// Decode
JSON.parse(decodeURIComponent(escape(atob(hash))))
```

`updateHash()` is called after every successful render and on Copy URL.

---

## Export formats

| Action | Implementation |
|--------|----------------|
| Save PNG | SVG → `<img>` → `<canvas>` → `toBlob('image/png')` → download |
| Save SVG | `XMLSerializer.serializeToString(svgEl)` → Blob → download |
| Copy Image | Same as PNG but `navigator.clipboard.write([new ClipboardItem(...)])` |
| Copy URL | `updateHash()` then `navigator.clipboard.writeText(location.href)` |

Scale (1x/2x/4x) multiplies canvas dimensions for PNG export.

---

## Common pitfalls

- **Never edit `editor.html` directly** — it's overwritten on every build
- **Avoid `\'` inside template literals** — use DOM API (`createElement`, `.textContent`) instead of `innerHTML` with quotes
- **Stroke overrides via CSS injection must re-run after every render** — the SVG is replaced in `doRender()`
- **`transform: scale()` breaks scrolling** — always use explicit `width`/`height` for zoom
- **Font option is the bare name** (`Inter`, not `"Inter", sans-serif`) — the renderer wraps it internally
