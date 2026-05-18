# PDF Support Feasibility Notes

## Summary

Adding basic PDF reading is probably moderate, not large, because `foliate-js` now has `pdf.js` and upstream `view.js` already calls `makePDF()` when it receives a PDF file. The app still has several EPUB assumptions in its own ingestion and reader code. Full EPUB-level parity for notes and AI is larger because some features rely on EPUB CFI, EPUB TOC assumptions, and the `plugin:epub` indexing/RAG backend.

## What Already Exists

* `packages/foliate-js/view.js` detects `%PDF-` and imports `./pdf.js`.
* `packages/foliate-js/pdf.js` builds a fixed-layout book with one section per PDF page, a PDF.js text layer, optional outline TOC, `resolveHref()`, `splitTOCHref()`, and `getCover()`.
* `packages/app/src/types/book.ts` and `packages/app/src/types/simple-book.ts` already include `PDF` in `BookFormat`.
* `packages/app/src/services/book-service.ts` recognizes PDF in `getBookFormat()` and `getFileMimeType()`, and `uploadBook()` allows `PDF` if a PDF reaches it.
* `packages/app/src/vite-env.d.ts` already declares `foliate-js/pdf.js`.

## Current App Blockers

* Upload gates are EPUB-only:
  * `packages/app/src/services/constants.ts` sets `SUPPORTED_FILE_EXTS = ["epub"]`.
  * `packages/app/src/pages/library/components/upload.tsx` hard-codes `accept=".epub"` and visible text says only `.epub`.
* Reader stores construct every loaded file as `application/epub+zip`:
  * `packages/app/src/store/reader-store.ts`
  * `packages/app/src/pages/reader/store/create-reader-store.ts`
  * `packages/app/src/store/chat-reader-store.ts`
* `packages/app/src/lib/document.ts` has an `isPDF()` helper but `DocumentLoader.open()` never branches to `makePDF()`.
* `packages/app/src/utils/toc.ts` assumes `bookDoc.splitTOCHref()` is synchronous and that sections have `cfi`. PDF `splitTOCHref()` is async, and PDF sections rely on fake CFI fallback in `foliate-js/view.js`.
* PDF metadata and cover extraction during upload are fallback-only today; `extractMetadataOnly()` only parses EPUB, and cover extraction only runs for EPUB.

## Notes / Annotation Risk

* Selection-based inline actions should be feasible because `foliate-js/pdf.js` creates a PDF.js text layer.
* `View.getCFI()` falls back to fake section CFIs when a section has no `cfi`, so PDF annotations may be representable as CFI-like values.
* The app annotation loader filters visible notes by comparing note CFIs against current progress CFI ranges with `epubcfi.compare()`. This may work if fake CFIs round-trip cleanly, but it needs explicit testing on PDF text-layer ranges.
* Position stability is the main risk: PDF.js text layer DOM structure may vary with zoom/render changes. Notes need testing across reopen, zoom, and page navigation.

## AI / RAG Risk

* Inline "explain selected text" and "ask AI about selected text" use the selected text event flow and should work if PDF text selection works.
* Book-wide semantic AI/RAG is EPUB-only today:
  * `packages/app/src/services/book-service.ts` exposes `indexEpub()`.
  * AI tools call `plugin:epub|search_db`, `plugin:epub|get_chunk_with_context`, `plugin:epub|get_toc_chunks`, and `plugin:epub|get_chunks_by_range`.
  * The Rust plugin path is `packages/app/src-tauri/plugins/tauri-plugin-epub`.
* Full PDF AI parity would require either a PDF indexing pipeline or a generalized document indexing pipeline.

## Feasible Approaches

### Approach A: Reader-First PDF MVP

Enable PDF upload/open/render, preserve selected-text AI, and verify basic notes/highlights. Do not claim book-wide RAG parity for PDF yet.

Pros:
* Lowest risk and fastest path to useful PDF reading.
* Reuses `foliate-js` PDF support.
* Keeps EPUB behavior isolated.

Cons:
* Book-wide semantic search/RAG remains EPUB-only.
* PDF annotations may need constraints if CFI stability is imperfect.

### Approach B: PDF Reader + Notes Parity

Enable PDF reading and make notes/highlights/bookmarks a required parity target. Add PDF-specific guards or tests around fake CFI behavior.

Pros:
* Aligns with "preserve booknote" as a real product promise.
* Still avoids backend RAG work.

Cons:
* More testing required across PDF rendering edge cases.
* May require small `foliate-js` patching if text-layer CFI anchors are unstable.

### Approach C: Full PDF Parity Including RAG

Enable reading, notes, selected-text AI, and add backend PDF text extraction/indexing so the RAG tools work for PDFs.

Pros:
* Closest to EPUB feature parity.
* Best long-term story for AI.

Cons:
* Much larger scope.
* Requires backend/Rust plugin design, chunk location model, and citation/navigation mapping for PDFs.
