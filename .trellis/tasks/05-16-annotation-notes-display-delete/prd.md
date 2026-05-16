# Independent Reader Notes

## Goal

Make highlights/annotations and notes fully independent in the reader. Notes may bind to a source text location, but they must not depend on highlight state. Readers can create a source-bound note from selected text, see it during the current reading flow, edit or delete it later, and jump back to the original text.

## Requirements

* Treat highlights/annotations and notes as separate concepts and separate records.
* A reader can create a highlight without creating or editing a note.
* A reader can create a source-bound note without creating, updating, or deleting a highlight.
* Tapping the note button on selected reader text creates a position-bound empty note and does not immediately open an editor.
* The note stores the source book, CFI, selected source excerpt, surrounding context, and optional user-written content.
* Position-bound notes without user-written content display only their original source excerpt in note lists.
* Re-tapping the note button for the same book/source CFI opens or reuses the existing note and must not create duplicates.
* Note editing exposes only the note body. The source excerpt provides the list/detail identity.
* Notes can be viewed, edited, and deleted from both the reader notes panel and the unified notes management page.
* Deleting a note never deletes or changes a highlight/annotation.
* Deleting a highlight/annotation never deletes or changes a note.
* Position-bound notes can open the original reader location.
* Current-reader notes are visible in the reader notes panel.
* Current-reader notes are also visible in the reading page as a small tag/badge marker at the selected text's end/top position.
* Tapping a reading-page note marker opens that note's detail/editor directly.

## Acceptance Criteria

* [ ] Tapping the note action on selected text creates an independent note with book id, CFI, source excerpt, and context.
* [ ] Creating a note from selected text does not force immediate editing.
* [ ] Creating a note does not create, modify, or delete any highlight/annotation.
* [ ] A note with no user-written content is identifiable in lists by its source excerpt.
* [ ] Re-tapping the note action for the same source position does not create a duplicate note.
* [ ] A saved note can be edited from the reader notes panel.
* [ ] A saved note can be edited from the unified notes management page.
* [ ] A saved note can be deleted from the reader notes panel.
* [ ] A saved note can be deleted from the unified notes management page.
* [ ] The note editor does not expose manual title editing for source-bound notes.
* [ ] Current-reader notes are visible in the reader notes panel.
* [ ] Current-reader notes have a small source-position marker at the top of the selected text's end position.
* [ ] Tapping a source-position note marker opens that note's detail/editor directly.
* [ ] Position-bound notes can navigate back to the original reader location.
* [ ] Unified notes still maps all supported record types and keeps reader navigation targets working.
* [ ] Note deletion and highlight deletion remain independent in both directions.

## Definition of Done

* Tests added or updated for changed behavior.
* `pnpm --filter app build` passes.
* Focused model tests pass for unified note mapping and reader target behavior.
* Manual verification covers reader note creation, duplicate prevention, marker display, edit/delete, and open-original behavior.
* Trellis specs are updated if implementation creates durable conventions.

## Technical Approach

Extend the independent `Note` model instead of storing user notes on `BookNote.note`. Add optional location fields to notes:

* `cfi`
* `sourceText`
* `contextBefore`
* `contextAfter`

The reader selection note action creates a `Note` with those source fields, book metadata, and initially empty user content. The existing `BookNote` annotation model remains responsible only for highlights/bookmarks/excerpts.

Because database initialization currently runs `schema.sql` through `CREATE TABLE IF NOT EXISTS`, existing app databases need explicit idempotent schema upgrade handling for new `notes` columns.

For reading-page markers, reuse `foliate-js` overlayer infrastructure rather than coupling notes to highlight overlays. Add a distinct app-side marker namespace/branch for independent notes so marker click handling does not go through the existing highlight annotation path. The marker should render as a small tag/badge at the selected text end/top position using the selection rects passed to overlayer draw helpers.

## Decision (ADR-lite)

**Context**: The existing app has both `Note` and `BookNote`. `BookNote` already has CFI and a `note` field, but the user confirmed that highlights/annotations and notes are fully independent concepts.

**Decision**: Use independent `Note` records for user-authored notes and extend them with optional source-location fields. Use `BookNote` only for annotations/bookmarks/excerpts. Use foliate overlayer APIs for reader note markers with a separate marker namespace.

**Consequences**: This requires backend model/schema/service changes and a small database upgrade path, but it keeps product semantics clean and makes deletion behavior unambiguous.

## Out of Scope

* Cloud sync or cross-device note sharing beyond existing local storage behavior.
* Rich-text note editing.
* Manual title editing for source-bound notes.
* Multiple notes for the exact same book/source CFI.
* A major redesign of the reader or unified notes surfaces.

## Technical Notes

Relevant app specs:

* `.trellis/spec/app/frontend/android-mobile-shell.md`
* `.trellis/spec/app/frontend/state-management.md`
* `.trellis/spec/app/frontend/type-safety.md`

Likely files:

* `packages/app/src/types/note.ts`
* `packages/app/src/services/note-service.ts`
* `packages/app/src-tauri/src/core/schema.sql`
* `packages/app/src-tauri/src/core/database.rs`
* `packages/app/src-tauri/src/core/notes/models.rs`
* `packages/app/src-tauri/src/core/notes/commands.rs`
* `packages/app/src/pages/reader/hooks/use-annotator.ts`
* `packages/app/src/pages/reader/components/annotator/index.tsx`
* `packages/app/src/components/notepad/**`
* `packages/app/src/mobile/notes/**`
* `packages/foliate-js/overlayer.js`
* `packages/foliate-js/view.js`

Research references:

* [`research/note-location-data-model.md`](research/note-location-data-model.md) — recommends extending independent `Note` records with optional location fields instead of coupling notes to `BookNote`.
* [`research/reader-note-marker-reuse.md`](research/reader-note-marker-reuse.md) — found no dedicated old note marker component, but recommends reusing foliate overlayer infrastructure for reader note markers.
