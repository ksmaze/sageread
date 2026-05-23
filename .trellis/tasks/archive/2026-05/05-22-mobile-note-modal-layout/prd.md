# brainstorm: fix mobile note modal layout

## Goal

Improve the mobile note editing surface so it remains usable with long quoted text and the on-screen keyboard: remove redundant title/content display if appropriate, prevent the note input from overlapping the action buttons, and allow the dialog content to scroll.

## What I already know

* The screenshot shows a mobile note dialog over a reader page with an on-screen keyboard open.
* The top title area repeats a long excerpt that is also shown again in the source/content preview below.
* The note input area can expand into the bottom action bar when content is long or the viewport is constrained.
* The visible dialog content cannot currently scroll enough to reach all controls comfortably.
* The relevant component is `packages/app/src/components/notepad/note-editor-dialog.tsx`.
* `getNoteDisplayTitle(note)` currently falls back to `getNoteSourceExcerpt(note)`, so source-bound notes can display the selected source text as the dialog title.
* `NoteEditorDialog` then renders `getNoteSourceExcerpt(note)` again in a blockquote, which causes the screenshot duplication.
* The source/book metadata block is outside the scroll area and marked `shrink-0`, so long source text can reduce available space for the note editor and footer.
* The same editor is used from the reader annotator and the mobile unified notes list.
* New screenshot shows the mobile home Notes page filtered to annotations. Annotation cards currently show a neutral "标注" badge and plain body text.
* Reader/notepad annotation rendering already uses each `BookNote`'s `style` and `color` to render highlight, underline, or squiggly styling.
* The home unified notes list is implemented in `packages/app/src/mobile/notes/unified-notes-list.tsx` and maps book annotations through `packages/app/src/mobile/notes/unified-note-model.ts`.
* `UnifiedNoteItem` currently carries the original `BookNote` in `source`, but does not expose annotation `style`/`color` as first-class display metadata.

## Assumptions (temporary)

* This is in the `packages/app` frontend mobile reader/note UI.
* The preferred fix should be layout-only unless repo inspection shows a state or data-flow issue.
* The source excerpt should still be available somewhere in the dialog, even if the redundant title is removed.

## Open Questions

* None.

## Requirements (evolving)

* On mobile, note editing controls must not overlap when the keyboard is open.
* Long excerpt/source content must not make the dialog unusable.
* Users must be able to scroll through dialog content when it exceeds the visible viewport.
* Preserve the existing actions: open original text, delete, and save.
* Preserve reader navigation behavior when "打开原文" is used.
* Use Approach A: replace the long excerpt-derived dialog title with a short fixed title, keeping the source excerpt only in the source preview area.
* Also inspect and adjust the unified notes detail dialog for the same mobile scroll/footer containment pattern if needed.
* Home/unified Notes annotation cards should visually match reader annotation rendering by applying the saved annotation style/color to the quoted text.
* Annotation cards should expose the annotation mark subtype, such as highlight, underline, or squiggly, instead of only a generic neutral "标注" badge.
* Apply annotation style/type parity in both the mobile unified notes list cards and the unified note detail dialog.

## Acceptance Criteria (evolving)

* [x] Long highlighted text no longer duplicates as both a title and source preview in a way that consumes most of the dialog.
* [x] The note input never overlaps the action buttons at mobile viewport sizes.
* [x] Dialog content scrolls when the source preview or note body exceeds available space.
* [x] Existing note actions remain available: open original text, delete, and save.
* [x] Source-bound note editor title is short and stable instead of repeating the selected source excerpt.
* [x] Unified notes detail dialog keeps long body/metadata content scrollable without hiding footer actions.
* [x] Mobile home Notes annotation cards render highlight/underline/squiggly text using the saved color/style.
* [x] Mobile home Notes annotation cards display the annotation mark subtype in Chinese.
* [x] Mobile home Notes annotation detail dialog renders the same styled annotation excerpt and subtype label.
* [x] Existing all/note/annotation/excerpt/bookmark filters keep their current behavior.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate for layout or component behavior.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Redesigning the entire reader UI.
* Changing note persistence, source matching, or AI note generation behavior unless required by the layout fix.
* Reworking the unified notes list/card design beyond annotation style/type parity.
* Converting dialogs into a new bottom-sheet component.

## Decision (ADR-lite)

**Context**: The note editor uses the source excerpt as a fallback display title and also renders the same excerpt as a source block. On mobile, this duplicates long text and consumes limited dialog height.

**Decision**: Use Approach A. The editor title should be a short fixed label, while the source excerpt appears only in the source preview area.

**Consequences**: The dialog loses excerpt-as-heading context, but keeps the original source visible below the header and frees header height for the editable note content.

## Scope Decision

Include the unified notes detail dialog in the MVP as a consistency check and targeted layout adjustment. Do not redesign unified notes cards or change note data behavior.

For the annotation style parity follow-up, include both the unified notes list card and the detail dialog. Keep persistence, filtering, and reader annotation drawing out of scope.

## Technical Approach

* Add a note-editor-specific title helper so the edit dialog can use a stable label without changing list/card display helpers.
* Keep the note editor as the existing Radix dialog, but structure it as a constrained flex column: fixed header, scrollable content region, fixed footer.
* Move source metadata/excerpt and textarea into the scrollable content region so long text scrolls instead of shrinking the editor/footer.
* Apply the same scroll/footer containment pattern to the unified notes detail dialog where it has long metadata/body content and an optional footer action.
* Extend the unified note display model with optional annotation display metadata derived from `BookNote.style` and `BookNote.color`.
* Render styled annotation text through a shared feature-local component/helper so the list card and detail dialog stay visually consistent.

## Implementation Plan

* [x] Add a focused test for the note editor title contract in `packages/app/src/components/notepad/note-utils.test.ts`.
* [x] Implement the note editor title helper in `packages/app/src/components/notepad/note-utils.ts`.
* [x] Update `packages/app/src/components/notepad/note-editor-dialog.tsx` to use the fixed title and scroll-contained mobile layout.
* [x] Update `packages/app/src/mobile/notes/unified-notes-list.tsx` detail dialog layout to keep metadata/body scrollable above a fixed footer.
* [x] Run the focused note utility test and `pnpm --filter app build`.
* [x] Extend unified note model tests for annotation style metadata and fallback defaults.
* [x] Add a focused annotation display style helper test.
* [x] Update unified notes cards and detail dialog to render annotation style/type parity.

## Verification

* `pnpm --filter app exec tsx --test src/components/ui/dialog-layout.test.ts src/components/notepad/note-utils.test.ts` — passed, 4 tests.
* `pnpm --filter app build` — passed (`tsc && vite build`).
* `git diff --check` — passed.
* `pnpm --filter app exec tsx --test src/mobile/notes/unified-note-annotation-display.test.ts src/mobile/notes/unified-note-model.test.ts` — passed, 8 tests.
* `pnpm --filter app build` — passed (`tsc && vite build`) after annotation style parity update.

## Spec Update Review

Updated `.trellis/spec/app/frontend/android-mobile-shell.md` with the mobile dialog fixed-footer scroll containment gotcha. No cross-layer code-spec update was needed.

Updated `.trellis/spec/app/frontend/android-mobile-shell.md` with the unified notes annotation display metadata contract: keep generic type labels separate from visible annotation style labels, preserve `annotationMark`, and test style output.

## Bug Analysis: Mobile Note Dialog Footer Overlap

### 1. Root Cause Category

* **Category**: D - Test Coverage Gap, plus E - Implicit Assumption.
* **Specific Cause**: The first fix assumed moving long content into Radix `ScrollArea` was enough. In this project, the `ScrollArea` root is only `relative`, and the dialog footer was transparent. On Android, textarea/source content could visually bleed behind the fixed footer controls, producing the overlap shown in the screenshots.

### 2. Why Fixes Failed

1. **First attempt**: Removed the duplicated title and moved source/text input into a scroll region, but used a non-clipping scroll primitive plus a transparent footer. This fixed the content model but not the visual containment.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added `dialog-layout.test.ts` to lock the scroll body and fixed footer class contract. | DONE |
| P0 | Architecture | Added shared dialog layout class constants for clipped scroll bodies and opaque fixed footers. | DONE |
| P1 | Documentation | Updated Android mobile shell spec with the fixed-footer/scroll-body gotcha. | DONE |

### 4. Systematic Expansion

* **Similar Issues**: Any mobile dialog with long content and a fixed footer can repeat this if it uses a non-clipping scroll primitive or transparent footer.
* **Design Improvement**: Prefer the same mobile containment pattern as `MobileSheet`: `min-h-0 flex-1 overflow-y-auto` for the body, fixed opaque footer outside the body.
* **Process Improvement**: Visual layout fixes need a regression contract for the Tailwind class pattern when full device automation is not available.

### 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/android-mobile-shell.md`.
* [x] Added shared implementation contract in `packages/app/src/components/ui/dialog-layout.ts`.
* [x] Added regression coverage in `packages/app/src/components/ui/dialog-layout.test.ts`.

## Technical Notes

* Task directory: `.trellis/tasks/05-22-mobile-note-modal-layout`.
* Relevant package/spec: `packages/app`, `.trellis/spec/app/frontend/index.md`.
* Relevant spec files read: `.trellis/spec/app/frontend/android-mobile-shell.md`, `.trellis/spec/app/frontend/component-guidelines.md`, `.trellis/spec/app/frontend/quality-guidelines.md`.
* Spec constraints: Android mobile first; use existing Radix/shadcn primitives; keep portalled dialogs above sheets; protect long text with `min-w-0`, wrapping, truncation, and scroll containment; verify mobile phone/tablet surfaces touched by the change.
* Likely files: `packages/app/src/components/notepad/note-editor-dialog.tsx`, possibly `packages/app/src/components/notepad/note-utils.ts` and `packages/app/src/components/notepad/note-utils.test.ts` if title fallback behavior changes globally.
