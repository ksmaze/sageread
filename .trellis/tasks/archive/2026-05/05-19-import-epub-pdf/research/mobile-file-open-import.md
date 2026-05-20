# Mobile File Open Import Research

## Question

How should SageRead support opening EPUB/PDF files from the OS as an import?

## Sources

* Tauri v2 mobile file associations: https://v2.tauri.app/zh-cn/learn/mobile-file-associations/
* Android intents and intent filters: https://developer.android.com/guide/components/intents-filters

## Findings

* Tauri v2 supports mobile file associations through `bundle.fileAssociations`, including `ext`, `mimeType`, `role`, and Android-specific `assetlinks`.
* Tauri's mobile file-association guide shows `App::default().run(...)` handling `RunEvent::Opened { urls }` and emitting those URLs to the frontend with `app.emit("open-file", urls)`.
* Android opens files through intents resolved by manifest intent filters. For this app, generated Android manifest currently only has launcher filters, so SageRead is not advertised as a handler for EPUB/PDF files.
* The frontend already has an import pipeline that accepts browser `File` objects via `useBookUpload().handleDropedFiles(files)`.
* The current app can already import local `.epub` and `.pdf` through the library picker: `SUPPORTED_FILE_EXTS = ["epub", "pdf"]`, `DocumentLoader` detects EPUB/PDF by file signature, and `foliate-js` has EPUB/PDF readers.

## Repo Constraints

* App is Android-shell first and uses Tauri 2.11.x.
* Existing import behavior is centralized in `uploadBook(file)` and `useBookUpload`, so OS-open imports should reuse that path.
* Imported files are copied into `$APPDATA/books/{id}/book.{format}` by Rust `save_book`.
* PDF semantic indexing is currently out of scope because `isSemanticIndexingSupported(format)` only returns true for EPUB and the Rust indexing pipeline assumes `book.epub`.

## Feasible Approaches

### Approach A: Tauri file associations + frontend event import (recommended)

Add EPUB/PDF file associations to Tauri config, handle `RunEvent::Opened { urls }` in Rust, emit those URLs to the frontend, convert incoming file URLs/content URIs to `File` objects, and reuse `handleDropedFiles`.

Pros:
* Matches Tauri's documented mobile flow.
* Reuses the existing import pipeline.
* Avoids duplicating book persistence logic in native Android code.

Cons:
* Need to validate URL-to-File conversion for Android `content://` URIs in Tauri WebView.
* May need a small native bridge if `content://` cannot be read directly by frontend fetch/fs APIs.

### Approach B: Native Android plugin copies incoming content URI to temp, then JS imports

Add Android intent filters and native Kotlin handling that copies the incoming content URI to a temp file or passes bytes/path to Rust/JS.

Pros:
* Strongest control over Android content URI permissions and streams.
* Good fallback if Tauri's `Opened` URL event is insufficient for content providers.

Cons:
* More platform-specific code and duplicate file-handling concerns.
* Less aligned with Tauri's documented cross-mobile association flow.

### Approach C: Frontend picker only

Treat the current picker/drag import as sufficient, only polish labels/tests.

Pros:
* Smallest change.
* No native/file-association risk.

Cons:
* Does not satisfy "open EPUB/PDF files as import" from file managers or share/open-with flows.
