# Fix Reader Note Marker Click and Note Save

## Goal

Fix two reader note regressions after changing note markers to compact bookmark icons:

- Tapping/clicking the note marker in the reader currently has no visible effect.
- Saving edited note content from the note editor shows an update failure and does not persist the note.

## What I Already Know

- The marker visual is now acceptable and should not be made visually larger.
- `Overlayer.noteMarker()` currently renders a 9x12 bookmark with a 15x18 transparent SVG hit area.
- Reader note markers are added with `overlayKey: note:<id>` and `hitElementOnly: true`.
- `View.#createOverlayer()` listens to document `click` and calls `overlayer.hitTest(e)` before emitting `show-annotation`.
- The app also registers iframe click handlers that can dispatch `iframe-single-click` for page chrome/page turning.
- Reader note editing reuses `NoteEditorDialog` and `useNotepad().handleUpdateNote`, which calls Tauri `update_note` with `{ id, content }`.
- Tauri `update_note` accepts partial updates through `Option<Option<T>>` fields and should allow a content-only update.

## Assumptions

- Keep the chosen A visual: small semi-transparent bookmark.
- It is acceptable to increase only the invisible hit area.
- Creating a note should still not immediately open the editor.

## Requirements

- Increase note marker tap/click reliability without visually enlarging the marker.
- Ensure marker taps open the existing independent note editor instead of triggering normal reader chrome/page click behavior.
- Fix note save failures for source-bound notes opened from the reader.
- Preserve note/highlight independence and `hitElementOnly` behavior.
- Preserve existing notepad note editing behavior outside the reader.

## Acceptance Criteria

- [x] The note marker has a larger invisible hit area while the visible bookmark remains 9x12.
- [x] Clicking/tapping inside that hit area emits `show-annotation` for `note:<id>`.
- [x] A marker click is treated as consumed so normal reader single-click chrome/page behavior does not run for the same tap.
- [x] Saving content for a source-bound note succeeds and updates the active reader note state.
- [x] Existing notepad note save behavior remains compatible.

## Definition of Done

- Add or update focused tests around overlay hit geometry and reader note save state.
- Run focused tests.
- Run `pnpm --filter foliate-js build`.
- Run `pnpm --filter app build`.
- Update specs if the overlay click consumption or reader note save contract changes.

## Out of Scope

- Changing the visible marker design.
- Reopening the editor immediately after note creation.
- Redesigning the notepad UI.

## Technical Notes

- Likely files:
  - `packages/foliate-js/overlayer.js`
  - `packages/foliate-js/view.js`
  - `packages/foliate-js/tests/overlayer-tests.js`
  - `packages/app/src/pages/reader/hooks/use-annotator.ts`
  - `packages/app/src/pages/reader/components/annotator/index.tsx`
  - `packages/app/src/components/notepad/note-editor-dialog.tsx`
- Current root-cause hypotheses:
  - Marker click miss: the invisible hit area is too small for touch and/or the click is not consumed before app reader chrome handles the same tap.
  - Save failure: reader uses a generic note update callback but does not keep `activeNote`/visible marker note state synchronized after save; exact failing condition still needs test-backed confirmation.
