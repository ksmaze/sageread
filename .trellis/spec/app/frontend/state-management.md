# State Management

> How state is managed in `packages/app`.

---

## Overview

The app uses Zustand for client state, TanStack React Query for async/server-like data, URL search params for shareable route filters, and local component state for transient UI. Tauri-backed persisted state uses `tauriStorage` through Zustand persistence where applicable.

## State Categories

### Global App State

Use `src/store/*-store.ts` for state that crosses pages, shell components, or reader tabs.

- `layout-store.ts`: compatibility bridge for reused reader/library components that still call `openBook`, plus per-book reader store creation and chat/notepad visibility used by shared reader components.
- `app-settings-store.ts`: persisted system settings and global reader settings.
- `theme-store.ts`: theme mode, dark mode, system UI flags, and chat auto-scroll.
- `library-store.ts`: library data, search query, refresh functions.
- `mobile/shell/mobile-shell-store.ts`: Android presentation state for active destination, active book, reader open state, reader chrome, and active reader sheet.

### Feature Local State

Use component state for transient UI that does not need persistence or cross-component access:

- open/closed dialogs
- selected editor item
- hover/drag overlays
- temporary form fields
- active tab inside notepad

### URL State

Use URL search params when the state should survive navigation or be externally addressable:

```ts
const selectedTagFromUrl = searchParams.get("tag") || "all";
navigate(tagId === "all" ? "/" : `/?tag=${tagId}`);
```

### Server / Async State

Use React Query or service-backed stores for data loaded from Tauri/backend services. Keep backend calls inside `services/` modules.

## When to Use Global State

Promote state to a store only when one of these is true:

- the app shell and child pages both need it
- reader tabs must preserve it across visibility switches
- settings must persist across app restarts
- multiple features need one source of truth
- async data refresh should update multiple consumers

Do not promote purely local dialog or input state.

## Android Reader Shell Contract

The current Android shell uses `useMobileShellStore` for presentation state and supports one active reader book at a time.

- `activeDestination`: `"library" | "notes" | "ai" | "stats"`.
- `activeBook`: `{ id: string; title: string } | null`.
- `isReaderOpen`: whether the reader overlay is mounted.
- `isReaderChromeVisible`: whether the dock/chrome is visible.
- `activeReaderSheet`: `"toc" | "search" | "notes" | "ai" | "style" | null`.

Opening a book from Android library code should route through `useMobileShellStore.openBook`. If reusing legacy library components that call `useLayoutStore.openBook`, adapt that call at the mobile destination boundary instead of rewriting book cards.

```ts
useLayoutStore.setState({
  openBook: (bookId: string, title: string) => {
    openMobileBook({ id: bookId, title });
  },
});
```

`MobileReader` creates the existing per-book reader store with `createReaderStore(activeBook.id)` and provides it through `ReaderProvider`.

## Legacy Layout Store Compatibility Contract

The desktop tab/sidebar shell was removed, but `useLayoutStore` remains because reused library, reader, and annotation components still call the older `openBook` and tab-shaped reader APIs. Opening a book creates or activates a tab-shaped record and creates a per-book reader store keyed by `reader-${bookId}`. Android destinations adapt this call to `useMobileShellStore.openBook` at the mobile boundary.

```ts
openBook: (bookId: string, title: string) => {
  const tabId = `reader-${bookId}`;
  const existingTab = tabs.find((t) => t.id === tabId);
  if (existingTab) {
    activateTab(tabId);
    return;
  }

  if (!readerStores.has(tabId)) {
    readerStores.set(tabId, createReaderStore(bookId));
  }
}
```

Persist only serializable layout state. Recreate `readerStores` in the persisted store `merge` function.

## Reader Navigation Target Contract

### 1. Scope / Trigger

Use this contract when UI outside the mounted reader needs to open a book and then navigate to a precise foliate location, such as unified notes opening a source annotation.

### 2. Signatures

```ts
interface ReaderNavigationTarget {
  cfi: string;
  requestedAt: number;
  source?: "unified-notes";
}

useMobileShellStore.openBook(book: ActiveBookRef, navigationTarget?: ReaderNavigationTarget): void;
useLayoutStore.openBook(bookId: string, title: string, navigationTarget?: ReaderNavigationTarget): void;

readerStore.getState().requestNavigation(target: ReaderNavigationTarget): void;
readerStore.getState().clearNavigationTarget(target: ReaderNavigationTarget): void;
createReaderStore(bookId: string, initialNavigationTarget?: ReaderNavigationTarget): ReaderStore;
```

### 3. Contracts

- The navigation target carries only reader-local data. Mobile shell may attach `bookId` internally while handing the target to `MobileReader`.
- Callers pass `undefined` when they only need to open the book at the existing saved location.
- If a pending navigation target exists while mounting a reader, initialize foliate with the pending target CFI before the saved book location. The saved location is only the initial target when there is no pending note/navigation request.
- `ReaderViewer` must wait for the foliate view to be ready before calling `view.goTo(target.cfi)`.
- Clearing a completed target must only clear the same `{ cfi, requestedAt }` target so a newer request cannot be accidentally removed by an older effect.
- Treat `view.goTo(cfi)` resolving to `undefined`/`null` as a navigation failure. Foliate can catch renderer errors internally, so "the promise resolved" is not enough proof that navigation succeeded.
- Restoring an initial saved location must not be allowed to abort reader initialization. If initial restore fails, log it and fall back to the book start so the reader remains mounted.
- Reader jumps from notes, annotations, unified notes, layout/mobile shell stores, reader stores, `ReaderViewer`, and foliate initialization must log with the `[SageRead:ReaderNav]` prefix. Include the full CFI, CFI length, source, `requestedAt`, book id/title where available, and whether foliate returned a resolved destination.
- Reader navigation logs must serialize details into one logcat-readable string. Do not pass detail objects as separate `console.*` arguments because Android/Tauri logcat can collapse them to `[object Object]`, hiding the CFI and boundary metadata needed for debugging.
- Direct `view.goTo(cfi)` calls from mounted reader surfaces must use the shared reader navigation tracing helper instead of ignoring the returned value. A missing view, missing CFI, thrown error, or unresolved result must be visible in logcat.
- When note-to-original navigation is reported as intermittent or cannot be reproduced locally, add or preserve boundary logs before attempting another behavioral fix. The first debugging artifact should show whether the request reached the UI click handler, shell/layout store, reader store, `ReaderViewer`, and foliate manager.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Note has no `bookId` | Do not show an open-reader action. |
| Note has `bookId` but no `cfi` | Open the book without a navigation target. |
| Reader view is not ready | Keep the target pending in the reader store. |
| A newer target arrives before an older target clears | Keep the newer target. |
| `view.goTo(cfi)` throws | Log the failure and leave the reader mounted. |
| `view.goTo(cfi)` resolves without a destination | Log the failure, leave the target pending, and leave the reader mounted. |
| Saved reader location is stale or invalid | Fall back to book start; do not blank or close the reader. |
| User reports a note jump freeze but local reproduction is unclear | Preserve `[SageRead:ReaderNav]` logs across every navigation boundary before changing behavior again. |

### 5. Good/Base/Bad Cases

- Good: Unified notes opens a book with `{ cfi, requestedAt, source: "unified-notes" }`; the reader mounts, becomes ready, and then consumes the target.
- Base: Library opens a book without a target and resumes the saved location.
- Bad: Calling `view.goTo` directly from a notes page before the reader exists, or clearing `pendingNavigationTarget` without checking which request completed.

### 6. Tests Required

- `reader-navigation-consume.test.ts` must cover stale-target clearing, await-before-clear, unresolved navigation, and pending-target initial-location precedence.
- Reader navigation debug helpers must keep stable target/result summaries so logcat output stays searchable and comparable across layers.
- Reader navigation debug helper tests must assert the emitted console call is a single string containing serialized JSON details.
- Unified note model tests must cover whether a display item can produce a reader target.
- Run `pnpm --filter app build` after signature changes to stores or reader hooks.

### 7. Wrong vs Correct

#### Wrong

```ts
openBook({ id, title });
view.goTo(cfi); // view may not exist yet
```

#### Correct

```ts
openBook({ id, title }, { cfi, requestedAt: Date.now(), source: "unified-notes" });
// ReaderViewer consumes the target after foliate initialization.
```

## Source-Bound Independent Notes Contract

### 1. Scope / Trigger

Use this contract when reader-selected text creates or displays an independent `Note`. These notes are not `BookNote` annotations: highlights, bookmarks, and excerpts stay in `book_notes`, while user-editable reader notes stay in `notes`.

### 2. Signatures

```sql
notes(
  id TEXT PRIMARY KEY,
  book_id TEXT,
  book_meta TEXT,
  title TEXT,
  content TEXT,
  cfi TEXT,
  source_text TEXT,
  context_before TEXT,
  context_after TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
CREATE INDEX IF NOT EXISTS idx_notes_book_id_cfi ON notes(book_id, cfi);
```

```ts
interface Note {
  bookId?: string;
  bookMeta?: { title: string; author: string };
  title?: string;
  content?: string;
  cfi?: string;
  sourceText?: string;
  contextBefore?: string;
  contextAfter?: string;
}

getNotes({ bookId, cfi, limit: 1 }): Promise<Note[]>;
getNoteByBookLocation(bookId: string, cfi: string): Promise<Note | null>;
getNoteById(id: string): Promise<Note | null>;
handleUpdateNote({ id, content }): Promise<Note>;
toNoteServiceErrorMessage(error: unknown): string;
```

```rust
#[tauri::command]
pub async fn update_note(app_handle: AppHandle, data: UpdateNoteData) -> Result<Note, String>;

pub struct UpdateNoteData {
    pub id: String,
    pub book_id: Option<Option<String>>,
    pub book_meta: Option<Option<BookMeta>>,
    pub title: Option<Option<String>>,
    pub content: Option<Option<String>>,
    pub cfi: Option<Option<String>>,
    pub source_text: Option<Option<String>>,
    pub context_before: Option<Option<String>>,
    pub context_after: Option<Option<String>>,
}
```

### 3. Contracts

- Creating a note from selected reader text stores `bookId`, `bookMeta`, exact `cfi`, `sourceText`, and nearby context. `content` starts empty so note creation does not force immediate editing.
- Duplicate creation checks `{ bookId, cfi }` first. If an existing note is found, reuse/open it instead of creating another row.
- Display helpers must treat source-bound empty notes as meaningful: show the source excerpt in reader notes and unified notes even when `content` is empty.
- Editing writes only the user's `content` unless the caller explicitly updates source fields. Do not expose manual title editing for source-bound notes.
- Reader marker clicks emit `note:<id>` and must open the independent note editor from the latest note state. If the note is not present in the current source-bound reader list, fetch it by id instead of silently ignoring the marker.
- Saving from the reader note editor must merge the backend-returned `Note` into the current active note state when ids match; do not keep a stale pre-save `activeNote` object.
- "Open original" actions from note dialogs must close the dialog first and defer reader navigation to the next turn. Do not synchronously call `view.goTo()` while a Radix dialog is still open; PDF/fixed-layout navigation can replace iframes while dialog focus cleanup is still running.
- Mutations through `useNotepad` must invalidate `["notes"]`, per-note detail, and `["mobile-unified-notes"]` so reader sheets and management screens stay in sync.
- `UpdateNoteData` uses `Option<Option<T>>` partial-update semantics: outer `None` means leave the field unchanged, `Some(None)` means clear it to SQL `NULL`, and `Some(Some(value))` means write a new value.
- Dynamic note updates must append assignment fragments and bind placeholders as one logical `SET` item. When using `sqlx::QueryBuilder::separated(", ")`, call `push_bind_unseparated()` after `push("field = ")`; otherwise sqlx can insert a comma before the bind and produce invalid SQL such as `content = , ?`.
- `update_note` must execute the dynamic `UPDATE`, treat `rows_affected() == 0` as `笔记不存在`, then return the fresh `Note` from `get_note_by_id` so the reader editor and note lists can replace stale state with backend truth.
- Frontend note services must preserve Tauri string errors. Use `toNoteServiceErrorMessage(error)` before wrapping service errors, and let hooks/toasts show `error.message` when available instead of collapsing backend strings to `未知错误`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `bookId` is provided without `bookMeta` | Reject the create/update request. |
| `title`, `content`, and `sourceText` are all blank on create | Reject the create request. |
| `{ id, content }` is the only update payload | Build valid `UPDATE notes SET content = ?, updated_at = ? WHERE id = ?`, execute it, and return the updated row. |
| No updatable fields are present in `UpdateNoteData` | Reject with `没有需要更新的字段`. |
| Dynamic update affects zero rows | Reject with `笔记不存在`. |
| Backend/Tauri rejects with a string error | Surface the actual string inside the frontend `Error.message`; do not replace it with `未知错误`. |
| Selected range cannot produce a CFI | Show an error and do not create a note. |
| `{ bookId, cfi }` already has a note | Open/reuse the existing note instead of inserting. |
| Marker emits `note:<id>` before the notes page is loaded | Fetch by id and open the editor if the note exists. |
| Note editor save returns an updated `Note` | Replace matching active reader note state with the returned note. |
| Source-bound note has empty `content` | Display the source excerpt, not an empty-state label. |
| Note is deleted | Remove/invalidate list state without touching `book_notes` highlights. |

### 5. Good/Base/Bad Cases

- Good: Select text, tap the note action, create an empty `Note` with source fields, close the selection popup, and later edit it from the note marker or notes list.
- Good: Tap a note marker, resolve `note:<id>` to a `Note`, save `{ id, content }`, and use the returned `Note` for active reader state.
- Good: Save `{ id, content: "aaa" }`, run the dynamic SQL update without separator corruption, and show the returned content immediately in the reader note editor.
- Base: A loose standalone note with no `bookId` continues to display title/content and has no reader target.
- Bad: Storing user note text inside `BookNote.note`, creating a highlight to represent a note, or using title/content-only rows for reader-created notes.
- Bad: Looking only in a possibly unloaded `sourceBoundNotes` array and doing nothing when the marker id is absent.
- Bad: Converting a Tauri string error into `未知错误`; that hides the SQL/backend cause needed for debugging.

### 6. Tests Required

- Unified note model tests must assert that source-bound notes use `sourceText` for title/body and include a reader target with `cfi`.
- Note display helper tests must assert empty source-bound notes display the source excerpt.
- Reader note state tests must assert save-returned notes replace matching active state and marker ids can fall back to `getNoteById`.
- Rust note command tests must cover content-only dynamic update SQL and execute it against an in-memory SQLite row.
- Note service tests must cover string Tauri errors and JavaScript `Error.message` preservation.
- Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` after schema/model/command changes.
- Run `pnpm --filter app build` after TypeScript contracts, reader hooks, or mobile notes screens change.

### 7. Wrong vs Correct

#### Wrong

```ts
await createNote({ bookId, bookMeta, title: selectedText, content: selectedText });
setActiveNote(newNote); // forces editing immediately and loses source/context fields
```

#### Correct

```ts
const existing = await getNoteByBookLocation(bookId, cfi);
if (existing) return setActiveNote(existing);

await createNote({
  bookId,
  bookMeta,
  title: sourceText,
  content: "",
  cfi,
  sourceText,
  contextBefore,
  contextAfter,
});
```

#### Wrong

```rust
separated.push("content = ").push_bind(content_opt.clone());
```

#### Correct

```rust
separated
    .push("content = ")
    .push_bind_unseparated(content_opt.clone());
```

## AI Learning Note Source Resolution Contract

### 1. Scope / Trigger

Use this contract when AI chat creates book-bound learning notes from chat/current-chapter context. This is a cross-layer contract because the AI tool writes existing `notes` rows and must resolve reader positions through Foliate before saving.

### 2. Signatures

```ts
interface ChatContext {
  activeBookId?: string;
  activeBookFormat?: BookFormat;
  activeBookMeta?: { title: string; author: string };
  activeContext?: string;
  activeSectionLabel?: string;
  activeSectionHref?: string;
  activeSectionIndex?: number;
  activeChapterStartCfi?: string;
}

interface ResolveNoteSourceInput {
  reasoning: string;
  sourceCandidates: Array<{ text: string; reason?: string }>;
  maxMatches?: number;
}

type ResolvedNoteSource =
  | { status: "matched"; matches: ResolvedNoteSourceMatch[]; fallback?: ChapterStartLocation }
  | { status: "chapter-start"; matches: []; fallback: ChapterStartLocation }
  | { status: "unavailable"; matches: []; error?: string };

interface CreateNoteToolInput {
  reasoning: string;
  title: string;
  content: string;
  bookId?: string;
  cfi?: string;
  sourceText?: string;
  contextBefore?: string;
  contextAfter?: string;
}
```

### 3. Contracts

- AI note positioning must never treat RAG `chunk_id` as a reader location. A saved CFI must come from Foliate search, the current TOC/section start, or an existing reader selection.
- `resolveNoteSource` searches the current Foliate section first using the actual relocate `progress.section` value exposed as `ChatContext.activeSectionIndex`.
- AI provides short verbatim `sourceCandidates`; the resolver normalizes whitespace and tries shorter spans to tolerate EPUB line breaks/markup.
- If a match is found, `createNote` must save `matches[0].cfi`, `sourceText`, `contextBefore`, and `contextAfter`.
- If matching fails, fallback to current chapter start in this order: TOC item `cfi` by `progress.sectionHref`, then `view.getCFI(progress.section, null)`, then no CFI.
- Chapter-start fallback must not invent `sourceText`; save synthesized note content plus the fallback CFI only.
- Book-bound AI note creation must supply `bookMeta` from `ChatContext.activeBookMeta` or a local `getBookWithStatusById(activeBookId)` lookup.
- Default DB-backed skills are additive. Startup may insert missing default skills by name, but must not overwrite user-edited existing skills.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| No active book id | Do not attach/use `createNote` for book-bound learning notes. |
| No reader view or no section index | Return `chapter-start` if fallback CFI is available; otherwise `unavailable`. |
| Source candidate has newlines or repeated whitespace | Normalize whitespace and try shorter fallback queries. |
| Foliate search returns multiple section-scoped matches | Return candidate CFI/excerpts so the AI can choose, usually the first plausible match. |
| Foliate search returns no match | Save at chapter-start fallback if available. |
| `sourceText` is present without `cfi` | Reject the tool call; source text cannot be saved without a real location. |
| Default skill already exists in DB | Leave the row unchanged; do not overwrite user edits. |

### 5. Good/Base/Bad Cases

- Good: Quick action asks for "生成学习笔记"; AI gets the skill, uses RAG/chat evidence, calls `resolveNoteSource`, then calls `createNote` with confirmed CFI fields.
- Base: Matching fails because of EPUB formatting; the note saves with current chapter-start CFI and no `sourceText`.
- Bad: Passing `[118]` or any `chunk_id` into note `cfi`, or saving a paraphrased summary sentence as `sourceText`.

### 6. Tests Required

- Resolver tests must assert whitespace normalization, shorter fallback queries, nested TOC CFI lookup, and section-start fallback.
- Chat context tests must cover new active section/book metadata fields if their behavior changes.
- Run `pnpm --filter app build` after AI tool, chat context, reader progress, or note tool signature changes.
- Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` after default skill initialization changes.

### 7. Wrong vs Correct

#### Wrong

```ts
await createNote({
  bookId,
  bookMeta,
  content,
  cfi: String(chunkId),
  sourceText: generatedSummary,
});
```

#### Correct

```ts
const resolution = await resolveNoteSource({
  reasoning: "确认学习笔记原文位置",
  sourceCandidates: [{ text: verbatimSourceText }],
});

await createNote({
  bookId,
  bookMeta,
  content: synthesizedNote,
  cfi: resolution.status === "matched" ? resolution.matches[0]?.cfi : resolution.fallback?.cfi,
  sourceText: resolution.status === "matched" ? resolution.matches[0]?.sourceText : undefined,
});
```

## Settings Contract

`useAppSettingsStore.settings` contains `globalReadSettings` and `globalViewSettings`. When reader settings change, update both persisted settings and the live foliate renderer when available.

```ts
setSettings({
  ...currentSettings,
  globalViewSettings: updatedSettings,
});
currentView?.renderer.setStyles?.(getStyles(updatedSettings));
```

`useThemeStore` owns the document `.dark` class and localStorage-backed theme preferences. Do not create component-local dark mode state.

## Server State

- Library refresh flows through `useLibraryStore.refreshBooks`.
- Book upload calls `uploadBook(file)` from `services/book-service` and refreshes the library after successful imports.
- Tags and book operations use feature hooks under `pages/library/hooks/`.
- Notes and annotations use dedicated hooks under `components/notepad/hooks/`.

## Reader Book Format Contract

### 1. Scope / Trigger

Use this contract when adding or changing reader-supported book formats, upload accept lists, reader file reconstruction, TOC handling, or AI behavior that depends on the active book format.

### 2. Signatures

```ts
getBookFormat(fileName: string): BookFormat | null;
getFileMimeType(fileName: string): string;
getBookMimeType(format: BookFormat): string;
getBookFileName(filePath: string | null | undefined, format: BookFormat): string;
isSemanticIndexingSupported(format: BookFormat | null | undefined): boolean;

interface ChatContext {
  activeBookId?: string;
  activeBookFormat?: BookFormat;
  activeBookMeta?: { title: string; author: string };
  activeContext?: string;
  activeSectionLabel?: string;
  activeSectionHref?: string;
  activeSectionIndex?: number;
  activeChapterStartCfi?: string;
}
```

### 3. Contracts

- Upload entry points must validate against `SUPPORTED_FILE_EXTS` / `FILE_ACCEPT_FORMATS`.
- Reader stores must reconstruct `File` objects with `getBookFileName(filePath, format)` and `getBookMimeType(format)`; do not hard-code EPUB names or MIME types.
- `DocumentLoader.open()` is the single frontend loader boundary for EPUB/PDF/MOBI/CBZ/FB2/FBZ. PDF files route through `foliate-js/pdf.js`.
- PDF library metadata is best-effort: embedded metadata when available, filename/title fallback, and no first-page thumbnail generation in the MVP.
- PDF rendering uses `foliate-fxl` through the pre-paginated renderer path. The app relies on fixed-layout exposing paginator-equivalent `create-overlayer`, `getContents()` with `{ doc, index, overlayer }`, and adjacent-section methods so highlights, note markers, TOC state, and reader controls remain format-agnostic.
- EPUB remains the only semantic indexing/RAG format. PDF AI is selected-text-only until a PDF indexing pipeline exists.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Unknown upload extension | Return `null` from `getBookFormat`, reject upload, and do not default to EPUB. |
| Stored book format is `PDF` | Reconstruct reader `File` as `application/pdf` with a `.pdf` fallback name. |
| PDF has embedded outline | Keep the outline as the TOC. |
| PDF has no embedded outline | Do not synthesize a page-list TOC. |
| PDF page creates or reloads an annotation | The underlying fixed-layout renderer must expose a page overlayer through `getContents()` so the saved CFI can draw visibly. |
| PDF/fixed-layout progress reports `range: null` | Treat `progress.location` as a page-level CFI. Replay highlights and reader note markers by resolving the saved CFI and current page CFI to section indexes, not by comparing the saved range CFI to `CFI.collapse(location)`/`collapse(location, true)`. |
| PDF reader previous/next controls are tapped | Use the mounted renderer's adjacent-section/page movement contract; do not assume only `foliate-paginator` supports reader chrome. |
| PDF chat has no selected text reference | Block submission with a selected-text-only message. |
| EPUB chat has vector capability | Keep attaching EPUB RAG tools. |

### 5. Good/Base/Bad Cases

- Good: A PDF import creates a library item, opens through `DocumentLoader`, renders via Foliate/PDF.js, and selected text can be sent to AI without enabling book-wide RAG.
- Good: A saved PDF annotation with a page-internal fake CFI is replayed on reopen because the reader compares the annotation's resolved section index to the current fixed-layout page index.
- Base: An EPUB import continues to use EPUB metadata, cover extraction, EPUB MIME, EPUB TOC, notes, and RAG behavior.
- Bad: Reconstructing every stored book as `new File(..., "book.epub", { type: "application/epub+zip" })`; this breaks PDF opening and hides format-specific failures.
- Bad: Letting PDF use `plugin:epub|search_db`, `parse_toc`, or other EPUB RAG tools.
- Bad: Reusing the EPUB visible-range filter for PDF annotation replay. A PDF page location such as `epubcfi(/6/2)` collapses to the same start and end, so a page-internal annotation CFI like `epubcfi(/6/2!...range...)` will never compare inside that range.

### 6. Tests Required

- Format helper tests must assert PDF/EPUB detection, MIME mapping, fallback filenames, and unsupported extension behavior.
- TOC tests must cover async PDF outline destination resolution and must not add fake page-list items.
- Fixed-layout renderer tests must assert PDF-style frame overlays and adjacent-section navigation.
- Reader annotation visibility tests must assert that page-level fixed-layout progress matches saved page-internal PDF annotation CFIs.
- Chat context tests must assert PDF selected-text-only behavior and EPUB-only RAG attachment.
- Run `pnpm --filter app build` after reader store, upload, chat context, or `DocumentLoader` changes.

### 7. Wrong vs Correct

#### Wrong

```ts
const file = new File([arrayBuffer], "book.epub", {
  type: "application/epub+zip",
});
```

#### Correct

```ts
const filename = getBookFileName(simpleBook.filePath, simpleBook.format);
const file = new File([arrayBuffer], filename, {
  type: getBookMimeType(simpleBook.format),
});
```

## Common Mistakes

- Storing `Map`, class instances, or reader stores directly in persisted JSON without reconstructing them on merge.
- Using local component state for active book tabs instead of `useLayoutStore`.
- Duplicating selected tag state outside the URL.
- Updating theme classes manually instead of using `useThemeStore.setThemeMode`.
- Updating persisted reader settings without applying them to the current renderer.
