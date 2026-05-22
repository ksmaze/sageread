## Bug Analysis: AI Note Source Resolution Never Searches

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, E - Implicit Assumption, D - Test Coverage Gap
- **Specific Cause**: Foliate emits `section: { current, total }` in relocate progress, but the app typed `BookProgress.section` as `number` and passed the raw object as `activeSectionIndex` / resolver `sectionIndex`. `resolveNoteSourceFromView()` requires `typeof sectionIndex === "number"`, so the real runtime path can return fallback/unavailable before calling `view.search()`.

### 2. Why Fixes Failed

1. **Previous result-shape fix**: It fixed direct `{ cfi, excerpt }` section search consumption, but only tested `resolveNoteSourceFromView()` with a manually supplied numeric `sectionIndex`. It did not test the `ReaderProgress -> createReaderNoteSourceResolver -> resolveNoteSourceFromView` boundary.
2. **Query-variant fix**: It made search attempts more robust after search starts, but could not help when search never starts because `sectionIndex` is not numeric.
3. **Fallback-centered mental model**: Chapter-start fallback made failures look graceful, hiding whether the resolver had searched anything.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Type Safety | Correct `BookProgress.section` to accept Foliate's `{ current, total }` shape and expose an explicit section-index helper. | DONE |
| P0 | Test Coverage | Add a boundary test for `createReaderNoteSourceResolver()` using real Foliate progress shape. | DONE |
| P0 | Architecture | Add a background section-document loose matcher after exact Foliate search misses, deriving CFI from DOM `Range` without visible search annotations. | DONE |
| P0 | Tool Availability | Decouple EPUB RAG tool attachment from vector model capability; keep `ragSearch` available and degrade to BM25 when vector config is missing. | DONE |
| P1 | Diagnostics | Include strategy attempts, raw/derived section index, and miss reasons in `resolveNoteSource` output/meta. | TODO |
| P1 | Documentation | Update app and cross-layer specs with the Foliate progress/search contracts. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Reader search and annotation search use `pageinfo.current` as a Foliate section index, but `pageinfo` is derived from Foliate `location`, not section. These consumers need the same section-index helper.
- **Design Improvement**: Make section index an explicit app boundary value. Do not let generic progress objects flow into APIs that require `book.sections[index]`.
- **Tooling Improvement**: Tool availability must follow the weakest backend mode that can satisfy the prompt. If a tool can execute BM25-only, absence of a vector config is an execution-mode decision, not a reason to remove the tool from `streamText`.
- **Process Improvement**: Cross-layer tests must start at the boundary where runtime data enters the app, not only at the pure helper below it.

### 5. Knowledge Capture

- [x] Created research notes under `.trellis/tasks/05-21-redesign-ai-note-source-matching/research/`.
- [x] Updated `.trellis/spec/app/frontend/state-management.md`.
- [x] Updated `.trellis/spec/foliate-js/frontend/state-management.md`.
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
- [x] No `src/templates/markdown/spec/` tree exists in this repository, so no template sync was possible.
