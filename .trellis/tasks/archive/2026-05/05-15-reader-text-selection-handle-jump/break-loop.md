# Bug Analysis: Android Paragraph-Start Selection Jump

## 1. Root Cause Category

- **Category**: E - Implicit Assumption, with D - Test Coverage Gap
- **Specific Cause**: `foliate-paginator` assumed pointer-driven `Range` selection meant desktop mouse drag selection. On Android, native selection handles can produce pointer and `selectionchange` events too. In the affected EPUB, paragraph CSS such as `text-indent: 1em`, `text-align: justify`, and `margin: 0` at a block boundary made a paragraph-start handle adjustment look like the selection escaped `#lastVisibleRange`, so foliate's cross-page selection helper could run during a native touch selection gesture.

## 2. Why Fixes Failed

1. **Paginator touch guard**: This correctly stopped page-swipe touch handlers from claiming an already active selection, but it did not address `selectionchange` auto-paging. The recording did not show a normal swipe page flip.
2. **App popup hypothesis**: The visible annotation popup made an overlay conflict plausible, but the user's EPUB-specific clue showed the stronger signal was document geometry and renderer range comparison. That app-side fix treated a symptom and was reverted.
3. **Missing pointer-type model**: The renderer had one `isPointerSelecting` boolean. It could not distinguish mouse drag selection from touch or pen native handle adjustment.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | Gate foliate selection auto-paging on `PointerEvent.pointerType === "mouse"`. | DONE |
| P0 | Test Coverage | Add unit coverage proving touch and pen range selections do not enter auto-paging. | DONE |
| P0 | Documentation | Record the foliate pointer-type selection contract in component guidelines. | DONE |
| P1 | Debug Process | For EPUB selection bugs, inspect the failing book's HTML/CSS and renderer range logic before assuming app overlays. | DONE |

## 4. Systematic Expansion

- **Similar Issues**: Any renderer feature that compares selection ranges to page/column visibility can misinterpret touch handle selection when EPUB CSS creates unusual boundary geometry.
- **Design Improvement**: Keep mouse cross-page selection behavior separate from native touch and pen selection handles. Pointer type is part of the selection contract.
- **Process Improvement**: When a bug reproduces in one EPUB but not another, inspect the content document structure and CSS before generalizing from UI symptoms.
- **Knowledge Gap**: `selectionchange` is not a finished-selection signal on mobile WebView. It can be a transient stream while native handles are moving.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/foliate-js/frontend/component-guidelines.md`.
- [x] Added `shouldAutoTurnPageForPointerSelection()` test coverage in `packages/foliate-js/tests/selection-tests.js`.
- [x] Reverted the earlier app popup deferral attempt so the final fix is at the renderer layer.
