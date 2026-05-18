# PRD: Fix PDF Annotation Reopen And Note Jumps

## Problem

PDF highlights and reader note markers are saved, and the notes views can still list them, but after leaving and reopening the same PDF the overlays are not visible on the PDF page. Opening the original reader location from a notes surface can trigger another blank/white reader state.

This follows the previous PDF lifecycle fixes, so the goal is to handle the remaining cross-layer annotation/navigation state without reintroducing stale PDF renderer state.

## Scope

- Restore saved PDF annotation highlights and source-bound note markers after reader close/reopen.
- Restore saved overlays after navigating to a PDF note/annotation target.
- Make reader pending-navigation consumption wait for `view.goTo()` completion and fail without blanking the reader.
- Avoid retaining a closed `foliate-view` in the reader store after teardown.
- Add focused regression tests for the PDF/fixed-layout visibility matching and navigation target behavior.

## Non-Goals

- No PDF semantic indexing/RAG work.
- No broad reader UI redesign.
- No changes to the persisted note/booknote database schema.
- No synthetic PDF page-list TOC.

## Acceptance Criteria

1. Creating a PDF highlight, leaving the reader, then reopening the same PDF shows the saved highlight on the page again.
2. Creating a source-bound reader note in a PDF, leaving the reader, then reopening shows the note marker again.
3. Opening a saved PDF note or annotation from the notes UI navigates to the reader page without white-screening.
4. If a note target cannot be resolved, the reader stays mounted and logs the navigation failure.
5. Closing/unmounting a reader clears the store's live `view` reference and `isViewerReady`.
6. Focused tests fail before the fix and pass after it.

## Investigation Notes

- Fixed-layout/PDF relocate events report page-level CFI locations with `range: null`.
- Reader annotation replay currently filters annotations by comparing saved range CFIs to `CFI.collapse(progress.location)` and `CFI.collapse(progress.location, true)`.
- For a PDF page base CFI such as `epubcfi(/6/2)`, both collapsed start and end are the same value. A page-internal annotation like `epubcfi(/6/2!...range...)` compares greater than both, so it is never replayed.
- `ReaderViewer` pending navigation currently calls `view.goTo()` without awaiting it and tries to clear the target through an out-of-scope store reference.
