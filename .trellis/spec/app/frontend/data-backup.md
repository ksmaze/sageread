# Data Backup And Restore

> Cross-layer contract for manual SageRead backup export/import in `packages/app`.

---

## 1. Scope / Trigger

Use this contract when changing Settings backup UI, `services/backup-service.ts`, Tauri backup commands, archive layout, or persisted data scope. This is infra and cross-layer storage work: frontend dialog/fs calls, Rust commands, SQLite rows, app data files, app config files, and selected localStorage keys must stay aligned.

## 2. Signatures

```rust
#[tauri::command]
pub async fn create_backup_archive(
    app_handle: AppHandle,
    local_storage_items: Option<Vec<BackupLocalStorageItem>>,
) -> Result<BackupExportResult, String>;

#[tauri::command]
pub async fn import_backup_archive(
    app_handle: AppHandle,
    archive_path: String,
    mode: ImportMode,
) -> Result<BackupImportResult, String>;

pub enum ImportMode {
    Merge,
    Overwrite,
}
```

```ts
export type BackupImportMode = "merge" | "overwrite";

export async function exportBackup(): Promise<BackupExportResult | null>;
export async function importBackup(mode: BackupImportMode): Promise<BackupImportResult | null>;
```

## 3. Contracts

- Export filename format is `sageread-backup-YYYYMMDD-HHMMSS.zip` using UTC timestamps.
- The archive is plain zip and not encrypted. UI must warn that it includes books, notes, AI config, and API keys.
- Archive entries:
  - `manifest.json`
  - `database.json`
  - `books/<bookId>/**` for real book assets only
  - `config/model-provider.json`
  - `config/app-settings.json`
  - `config/vector-store.json`
  - `config/layout-store.json`
  - `local-storage/tts-config-storage.json`
- Include SQLite tables: `tags`, `skills`, `books`, `book_status`, `reading_sessions`, `notes`, `book_notes`, `threads`.
- Exclude generated RAG artifacts (`mdbook/`, `vectors.sqlite*`) and legacy local embedding model/backend files. Android remote vector model settings may still be included through `vector-store.json`.
- Exclude local-only UI preferences that are not part of Tauri config backup scope, such as `themeMode`, `autoScroll`, and `customThemes`.
- If a book record points to a missing file during export, skip that book and skip strong linked data: `book_status`, `reading_sessions`, `book_notes`, book-scoped `threads`, and book-scoped `notes`. Keep standalone notes and global threads.
- Merge import preserves current device config files and localStorage. It imports database/book user content and uses `updated_at` to keep newer records.
- Overwrite import restores backed-up database rows, book files, Tauri config files, and allowed localStorage keys, then the app reloads.

## 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Backup schema version is unsupported | Reject import with a clear unsupported-version error. |
| Archive path contains absolute paths, drive prefixes, `..`, or NUL | Reject before extraction. |
| Archive contains an unknown database table | Reject import. |
| A database row is not an object or lacks its primary key | Reject import. |
| A backed-up book row has no matching archived `file_path` | Reject import before overwrite deletes current book files. |
| Exported book file is missing on disk | Skip book and linked rows, report `skippedBooks` in the manifest. |
| Merge row has the same primary key as local and imported `updated_at` is older | Keep local row. |
| Merge row conflicts on unique `tags.name` or `skills.name` | Resolve by name and keep the newer `updated_at` row without creating a duplicate unique row. |
| User cancels save/open dialog | Return `null` from the frontend service and do not show success. |
| Import succeeds | Reload the app after the success toast so stores rehydrate from restored files. |

## 5. Good / Base / Bad Cases

- Good: Export creates a zip with `database.json`, allowed config/localStorage entries, and only real `books/<bookId>` files.
- Good: Merge import adds a new book and keeps a newer local edited tag with the same name.
- Good: Overwrite import validates the whole archive before deleting current `books/`.
- Base: No books exist. Export still creates a valid zip with manifest/database/config entries that exist.
- Bad: Exporting `mdbook/`, `vectors.sqlite`, GGUF models, or legacy local embedding backend binaries.
- Bad: Restoring device-local theme/autoscroll preferences from backup.
- Bad: Reading Android shared storage directly in Rust instead of using the frontend dialog/fs handoff unless official plugins prove insufficient on device.

## 6. Tests Required

- Rust unit tests for filename format, missing-book export filtering, merge timestamp behavior, overwrite table replacement, unique-name conflict resolution, archive file inclusion/exclusion, and archive validation for book rows missing files.
- Run `cargo test --manifest-path packages/app/src-tauri/Cargo.toml backup::tests --lib` after changing archive/database logic.
- Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` after Tauri command signatures or Rust dependency changes.
- Run `pnpm --filter app build` after TypeScript service, Settings UI, or command payload changes.
- On Android device or emulator, manually verify save/open dialogs can round-trip a zip through the system file picker before adding fallback filesystem plugins.

## 7. Wrong vs Correct

### Wrong

```rust
// Wrong: destructive overwrite before validating file coverage.
fs::remove_dir_all(app_data_dir.join("books"))?;
let archive = read_backup_zip(path)?;
```

### Correct

```rust
let archive = read_backup_zip(path)?;
validate_backup_archive(&archive)?;
// Only now may overwrite remove existing book files.
```

### Wrong

```ts
// Wrong: treat merge as full sync of device config.
await invoke("import_backup_archive", { archivePath, mode: "merge" });
restoreBackupLocalStorageItems(result.localStorageItems);
```

### Correct

```ts
const result = await invoke<BackupImportResult>("import_backup_archive", { archivePath, mode });
if (mode === "overwrite") {
  restoreBackupLocalStorageItems(result.localStorageItems);
}
```
