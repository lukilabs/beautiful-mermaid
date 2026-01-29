import { defineConfig } from 'tsup'

export default defineConfig([
  // Main library builds (ESM + CJS)
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: true,
  },
  // Browser bundle (IIFE for <script> tag usage)
  {
    entry: { 'beautiful-mermaid.browser': 'src/browser.ts' },
    format: ['iife'],
    globalName: 'beautifulMermaid',
    platform: 'browser',
    sourcemap: true,
    minify: true,
    splitting: false,
    treeshake: true,
    noExternal: [/.*/], // Bundle all dependencies
  },
])
