# Diagram Type Design Notes

Long-form implementation notes for individual diagram families live in this
directory.

Use this folder for design docs that explain diagram-specific parsing, layout,
rendering, parity decisions, and intentional boundaries. Keep end-user and API
documentation in the root [README](../../README.md), and keep implementation
code and tests in the same places the rest of the project already uses:

- `src/<diagram>/` for parser, layout, renderer, and types
- `src/ascii/<diagram>.ts` for diagram-specific ASCII output
- `src/__tests__/` and `src/__tests__/testdata/` for tests and golden fixtures

This keeps the repository root focused on project-level entry points while
giving future diagram types one predictable home for deeper design notes.
