# Source Resolution Redesign Research

## Current Contract

- `packages/app/src/ai/note-source-resolver.ts` builds bounded query variants and calls `view.search({ scope: "section", index })`.
- The resolver already accepts both Foliate stream shapes: direct section matches `{ cfi, excerpt }` and grouped book results `{ label, subitems }`.
- It already aggregates unique CFIs across candidates until `maxMatches`.
- `ResolvedNoteSource` is consumed by `resolveNoteSource` and `createNote` tool descriptions, so its status/output shape should stay stable.

## Remaining Failure Mode

Foliate exact search can still miss visible source text when the DOM text stream differs from RAG/quoted text:

- EPUB markup can split adjacent text without a whitespace text node, so `"idea continues"` becomes `"ideacontinues"`.
- Japanese ruby annotations can inject `rt` text into the DOM stream unless the app passes an `acceptNode` filter like the normal reader search UI does.
- Soft hyphens and line-break hyphenation can make `"hyphenated"` appear as `"hy-\nphenated"`.
- CJK snippets sometimes contain spaces from RAG/tokenization while the DOM text does not.

## Implementation Implications

- Keep Foliate search first because it already returns DOM `Range` backed CFIs and search overlays.
- Add a second bounded pass over the current section document only.
- The fallback should normalize both document and query to a comparable string by lowercasing, removing whitespace/format characters, removing soft hyphens, and removing hyphenation at line breaks.
- The fallback must keep mappings back to original text nodes and offsets so it can create a real DOM range and call `view.getCFI(sectionIndex, range)`.
- Use reader-search-compatible node filtering for both exact and fallback passes.
