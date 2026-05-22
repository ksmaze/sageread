# App Resolve Note Source Flow Research

## Summary

The current `resolveNoteSource` can fail before it ever calls Foliate search. The app models `BookProgress.section` as a `number`, but the actual Foliate relocation payload contains `section: { current, total }`. `reader-note-source-runtime.ts` passes that object where `note-source-resolver.ts` requires a number, so the resolver returns fallback/unavailable instead of searching.

## Evidence

- `packages/foliate-js/progress.js:73-98`
  - `SectionProgress.getProgress()` returns `section: { current: index, total: sizes.length }` and `location: { current, next, total }`.
- `packages/foliate-js/view.js:343-351`
  - `View.#onRelocate()` spreads the `SectionProgress` result into `lastLocation` and emits it as the app-facing `relocate` detail.
- `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts:294-304`
  - The manager stores `section: detail.section` and `pageinfo: detail.location`.
  - This preserves the `section` object even though the app type says otherwise.
- `packages/app/src/types/book.ts:175-184`
  - `BookProgress.section` is typed as `number`, which hides the runtime shape mismatch.
- `packages/app/src/ai/reader-note-source-runtime.ts:18-28`
  - Chapter-start fallback calls `getSectionStartCfi` only when `typeof input.progress?.section === "number"`.
  - With the real object shape, this guard is false.
- `packages/app/src/ai/reader-note-source-runtime.ts:36-42`
  - `sectionIndex: input.progress.section` passes the object into the resolver.
- `packages/app/src/ai/note-source-resolver.ts:395-410`
  - The resolver refuses to search when `typeof runtime.sectionIndex !== "number"`.
- `packages/app/src/components/side-chat/index.tsx:101-104` and `packages/app/src/mobile/ai/mobile-ai-chat.tsx:202-205`
  - Chat context exposes `activeSectionIndex: progress?.section`, so the AI/tool metadata receives the wrong shape too.
- `packages/app/src/pages/reader/components/search-bar.tsx:100-105` and `packages/app/src/components/markdown/hooks/use-annotation-search.ts:98-115`
  - Existing section-search consumers use `pageinfo.current` as `index`, but `pageinfo` is Foliate `location`, not section index.

## Root Cause

This is a cross-layer contract bug:

```text
Foliate SectionProgress.section object
  -> app BookProgress.section typed as number
  -> resolver expects number
  -> real runtime object fails typeof check
  -> resolver never searches current section
```

The previous fix focused on query robustness and stream result shapes, but the real runtime section index boundary was not tested.

## Redesign Constraints

- Introduce an explicit app-side section index field or normalize `BookProgress.section` to a typed `{ current, total }` and derive a helper such as `getProgressSectionIndex(progress)`.
- All search consumers that call `view.search({ index })` must pass a real Foliate section index.
- Resolver tests must include a runtime-shaped progress object or a boundary test for `createReaderNoteSourceResolver()`, not only direct `resolveNoteSourceFromView()` unit tests.
- `resolveNoteSource` output should include diagnostic meta for `sectionIndex`, raw section shape, and strategy attempts.

## Recommended Implementation Plan

1. Correct `BookProgress` typing and add a helper:

```ts
interface SectionInfo {
  current: number;
  total: number;
}

function getProgressSectionIndex(progress?: BookProgress | null): number | undefined {
  return typeof progress?.section?.current === "number" ? progress.section.current : undefined;
}
```

2. Update `reader-note-source-runtime`, side chat, mobile chat, reader search, and annotation search to use the helper.
3. Add tests around `createReaderNoteSourceResolver()` with real progress shape.
4. Implement the background section text resolver described in `foliate-search-redesign.md`.
