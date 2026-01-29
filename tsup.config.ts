import { defineConfig } from 'tsup'

export default defineConfig([
  // Library bundle
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
  // CLI bundle
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    minify: false,
    splitting: false,
    treeshake: true,
    banner: {
      js: '#!/usr/bin/env bun',
    },
  },
])
