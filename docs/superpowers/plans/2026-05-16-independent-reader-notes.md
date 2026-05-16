# Independent Reader Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build independent, source-bound reader notes that can be created from selected text, shown in reader lists and in-page markers, edited/deleted later, and opened back to the source location without coupling to highlights.

**Architecture:** Extend the existing `Note` record with optional source-location fields and keep `BookNote` reserved for highlights/bookmarks/excerpts. Reuse foliate overlayer rendering for in-page note markers by adding a separate note-marker namespace and draw helper. Keep UI changes inside existing notepad and unified notes surfaces.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tauri commands, Rust/sqlx/SQLite, foliate-js overlays, node:test, Vite build.

---

## File Structure

Backend data and migration:

* Modify `packages/app/src-tauri/src/core/schema.sql` to add nullable source-location columns to new `notes` tables.
* Modify `packages/app/src-tauri/src/core/database.rs` to add idempotent `ALTER TABLE notes ADD COLUMN ...` upgrade logic for existing databases.
* Modify `packages/app/src-tauri/src/core/notes/models.rs` to add location fields to `Note`, `CreateNoteData`, `UpdateNoteData`, and `NoteQueryOptions`.
* Modify `packages/app/src-tauri/src/core/notes/commands.rs` to read/write/update/query the new fields.

Frontend note data:

* Modify `packages/app/src/types/note.ts` to expose `cfi`, `sourceText`, `contextBefore`, and `contextAfter`.
* Modify `packages/app/src/services/note-service.ts` to support `cfi` queries and duplicate lookup.
* Create `packages/app/src/components/notepad/note-utils.ts` for source excerpt/body display helpers.

Unified notes:

* Modify `packages/app/src/mobile/notes/unified-note-model.ts` to map source-bound notes to display items and reader targets.
* Modify `packages/app/src/mobile/notes/unified-note-model.test.ts` to cover source-bound notes.

Reader and marker rendering:

* Modify `packages/foliate-js/overlayer.js` to add a note badge draw helper and marker hit testing.
* Modify `packages/foliate-js/view.js` to support a distinct overlay key separate from the CFI value.
* Modify `packages/app/src/types/view.ts` to type note-marker overlays.
* Modify `packages/app/src/pages/reader/hooks/use-annotator.ts` to create/reuse source-bound notes and load current-book notes.
* Modify `packages/app/src/pages/reader/components/annotator/index.tsx` to draw note markers and open note editors from marker taps.

Note UI:

* Create `packages/app/src/components/notepad/note-editor-dialog.tsx` for body-only editing, source excerpt display, delete, and open-original actions.
* Modify `packages/app/src/components/notepad/note-item.tsx` to use source excerpt display and the editor dialog.
* Modify `packages/app/src/components/notepad/notepad-content.tsx` to pass reader `view.goTo(note.cfi)` as the open-original callback for source-bound notes.
* Modify `packages/app/src/mobile/notes/unified-notes-list.tsx` to edit/delete independent notes and keep annotation detail behavior intact.

---

### Task 1: Backend Note Location Fields

**Files:**

* Modify: `packages/app/src-tauri/src/core/schema.sql`
* Modify: `packages/app/src-tauri/src/core/database.rs`
* Modify: `packages/app/src-tauri/src/core/notes/models.rs`
* Modify: `packages/app/src-tauri/src/core/notes/commands.rs`

- [ ] **Step 1: Extend the `notes` table for new databases**

In `packages/app/src-tauri/src/core/schema.sql`, update the `notes` table:

```sql
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT,
    book_meta TEXT,
    title TEXT,
    content TEXT,
    cfi TEXT,
    source_text TEXT,
    context_before TEXT,
    context_after TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
);
```

Add an index after the existing note indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_notes_book_id_cfi ON notes(book_id, cfi);
```

- [ ] **Step 2: Add idempotent column upgrades for existing databases**

In `packages/app/src-tauri/src/core/database.rs`, add `Row` to the imports:

```rust
use sqlx::{migrate::MigrateDatabase, Row, Sqlite, SqlitePool};
```

Add this helper below `initialize`:

```rust
async fn ensure_note_location_columns(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let rows = sqlx::query("PRAGMA table_info(notes)").fetch_all(pool).await?;
    let existing: std::collections::HashSet<String> = rows
        .iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect();

    for (column, definition) in [
        ("cfi", "TEXT"),
        ("source_text", "TEXT"),
        ("context_before", "TEXT"),
        ("context_after", "TEXT"),
    ] {
        if !existing.contains(column) {
            sqlx::query(&format!("ALTER TABLE notes ADD COLUMN {} {}", column, definition))
                .execute(pool)
                .await?;
        }
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notes_book_id_cfi ON notes(book_id, cfi)")
        .execute(pool)
        .await?;

    Ok(())
}
```

Call it immediately after `schema.sql` executes:

```rust
sqlx::query(include_str!("./schema.sql"))
    .execute(&pool)
    .await?;
ensure_note_location_columns(&pool).await?;
println!("Database schema initialized.");
```

- [ ] **Step 3: Extend Rust note models**

In `packages/app/src-tauri/src/core/notes/models.rs`, add these fields to `Note`:

```rust
pub cfi: Option<String>,
#[serde(rename = "sourceText")]
pub source_text: Option<String>,
#[serde(rename = "contextBefore")]
pub context_before: Option<String>,
#[serde(rename = "contextAfter")]
pub context_after: Option<String>,
```

Add matching optional fields to `CreateNoteData`:

```rust
pub cfi: Option<String>,
#[serde(rename = "sourceText")]
pub source_text: Option<String>,
#[serde(rename = "contextBefore")]
pub context_before: Option<String>,
#[serde(rename = "contextAfter")]
pub context_after: Option<String>,
```

Add nullable update fields to `UpdateNoteData`:

```rust
pub cfi: Option<Option<String>>,
#[serde(rename = "sourceText")]
pub source_text: Option<Option<String>>,
#[serde(rename = "contextBefore")]
pub context_before: Option<Option<String>>,
#[serde(rename = "contextAfter")]
pub context_after: Option<Option<String>>,
```

Add a `cfi` query option to `NoteQueryOptions`:

```rust
pub cfi: Option<String>,
```

Update `Note::new` to accept and store the four location fields. Update `Note::from_db_row` to read:

```rust
cfi: row.try_get("cfi")?,
source_text: row.try_get("source_text")?,
context_before: row.try_get("context_before")?,
context_after: row.try_get("context_after")?,
```

Update `Default for NoteQueryOptions` with `cfi: None`.

- [ ] **Step 4: Write note location fields in commands**

In `packages/app/src-tauri/src/core/notes/commands.rs`, update the create insert columns:

```rust
INSERT INTO notes (
    id, book_id, book_meta, title, content, cfi, source_text, context_before, context_after, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Bind the new fields before timestamps:

```rust
.bind(&data.cfi)
.bind(&data.source_text)
.bind(&data.context_before)
.bind(&data.context_after)
```

Pass the fields into `Note::new` in the same order.

- [ ] **Step 5: Update note updates and duplicate queries**

In `update_note`, add dynamic update blocks for `cfi`, `source_text`, `context_before`, and `context_after`:

```rust
if let Some(cfi_opt) = &data.cfi {
    has_updates = true;
    separated.push("cfi = ").push_bind(cfi_opt.clone());
}
```

Repeat that exact pattern for `source_text`, `context_before`, and `context_after`.

In `execute_normal_query`, replace the single `book_id` `WHERE` branch with separated conditions:

```rust
let mut has_where = false;
if let Some(ref book_id) = opts.book_id {
    query_builder.push(" WHERE book_id = ").push_bind(book_id);
    has_where = true;
}

if let Some(ref cfi) = opts.cfi {
    query_builder.push(if has_where { " AND cfi = " } else { " WHERE cfi = " });
    query_builder.push_bind(cfi);
}
```

- [ ] **Step 6: Run backend compile check**

Run:

```bash
cargo check --manifest-path packages/app/src-tauri/Cargo.toml
```

Expected: PASS.

---

### Task 2: Frontend Note Types, Services, and Display Helpers

**Files:**

* Modify: `packages/app/src/types/note.ts`
* Modify: `packages/app/src/services/note-service.ts`
* Create: `packages/app/src/components/notepad/note-utils.ts`

- [ ] **Step 1: Extend TypeScript note contracts**

In `packages/app/src/types/note.ts`, add optional fields to `Note` and `CreateNoteData`:

```ts
cfi?: string;
sourceText?: string;
contextBefore?: string;
contextAfter?: string;
```

Add nullable fields to `UpdateNoteData`:

```ts
cfi?: string | null;
sourceText?: string | null;
contextBefore?: string | null;
contextAfter?: string | null;
```

Add `cfi?: string;` to `NoteQueryOptions`.

- [ ] **Step 2: Add duplicate lookup service**

In `packages/app/src/services/note-service.ts`, add:

```ts
export async function getNoteByBookLocation(bookId: string, cfi: string): Promise<Note | null> {
  const notes = await getNotes({ bookId, cfi, limit: 1, sortBy: "updated_at", sortOrder: "desc" });
  return notes[0] ?? null;
}
```

- [ ] **Step 3: Add display helpers**

Create `packages/app/src/components/notepad/note-utils.ts`:

```ts
import type { Note } from "@/types/note";

export function cleanNoteText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export function isSourceBoundNote(note: Note): boolean {
  return Boolean(note.bookId && note.cfi);
}

export function getNoteSourceExcerpt(note: Note): string {
  return cleanNoteText(note.sourceText) || cleanNoteText(note.title) || cleanNoteText(note.content);
}

export function getNoteDisplayTitle(note: Note): string {
  return getNoteSourceExcerpt(note) || cleanNoteText(note.bookMeta?.title) || "未命名笔记";
}

export function getNoteDisplayBody(note: Note): string {
  return cleanNoteText(note.content) || getNoteSourceExcerpt(note) || "无正文";
}
```

- [ ] **Step 4: Run TypeScript build**

Run:

```bash
pnpm --filter app build
```

Expected: PASS.

---

### Task 3: Unified Notes Mapping and Reader Targets

**Files:**

* Modify: `packages/app/src/mobile/notes/unified-note-model.ts`
* Modify: `packages/app/src/mobile/notes/unified-note-model.test.ts`

- [ ] **Step 1: Write source-bound note tests**

In `packages/app/src/mobile/notes/unified-note-model.test.ts`, add:

```ts
it("maps source-bound notes to source excerpt display and reader target", () => {
  const note: Note = {
    id: "note-source-1",
    bookId: "book-1",
    bookMeta: { title: "Effective Reading", author: "Ada" },
    content: "",
    cfi: "epubcfi(/6/8)",
    sourceText: "Selected source text",
    contextBefore: "Before",
    contextAfter: "After",
    createdAt: 100,
    updatedAt: 200,
  };

  const item = createUnifiedNoteFromStandaloneNote(note);

  assert.equal(item.title, "Selected source text");
  assert.equal(item.body, "Selected source text");
  assert.equal(item.cfi, "epubcfi(/6/8)");
  assert.deepEqual(getUnifiedNoteReaderTarget(item), {
    bookId: "book-1",
    title: "Effective Reading",
    cfi: "epubcfi(/6/8)",
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter app exec tsx --test src/mobile/notes/unified-note-model.test.ts
```

Expected: FAIL because standalone `Note` mapping does not use `sourceText` or `cfi` yet.

- [ ] **Step 3: Update unified note mapping**

In `packages/app/src/mobile/notes/unified-note-model.ts`, import note helpers:

```ts
import { getNoteDisplayBody, getNoteDisplayTitle } from "@/components/notepad/note-utils";
```

Update `createUnifiedNoteFromStandaloneNote`:

```ts
export function createUnifiedNoteFromStandaloneNote(note: Note): UnifiedNoteItem {
  const title = getNoteDisplayTitle(note);
  const body = getNoteDisplayBody(note);

  return {
    id: note.id,
    type: "note",
    typeLabel: UNIFIED_NOTE_TYPE_LABELS.note,
    bookId: note.bookId,
    bookTitle: note.bookMeta?.title,
    bookAuthor: note.bookMeta?.author,
    title,
    body,
    cfi: note.cfi,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    source: note,
  };
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter app exec tsx --test src/mobile/notes/unified-note-model.test.ts
```

Expected: PASS.

---

### Task 4: Editable Note Dialogs in Reader and Unified Notes

**Files:**

* Create: `packages/app/src/components/notepad/note-editor-dialog.tsx`
* Modify: `packages/app/src/components/notepad/note-item.tsx`
* Modify: `packages/app/src/components/notepad/notepad-content.tsx`
* Modify: `packages/app/src/mobile/notes/unified-notes-list.tsx`

- [ ] **Step 1: Create the shared note editor dialog**

Create `packages/app/src/components/notepad/note-editor-dialog.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Note, UpdateNoteData } from "@/types/note";
import { BookOpen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getNoteDisplayTitle, getNoteSourceExcerpt } from "./note-utils";

interface NoteEditorDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UpdateNoteData) => Promise<Note>;
  onDelete?: (noteId: string) => Promise<void>;
  onOpenOriginal?: (note: Note) => void;
}

export function NoteEditorDialog({ note, open, onOpenChange, onSave, onDelete, onOpenOriginal }: NoteEditorDialogProps) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(note?.content ?? "");
  }, [note]);

  if (!note) return null;

  const sourceExcerpt = getNoteSourceExcerpt(note);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ id: note.id, content });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="break-words text-base leading-6">{getNoteDisplayTitle(note)}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="shrink-0 space-y-2 px-4 py-3 text-muted-foreground text-sm">
            {note.bookMeta ? <div>{note.bookMeta.title}{note.bookMeta.author ? ` · ${note.bookMeta.author}` : ""}</div> : null}
            {sourceExcerpt ? <blockquote className="border-l-2 pl-3 text-foreground">{sourceExcerpt}</blockquote> : null}
          </div>
        </DialogDescription>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <Textarea
            value={content}
            className="min-h-40 resize-none"
            aria-label="笔记正文"
            onChange={(event) => setContent(event.target.value)}
          />
        </ScrollArea>
        <DialogFooter className="shrink-0 border-t p-3 pt-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {onOpenOriginal && note.bookId && note.cfi ? (
                <Button type="button" variant="outline" onClick={() => onOpenOriginal(note)}>
                  <BookOpen className="size-4" />
                  打开原文
                </Button>
              ) : null}
              {onDelete ? (
                <Button type="button" variant="destructive" onClick={() => onDelete(note.id)}>
                  <Trash2 className="size-4" />
                  删除
                </Button>
              ) : null}
            </div>
            <Button type="button" disabled={saving} onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Replace note item detail with editor dialog**

In `packages/app/src/components/notepad/note-item.tsx`, replace `NoteDetailDialog` usage with `NoteEditorDialog`. Use `getNoteDisplayBody(note)` for the card preview and pass `handleUpdateNote`, `handleDeleteNote`, and any optional `onOpenOriginal` prop through.

The card preview line should become:

```tsx
{getNoteDisplayBody(note)}
```

- [ ] **Step 3: Pass open-original from reader notepad content**

In `packages/app/src/components/notepad/notepad-content.tsx`, when rendering `NoteItem`, pass an `onOpenOriginal` callback that calls `view.goTo(note.cfi)` when the note has CFI and the reader view exists.

- [ ] **Step 4: Add editable note handling to unified notes**

In `packages/app/src/mobile/notes/unified-notes-list.tsx`, import `NoteEditorDialog`, `useNotepad`, and `type Note`. When `selectedItem?.type === "note"`, render `NoteEditorDialog` with:

```tsx
note={selectedItem.source as Note}
onSave={handleUpdateNote}
onDelete={async (noteId) => {
  await handleDeleteNote(noteId);
  setSelectedItem(null);
}}
onOpenOriginal={(note) => {
  const target = getUnifiedNoteReaderTarget({
    ...selectedItem,
    cfi: note.cfi,
  });
  if (target && onOpenReaderTarget) {
    setSelectedItem(null);
    onOpenReaderTarget(target);
  }
}}
```

Keep the existing read-only detail dialog for annotations, excerpts, and bookmarks.

- [ ] **Step 5: Run build**

Run:

```bash
pnpm --filter app build
```

Expected: PASS for note editor and unified notes files. Marker behavior is implemented in Task 6.

---

### Task 5: Reader Source-Bound Note Creation and Duplicate Reuse

**Files:**

* Modify: `packages/app/src/pages/reader/hooks/use-annotator.ts`
* Modify: `packages/app/src/pages/reader/components/annotator/index.tsx`
* Modify: `packages/app/src/components/notepad/hooks/use-notepad.ts`

- [ ] **Step 1: Add current-book note invalidation**

In `use-notepad.ts`, after create/update/delete, invalidate both scoped and unified note queries:

```ts
queryClient.invalidateQueries({ queryKey: ["mobile-unified-notes"] });
```

Use this in addition to the existing `["notes", bookId]` invalidations.

- [ ] **Step 2: Update the reader note action**

In `use-annotator.ts`, import:

```ts
import { getNoteByBookLocation } from "@/services/note-service";
```

In `addNote`, compute CFI and context before creating:

```ts
const cfi = view?.getCFI(selection.index, selection.range);
if (!cfi) {
  toast.error("无法定位笔记位置");
  return;
}

const existingNote = await getNoteByBookLocation(bookId, cfi);
if (existingNote) {
  setActiveNote(existingNote);
  toast.info("已打开现有笔记");
  return;
}

const ctx = getContextByRange(selection.range, 50);
const sourceText = selection.text.trim();
```

Create the note with empty content and source fields:

```ts
const newNote = await handleCreateNote({
  bookId,
  bookMeta,
  title: sourceText,
  content: "",
  cfi,
  sourceText,
  contextBefore: ctx.before,
  contextAfter: ctx.after,
});
setActiveNote(newNote);
toast.success("笔记已创建");
```

Expose `activeNote`, `setActiveNote`, `handleUpdateNote`, `handleDeleteNote`, and `sourceBoundNotes` from the hook return.

- [ ] **Step 3: Wire the editor in the annotator component**

In `annotator/index.tsx`, render `NoteEditorDialog` near the existing popups:

```tsx
<NoteEditorDialog
  note={activeNote}
  open={activeNote !== null}
  onOpenChange={(open) => {
    if (!open) setActiveNote(null);
  }}
  onSave={handleUpdateNote}
  onDelete={async (noteId) => {
    await handleDeleteNote(noteId);
    setActiveNote(null);
  }}
  onOpenOriginal={(note) => {
    if (note.cfi) view?.goTo(note.cfi);
  }}
/>
```

Use `handleUpdateNote` and `handleDeleteNote` returned from `useAnnotator` so note mutations stay owned by the reader hook.

- [ ] **Step 4: Run focused build**

Run:

```bash
pnpm --filter app build
```

Expected: PASS for note creation and editor wiring. Marker rendering is implemented in Task 6.

---

### Task 6: Reading-Page Note Markers

**Files:**

* Modify: `packages/foliate-js/overlayer.js`
* Modify: `packages/foliate-js/view.js`
* Modify: `packages/app/src/types/view.ts`
* Modify: `packages/app/src/pages/reader/hooks/use-annotator.ts`
* Modify: `packages/app/src/pages/reader/components/annotator/index.tsx`

- [ ] **Step 1: Add note marker draw helper**

In `packages/foliate-js/overlayer.js`, add:

```js
static noteMarker(rects, options = {}) {
    const {
        color = '#2563eb',
        textColor = '#ffffff',
        label = '笔',
        width = 18,
        height = 16,
        radius = 5,
        offset = 2,
    } = options
    const rect = rects[rects.length - 1]
    const g = createSVGElement('g')
    if (!rect) return g

    const x = rect.right - width / 2
    const y = Math.max(0, rect.top - height - offset)

    const badge = createSVGElement('rect')
    badge.setAttribute('x', x)
    badge.setAttribute('y', y)
    badge.setAttribute('width', width)
    badge.setAttribute('height', height)
    badge.setAttribute('rx', radius)
    badge.setAttribute('fill', color)

    const text = createSVGElement('text')
    text.setAttribute('x', x + width / 2)
    text.setAttribute('y', y + height / 2 + 4)
    text.setAttribute('fill', textColor)
    text.setAttribute('font-size', '11')
    text.setAttribute('font-weight', '700')
    text.setAttribute('text-anchor', 'middle')
    text.textContent = label

    g.append(badge, text)
    return g
}
```

- [ ] **Step 2: Let marker clicks hit the badge**

In `Overlayer.hitTest`, after range rect checks and before returning `[]`, add an element-bounds fallback inside the loop:

```js
const box = obj.element?.getBoundingClientRect?.()
if (box && box.top <= y && box.left <= x && box.bottom > y && box.right > x)
    return [key, obj.range]
```

- [ ] **Step 3: Add separate overlay keys in foliate view**

In `packages/foliate-js/view.js`, change the start of `addAnnotation`:

```js
const { value, overlayKey = value, indicatorType = 'outline', indicatorOptions = {} } = annotation;
```

For non-search annotations, use `overlayKey` for `overlayer.remove`, `overlayer.add`, and emitted `show-annotation` values:

```js
overlayer.remove(overlayKey);
const draw = (func, opts) => overlayer.add(overlayKey, range, func, opts);
this.#emit("draw-annotation", { draw, annotation, doc, range });
```

This keeps `value` as the CFI used by `resolveNavigation` while allowing note marker keys such as `note:<id>`.

- [ ] **Step 4: Type note marker overlays**

In `packages/app/src/types/view.ts`, add:

```ts
export interface ReaderNoteMarker {
  id: string;
  cfi: string;
  value: string;
  overlayKey: string;
  markerType: "note";
  noteId: string;
}
```

Update `addAnnotation` to accept `BookNote | ReaderNoteMarker`.

- [ ] **Step 5: Load and draw note markers**

In `use-annotator.ts`, load current book notes with `useNotepad({ bookId })` data. Flatten pages into notes with CFI. For each note in the current progress range, call:

```ts
view?.addAnnotation({
  id: note.id,
  cfi: note.cfi,
  value: note.cfi,
  overlayKey: `note:${note.id}`,
  markerType: "note",
  noteId: note.id,
});
```

Use the same CFI range comparison already used for highlights.

- [ ] **Step 6: Draw marker and open note editor on tap**

In `annotator/index.tsx`, update `onDrawAnnotation`:

```ts
if ((annotation as any).markerType === "note") {
  draw(Overlayer.noteMarker, { color: "#2563eb", textColor: "#ffffff", label: "笔" });
  return;
}
```

Update `onShowAnnotation` before the highlight lookup:

```ts
if (String(detail.value).startsWith("note:")) {
  const noteId = String(detail.value).slice("note:".length);
  const note = sourceBoundNotes.find((item) => item.id === noteId);
  if (note) setActiveNote(note);
  return;
}
```

Keep the existing highlight annotation path unchanged for normal annotation CFIs.

- [ ] **Step 7: Run build**

Run:

```bash
pnpm --filter app build
```

Expected: PASS.

---

### Task 7: Verification and Manual Checks

**Files:**

* Verify: `packages/app/src/mobile/notes/unified-note-model.test.ts`
* Verify: `packages/app`

- [ ] **Step 1: Run focused unified notes tests**

Run:

```bash
pnpm --filter app exec tsx --test src/mobile/notes/unified-note-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run app build**

Run:

```bash
pnpm --filter app build
```

Expected: PASS.

- [ ] **Step 3: Manual reader checks**

Run the app locally with:

```bash
pnpm --filter app dev
```

Check these flows in a browser or Android WebView-sized viewport:

* Select text, tap note, and confirm a note is created without opening the editor.
* Select the same text again, tap note, and confirm the existing note opens instead of creating another.
* Confirm the note appears in the reader notes panel with the source excerpt.
* Confirm the note appears in unified notes with the source excerpt.
* Edit the note body from the reader notes panel.
* Edit the note body from unified notes.
* Delete a note from the reader notes panel.
* Delete a note from unified notes.
* Create and delete a highlight around the same text and confirm the note remains.
* Delete a note around highlighted text and confirm the highlight remains.
* Confirm the note badge appears at the selected text end/top position and opens the note editor.
* Confirm "打开原文" navigates to the stored CFI.

- [ ] **Step 4: Record durable lessons**

Review the source-bound note and foliate overlay marker conventions before finishing. Update the relevant Trellis spec when the implementation introduces a durable convention:

* `.trellis/spec/app/frontend/state-management.md`
* `.trellis/spec/app/frontend/android-mobile-shell.md`
* `.trellis/spec/foliate-js/frontend/component-guidelines.md`
