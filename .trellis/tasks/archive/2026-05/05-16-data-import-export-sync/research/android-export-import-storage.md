# Android Export/Import Storage Research

## Sources

* Tauri dialog plugin docs: https://v2.tauri.app/plugin/dialog/
* Tauri filesystem plugin docs: https://v2.tauri.app/plugin/file-system/
* `tauri-plugin-android-fs` README on docs.rs: https://docs.rs/crate/tauri-plugin-android-fs/latest/source/README.md
* Android fs plugin upstream repo: https://github.com/aiueo13/tauri-plugin-android-fs

## Relevant Third-Party Findings

* Tauri already has `tauri-plugin-dialog` and `tauri-plugin-fs` installed in this app. The official dialog plugin covers native open/save flows, while the fs plugin covers scoped reads and writes through configured capabilities.
* Tauri's official Android dialog behavior returns content URIs for file choices and does not support directory selection on Android. That matters for importing/exporting user-chosen backup files outside app-scoped storage.
* `tauri-plugin-android-fs` is specifically targeted at Android filesystem access and exposes save/open style flows plus persistent URI permission helpers. It is a plausible Android-only complement rather than a replacement for Tauri's official desktop-capable dialog/fs plugins.

## Repo Constraints

* Current target is Android mobile/tablet first. Settings UI lives in `packages/app/src/components/settings/*` and is shared by the Android shell.
* Persistent app data is split across:
  * SQLite main DB: `appDataDir/database/app.db`
  * Book directories: `appDataDir/books/<bookId>/`
  * Book files and metadata: `book.<format>`, `cover.jpg`, `metadata.json`
  * Per-book reader settings: `appDataDir/books/<bookId>/view-settings.json`
  * RAG/index artifacts: `appDataDir/books/<bookId>/mdbook/` and `vectors.sqlite`
  * Platform-local model/backend files may exist in non-Android flows, but Android currently uses the remote vector model settings surface rather than local Llama.cpp model/backend management.
  * Zustand JSON settings in `appConfigDir`: `app-settings.json`, `model-provider.json`, `layout-store.json`, and remote vector model settings currently persisted under the `llama-store` key.
  * Browser `localStorage` values currently used by `theme-store`: `themeMode`, `autoScroll`, `customThemes`
* The current Tauri mobile capability file has no permissions, while `default.json` has desktop/default fs, dialog, sql, and plugin permissions.
* The app already depends on `@zip.js/zip.js` in the frontend, but the most reliable full-app backup path likely needs Rust-side filesystem access so large book files can be streamed from app data without loading everything into JS memory.
* Local Llama.cpp artifacts are not part of the Android MVP scope. The `llama-store` name should be treated as current implementation naming for vector settings, not as a product requirement to back up local Llama.cpp binaries.

## Feasible Approaches

### Approach A: Rust Backup Service + Android FS Bridge (Recommended)

Add Rust commands for `export_backup` and `import_backup`. The backend enumerates app data, writes/reads a zip package through a temporary app-scoped file, and then uses Android-specific file save/open helpers only for moving the final archive to/from user-selected storage.

Pros:
* Centralizes validation, archive schema, SQLite handling, and filesystem operations in one trusted layer.
* Avoids sending large books and vector DBs through frontend memory.
* Can support desktop and Android with platform-specific picker/output adapters.

Cons:
* Requires adding Rust zip/archive dependencies and Android plugin wiring.
* Needs careful command API design and tests for destructive import paths.

### Approach B: Frontend Zip With Existing `@zip.js/zip.js`

Build/export the archive in TypeScript using existing zip.js, then save/open with dialog/fs or Android fs helpers.

Pros:
* Uses an already installed package.
* Faster to prototype for small archives.

Cons:
* Risky for large book libraries and local model/vector artifacts.
* Harder to capture SQLite safely while the backend is active.
* More cross-layer data copying and more Android URI edge cases in UI code.

### Approach C: Raw App Data Folder Copy

Export a directory tree rather than a versioned backup zip.

Pros:
* Lowest archive schema work.
* Useful for developer diagnostics.

Cons:
* Poor user experience compared with one zip file.
* Android directory picking is weaker in official Tauri dialog APIs.
* Harder to validate, preview, and import safely.

## Recommendation

Use Approach A for MVP: a versioned zip format produced and consumed by Rust commands, with a thin Settings UI and Android-specific external file adapter when needed. Exclude generated caches such as `mdbook/` and `vectors.sqlite`, and do not include platform-local model/backend binaries in the Android MVP.
