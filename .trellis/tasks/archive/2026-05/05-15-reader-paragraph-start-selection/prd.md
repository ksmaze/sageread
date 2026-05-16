# Fix Reader Paragraph-Start Text Selection

## Goal

Android reader text selection should remain under the user's control when a selection starts at, or is adjusted to include, the beginning of a paragraph. The current behavior can jump the selection endpoint several lines away and make the selection handles hard to adjust.

## What I Already Know

- User reports the issue only when the selection starts from a paragraph beginning or is adjusted to include the paragraph beginning.
- Selection starting elsewhere behaves normally until it reaches the paragraph start.
- Reader selection is handled through iframe document selection events in `packages/app/src/pages/reader/hooks/use-text-selector.ts`.
- Reflowable pagination touch handling lives in `packages/foliate-js/paginator.js`.
- In paginated mode, `Paginator.#onTouchMove` currently calls `preventDefault()` and scrolls pages for any one-finger touchmove.
- Android native text-selection handle dragging also uses touch events inside the iframe document.

## Requirements

- Preserve normal paginated swipe navigation when there is no active text selection.
- Do not let paginator touchmove/touchend handling hijack Android native text-selection handle dragging.
- Preserve live DOM `Range` objects for annotations, CFI conversion, search, and popup positioning.
- Keep the fix framework-free inside `packages/foliate-js`.
- Avoid changing annotation storage, CFI serialization, or popup actions.

## Acceptance Criteria

- [x] While an iframe document has an active non-collapsed selection, paginator touchmove does not call `preventDefault()` or perform page scrolling.
- [x] While an iframe document has an active non-collapsed selection, paginator touchend does not snap the page as if a swipe occurred.
- [x] Existing reader touch swipe behavior is unchanged when there is no active selection.
- [x] A focused regression test covers active-range selection detection.
- [x] `pnpm --filter foliate-js build` succeeds.
- [x] `pnpm --filter app build` succeeds.

## Definition of Done

- Root cause is documented.
- Regression test added for the guard logic.
- Relevant foliate/app specs updated if the renderer touch-selection contract changes.
- Build/quality checks pass.

## Technical Approach

Add a small helper in `packages/foliate-js` to detect whether a document currently has an active text selection (`rangeCount > 0`, non-collapsed range, non-empty text when available). Use it in the paginator touch handlers to skip page gesture handling while text selection is active.

## Decision (ADR-lite)

**Context**: The reader uses native WebView selection for text ranges, while the paginator also listens to iframe touch events for page swipes.

**Decision**: Text selection wins over page-swipe handling. When an active range selection exists, paginator touch handlers should not prevent default touch behavior or snap pages.

**Consequences**: Selection handles remain usable on Android. Page swiping still works outside active text selection. The contract stays in `foliate-js`, where the touch gesture conflict originates.

## Out of Scope

- Redesigning annotation popup placement.
- Changing how highlights are saved.
- Changing CFI generation or stored annotation data.
- Reworking foliate pagination architecture.

## Technical Notes

- Relevant files inspected:
  - `packages/app/src/pages/reader/hooks/use-text-selector.ts`
  - `packages/app/src/pages/reader/components/annotator/index.tsx`
  - `packages/app/src/pages/reader/hooks/use-annotator.ts`
  - `packages/foliate-js/paginator.js`
  - `packages/foliate-js/view.js`
- Relevant specs:
  - `.trellis/spec/app/frontend/android-mobile-shell.md`
  - `.trellis/spec/foliate-js/frontend/component-guidelines.md`
  - `.trellis/spec/foliate-js/frontend/quality-guidelines.md`
  - `.trellis/spec/foliate-js/frontend/state-management.md`
