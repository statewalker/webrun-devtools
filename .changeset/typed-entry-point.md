---
"@statewalker/webrun-devtools": patch
---

Ship type declarations for the main entry point (`types`: `dist/types/api-client/index.d.ts`), generated from the JavaScript sources, and type the re-exported `newRegistry` locally, since `@statewalker/utils` (bundled, not a dependency) has no types.
