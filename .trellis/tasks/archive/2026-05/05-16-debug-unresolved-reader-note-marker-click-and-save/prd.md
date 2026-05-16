# Debug Unresolved Reader Note Marker Click and Save

## Goal

Fix the two unresolved reader note regressions using evidence from the Android screen recording instead of another surface-level patch.

## What I Already Know

- User-provided video: `D:\Downloads\Record_2026-05-16-15-24-18_d96bc14e7eba6069301f5c6a43c045ae.mp4`.
- The recording shows marker-area taps toggling reader chrome / tool sheets instead of opening the note editor.
- The recording shows `更新笔记失败` after editing note content and tapping Save.
- Previous commit `a8c863c` enlarged the marker visual hit geometry and consumed foliate `click` events, but did not verify the real Android WebView flow.
- Save failure has a concrete backend root cause: `sqlx::QueryBuilder::separated()` is used with chained `push("field = ").push_bind(value)`, which inserts the separator before the bind argument and can produce invalid `UPDATE notes SET content = , ?` SQL.
- Click failure likely has a real-browser hit-test gap: `Overlayer.hitTest()` checks the SVG group bounding box, while the transparent hit rectangle may not expand the group bounding box in Android WebView.

## Requirements

- Fix source-bound note updates so `{ id, content }` persists successfully.
- Preserve partial update semantics for nullable fields (`bookId`, `bookMeta`, `title`, `content`, `cfi`, `sourceText`, `contextBefore`, `contextAfter`).
- Make marker hit-testing use the explicit transparent hit rectangle, not only browser-dependent SVG group bounds.
- Marker taps must open the independent note editor and must not toggle reader chrome for the same tap.
- Preserve visible marker size and opacity.
- Preserve existing note list and notepad editing behavior.

## Acceptance Criteria

- [x] A backend regression test or focused check proves content-only `update_note` builds valid SQL and returns the updated note.
- [x] The note service surfaces string errors with the real backend message instead of `未知错误`.
- [x] An overlay regression test proves a point inside the transparent hit area but outside the visible bookmark hits `note:<id>`.
- [x] A marker tap is consumed before `iframe-single-click` can toggle chrome.
- [x] Existing builds and touched tests pass.

## Definition of Done

- Add focused tests for SQL update construction and overlay hit behavior.
- Run relevant frontend and Rust checks.
- Update Trellis specs with the failure mode and prevention.
- Commit code, task, and spec changes.

## Out of Scope

- Redesigning the note marker.
- Changing note creation flow to immediately edit.
- Reworking the whole notepad UI.

## Technical Notes

- Likely files:
  - `packages/app/src-tauri/src/core/notes/commands.rs`
  - `packages/app/src/services/note-service.ts`
  - `packages/foliate-js/overlayer.js`
  - `packages/foliate-js/tests/overlayer-tests.js`
  - relevant app note tests
- Break-loop classification so far:
  - Save: cross-layer contract and test coverage gap around SQL builder semantics.
  - Click: implicit browser assumption and integration coverage gap around SVG hit-testing in Android WebView.
