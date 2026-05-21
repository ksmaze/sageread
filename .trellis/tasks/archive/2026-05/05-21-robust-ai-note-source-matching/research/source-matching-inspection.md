# AI Note Source Matching Inspection

## Current Flow

- `packages/app/src/ai/tools/resolve-note-source.ts` exposes `resolveNoteSource`.
- The tool accepts 1-5 `sourceCandidates`, but the resolver does not return one result per candidate.
- `packages/app/src/ai/note-source-resolver.ts` converts candidates into a flat ordered query list with `buildSourceSearchQueries`.
- `resolveNoteSourceFromView` searches the current section with each query and returns immediately on the first query that has any matches.
- If no query matches, it returns `chapter-start` when a fallback CFI is available.
- Foliate `View.search({ index })` yields direct section results shaped as `{ cfi, excerpt }`, while book-wide search yields grouped `{ label, subitems }` results.
- Current app resolver collection only reads grouped `subitems`, so real current-section matches can be missed or crash the collector.

## Why Five Candidates Can Produce One Fallback

Five input candidates only mean "up to five search hints." If all generated exact-search queries miss the current Foliate section, the current output is:

```ts
{ status: "chapter-start", matches: [], fallback }
```

The output does not report per-candidate failures today.

## Foliate Search Behavior

- `packages/foliate-js/view.js` implements `View.search(opts)`.
- `View.search` calls `searchMatcher(textWalker, { defaultLocale: this.language, ...opts })`.
- `packages/foliate-js/search.js` builds matches over text walker strings and returns `Range` values that `View` converts to CFI.
- App search passes `BookSearchConfig` with `scope`, `index`, `matchCase`, `matchWholeWords`, `matchDiacritics`, and optional `acceptNode`.
- Existing reader search uses `createRejecttFilter` to skip Japanese `rt` annotation nodes; AI source matching currently does not pass that filter.

## Robustness Risks

- Query generation is prefix-heavy. If the copied/RAG text mismatch is near the beginning, later exact text in the same candidate may never be searched.
- Section-scoped Foliate search returns direct match objects; consumers must handle both direct section matches and grouped book matches.
- Foliate search is still exact over the search string after its internal normalization. Candidate text with EPUB/RAG whitespace differences, CJK line-break spaces, soft hyphens, or markup boundaries can miss.
- Returning on the first query with matches can hide better matches from later source candidates.
- The current tests cover query building and chapter-start fallback, but not multi-candidate aggregation, first-hit early return, or whitespace-insensitive section matching.

## Recommended Direction

Use a layered resolver:

1. Generate more balanced search variants per source candidate: normalized, whitespace-compacted, and start/middle/end windows.
2. Search across candidates and collect unique matches up to `maxMatches` instead of stopping at the first query.
3. If Foliate exact search still misses, run a browser-only normalized section matcher over the current section document, map the normalized hit back to a `Range`, and derive CFI with `view.getCFI(sectionIndex, range)`.
4. Keep chapter-start fallback only after both exact and normalized section matching fail.
