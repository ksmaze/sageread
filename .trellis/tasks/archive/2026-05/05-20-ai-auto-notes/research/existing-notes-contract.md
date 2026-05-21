# Existing Notes Contract Research

## Question

How are reader notes implemented today, and what does that imply for AI-generated notes?

## Findings

### Storage

Independent notes live in the `notes` SQLite table, not `book_notes`.

Relevant fields:

* `book_id`
* `book_meta`
* `title`
* `content`
* `cfi`
* `source_text`
* `context_before`
* `context_after`

`CreateNoteData.validate()` requires `bookMeta` when `bookId` is provided, and rejects notes whose `title`, `content`, and `sourceText` are all blank.

### Reader Selection Creation

Reader-selected text creates a source-bound `Note` through `useAnnotator.addNote()`:

* computes exact CFI via `view.getCFI(selection.index, selection.range)`
* checks duplicates with `getNoteByBookLocation(bookId, cfi)`
* stores `bookId`, `bookMeta`, selected text as `title`/`sourceText`, `content: ""`, exact `cfi`, and nearby context
* draws a reader note marker via `ReaderNoteMarker` with `overlayKey: note:<id>`

### Display and Navigation

Reader notes are displayed through `useNotepad({ bookId })`, `NoteItem`, and `NoteEditorDialog`.

Unified notes map both standalone `Note` rows and `BookNote` rows into `UnifiedNoteItem`. A `Note` with `bookId` and `cfi` can produce a reader target for "打开原文".

Empty source-bound notes are meaningful: display helpers show `sourceText` when `content` is empty.

### AI Chat Selection Context

Reader "解释/询问AI" currently sends selected text to chat through `IframeService` and `useTextEventHandler`.

The event payload currently carries:

* selected text
* question
* type
* timestamp
* bookId

It does **not** carry CFI, source context, or the original reader `Range`. Chat `ChatReference` currently stores only `{ id, text }`.

### Implications for AI Auto Notes

AI-generated notes should not be treated as loose chat notes when a reader/book context is available. They should reuse the existing source-bound note model:

* attach `bookId` and `bookMeta`
* attach exact `cfi`, `sourceText`, and nearby context when generated from selected reader text
* avoid writing into `book_notes`
* appear in reader notes and unified notes through the existing `notes` table

For quick actions or high-confidence automatic saves without an explicit selected reader range, the feature should not invent a reader CFI. Use AI-selected verbatim source candidates and Foliate search to confirm a real CFI when possible. Return Foliate CFI/excerpt candidates to the AI for confirmation, then save `cfi` from Foliate search or reader selection when available. If source matching fails, fall back to the current chapter start CFI.

## Revised Decision After Quick Action Research

Direct-save AI notes have two source modes:

* Reader-selection mode: preserve exact `bookId`, `bookMeta`, `cfi`, `sourceText`, and nearby context.
* Learning-note quick action mode: generate from recent chat history plus current chapter context, without requiring a selected reader range; preserve AI-selected source candidates and confirmed CFI when Foliate search succeeds, otherwise attach the note to the current chapter start.

The quick action uses source text as the AI-selected anchor. `chunk_id` may be used to retrieve candidate text, but Foliate search is the confirmation step for `notes.cfi`.
