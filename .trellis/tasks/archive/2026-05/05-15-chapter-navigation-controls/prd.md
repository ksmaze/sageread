# Chapter Navigation Controls

## Goal

Add a cleaner reader chrome experience that lets readers move directly to the next or previous chapter, see chapter context, and see reading progress as pages read out of total pages while reading.

## Requirements

* Reader can jump to the next chapter.
* Reader can jump to the previous chapter.
* The MVP should expose previous/next chapter as visible controls in the reader chrome.
* On Android mobile/tablet, chapter controls should be discoverable when reader chrome is visible.
* Reader chrome should show chapter title/context alongside chapter controls.
* Reader chrome should show progress as pages read / total pages.
* The reader chrome should use a bottom reading console layout.
* The bottom reading console should visually coordinate with the existing reader tool dock as one coherent chrome system.
* The console and dock should be composed as a single bottom chrome stack with shared width, safe-area padding, reveal/hide behavior, shadow, and theme tokens.
* Chapter navigation should use existing Foliate renderer section navigation APIs where possible.

## Acceptance Criteria

* [ ] From the reader, the user can trigger next chapter navigation.
* [ ] From the reader, the user can trigger previous chapter navigation.
* [ ] Navigation handles first-chapter and last-chapter boundaries without breaking the reader state.
* [ ] Android reader chrome includes visible previous/next chapter controls with touch-friendly targets.
* [ ] Reader chrome shows page progress in the form of current page/read pages out of total pages.
* [ ] Chapter/context text truncates cleanly and does not crowd existing reader tools on phone portrait.
* [ ] The console and dock align visually through shared width, spacing, motion, shadow, and mobile theme tokens.
* [ ] The console and dock feel like one bottom chrome component, not two unrelated floating elements.

## Definition of Done

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Technical Approach

Update the current Android reader chrome by evolving `ReaderToolDock` into a single bottom chrome stack. The outer fixed wrapper keeps the existing safe-area behavior and max width. The stack uses one visual surface with the current mobile control tokens, one shadow, and one reveal/hide behavior.

The top row contains previous chapter, current chapter/progress, and next chapter controls. The centered text truncates the chapter title on one line and displays progress as `已读 X / Y 页` from `BookProgress.pageinfo`. The bottom row preserves the existing TOC, search, notes, AI, and style tools and their sheet-opening behavior.

Navigation should call the existing Foliate renderer section APIs (`prevSection` / `nextSection`) through the active reader store view. Boundary behavior is quiet/no-op for MVP if no adjacent section is available.

## Decision (ADR-lite)

**Context**: The current Android reader hides the legacy desktop footer, so chapter navigation needs an Android-reader-visible interaction rather than relying on the existing footer behavior.

**Decision**: Expose previous/next chapter as visible controls in a bottom reading console integrated into a single chrome stack with the existing reader tool dock.

**Consequences**: This is discoverable and thumb-friendly, but the implementation must avoid a visually heavy double-stack that covers too much reading content or feels unrelated to the existing TOC, search, notes, AI, and style dock.

## Out of Scope

* Reworking the whole table-of-contents experience.
* Changing ebook parsing or chapter detection unless the existing APIs cannot support chapter jumps.
* Keyboard shortcuts, gesture-only controls, and TOC-sheet-only shortcuts are not part of the MVP.

## Technical Notes

* Relevant spec indexes discovered:
  * `.trellis/spec/guides/index.md`
  * `.trellis/spec/app/frontend/index.md`
  * `.trellis/spec/foliate-js/frontend/index.md`
* Relevant files inspected:
  * `packages/app/src/mobile/reader/mobile-reader.tsx`
  * `packages/app/src/mobile/components/reader-tool-dock.tsx`
  * `packages/app/src/pages/reader/components/reader-viewer.tsx`
  * `packages/app/src/pages/reader/components/footer-bar.tsx`
  * `packages/app/src/pages/reader/hooks/use-pagination.ts`
  * `packages/app/src/pages/reader/hooks/use-book-shortcuts.ts`
  * `packages/app/src/types/view.ts`
  * `packages/foliate-js/paginator.js`
* Current implementation path likely does not require changing ebook parsing. The renderer already knows adjacent sections; the work is mostly UI/exposure and possibly shared helper/type cleanup.
