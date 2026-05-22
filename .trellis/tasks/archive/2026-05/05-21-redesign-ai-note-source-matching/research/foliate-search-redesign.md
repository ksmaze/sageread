# Foliate Search Redesign Research

## Summary

Foliate already has the primitives needed to map matching text to CFI: DOM text walking, search result `Range`s, and `View.getCFI(index, range)`. The current app path uses the public `View.search()` UI API for AI note source positioning, but that API is not a clean background resolver. It mutates visible search state and depends on the caller passing the correct section index.

## Foliate Search Internals

- `packages/foliate-js/view.js:563-567`
  - `#searchSection(matcher, query, index)` loads one section document, runs the matcher, and yields direct `{ cfi, excerpt }` objects.
  - CFI is created from the returned DOM range with `this.getCFI(index, range)`.
- `packages/foliate-js/view.js:568-578`
  - `#searchBook(matcher, query)` walks all sections and yields progress records plus grouped `{ index, subitems }` results.
- `packages/foliate-js/view.js:580-616`
  - `search(opts)` clears previous search, configures drawing, imports `searchMatcher`, chooses section search when `opts.index != null`, adds search annotations, and yields `"done"` at the end.
  - This means it is a visible search/highlight API, not just a pure text lookup API.
- `packages/foliate-js/search.js:103-129`
  - `searchMatcher(textWalker, opts)` turns text matches into DOM `Range`s through `textWalker`, with locale/case/diacritic/whole-word options.
- `packages/foliate-js/search.js:49-101`
  - `segmenterSearch` uses `Intl.Segmenter` and `Intl.Collator`.
  - It collapses whitespace segments inside the DOM text stream, ignores Unicode format characters, and can match across multiple text nodes.
- `packages/foliate-js/search.js:23-47`
  - `simpleSearch` joins raw text node strings and uses exact `indexOf`; it is less tolerant but only used when the options force it or `Intl.Segmenter` is unavailable.
- `packages/foliate-js/text-walker.js:30-42`
  - `textWalker` gathers text/CDATA nodes into `strs` and creates a DOM `Range` from matched start/end string indexes.

## Matching Limits

- Foliate normalizes whitespace segments that exist in the DOM stream, but it does not invent whitespace between adjacent text nodes.
- If EPUB markup splits text as `["foo", "bar"]`, a query `"foo bar"` can miss because the DOM stream is effectively `"foobar"`.
- If source extraction inserts spaces between CJK characters and the DOM has none, exact/collated matching can miss unless the app also tries compacted variants.
- Soft hyphenation, page/line hyphen breaks, ruby text, footnote markers, or hidden/generated nodes can still create mismatches.
- `makeExcerpt()` in `packages/foliate-js/search.js:6-20` appears to use string values instead of indexes when constructing cross-node `excerpt.match`; the DOM `Range` can still be correct, but `sourceText` derived from `excerpt.match` can be incomplete for multi-node matches.

## Design Implications

1. AI note positioning should not use `View.search()` as the primary mechanism because every query clears and redraws reader search annotations.
2. A robust resolver should reuse Foliate's lower-level text-walking idea, but expose a background API shaped for "resolve this text to a CFI" rather than "show search results".
3. The resolver must report which strategy ran:
   - exact Foliate-style section lookup
   - normalized text-map lookup
   - compacted/no-space lookup
   - chapter-start fallback
4. The implementation should keep a range-backed path. String offsets alone are not enough; the final CFI must come from a DOM `Range` in the section document.

## Recommended Resolver Shape

```ts
interface SectionTextMatch {
  cfi: string;
  sourceText: string;
  contextBefore?: string;
  contextAfter?: string;
  strategy: "exact" | "normalized" | "compacted";
}
```

The background resolver can build a normalized text map from current section text nodes, find one or more source candidates against that map, convert normalized offsets back to original text node offsets, then call `view.getCFI(sectionIndex, range)`.
