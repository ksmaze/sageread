# brainstorm: fix home notes page display

## Goal

Fix the notes page shown from the home page so it displays correctly and implement any missing content needed for the expected notes experience.

## What I already know

* The user reports that the home page's notes page is not displaying normally.
* The user wants all content implemented, not only a placeholder or partial fix.
* `packages/app/src/components/home-layout.tsx` defines `/notes` as a local `NotesPage` placeholder with "笔记功能开发中...".
* The current mounted shell is `AndroidAppShell`, which already has `NotesDestination` and `UnifiedNotesList` for all notes/book notes.
* `UnifiedNotesList` currently lists all note types but has limited content affordances: no detail view and no delete action.
* `pnpm --filter app build` passes before changes, so the issue is not a compile-time failure.

## Assumptions (temporary)

* "首页的笔记页面" refers to the `/notes` route in `HomeLayout` and the app-level notes destination.
* The expected result should match existing product patterns in this repository.

## Open Questions

* None for MVP.

## Requirements (evolving)

* The notes page reachable from the home page must render real content instead of a development placeholder.
* The unified notes page must include standalone notes, annotations, excerpts, and bookmarks.
* The notes page must support filtering by type.
* Each note card must display meaningful title/body/book metadata/time/type content.
* Users must be able to open a full detail view for an item.
* Existing loading, error, and empty states must remain readable.
* Mobile notes must keep the current shell layout and safe-area behavior.

## Acceptance Criteria (evolving)

* [ ] `/notes` in `HomeLayout` renders the unified notes content, not "笔记功能开发中...".
* [ ] Mobile notes destination renders the same content model with mobile-safe spacing.
* [ ] Standalone notes and book notes map to complete display data.
* [ ] Filter tabs cover all supported note types.
* [ ] Detail dialog shows the selected item's title, source book/type/time, and full body.
* [ ] Relevant tests or verification steps prove the issue is fixed.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks pass, or failures are documented.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Unrelated redesigns or broad navigation changes.
* Creating/editing standalone notes from the notes destination.
* Changing Rust database schemas or note storage commands.

## Technical Notes

* Main app entry: `packages/app/src/main.tsx`.
* Legacy/home route shell: `packages/app/src/components/home-layout.tsx`.
* Mobile notes shell: `packages/app/src/mobile/destinations/notes-destination.tsx`.
* Unified note data hook/list: `packages/app/src/mobile/notes/use-unified-notes.ts`, `packages/app/src/mobile/notes/unified-notes-list.tsx`.
* Existing reader-specific notepad: `packages/app/src/components/notepad/`.
* Project has no first-party test script, but `pnpm exec tsx` is available; use Node's test runner for focused pure-data regression tests.

## Technical Approach

Create a shared unified notes presentation layer under `packages/app/src/mobile/notes/` and reuse it from both the mobile destination and `HomeLayout`'s `/notes` route. Keep storage calls unchanged, add a focused test for the note-to-display-item mapping, and verify with build/type-check.

## Decision (ADR-lite)

**Context**: The visible bug is a placeholder home notes page while a more complete mobile notes list already exists.

**Decision**: Reuse and harden the unified notes implementation instead of creating a separate desktop notes page.

**Consequences**: The notes content model stays consistent across shells. The implementation remains frontend-scoped and avoids database/API churn.
