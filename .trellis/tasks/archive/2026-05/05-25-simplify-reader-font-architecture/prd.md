# brainstorm: simplify reader font architecture

## Goal

Re-evaluate the recent reader font work and decide whether to simplify the architecture. The goal is to preserve release-build correctness while making the font system more controllable, more understandable, and closer to the actual user-visible value.

## What I Already Know

* The user feels the recent font work may have made behavior worse or no better than the older "add WOFF font" approach.
* Recent relevant tasks:
  * 05-15 fixed the reader font select popup visibility.
  * 05-16 removed the custom font upload/conversion/discovery pipeline during Android-only cleanup.
  * 05-24 expanded bundled reader fonts, added Android native materialization/logcat diagnostics, fixed Foliate style sync, and hid legacy conceptual presets.
* Current working tree was clean before this brainstorm task was created.
* Current font resources include 8 WOFF2 files totaling about 41.8 MB in source resources, duplicated into generated Android assets.
* Current implementation is robust but broad: registry, selected presets, CJK/Latin stack generation, native Android fallback, diagnostics, and migration aliases are coupled.
* User selected a modified Option B: keep the current bundled font files/options for now, but change runtime behavior so only the current selected font is loaded/materialized/mounted by default.
* Future font addition should remain easy: a later task should be able to add a new source font, convert/normalize it to WOFF2, copy it into the bundle, register metadata, and get tests that prove it is correctly included.
* User selected preview behavior option 2: when the reader style/settings panel is open, the app may temporarily load candidate fonts so selector previews can render accurately. Reader documents should still load only the current selected font.

## Research References

* [`research/font-architecture-retrospective.md`](research/font-architecture-retrospective.md) — compares the old simple model with the current complex model and identifies what should and should not be rolled back.
* [`info.md`](info.md) — design principles and proposal options.

## Research Summary

The old implementation was simpler and easier to reason about, but not safe to restore exactly. Its direct Android resource URL path, CJK metadata gate, system-font assumptions, and duplicate style append behavior were real problems.

The current implementation solved real release issues, but expanded into a mini bundled font platform. That may be the wrong product shape if the desired UX is just "a small number of reliable reading fonts."

The likely better path is a scope rollback, not a bug-fix rollback: keep Android-compatible loading and style sync, keep the current physical font assets for now, but only resolve/load/log selected fonts during normal reader operation.

## Requirements (Evolving)

* Compare the old and current reader font architectures.
* Identify which old behaviors were simpler and useful.
* Identify which old behaviors were genuine bugs and should not return.
* Produce a design and proposal before any code changes.
* Ask the user for confirmation before implementation.
* Keep the current bundled font assets and visible physical options for this task unless implementation proves one is invalid or unrenderable.
* Load, materialize, mount, and diagnose only the current selected font family/families by default.
* Allow scoped temporary loading of candidate fonts for settings-panel previews while the font picker/style UI is open.
* Preserve an explicit registry/manifest shape so future bundled fonts can be added with WOFF conversion and predictable tests.

## Acceptance Criteria (Evolving)

* [x] A research note compares old vs current font architecture.
* [x] The design separates "release fixes to keep" from "scope to simplify."
* [x] Proposal includes at least two feasible directions with trade-offs.
* [x] User selects a simplification direction before implementation begins.
* [x] If implementation proceeds, visible font options map only to real supported physical choices.
* [x] If implementation proceeds, tests prove only selected font files are resolved/mounted by default.
* [x] If implementation proceeds, tests prove preview/all-candidate loading is scoped to the settings preview path, not reader document mounting.
* [x] If implementation proceeds, tests cover future-font extension points: metadata, source resource, generated Android asset, and preset mapping.

## Definition Of Done

* Research and proposal are captured in the task.
* User confirms the desired direction.
* If code is later changed, focused tests and `pnpm build` pass.
* Specs are updated if the font architecture contract changes.

## Out Of Scope

* Implementing before confirmation.
* Reintroducing custom font upload/conversion.
* Porting Readest's full font system.
* Deleting currently bundled fonts as the default simplification strategy.
* Eagerly loading every bundled font in normal reader document loads.
* Requiring non-selected preview fonts to stay mounted after the settings preview surface is closed.

## Proposal

### Option A: Minimal Rollback Plus Release Fixes

Keep only `system` and `寒蝉活宋体`, remove extra bundled fonts, and simplify `font.ts` back toward a one-font helper while preserving Android-compatible loading and style sync.

Best when the priority is maximum simplicity and smallest app footprint.

### Option B: Selected-Font Lazy Loading With Extensible Registry (Selected)

Keep the current bundled/system choices for now, but make runtime behavior selected-font-first: only the active preset's required font definitions are resolved, materialized, mounted, and logged by default. Keep a clear manifest so adding future WOFF2 fonts is predictable.

Best when the priority is controllable behavior without losing the already bundled font options or future extensibility.

### Option C: Keep Current Full Registry

Keep the full registry and improve labels/samples/status UI around it.

Best only if the product goal is a built-in font platform.

## Recommended Decision

The selected direction is **Option B: Selected-Font Lazy Loading With Extensible Registry**.

Reason: it respects the user's concern that the current architecture is too complex, but does not throw away the release-build fixes, current font assets, or future ability to add more bundled fonts cleanly.

## Decision (ADR-lite)

**Context**: The current implementation proved Android release font loading with native asset materialization, but it eagerly resolves and diagnoses every bundled font. The old implementation was easier to reason about, but its release resource URL assumptions were fragile.

**Decision**: Keep the current bundled font assets/options for now. Simplify normal runtime behavior so the reader resolves, materializes, mounts, and logs only the current selected font family/families. Preserve a registry/manifest and tests that make future WOFF2 font additions straightforward.

**Consequences**: App/repo size does not shrink in this task, but the hot path becomes smaller and easier to verify. Future cleanup can still remove weak or redundant fonts after visual comparison. Future font additions remain code-reviewed, testable bundle updates rather than ad hoc resource drops.

**Preview decision**: The main app may temporarily load all candidate fonts for the reader style/settings preview surface. This is a UI-only exception to selected-font-only loading; reader document mounting remains selected-only.

## Technical Approach

* Split font metadata from font loading:
  * registry/manifest: physical family name, resource filename/path, CSS metadata, sample text, language/script role, generated Android asset expectations;
  * resolver: maps current reader font settings/preset to the exact font definitions needed now.
* Replace broad `getBuiltInFontFaces()` usage in reader mounting with a selected-font resolver.
* Add a separate preview resolver/mounting path for the settings panel so non-selected font options can render with their real faces only when that UI needs previews.
* Keep native Android materialization, but call it only for selected font files.
* Keep logcat diagnostics, but default to selected-font summary. Add an explicit verbose/all-font diagnostic path only if needed for debugging.
* Keep future font onboarding documented/tested:
  * acquire source with license noted;
  * normalize/convert to WOFF2;
  * place under `src-tauri/resources/fonts`;
  * sync generated Android assets;
  * add registry metadata and preset mapping;
  * run tests that compare source/generated assets and prove selected-load behavior.

## Technical Notes

* Task path: `.trellis/tasks/05-25-simplify-reader-font-architecture`.
* Relevant current files:
  * `packages/app/src/utils/font.ts`
  * `packages/app/src/utils/style.ts`
  * `packages/app/src/services/constants.ts`
  * `packages/app/src/pages/reader/components/reader-style-font-options.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/index.ts`
  * `packages/app/src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/AndroidSystemPlugin.kt`
* Relevant archived task docs:
  * `.trellis/tasks/archive/2026-05/05-16-android-only-settings-cleanup/prd.md`
  * `.trellis/tasks/archive/2026-05/05-24-expand-reading-font-options/prd.md`
* Verified with:
  * `pnpm --filter app exec tsx --test src/utils/font.test.ts src/utils/style.test.ts`
  * `pnpm --filter app exec tsx --test src/pages/reader/components/reader-style-font-options.test.ts src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts`
  * `pnpm --filter app build`

## Open Question

None. Ready for final confirmation before implementation.
