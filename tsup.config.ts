import { defineConfig } from 'tsup'

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    outDir: 'dist',
    external: ['elkjs', 'entities'],
  },
  // CLI build
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    target: 'es2022',
    outDir: 'dist',
    external: ['elkjs', 'entities'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
