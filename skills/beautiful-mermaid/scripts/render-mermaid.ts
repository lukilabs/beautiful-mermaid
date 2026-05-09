#!/usr/bin/env bun
import { renderMermaid, renderMermaidAscii, THEMES } from "beautiful-mermaid";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const DEFAULT_FORMAT = "svg" as const;

type Format = "svg" | "ascii";

type Args = {
  format: Format;
  input?: string;
  out?: string;
  theme?: string;
  useAscii: boolean;
  transparent: boolean;
  font?: string;
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  paddingX?: number;
  paddingY?: number;
  boxBorderPadding?: number;
  help: boolean;
};

const usage = () => {
  const themes = Object.keys(THEMES).sort().join(", ");
  return `Usage: bun run scripts/render-mermaid.ts [options]

Core:
  --format svg|ascii       Output format (default: ${DEFAULT_FORMAT})
  --input <file>           Read Mermaid source from file (else stdin)
  --out <file>             Write output to file (else stdout)
  --theme <name>           Built-in theme (${themes})

SVG styling:
  --bg <hex> --fg <hex> --accent <hex> --muted <hex> --surface <hex> --border <hex> --line <hex>
  --font <family>
  --transparent

ASCII styling:
  --use-ascii              Use +---+ style instead of Unicode box drawing
  --padding-x <n> --padding-y <n> --box-border-padding <n>

Other:
  --help
`;
};

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    format: DEFAULT_FORMAT,
    useAscii: false,
    transparent: false,
    help: false,
  };

  const readValue = (index: number, token: string) => {
    const eq = token.indexOf("=");
    if (eq !== -1) {
      return { value: token.slice(eq + 1), nextIndex: index };
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      return { value: next, nextIndex: index + 1 };
    }
    return { value: undefined, nextIndex: index };
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const flag = token.replace(/^--/, "");
    if (flag === "help") {
      args.help = true;
      continue;
    }

    if (flag === "transparent") {
      args.transparent = true;
      continue;
    }

    if (flag === "use-ascii") {
      args.useAscii = true;
      continue;
    }

    if (flag === "ascii") {
      args.format = "ascii";
      continue;
    }

    if (flag === "svg") {
      args.format = "svg";
      continue;
    }

    const { value, nextIndex } = readValue(i, token);
    if (nextIndex !== i) {
      i = nextIndex;
    }

    switch (flag) {
      case "format":
        if (value === "svg" || value === "ascii") {
          args.format = value;
        }
        break;
      case "input":
        args.input = value;
        break;
      case "out":
        args.out = value;
        break;
      case "theme":
        args.theme = value;
        break;
      case "font":
        args.font = value;
        break;
      case "bg":
        args.bg = value;
        break;
      case "fg":
        args.fg = value;
        break;
      case "line":
        args.line = value;
        break;
      case "accent":
        args.accent = value;
        break;
      case "muted":
        args.muted = value;
        break;
      case "surface":
        args.surface = value;
        break;
      case "border":
        args.border = value;
        break;
      case "padding-x":
        args.paddingX = value ? Number(value) : undefined;
        break;
      case "padding-y":
        args.paddingY = value ? Number(value) : undefined;
        break;
      case "box-border-padding":
        args.boxBorderPadding = value ? Number(value) : undefined;
        break;
      default:
        break;
    }
  }

  return args;
};

const readInput = async (inputPath?: string) => {
  if (inputPath) {
    if (!existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    return await Bun.file(inputPath).text();
  }

  if (process.stdin.isTTY) {
    return "";
  }

  return await new Response(process.stdin).text();
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const source = (await readInput(args.input)).trim();
  if (!source) {
    console.error("No Mermaid input provided.\n");
    console.error(usage());
    process.exit(1);
  }

  if (args.theme && !THEMES[args.theme]) {
    console.error(`Unknown theme: ${args.theme}`);
    console.error(`Available themes: ${Object.keys(THEMES).sort().join(", ")}`);
    process.exit(1);
  }

  if (args.format === "ascii") {
    const ascii = renderMermaidAscii(source, {
      useAscii: args.useAscii,
      paddingX: args.paddingX,
      paddingY: args.paddingY,
      boxBorderPadding: args.boxBorderPadding,
    });
    if (args.out) {
      await writeFile(args.out, `${ascii}\n`, "utf8");
    } else {
      process.stdout.write(`${ascii}\n`);
    }
    return;
  }

  const theme = args.theme ? THEMES[args.theme] : {};
  const svg = await renderMermaid(source, {
    ...theme,
    bg: args.bg ?? theme.bg,
    fg: args.fg ?? theme.fg,
    line: args.line ?? theme.line,
    accent: args.accent ?? theme.accent,
    muted: args.muted ?? theme.muted,
    surface: args.surface ?? theme.surface,
    border: args.border ?? theme.border,
    font: args.font,
    transparent: args.transparent,
  });

  if (args.out) {
    await writeFile(args.out, svg, "utf8");
  } else {
    process.stdout.write(svg);
    if (!svg.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
};

await main();
