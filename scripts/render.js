#!/usr/bin/env node

/**
 * Beautiful Mermaid CLI Renderer
 * 
 * Usage:
 *   node scripts/render.js <input.mmd> [options]
 *   node scripts/render.js --code "graph TD\nA --> B" [options]
 *   node scripts/render.js --batch <dir> [options]
 * 
 * Options:
 *   --format, -f     output format: svg (default) | ascii | png
 *   --theme, -t      theme name or custom theme JSON
 *   --output, -o     output file path
 *   --code, -c       pass Mermaid code directly
 *   --bg             background color (mono mode)
 *   --fg             foreground color (mono mode)
 *   --line           edge/line color
 *   --preset, -p     style preset: default | modern | gradient | outline | glass
 *   --width, -w      PNG output width (default: 1200)
 *   --scale, -s      PNG scale factor (default: 1, range: 0.5-4)
 *   --dpi            PNG output DPI (default: 144, range: 72-600)
 *   --interactive    enable interactive tooltips (XY charts only)
 *   --batch          batch mode: render all .mmd files in a directory
 *   --color-mode     ASCII color mode: none | auto | ansi16 | ansi256 | truecolor (default) | html
 *   --help, -h       show help
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lazy-load sharp only for PNG output to avoid install errors in non-PNG scenarios
let _sharp = null;
function getSharp() {
  if (!_sharp) _sharp = require('sharp');
  return _sharp;
}

// Import shared data from styles.js (single source of truth)
const {
  STYLE_PRESETS,
  THEMES: LOCAL_THEMES,
  THEME_DEFAULTS,
  THEME_META,
  injectStylesToSVG,
  isValidPreset,
  isValidTheme,
  getTheme,
  getThemeMeta,
  getRecommendedPreset,
  resolveTheme,
  getDarkThemes,
  getLightThemes,
} = require('./styles');

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    format: 'svg',
    theme: 'github-light',
    output: null,
    code: null,
    bg: null,
    fg: null,
    line: null,
    preset: null,
    width: 1200,
    scale: 1,
    dpi: 144,
    interactive: false,
    colorMode: 'truecolor',
    batch: false,
    input: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--theme':
      case '-t':
        options.theme = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--code':
      case '-c':
        options.code = args[++i];
        break;
      case '--bg':
        options.bg = args[++i];
        break;
      case '--fg':
        options.fg = args[++i];
        break;
      case '--line':
        options.line = args[++i];
        break;
      case '--preset':
      case '-p':
        options.preset = args[++i];
        break;
      case '--width':
      case '-w':
        options.width = parseInt(args[++i], 10);
        break;
      case '--scale':
      case '-s':
        options.scale = parseFloat(args[++i]);
        break;
      case '--dpi':
        options.dpi = parseInt(args[++i], 10);
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--color-mode':
        options.colorMode = args[++i];
        break;
      case '--batch':
        options.batch = true;
        break;
      case '--list-themes':
        options.listThemes = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !options.input) {
          options.input = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Beautiful Mermaid CLI Renderer
================================

Usage:
  node scripts/render.js <input.mmd> [options]
  node scripts/render.js --code "graph TD\\nA --> B" [options]
  node scripts/render.js --batch <dir> [options]

Options:
  --format, -f     output format: svg (default) | ascii | png
  --theme, -t      theme name (e.g. tokyo-night, dracula, github-dark)
                   or custom JSON: '{"bg":"#...","fg":"#..."}'
  --output, -o     output file path (default: input.svg or output.png)
  --code, -c       pass Mermaid code directly
  --bg             background color (e.g. #f7f7fa)
  --fg             foreground/text color (e.g. #27272a)
  --line           edge/line color (e.g. #6b7280)
  --preset, -p     style preset: default | modern | gradient | outline | glass
                   (matches the style presets in preview.html)
  --width, -w      PNG output width in px (default: 1200)
  --scale, -s      PNG scale factor (default: 1, range: 0.5-4)
  --dpi            PNG output DPI (default: 144, range: 72-600)
  --interactive    enable interactive tooltips (XY charts only)
  --color-mode     ASCII color mode: none | auto | ansi16 | ansi256 | truecolor | html
  --batch          batch mode: render all .mmd files in a directory
  --help, -h       show help

Available themes:
  github-light        GitHub Light (default)
  tokyo-night-storm   Tokyo Night Storm
  tokyo-night-light   Tokyo Night Light
  dracula             Dracula
  github-dark         GitHub Dark
  github-light        GitHub Light
  nord                Nord Dark
  nord-light         Nord Light
  one-dark            One Dark
  catppuccin-mocha    Catppuccin Mocha
  catppuccin-latte    Catppuccin Latte
  solarized-dark      Solarized Dark
  solarized-light     Solarized Light
  zinc-light          Zinc Light
  zinc-dark           Zinc Dark

Style presets (--preset):
  default     default (8px radius, 2px border, shadow)
  modern      modern (16px radius, 1px border, soft shadow)
  gradient    gradient (12px radius, no border, colorful shadow)
  outline     outline style (4px radius, 2px border, no shadow)
  glass       glass (12px radius, 1px border, heavy blur shadow)

Examples:
  # Render SVG from file (default theme)
  node scripts/render.js diagram.mmd -o output.svg

  # Render with a specific theme
  node scripts/render.js diagram.mmd -t dracula -o output.svg

  # Custom colors + style preset (same as preview.html)
  node scripts/render.js diagram.mmd --bg '#f7f7fa' --fg '#27272a' --line '#6b7280' -p modern -o output.svg

  # Render to PNG
  node scripts/render.js diagram.mmd -f png -o output.png

  # Custom PNG dimensions
  node scripts/render.js diagram.mmd -f png -w 2400 -o output.png

  # High-res PNG (2× scale)
  node scripts/render.js diagram.mmd -f png -s 2 -o output.png

  # High-DPI PNG (print quality)
  node scripts/render.js diagram.mmd -f png --dpi 300 -o output.png

  # Render to ASCII (terminal-friendly)
  node scripts/render.js diagram.mmd -f ascii

  # ASCII with custom color mode
  node scripts/render.js diagram.mmd -f ascii --color-mode ansi256

  # XY chart with interactive tooltips
  node scripts/render.js chart.mmd --interactive -o chart.svg

  # Pass code directly (use \\n for newlines)
  node scripts/render.js -c "graph TD\\nA[Start] --> B[End]" -f ascii
  node scripts/render.js -c "graph TD\\nA[Start] --> B[End]" -o output.svg -t github-dark

  # Batch render all .mmd files in a directory
  node scripts/render.js --batch ./diagrams -f svg -t dracula

  # Batch render to a specific output directory
  node scripts/render.js --batch ./diagrams -f svg -o ./output
`);
}

async function main() {
  const options = parseArgs();

  // --list-themes: print all theme details
  if (options.listThemes) {
    console.log('\nAvailable themes (--theme):\n');
    const dark  = getDarkThemes();
    const light = getLightThemes();
    console.log('  ● Dark themes:');
    dark.forEach(n => {
      const meta = getThemeMeta(n);
      console.log(`    ${n.padEnd(25)} → recommended preset: ${meta.recommendedPreset}`);
    });
    console.log('\n  ● Light themes:');
    light.forEach(n => {
      const meta = getThemeMeta(n);
      console.log(`    ${n.padEnd(25)} → recommended preset: ${meta.recommendedPreset}`);
    });
    console.log('');
    process.exit(0);
  }

  // Dynamically import beautiful-mermaid (ESM)
  const { renderMermaidSVG, renderMermaidASCII, THEMES } = await import('beautiful-mermaid');

  // Batch mode
  if (options.batch) {
    if (!options.input) {
      console.error('Error: --batch requires a directory path');
      showHelp();
      process.exit(1);
    }
    if (!fs.existsSync(options.input)) {
      console.error(`Error: directory not found: ${options.input}`);
      process.exit(1);
    }
    const stat = fs.statSync(options.input);
    if (!stat.isDirectory()) {
      console.error(`Error: not a directory: ${options.input}`);
      process.exit(1);
    }

    // Collect .mmd files
    const mmdFiles = fs.readdirSync(options.input)
      .filter(f => f.endsWith('.mmd'))
      .sort();

    if (mmdFiles.length === 0) {
      console.error('Error: no .mmd files found in directory');
      process.exit(1);
    }

    // Determine output directory
    const outputDir = options.output || options.input;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const ext = options.format === 'ascii' ? 'txt' : options.format === 'png' ? 'png' : 'svg';
    let success = 0;
    let failed = 0;

    console.log(`Batch render: ${mmdFiles.length} .mmd files → ${outputDir}/ (${options.format})\n`);

    for (const file of mmdFiles) {
      const inputPath = path.join(options.input, file);
      const baseName = file.replace(/\.mmd$/, '');
      const outputPath = path.join(outputDir, `${baseName}.${ext}`);
      try {
        await renderSingleFile(inputPath, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES });
        success++;
      } catch (e) {
        failed++;
        console.error(`  ✗ ${file}: ${e.message}`);
      }
    }

    console.log(`\nDone: ${success} succeeded, ${failed} failed`);
    return;
  }

  // Single file mode
  let code;
  if (options.code) {
    code = options.code;
  } else if (options.input) {
    if (!fs.existsSync(options.input)) {
      console.error(`Error: file not found: ${options.input}`);
      process.exit(1);
    }
    code = fs.readFileSync(options.input, 'utf-8');
  } else {
    console.error('Error: provide an input file or use --code');
    showHelp();
    process.exit(1);
  }

  // Determine default output path
  const ext = options.format === 'ascii' ? 'txt' : options.format === 'png' ? 'png' : 'svg';
  const defaultOutput = options.input
    ? options.input.replace(/\.mmd$/, `.${ext}`)
    : `output.${ext}`;
  const outputPath = options.output || defaultOutput;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    await renderSingleCode(code, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES });
  } catch (error) {
    console.error('Render failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Render a single file
async function renderSingleFile(inputPath, outputPath, options, lib) {
  const code = fs.readFileSync(inputPath, 'utf-8');
  await renderSingleCode(code, outputPath, options, lib);
}

// Core render logic (code string → output)
async function renderSingleCode(code, outputPath, options, { renderMermaidSVG, renderMermaidASCII, THEMES }) {
  // Resolve theme
  // Priority: CLI --bg/--fg > JSON string > LOCAL_THEMES name
  // Parsed then enriched with resolveTheme() to fill all 7 fields
  let rawTheme;
  if (options.bg && options.fg) {
    rawTheme = { bg: options.bg, fg: options.fg, line: options.line };
  } else {
    try {
      rawTheme = JSON.parse(options.theme);
    } catch {
      rawTheme = options.theme; // string name, resolved by resolveTheme
    }
  }
  // resolveTheme: name → full object with all 7 color fields
  const theme = resolveTheme(rawTheme);

  // Validate preset (orthogonal to theme — any theme + any preset)
  if (options.preset && !isValidPreset(options.preset)) {
    throw new Error(`Unknown style preset '${options.preset}'. Available: ${Object.keys(STYLE_PRESETS).join(', ')}`);
  }

  // If no preset specified, use the theme's recommended preset (for named built-in themes)
  const effectivePreset = options.preset ||
    (typeof rawTheme === 'string' ? getRecommendedPreset(rawTheme) : null);

  // Validate colorMode
  const validColorModes = ['none', 'auto', 'ansi16', 'ansi256', 'truecolor', 'html'];
  if (!validColorModes.includes(options.colorMode)) {
    console.warn(`Warning: unknown color mode '${options.colorMode}', using default 'truecolor'`);
    options.colorMode = 'truecolor';
  }

  if (options.format === 'ascii') {
    const output = renderMermaidASCII(code, {
      colorMode: options.colorMode,
    });

    if (outputPath) {
      fs.writeFileSync(outputPath, output);
      console.log(`✓ ASCII written: ${outputPath}`);
    } else {
      console.log(output);
    }
  } else if (options.format === 'png') {
    // theme is a full object (enriched by resolveTheme), pass directly to library
    const renderOptions = { ...theme, interactive: options.interactive };
    let svgOutput = renderMermaidSVG(code, renderOptions);

    if (effectivePreset) {
      svgOutput = injectStylesToSVG(svgOutput, theme, effectivePreset);
    }

    const scale = Math.max(0.5, Math.min(4, options.scale));
    const dpi = Math.max(72, Math.min(600, options.dpi));
    const outputWidth = Math.round(options.width * scale);

    const pngBuffer = await getSharp()(Buffer.from(svgOutput))
      .resize(outputWidth, null, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 100, density: dpi })
      .toBuffer();

    fs.writeFileSync(outputPath, pngBuffer);
    const presetInfo = effectivePreset ? `, preset:${effectivePreset}` : '';
    console.log(`✓ PNG written: ${outputPath} (${outputWidth}px, scale:${scale}, dpi:${dpi}${presetInfo})`);
  } else {
    const renderOptions = { ...theme, interactive: options.interactive };
    let output = renderMermaidSVG(code, renderOptions);

    if (effectivePreset) {
      output = injectStylesToSVG(output, theme, effectivePreset);
    }

    fs.writeFileSync(outputPath, output);
    const presetInfo = effectivePreset ? ` + preset:${effectivePreset}` : '';
    console.log(`✓ SVG written: ${outputPath}${presetInfo}`);
  }
}

main();
