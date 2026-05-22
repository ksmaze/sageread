# Redesign AI Note Source Matching

## Goal

Make `resolveNoteSource` resilient when Foliate exact search cannot locate model-provided source text because EPUB DOM text differs from RAG/quoted text at whitespace, markup, ruby, or hyphenation boundaries. The resolver should keep returning real CFIs when it can derive a DOM `Range`, and only use chapter-start fallback after bounded source matching is exhausted.

## Requirements

- Derive the current Foliate section index from `progress.section.current`; do not pass the raw section-progress object or `pageinfo.current` to section-scoped search.
- Preserve the existing AI learning-note contract: source CFIs must come from Foliate search, a DOM range converted through `getCFI`, reader selection, or chapter-start fallback.
- Keep current exact Foliate search as the first pass so overlays and existing search behavior remain unchanged.
- Add an app-side normalized current-section fallback that walks section text, compares compacted/lowercased text, tolerates whitespace drift, markup-adjacent missing spaces, CJK spaces, soft hyphens, and simple line-break hyphenation.
- Convert normalized fallback hits back to a DOM `Range` and derive a CFI with `view.getCFI(sectionIndex, range)`.
- Use the same search node filtering shape for exact and normalized passes, including Japanese ruby `rt` rejection where the reader search UI already applies it.
- Continue collecting unique CFIs up to `maxMatches`; do not stop at the first query/candidate unless the requested match limit is reached.
- Keep output shape compatible with `ResolvedNoteSource`: `matched`, `chapter-start`, and `unavailable` statuses must not change.
- Keep RAG tools available for EPUB/legacy active-book chats even when no vector model is configured; `ragSearch` should fall back to BM25 instead of being omitted from the AI SDK tool set.

## Acceptance Criteria

- [x] Unit tests cover normalized text matching across missing whitespace at chunk/markup boundaries.
- [x] Unit tests cover hyphenated line-break matching.
- [x] Resolver tests cover fallback to normalized section matching after exact Foliate search returns no matches.
- [x] Runtime tests cover deriving `section.current` from real Foliate-style progress before source search.
- [x] Existing resolver tests for direct section results, grouped results, compacted CJK variants, and chapter-start fallback still pass.
- [x] Chat context tests cover EPUB/legacy RAG tool attachment without vector gating and explicit unsupported format exclusion.
- [x] RAG search mode tests cover BM25 fallback when vector config is unavailable.
- [x] `pnpm --filter app exec tsx --test src/ai/reader-note-source-runtime.test.ts src/ai/note-source-resolver.test.ts src/ai/learning-note-contract.test.ts src/ai/model-message-conversion.test.ts` passes.
- [x] `pnpm --filter app build` passes.

## Technical Approach

Use a layered resolver:

1. Derive the current section index through `getProgressSectionIndex(progress)`.
2. Build bounded balanced source queries as today.
3. Search the current section with `view.search()`.
4. If more matches are needed, load the current section document, collect accepted text nodes, build a normalized comparable index with source-node/offset mappings, locate query variants in that normalized index, create DOM ranges from those mappings, and convert them to CFIs through `view.getCFI`.
5. Return chapter-start fallback only if both passes produce no matches.

## Decision

**Context**: Foliate search returns precise DOM ranges, but its matcher remains exact over the DOM text stream after limited normalization. EPUB markup can remove expected spaces or add ruby annotation text, causing source resolution to report no match even when the passage is visibly present.

**Decision**: Fix the app-side Foliate progress contract first, then keep Foliate search first and add a narrow app-side normalized section matcher as a fallback. Do not modify the `foliate-js` submodule in this task.

**Consequences**: The app can recover CFIs for common source drift without changing public Foliate search semantics. The fallback is intentionally bounded to current-section text and existing query limits.

## Out of Scope

- Full fuzzy semantic matching.
- Book-wide normalized fallback.
- Changing `ResolvedNoteSource` tool schema.
- Modifying `packages/foliate-js` search internals.
- Passing selected-text CFI through chat references.

## Technical Notes

- Primary files:
  - `packages/app/src/ai/note-source-resolver.ts`
  - `packages/app/src/ai/note-source-resolver.test.ts`
  - `packages/app/src/ai/reader-note-source-runtime.ts`
  - `packages/app/src/components/side-chat/index.tsx`
  - `packages/app/src/mobile/ai/mobile-ai-chat.tsx`
- Relevant specs:
  - `.trellis/spec/app/frontend/state-management.md`
  - `.trellis/spec/app/frontend/type-safety.md`
  - `.trellis/spec/app/frontend/quality-guidelines.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
