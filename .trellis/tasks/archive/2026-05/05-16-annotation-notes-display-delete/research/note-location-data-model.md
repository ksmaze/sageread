# Note Location Data Model Research

## Question

How should independent reader notes bind to source text locations without coupling them to highlight annotations?

## Existing Repo Facts

* `Note` records are independent user notes stored in the `notes` table with `book_id`, `book_meta`, `title`, and `content`.
* `BookNote` records are source-positioned book marks stored in `book_notes` with `book_id`, `type`, `cfi`, `text`, style/color, and `note`.
* The reader selection note action currently creates a `Note` with the selected text as `content`; it does not save CFI, selected quote, or surrounding context.
* The unified notes model already treats `Note` and `BookNote` as separate display item sources.
* Database initialization runs `schema.sql` with `CREATE TABLE IF NOT EXISTS`; there is no current migration runner for existing app databases. Any new note columns need explicit idempotent `ALTER TABLE` handling or a migration mechanism.

## Approaches

### Approach A: Extend `Note` With Optional Location Fields (Recommended)

Add optional fields to independent `Note` records:

* `cfi`
* `sourceText`
* `contextBefore`
* `contextAfter`

The selection note action creates a `Note` with user-authored `content`, source quote/context, book metadata, and CFI. Highlight annotations remain entirely separate.

Pros:

* Matches the product model: notes are independent records.
* Minimal UI-model disruption because reader/global notes already load `Note` records.
* Allows `getUnifiedNoteReaderTarget` to navigate `Note` records with a CFI.
* Keeps delete semantics simple: `delete_note` only deletes a note.

Cons:

* Requires backend Rust model, schema, service type, and query mapping changes.
* Existing databases need a small schema upgrade path, not just `schema.sql`.

### Approach B: Add a `note_locations` Table

Keep `notes` unchanged and add a `note_locations` table keyed by `note_id`, with book/location/quote/context columns.

Pros:

* Keeps the base notes table cleaner.
* Future-proof if notes can have multiple source locations.

Cons:

* More backend queries and joins for the current MVP.
* More complex deletion and sync behavior.
* Existing frontend note flows need extra loading/model composition.

### Approach C: Reuse `BookNote.note`

Store user note content on an `annotation` `BookNote`, using the existing `cfi`, `text`, and context fields.

Pros:

* Least schema work.
* Already has source-location fields.

Cons:

* Violates the confirmed product requirement that highlights/annotations and notes are independent concepts.
* Makes delete semantics ambiguous.
* Encourages future UI coupling between highlight state and note state.

## Recommendation

Use Approach A for the MVP. It preserves the user's conceptual model while keeping implementation scope moderate. Add idempotent schema upgrade logic for existing databases, then update `Note` types, services, reader creation flow, reader/global list display, deletion, and unified reader-target mapping.
