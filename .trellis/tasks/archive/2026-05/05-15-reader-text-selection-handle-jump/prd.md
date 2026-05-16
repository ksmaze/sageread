# Fix Reader Text Selection Handle Jump

## Goal

Android reader text selection handles should remain usable when the user drags an existing selection boundary to the beginning of a paragraph in paginated EPUB content.

## What I Know

- The first foliate touch guard prevented page-swipe handlers from claiming active selections, but the user still reproduced the issue.
- The provided recording shows an existing selected range, then the user drags the start/left selection handle near the paragraph starting "Shifting your persuasive style...".
- The visible page does not flip, but the selected range jumps upward into the previous paragraph.
- The user could not reproduce the same behavior in another Chinese book.
- The failing EPUB content is relevant. The local EPUB contains paragraphs like:
  - `<p id="filepos198217" class="calibre_21">Shifting your persuasive style ...</p>`
  - `.calibre_21 { text-align: justify; text-indent: 1em; margin: 0 }`
- That combination of paragraph start, indentation, justification, and paginated column layout can make Android WebView selection boundary updates look like they escaped the current visible range.

## Root Cause

`foliate-paginator` has selection auto-paging logic intended for mouse drag selection across paginated columns. It tracks `pointerdown` and, during `selectionchange`, compares the current selection range against `#lastVisibleRange`. If the range appears before or after the visible range, it calls `prev()` or `next()`.

The implicit assumption was that pointer-driven range selection meant mouse drag selection. On Android, native touch selection handles can also produce pointer and `selectionchange` sequences. EPUB-specific paragraph layout can then make a handle adjustment at a paragraph start appear outside the current visible range, so foliate tries to auto-adjust pages/ranges during a native touch selection gesture.

## Requirements

- Preserve mouse drag selection auto-paging across paginated content.
- Do not run selection auto-paging for touch or pen pointer selections.
- Keep Android native WebView selection handles in control of range adjustment.
- Do not change saved annotations, CFI generation, highlight drawing, or React reader popup behavior.
- Keep the previous active-selection touch paging guard.

## Acceptance Criteria

- [x] `foliate-paginator` records the pointer type for pointer selection.
- [x] Selection auto-paging only runs for mouse `Range` selection.
- [x] Touch and pen `Range` selections do not call the auto page-turn selection path.
- [x] Unit coverage documents the pointer-type gate.
- [x] The app-level popup deferral attempt is reverted and not part of the fix.
- [x] `node --test packages/foliate-js/tests/selection-tests.js` succeeds.
- [x] `pnpm --filter app build` succeeds.

## Technical Approach

Add a small testable helper in `packages/foliate-js/selection.js`:

- true only when pointer selection is active, pointer type is `mouse`, and selection type is `Range`
- false for touch and pen range selections

Use that helper from `foliate-paginator` before invoking `checkPointerSelection()`.

## Decision (ADR-lite)

**Context**: `checkPointerSelection()` is a renderer-level feature for extending mouse selections across paginated columns. Android and iOS native selection handles are browser-controlled gestures and are especially sensitive at EPUB paragraph boundaries.

**Decision**: Selection auto-paging is mouse-only. Touch and pen selections must not trigger `prev()` or `next()` from `selectionchange` range comparisons.

**Consequences**: Desktop mouse drag selection keeps the cross-page behavior. Android native handles remain controlled by WebView even when EPUB CSS creates unusual paragraph-start range geometry.

## Out of Scope

- Replacing the annotation toolbar UI.
- Changing saved annotations or CFI serialization.
- Reworking EPUB CSS normalization.
- Removing the existing selection guard in touch paging handlers.

## Relevant Files

- `packages/foliate-js/paginator.js`
- `packages/foliate-js/selection.js`
- `packages/foliate-js/tests/selection-tests.js`
- `.trellis/spec/foliate-js/frontend/component-guidelines.md`
