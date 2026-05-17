# brainstorm: data import export sync

## Goal

Add a simplified data sync experience through explicit data export and import, likely from Settings, so users can back up and restore all SageRead data across devices without requiring a live sync service.

## What I already know

* The user wants both export and import.
* The data should include all app data: books, notes, AI-related data, and any other persistent user data.
* The preferred export package is a single `.zip`.
* Import must consider both merge and overwrite behavior.
* The current UI idea is to add one import button and one export button in Settings.
* Android filesystem access may need `tauri-plugin-android-fs`: https://github.com/aiueo13/tauri-plugin-android-fs
* The app is Android mobile/tablet first and shares Settings through `packages/app/src/components/settings/*`.
* Main durable database data is in SQLite at `appDataDir/database/app.db`.
* Book files and book-local artifacts live under `appDataDir/books/<bookId>/`.
* AI/chat/user skill data is partly in SQLite (`threads`, `skills`) and partly in persisted Zustand config JSON (`model-provider`, app settings, and remote vector model settings).
* RAG/vectorization artifacts can exist per book as `mdbook/` and `vectors.sqlite`.
* The codebase has local Llama.cpp support, but the Android settings surface currently exposes remote vector model configuration rather than local Llama.cpp model/backend management.

## Assumptions (temporary)

* This is a local, manual backup/restore feature, not continuous cloud sync.
* Export should be portable across desktop and Android builds when feasible.
* Import should validate the archive before modifying existing app data.
* The app already has a persistent local data layer that can be enumerated.
* Archive format should be versioned so future migrations can be handled.
* Generated caches and large binaries should be an explicit scope decision, not silently included.

## Open Questions

* None currently blocking.

## Requirements (evolving)

* Provide Settings entry points for data export and data import.
* Export user data into one `.zip` archive.
* Import from a previously exported archive.
* Include books, notes, AI-related data, and other durable user data in the archive.
* Include AI provider credentials/API keys in the backup archive.
* Include Android remote vector model configuration in the AI configuration backup scope.
* Treat exported backup archives as sensitive files and warn users that they may contain API keys and private reading/chat data.
* Backup archives are plain, unencrypted zip files in the MVP.
* Exclude generated caches and large binaries from the MVP export, including RAG `mdbook/` and `vectors.sqlite` artifacts and any platform-local model/backend binaries.
* Exclude localStorage-backed UI preferences from the MVP export/import, including `themeMode`, `autoScroll`, and `customThemes`.
* If a book database row exists but its backing book file is missing, export skips that book and continues.
* Export result must clearly report skipped books caused by missing backing files.
* When a missing-file book is skipped, export also skips data strongly tied to that book, including `book_status`, `reading_sessions`, `book_notes`, book-scoped `threads`, and `notes` with that `book_id`.
* Standalone notes without `book_id` are still exported when other books are skipped.
* Exported backup files use the generated filename format `sageread-backup-YYYYMMDD-HHMMSS.zip`.
* Define safe behavior for merge and overwrite cases.
* Preserve the Android-first Settings layout and touch target constraints.
* Use a versioned manifest in the backup archive.
* Validate backup structure before applying an import.
* Import must present two modes before applying data: merge and overwrite.
* Merge mode is the default import mode.
* Merge mode keeps existing local data and resolves same-id conflicts by preferring the record with the newer `updated_at` where available.
* Merge mode preserves current device settings/config files and only imports database/book user content.
* In merge mode, backed-up JSON config files without per-record conflict metadata do not replace current files.
* Overwrite mode is a destructive restore path and must be clearly labeled before execution.
* Overwrite mode restores backed-up settings/config files as part of the restore.
* Overwrite mode does not create an automatic pre-import safety backup in the MVP.
* Overwrite mode must still validate the archive before deleting or replacing current user data.
* Import does not show a detailed archive preview summary in the MVP.
* After the user selects a valid archive and import mode, the flow proceeds after the required confirmation.
* Backup manifest metadata is still used internally for validation and compatibility checks.
* Successful import reloads the app UI so SQLite-backed state, app data files, and persisted Zustand state rehydrate consistently.
* Overwrite mode replaces user data and backed-up book directories without attempting to manage platform-local model/backend directories.
* Overwrite mode may remove old per-book generated artifacts indirectly when replacing `books/<bookId>` directories because RAG `mdbook/` and `vectors.sqlite` are stored inside those directories and are excluded from the backup.

## Acceptance Criteria (evolving)

* [ ] A user can trigger export from Settings and receive a `.zip` backup.
* [ ] A user can trigger import from Settings and select a backup archive.
* [ ] The archive format includes enough metadata to validate app/version compatibility.
* [ ] Import behavior presents merge and overwrite choices, with merge selected by default.
* [ ] Merge behavior preserves existing data and handles same-id records deterministically.
* [ ] Merge behavior preserves current device settings/config JSON.
* [ ] Overwrite behavior is clearly confirmed before replacing current user data.
* [ ] Overwrite mode does not promise automatic rollback or pre-import backup.
* [ ] Import does not require a record-count/content preview screen before execution.
* [ ] Invalid or incompatible archives fail without corrupting existing data.
* [ ] After a successful import, the app reloads or otherwise fully rehydrates from the imported persisted data.
* [ ] Export scope is documented and testable, including the explicit exclusion of generated indexes and local model binaries.
* [ ] Export UI communicates that the archive contains sensitive data, including AI provider API keys.
* [ ] Remote vector model configuration is included with AI configuration backup data.
* [ ] Export/import UI does not claim password protection or encryption for MVP backups.
* [ ] Android file picking/saving works without requiring the user to know the app data directory.
* [ ] localStorage-backed UI preferences are not included in the MVP backup archive.
* [ ] Export can complete when a book file is missing, and reports the skipped book to the user.
* [ ] Data tied to skipped books is not exported as broken references.
* [ ] Export suggests or uses a timestamped filename in the format `sageread-backup-YYYYMMDD-HHMMSS.zip`.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Technical Approach

Use a Rust-side backup service under `packages/app/src-tauri/src/core/backup/` with frontend Settings controls calling thin TypeScript service wrappers. The backend owns archive creation, validation, import semantics, and filesystem operations; the UI owns mode selection, sensitive-data warnings, destructive confirmation, progress/result messaging, and app reload after success.

### Archive shape

The zip archive is versioned and should use stable internal paths:

* `manifest.json` — archive schema version, app version, created timestamp, export scope, sensitivity flags, skipped item summary, and table/file counts where useful for validation.
* `database/*.json` or equivalent structured table exports — SQLite user tables filtered to the selected export scope.
* `books/<bookId>/book.<format>`, `books/<bookId>/cover.jpg`, `books/<bookId>/metadata.json`, and `books/<bookId>/view-settings.json` when present.
* `config/app-settings.json`, `config/model-provider.json`, `config/layout-store.json`, and remote vector model settings when present. Current code persists the remote vector model settings in the `llama-store` storage key; this is implementation naming, not a requirement to back up local Llama.cpp binaries on Android.

The archive must exclude generated per-book `mdbook/`, `vectors.sqlite`, platform-local model/backend binaries, and localStorage-only preferences.

### Import semantics

* Validate archive structure and manifest before changing current data.
* Merge mode imports database/book user content only and preserves current config JSON.
* Merge mode uses primary keys and `updated_at` where available to deterministically upsert records.
* Overwrite mode replaces backed-up user data and backed-up book directories, restores backed-up config JSON, does not manage platform-local model/backend directories, and reloads the app after success.
* Import does not show a detailed preview summary in the MVP.

### UI integration

Add a data section in Settings, likely in General settings unless a new "数据" navigation entry is cleaner during implementation. It contains an export button, import button, sensitive-data copy, merge/overwrite choice for import, and destructive confirmation for overwrite. Layout must preserve the existing Android Settings constraints.

### Files likely impacted

* `packages/app/src-tauri/Cargo.toml`
* `packages/app/src-tauri/src/lib.rs`
* `packages/app/src-tauri/src/core/mod.rs`
* `packages/app/src-tauri/src/core/backup/**`
* `packages/app/src-tauri/capabilities/*.json`
* `packages/app/src/components/settings/**`
* `packages/app/src/services/**` or a new `backup-service.ts`
* `packages/app/src/types/**`

## Out of Scope (explicit)

* Continuous background sync.
* Cloud account sync.
* Multi-device conflict resolution beyond the selected import behavior.
* Visual redesign of Settings beyond the import/export controls.
* Exporting generated RAG caches or platform-local model/backend binaries in the MVP.
* Automatic pre-import safety backup for overwrite mode in the MVP.
* Password-protected or encrypted backup archives in the MVP.
* Exporting localStorage-only UI preferences in the MVP.

## Technical Notes

* Task directory: `.trellis/tasks/05-16-data-import-export-sync`
* Inspected `packages/app/src-tauri/src/core/schema.sql`, `database.rs`, `lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/*.json`, Settings components, Zustand stores, book/note/thread services, and EPUB/vector model paths.
* Current installed Tauri plugins: dialog, fs, http, sql, opener, os, log, local `llamacpp`, local `epub`.
* `mobile.json` currently has no permissions; Android import/export may require capability additions.
* `@zip.js/zip.js` exists in frontend dependencies, but large full-library backups likely fit better in Rust to avoid JS memory pressure.
* Full-app data flow spans UI, TS service, Rust command, SQLite, app data filesystem, app config filesystem, and Android external storage.
* User chose MVP export scope: user data only, excluding generated caches and platform-local model/backend binaries.
* User chose MVP import conflict strategy: explicit merge/overwrite choice, defaulting to merge.
* User chose no automatic pre-import safety backup for overwrite mode.
* User chose to include AI provider API keys in the backup archive.
* User chose no password/encryption support for MVP backup archives.
* User chose no import preview summary for the MVP.
* User chose to reload the app UI after successful import.
* User chose overwrite handling for excluded files: replace user data/book directories without managing platform-local model/backend directories.
* User chose merge-mode config handling: preserve current device settings/config JSON; overwrite-mode restores backed-up settings/config.
* User chose to exclude localStorage-backed UI preferences from the MVP backup.
* User chose missing book file export handling: skip the affected book and continue export, with a clear skipped-item report.
* User chose skipped-book dependency handling: skip strong book-linked data and keep standalone notes.
* User chose backup filename format: `sageread-backup-YYYYMMDD-HHMMSS.zip`.
* Clarification: local Llama.cpp model/backend data is not part of the Android MVP backup scope. The existing `llama-store` name only matters if implementation needs to include remote vector model settings persisted under that storage key.
* User confirmed Android remote vector model configuration should be included in backup/import scope.

## Decision (ADR-lite)

**Context**: Import can either preserve existing data or restore a backup as the source of truth. Users need both workflows, but accidental data loss must be minimized.

**Decision**: The MVP import flow presents merge and overwrite modes, with merge selected by default. Merge preserves current data and resolves same-id conflicts using newer `updated_at` records when available. Overwrite is treated as a destructive restore action, requires clear confirmation, and does not create an automatic pre-import safety backup.

**Consequences**: The implementation needs deterministic import semantics and tests for both modes. Merge avoids most accidental data loss, while overwrite still supports true backup restoration. Without automatic backup, validation must happen before destructive work and the UI must not imply rollback is available.

## Implementation Plan (small PRs)

* PR1: Add backend backup module scaffolding, archive manifest types, export scope filtering, and tests for missing-book skip behavior.
* PR2: Implement import validation plus merge/overwrite database and file semantics with focused Rust tests.
* PR3: Wire Settings UI, TypeScript services, Android/desktop file save/open handling, user warnings/confirmations, and app reload.
* PR4: Run full verification, update relevant Trellis specs if new backup/storage conventions are established, and clean up docs.

## Research References

* [`research/android-export-import-storage.md`](research/android-export-import-storage.md) — recommends a Rust backup service with Android-specific file access adapter.

## Research Notes

### Feasible approaches here

**Approach A: Rust backup service + Android FS bridge** (Recommended)

* How it works: Rust commands create/import a versioned zip from app-scoped data; Android-specific file helpers handle user-visible save/open.
* Pros: Better for large books, SQLite, generated artifacts, and validation.
* Cons: Requires Rust archive dependency, new commands, permissions, and tests.

**Approach B: Frontend zip using existing `@zip.js/zip.js`**

* How it works: TypeScript reads app files and creates/imports zip archives.
* Pros: Fast prototype and uses an existing dependency.
* Cons: Risky for large libraries, harder to safely snapshot SQLite, and more URI/file handling leaks into UI.

**Approach C: Raw app data folder copy**

* How it works: Copy app data directories instead of creating a structured zip.
* Pros: Simple for developer diagnostics.
* Cons: Weak user experience, weak validation, and less aligned with Android file picker limitations.
