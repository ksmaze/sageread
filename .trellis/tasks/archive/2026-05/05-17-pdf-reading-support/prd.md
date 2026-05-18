# brainstorm: add PDF reading support

## Goal

Evaluate and design PDF reading support in Sageread now that `foliate-js` includes a PDF.js-backed adapter, while preserving current EPUB reader behavior, book notes, annotations, chat/AI workflows, and library metadata flows.

## What I already know

* The user wants to know whether PDF support is relatively easy to add alongside EPUB support.
* The recent `foliate-js` submodule update preserved app-specific annotation/search overlay behavior and kept upstream PDF support.
* Current features that must not regress include book notes, annotation overlays, and AI/chat behavior connected to reader content.
* `foliate-js` already has a PDF adapter using PDF.js, and upstream `view.js` can open PDFs.
* The app already has `PDF` in some TypeScript model types and upload service helpers.
* The user explicitly requested `trellis-brainstorm`, `superpowers:brainstorming`, and `grill-me`, so no implementation will start until the design is confirmed.

## Assumptions (temporary)

* PDF support should be added as a first-class book format in the existing reader/library flow, not as a separate standalone viewer.
* EPUB behavior should remain unchanged.
* The first version may focus on readable PDFs, selected-text AI, and basic note continuity before advanced PDF-specific RAG.

## Open Questions

* None. MVP scope was approved and implemented.

## Requirements (evolving)

* Support opening PDF files through the existing app book flow if feasible.
* Preserve EPUB reader features and app-specific `foliate-js` compatibility patches.
* Preserve book notes and AI/chat workflows at the product level.
* Do not claim full PDF feature parity unless notes and AI/RAG behavior are explicitly tested.
* MVP scope is **Reader + Booknote Parity**:
  * PDF import and open in the existing reader.
  * PDF progress/navigation through the existing reader chrome.
  * PDF highlights, source-bound notes, note markers, and bookmarks where the existing booknote model supports them.
  * Selected-text explain/ask-AI flow for PDF text selections.
  * Explicitly exclude book-wide PDF semantic RAG/indexing from MVP.
* PDF note locations will use the existing `cfi` field with Foliate-generated CFI-like locations. No schema change for a separate PDF locator in MVP.
* Scanned/image-only PDFs should still open for visual reading in the MVP, but text-dependent features are unavailable when no selectable text layer exists.
* For PDFs without selectable text, the app should not offer highlights, source-bound notes from selection, or selected-text AI. It should present a clear unsupported-text/OCR-not-included message when the user attempts a text-dependent action.
* PDF book-wide AI/chat actions that depend on EPUB semantic indexing are disabled for MVP. PDF AI support is limited to selected-text explain/ask flows.
* PDF navigation should use embedded PDF outline/bookmarks when available. If a PDF has no outline, the MVP should not synthesize a page-list TOC; users navigate through the reader's page/progress controls instead.
* PDF library metadata should be best-effort: use embedded PDF metadata when available, use the filename as the title fallback, and use a generic PDF cover/icon fallback rather than generating thumbnails or forcing metadata edits during import.

## Acceptance Criteria (evolving)

* [ ] A feasibility assessment identifies what works from `foliate-js` PDF support and what the app still needs.
* [ ] MVP PDF feature scope is explicit, including which note/AI behaviors are required.
* [ ] Any implementation plan includes regression checks for EPUB notes, annotations, and AI workflows.
* [ ] Any PDF MVP includes a decision about whether book-wide semantic AI/RAG is included or explicitly out of scope.
* [ ] PDF notes/highlights survive close and reopen for at least text-based PDFs.
* [ ] PDF notes/highlights survive zoom and page navigation for at least text-based PDFs.
* [ ] Selected text from a PDF can be sent to the existing explain/ask-AI flow.
* [ ] Book-wide AI/RAG entry points are unavailable or clearly disabled for PDFs in the MVP.
* [ ] PDFs with embedded outlines show navigable TOC entries.
* [ ] PDFs without embedded outlines do not show a fake page-list TOC.
* [ ] PDF imports create usable library entries even when embedded metadata is missing.
* [ ] PDFs without cover art use a generic PDF cover/icon fallback.
* [ ] Scanned/image-only PDFs can open for visual reading without crashing the reader.
* [ ] Text-dependent PDF actions fail gracefully when a PDF has no selectable text layer.
* [ ] EPUB import, reading, notes, and selected-text AI still work after PDF changes.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* App build/typecheck passes.
* Foliate package build/checks pass if the submodule is touched.
* Docs/spec notes updated if app-facing behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Implementing PDF editing, form filling, signing, or OCR unless explicitly brought into scope.
* Replacing the EPUB reader stack.
* Full book-wide semantic search/RAG over PDF content in the first MVP.
* OCR or text-layer reconstruction for scanned/image-only PDFs in the first MVP.
* Annotation support for scanned/image-only PDFs that lack selectable text.

## Technical Notes

* Task created on 2026-05-17.
* Feasibility notes: `research/pdf-feasibility.md`.
* User chose approach 2: Reader + Booknote Parity.
* User chose location approach A: keep the existing `cfi` field and rely on Foliate CFI-like locations for PDF notes in MVP.
* User chose scanned-PDF approach A: open scanned/image-only PDFs visually, with text-dependent features disabled and no OCR in MVP.
* User chose AI scope approach A: disable book-wide PDF AI/RAG for MVP and keep PDF AI selected-text-only.
* User chose TOC approach B: do not generate fallback page-list TOCs for PDFs without outlines.
* User chose metadata approach A: use filename/title fallback, best-effort embedded metadata, and a generic PDF cover/icon fallback.
* Relevant files inspected:
  * `packages/foliate-js/view.js`
  * `packages/foliate-js/pdf.js`
  * `packages/app/src/lib/document.ts`
  * `packages/app/src/services/constants.ts`
  * `packages/app/src/services/book-service.ts`
  * `packages/app/src/store/reader-store.ts`
  * `packages/app/src/pages/reader/store/create-reader-store.ts`
  * `packages/app/src/store/chat-reader-store.ts`
  * `packages/app/src/utils/toc.ts`
  * `packages/app/src/pages/reader/hooks/use-annotator.ts`
  * `packages/app/src/ai/tools/rag-search.ts`

## Decision (ADR-lite)

**Context**: Existing notes, annotations, navigation, search-result scrolling, and note lists all key off a `cfi` string. Introducing a new PDF locator schema would touch storage, UI, navigation, and note filtering.

**Decision**: For the MVP, keep using the existing `cfi` field for PDF notes/highlights/bookmarks and rely on `foliate-js` CFI-like locations for PDF pages/text ranges.

**Consequences**: This keeps the first PDF implementation smaller and avoids note schema migration. The risk is location stability on PDF.js text layers, so implementation must explicitly test close/reopen, zoom, page navigation, and annotation redraw for text-based PDFs.
