# Foliate Search Normalization Research

> Background findings for a potential future `foliate-js`-level fix. The current task is implementing an app-level resolver improvement, not modifying the submodule.

## Summary

The AI note source resolver normalizes model-provided source candidates with `normalizeSearchText()` before passing them to `FoliateView.search()`. Foliate then searches the EPUB section DOM through `textWalker()` and `searchMatcher()`. This works when whitespace is present in the DOM text stream, including newlines, but fails when EPUB markup removes the boundary whitespace or when hyphenation splits words across line breaks.

## Code References

- `packages/app/src/ai/note-source-resolver.ts`
  - `normalizeSearchText()` collapses all whitespace to a single space.
  - `buildSourceSearchQueries()` builds exact substring queries from normalized candidate text.
  - `resolveNoteSourceFromView()` searches the current section with `scope: "section"` and `index: runtime.sectionIndex`.
- `packages/app/src/types/book.ts`
  - `BookSearchConfig` supports `scope`, `matchCase`, `matchWholeWords`, `matchDiacritics`, optional `index`, optional `query`, and optional `acceptNode`.
  - There is no configured search `mode` or fuzzy/normalized-search mode today.
- `packages/foliate-js/view.js`
  - `View.search(opts)` imports `searchMatcher()`, uses `opts.index` to choose section search vs whole-book search, and yields section-grouped results.
  - `#searchSection()` and `#searchBook()` convert DOM `Range` results to CFI through `getCFI(index, range)`.
- `packages/foliate-js/search.js`
  - `searchMatcher()` walks DOM text nodes and delegates matching to `search(strs, query, options)`.
  - `segmenterSearch()` normalizes whitespace segments, so a query with a single space can match DOM text containing a newline.
  - `simpleSearch()` joins raw text node strings without whitespace normalization and is less robust when `Intl.Segmenter` is unavailable.
  - `makeExcerpt()` has a bug for matches spanning more than two text nodes: it uses `strs.slice(start + 1, end)` instead of `strs.slice(startIndex + 1, endIndex)`, dropping middle nodes from `excerpt.match`.
- `packages/foliate-js/text-walker.js`
  - Text nodes are traversed as separate strings and joined only by the search implementation.

## Evidence

Inline probe against `packages/foliate-js/search.js`:

- Query `"The first important idea continues"` matches `["The first important idea\n", "continues"]`.
- The same query does not match `["The first important idea", "continues"]` because no whitespace exists across the markup boundary.
- Query `"The first important hyphenated idea"` does not match `["The first important hy-\n", "phenated idea"]`.
- Query `"alpha beta gamma"` matches `["alpha ", "beta ", "gamma"]`, but `excerpt.match` returns `"alpha gamma"`, dropping `"beta "`.

## Implementation Constraints

- Preserve `FoliateView.search()` return shape for existing reader search UI and annotation search.
- Do not add app-specific imports to `packages/foliate-js`.
- Keep search results backed by DOM `Range` so CFI generation and overlay highlighting continue to work.
- Prefer a narrow normalized matching mode or helper in `foliate-js/search.js` over a broad rewrite of reader/search UI.
- Add focused tests around pure search behavior before changing the matcher.
