# Foliate Search CFI Research

## Question

Can AI-generated learning notes confirm an exact reader CFI by searching source text through Foliate?

## Findings

### Current Foliate Search Contract

The reader `FoliateView` type exposes:

* `search(config: BookSearchConfig): AsyncGenerator<BookSearchResult | string, void, void>`
* `getCFI(index, range): string`
* `resolveCFI(cfi)`
* `goTo(cfi)`

Foliate's implementation builds search results from real DOM `Range`s and returns CFI values:

* section search yields `{ cfi, excerpt }`
* book search yields `{ label, subitems: [{ cfi, excerpt }] }`

Search results are already used by the reader search UI and markdown annotation popover.

### Existing App Usage

Reader search:

* `packages/app/src/pages/reader/components/search-bar.tsx`
* calls `view.search(...)`
* collects `BookSearchResult[]`
* search result clicks call `view.goTo(cfi)`

Markdown annotation lookup:

* `packages/app/src/components/markdown/hooks/use-annotation-search.ts`
* fetches a RAG chunk by `chunk_id`
* extracts a candidate search sentence with `getBestSearchSentence`
* calls `view.search(...)`
* takes the first returned CFI and navigates to it

This proves the app already has a workable "source text -> Foliate search -> CFI" path.

### Implication for AI Notes

The AI should not pass `chunk_id` as position. Instead, it should pass one or more source text candidates selected from chat/RAG evidence.

The note creation flow can then resolve CFI in the frontend:

1. AI generates `title`, `content`, and `sourceCandidates`.
2. Each source candidate should be a short verbatim quote from the book, not a paraphrase.
3. A source-resolution tool searches Foliate for the candidate text.
4. The tool returns candidate CFI/excerpt matches to the AI.
5. The AI confirms the best match, usually the first plausible chapter-scoped match.
6. The AI calls note creation with the confirmed CFI and source text.
7. If no reliable source match is found, fall back to the current chapter start CFI.

### Scope and Limitations

This requires an active reader `view`; it works naturally in the reader side chat but not in a standalone/background chat with no mounted Foliate view.

Search can fail or be ambiguous when:

* the AI gives a paraphrase instead of verbatim text
* the same sentence appears multiple times
* mdBook/RAG text differs from the rendered EPUB DOM
* punctuation, whitespace, footnote, ruby, OCR, or formatting transformations differ
* the candidate comes from an image/table rather than searchable text

The resolver should be pragmatic but not blind: because matching is scoped to the current chapter, multiple results are less likely. When there are candidates, return excerpts to the AI and let it confirm the best one. When no candidate can be found, attach the note to the current chapter start rather than leaving it unpositioned.

Line breaks and whitespace are a bigger risk than excessive matches. Foliate's search implementation normalizes whitespace in the segmenter path, but source candidates should still be normalized before search, and the resolver should try shorter fallback spans when exact candidate text fails.

### Recommended MVP Contract

Add `sourceCandidates` to the AI note creation input:

* `text`: short verbatim source quote, ideally 20-120 characters
* `reason`: why this source anchors the note
* optional `sectionLabel`: current/expected section

The frontend resolver should:

* try current section first when possible, using the actual Foliate section index from reader progress
* fall back to book-wide search only if section search fails
* prefer unique matches
* return candidate excerpts to the AI when multiple matches are found, so the AI can confirm the best match
* normalize whitespace and try shorter source spans to tolerate line breaks and formatting differences
* store `sourceText` and `cfi` from confirmed Foliate results when available
* if no source match is available, resolve current chapter start in this order: TOC item `cfi` from `progress.sectionHref`, Foliate section-start CFI from the actual section index, then no CFI as last resort
* do not fabricate `sourceText` for chapter-start fallback; use synthesized `content` and optional chapter label metadata/text only

Do not expose raw `chunk_id` as note position. A RAG chunk can still help the AI choose a quote, but Foliate search is the confirmation step that turns quote text into CFI.
