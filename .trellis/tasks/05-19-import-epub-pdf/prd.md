# brainstorm: import epub and pdf files

## Goal

Add support for importing EPUB and PDF files so users can open local book/document files in SageRead through the existing import/open flow.

## What I already know

* The user wants support to open EPUB and PDF files as imports.
* The feature likely touches import UX, file handling, parsing/extraction, persistence, and reader-opening behavior.
* Current library import already accepts `.epub` and `.pdf` through `SUPPORTED_FILE_EXTS` / `FILE_ACCEPT_FORMATS`.
* `DocumentLoader` already detects EPUB/PDF by file signature and uses `foliate-js` EPUB/PDF readers.
* `uploadBook(file)` already stores imported books through the existing `save_book` command.
* Android manifest currently only declares launcher intent filters, so SageRead is not registered as an OS handler for EPUB/PDF files.

## Assumptions (temporary)

* "Open" means choosing SageRead from the OS/file-manager "open with" flow and importing the selected file into the library.
* EPUB and PDF support should integrate with the current import model rather than create a separate document workflow.
* Text extraction and metadata should follow existing book/content conventions where possible.

## Requirements (evolving)

* Users can import local EPUB files through the existing in-app library import flow.
* Users can import local PDF files through the existing in-app library import flow.
* Users can open an EPUB/PDF file from the OS and have SageRead import it into the library.
* Imported files can be opened/read through the app after import.
* The implementation should use Tauri mobile file associations and `RunEvent::Opened` where possible, then reuse the existing frontend import path.
* OS-open import should import the book into the library and show the existing import success/error feedback; it should not automatically open the reader in this MVP.
* MVP scope is limited to the current requirement: OS file association import for EPUB/PDF.

## Acceptance Criteria (evolving)

* [ ] An EPUB file can be selected from the import/open flow and becomes available in the app.
* [ ] A PDF file can be selected from the import/open flow and becomes available in the app.
* [ ] Opening an EPUB/PDF with SageRead from the OS imports it into the library without automatically opening the reader.
* [ ] Unsupported or invalid files fail with a clear user-facing error.
* [ ] Tests cover the parsing/import path and failure behavior appropriate to the implementation.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Bulk import directories unless already supported by the current import flow.
* Cloud sync or external content provider integration.
* Full-featured PDF annotation or EPUB editing.
* Automatically opening the reader after OS-open import.
* Duplicate-specific UX beyond the existing import failure feedback.
* Adding a native Android content URI bridge unless basic Tauri file association import cannot work without it.

## Technical Notes

* `packages/app/src/services/constants.ts` already lists `["epub", "pdf"]`.
* `packages/app/src/lib/document.ts` supports EPUB and PDF loading.
* `packages/app/src/services/book-service.ts` already extracts metadata and persists imported files.
* `packages/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml` currently lacks `ACTION_VIEW`/file association filters.
* `packages/app/src-tauri/src/lib.rs` currently does not handle Tauri `RunEvent::Opened`.

## Technical Approach

Add Tauri file associations, handle `RunEvent::Opened`, emit opened file URLs to the frontend, convert them into `File` objects, and pass them through the existing import handler. The frontend should import only and leave reader opening to the user.

## Research References

* [`research/mobile-file-open-import.md`](research/mobile-file-open-import.md) — Tauri v2 supports mobile file associations via config plus `RunEvent::Opened`; repo should reuse existing import flow.

## Research Notes

### Feasible approaches here

**Approach A: Tauri file associations + frontend event import** (Recommended)

* How it works: add EPUB/PDF file associations, emit opened file URLs from Rust, convert them to frontend `File` objects, then reuse `useBookUpload`.
* Pros: aligns with Tauri's documented mobile flow and keeps import persistence centralized.
* Cons: Android `content://` URI reading may need validation or a fallback bridge.

**Approach B: Native Android copy bridge**

* How it works: add Android intent filters and copy incoming content URIs to a temp file via Kotlin/Rust before importing.
* Pros: strongest control over Android content URI permissions.
* Cons: more platform-specific code and more duplication around file handling.

**Approach C: In-app picker only**

* How it works: treat existing `.epub`/`.pdf` picker import as complete and only polish tests/copy.
* Pros: smallest change.
* Cons: does not make OS "open with SageRead" work.

## Decision (ADR-lite)

**Context**: The app already supports `.epub` and `.pdf` through the in-app import picker and reader, but is not registered as an OS handler for opening those file types.

**Decision**: Use Approach A: add Tauri mobile file associations for EPUB/PDF, handle opened file URLs via `RunEvent::Opened`, emit them to the frontend, convert them into `File` objects, and reuse the existing import pipeline.

**Consequences**: This keeps import behavior centralized and aligned with Tauri's documented mobile flow. Android `content://` handling remains the main risk; if frontend URL-to-File conversion cannot access provider content reliably, the implementation should add the smallest native bridge needed to copy/read the incoming file.
