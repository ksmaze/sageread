## Bug Analysis: AI Note Source Matching Falls Back Too Early

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, E - Implicit Assumption, D - Test Coverage Gap
- **Specific Cause**: The app resolver assumed all Foliate search stream items were grouped `{ subitems }` results, but section-scoped search yields direct `{ cfi, excerpt }` matches. The resolver also treated source candidates as a flat query list and returned after the first matching query, so later candidates were never considered. Query generation was prefix-heavy, which made source matching fragile when EPUB/RAG text had inserted/missing spaces or mismatches near the beginning.

### 2. Why Fixes Failed (if applicable)

1. Previous implementation focused on providing chapter-start fallback, but did not prove that section search matches were actually consumed.
2. Existing tests covered query normalization and TOC fallback, but not Foliate stream shape, cross-candidate aggregation, compacted whitespace, or middle/end windows.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Type Safety | Model `view.search()` as `BookSearchResult | BookSearchMatch | string` and narrow consumers explicitly. | DONE |
| P0 | Test Coverage | Add resolver tests for direct section results, cross-candidate aggregation, compacted query variants, middle-window queries, and chapter-start fallback. | DONE |
| P0 | Architecture | Aggregate unique CFIs across bounded query attempts instead of returning on first hit. | DONE |
| P1 | Documentation | Update the AI note source resolution contract with Foliate stream shapes and robust query expectations. | DONE |
| P1 | Thinking Guide | Add Foliate search stream shape as a cross-layer boundary mistake. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Reader search and annotation search also consume `view.search()`; their types and narrowing were updated so direct section matches and grouped results are both accepted.
- **Design Improvement**: Treat search stream normalization as a boundary helper inside consumers instead of assuming one runtime shape from the TypeScript type.
- **Process Improvement**: When a runtime API changes shape by scope/mode, write one regression test per shape before adding fallback behavior.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/state-management.md`.
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
- [x] Added regression coverage in `packages/app/src/ai/note-source-resolver.test.ts`.
- [x] No `src/templates/markdown/spec/` tree exists in this repository, so there is no template mirror to sync.
