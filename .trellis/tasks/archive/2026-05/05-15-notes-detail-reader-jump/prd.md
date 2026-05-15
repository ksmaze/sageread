# Fix Notes Detail Dialog and Reader Jump

## Goal

Make the unified notes page usable after the first implementation: note details must show full content without clipping on mobile, and book-linked notes must provide a direct path back into the reader.

## What I Already Know

- The notes page now loads data and displays unified note cards.
- The screenshot shows the detail dialog clipping long title/body content on mobile.
- `UnifiedNotesPage` is shared by the mobile Notes destination and the legacy home `/notes` route.
- `UnifiedNotesList` currently owns the detail dialog and uses `DialogContent` with `overflow-hidden` plus a nested `ScrollArea`.
- Existing reader code supports `view.goTo(cfi)` from inside the reader, for example `components/notepad/annotation-item.tsx`.
- Mobile shell already opens books through `useMobileShellStore.openBook({ id, title })`.
- Desktop home opens books through `useLayoutStore.openBook(bookId, title)`.

## Requirements

- Detail dialog content must be fully readable on mobile and desktop:
  - long titles wrap instead of disappearing horizontally;
  - metadata and CFI/location text wrap safely;
  - body content scrolls inside the dialog when it exceeds available viewport height;
  - footer actions remain accessible.
- Book-linked notes should show a reader action in the detail dialog.
- For notes with a CFI, reader action should open the book and navigate to the CFI after the reader view is ready.
- For notes linked to a book but without a CFI, reader action should open the book at its existing/last reader location.
- The behavior should work for the mobile notes destination. When the shared page is used in desktop home `/notes`, it should at least open the reader tab; CFI navigation should use the same shared reader-store mechanism if feasible without broad refactor.

## Acceptance Criteria

- [ ] Opening a long note detail on mobile does not clip the title/body horizontally.
- [ ] Long note detail body can be scrolled to the end inside the modal.
- [ ] A book-linked note detail shows an action such as `打开原文` / `打开书籍`.
- [ ] Tapping the action from mobile Notes opens the reader overlay for that book.
- [ ] If the note has a CFI, the reader navigates to that CFI once the reader view exists.
- [ ] Existing note list loading and type filters continue to work.
- [ ] Touched files pass focused lint/type/build checks.

## Technical Approach

Recommended approach:

- Rework `UnifiedNoteDetailDialog` into a flex-column modal:
  - fixed header;
  - fixed metadata block;
  - `ScrollArea` as `min-h-0 flex-1`;
  - fixed footer with reader action.
- Add a small shared reader navigation target contract to the reader store:
  - callers can request a CFI target before the foliate view exists;
  - `ReaderViewer` consumes the pending target once `view` is ready and calls `view.goTo(cfi)`;
  - this keeps CFI navigation in reader-owned code instead of calling reader internals from the notes page.
- Add a pure helper around unified note reader targets so UI logic and tests can agree on when a note can open the reader.

## Decision (ADR-lite)

**Context**: The notes page lives outside the reader, but precise source navigation needs the foliate view, which only exists after the reader mounts.

**Decision**: Pass a pending navigation target through shell/layout state and consume it inside the reader store/view layer.

**Consequences**: This adds a small shared reader-navigation contract, but avoids timing hacks and allows both mobile and desktop reader entry points to reuse the same pending-CFI behavior.

## Out of Scope

- Editing or deleting notes from the unified notes page.
- Highlighting the target annotation after navigation beyond Foliate's normal `goTo` positioning.
- Building a full bidirectional sync between notes list selection and reader state.

## Technical Notes

- Relevant files inspected:
  - `packages/app/src/mobile/notes/unified-notes-list.tsx`
  - `packages/app/src/mobile/notes/unified-note-model.ts`
  - `packages/app/src/mobile/notes/unified-notes-page.tsx`
  - `packages/app/src/mobile/shell/mobile-shell-store.ts`
  - `packages/app/src/mobile/reader/mobile-reader.tsx`
  - `packages/app/src/mobile/destinations/library-destination.tsx`
  - `packages/app/src/pages/reader/components/reader-viewer.tsx`
  - `packages/app/src/pages/reader/store/create-reader-store.ts`
  - `packages/app/src/store/layout-store.ts`
  - `packages/app/src/components/ui/dialog.tsx`
  - `packages/app/src/components/ui/scroll-area.tsx`
- Existing working CFI call: `view.goTo(annotation.cfi)` in `components/notepad/annotation-item.tsx`.
