# Independent Reader Notes Design

## Summary

Highlights/annotations and notes are independent reader concepts. A note can bind to selected source text and show a reading-page marker, but creating, editing, or deleting that note must not affect highlights.

This design extends independent `Note` records with optional source-location fields and reuses the foliate overlayer infrastructure for small in-page note markers.

## Goals

* Create source-bound independent notes from selected reader text.
* Avoid immediate editing when the user taps the note action.
* Show notes in the current reading flow through both the reader notes panel and in-page markers.
* Allow editing and deleting notes from reader and unified management surfaces.
* Keep note deletion and highlight deletion independent.
* Preserve open-original navigation for source-bound notes.

## Non-Goals

* Rich-text note editing.
* Manual title editing for source-bound notes.
* Multiple notes for the same book/source CFI.
* Cloud sync changes.
* Replacing the existing reader/notepad shell.

## Data Model

Extend `Note` with optional source-location fields:

```ts
interface Note {
  id: string;
  bookId?: string;
  bookMeta?: BookMeta;
  title?: string;
  content?: string;
  cfi?: string;
  sourceText?: string;
  contextBefore?: string;
  contextAfter?: string;
  createdAt: number;
  updatedAt: number;
}
```

The `notes` table should add nullable columns matching those fields. Existing databases need idempotent upgrade handling because the app currently initializes the schema with `CREATE TABLE IF NOT EXISTS`.

`BookNote` remains responsible for annotations/bookmarks/excerpts only. Do not store user-authored independent notes on `BookNote.note`.

## Reader Flow

When the user selects text and taps the note icon:

1. Compute CFI from the selected range.
2. Check whether a note already exists for the same `bookId` and CFI.
3. If one exists, open that note detail/editor.
4. If none exists, create a `Note` with book metadata, CFI, source excerpt, context, and empty content.
5. Show a success toast and render the in-page marker. Do not open the editor automatically after first creation.

The list identity for an empty note is its source excerpt. Editing exposes only the note body.

## UI Surfaces

Reader notes panel:

* Shows current book notes.
* Displays source excerpt for empty notes.
* Allows editing note body.
* Allows deleting notes.
* Allows opening the original text when CFI exists.

Unified notes management:

* Shows standalone notes, source-bound notes, annotations, excerpts, and bookmarks through the existing unified notes model.
* Allows editing and deleting independent notes.
* Allows opening original text for notes with CFI.

Reading-page marker:

* Render a small tag/badge at the selected text end/top position.
* Use foliate overlayer rects to position the marker.
* Use a distinct value namespace for note markers so marker clicks do not enter the existing highlight annotation path.
* Tapping the marker opens the note detail/editor directly.

## Architecture

Backend:

* Add nullable note location columns to `schema.sql`.
* Add idempotent upgrade logic for existing databases.
* Extend Rust `Note`, `CreateNoteData`, and `UpdateNoteData`.
* Add query support for duplicate lookup by `bookId` + `cfi`.

Frontend services/types:

* Extend `types/note.ts`.
* Extend `note-service.ts` create/update/query payloads.
* Add helper logic for display title/body based on `content || sourceText`.

Reader:

* Update `use-annotator.ts` note action to create/reuse source-bound `Note` records.
* Render note markers from current book notes with CFI.
* Add click handling that opens note detail/editor, separate from annotation handling.

Notepad and unified notes:

* Update note item/detail/editor components to show source excerpts, edit body only, delete, and open original text.
* Update unified note mapping so source-bound `Note` records can produce reader targets.

## Error Handling

* If CFI generation fails, show a note creation error and do not create an unpositioned note from the reader selection action.
* If duplicate lookup fails, fail closed with an error rather than creating possible duplicates.
* If opening original text fails, keep the reader mounted and log the failure.
* If marker rendering fails for one note, avoid blocking the rest of the reader UI.

## Testing

* Update unified note model tests for source-bound `Note` display and reader targets.
* Add tests or focused coverage for duplicate detection logic.
* Run `pnpm --filter app build`.
* Manual checks:
  * Create note from selected text.
  * Re-tap note action at same source and confirm no duplicate.
  * See note in reader panel and unified notes.
  * Edit body from both surfaces.
  * Delete from both surfaces.
  * Confirm highlights remain unchanged.
  * Confirm marker appears at text end/top and opens editor.
  * Confirm open-original navigation works.

## Implementation Plan

1. Extend note data model and database upgrade path.
2. Update frontend note service/types and unified display model.
3. Implement reader source-bound note creation and duplicate reuse.
4. Add note detail/editor support in reader panel and unified notes.
5. Add in-page note marker rendering and marker click handling.
6. Verify build, focused tests, and manual reader flows.
