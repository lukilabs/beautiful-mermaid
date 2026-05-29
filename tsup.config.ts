import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/mcp/cli.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['elkjs', 'entities'],
})
