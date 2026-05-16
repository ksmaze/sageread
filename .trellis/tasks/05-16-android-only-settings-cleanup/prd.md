# brainstorm: audit android-only settings cleanup

## Goal

Audit the settings entries that may no longer make sense for an Android-only app, then decide whether to remove the settings UI, related runtime code, and possibly now-unused packages for app version, swap sidebar, data folder, and font management.

## What I already know

* The app is now being evaluated as Android-only.
* Candidate settings to audit:
  * App version
  * Swap sidebar
  * Data folder
  * Font management
* The desired outcome may include removing settings entries, associated code paths, and unused dependencies/packages.
* `src/main.tsx` renders `AndroidAppShell` directly, so Android mobile shell is the active app entry.
* `SettingsDialog` is still reachable from the Android shell via `MobileSettingsEntry`.
* `GeneralSettings` owns the app version, update check, swap sidebars, and data folder sections.
* `FontManager` owns the settings-page font-management UI, but reader style controls still consume custom font data through `useFontStore`.

## Assumptions (temporary)

* "Android-only" means desktop/Electron-style settings and filesystem affordances should be removed when they do not serve Android users.
* Cleanup should preserve reader functionality and avoid deleting code that is still needed by Android builds.
* Package cleanup is in scope only when dependency usage can be proven obsolete.
* Mobile reader style customization should keep curated font selection and font-size controls unless explicitly removed.

## Open Questions

* None.

## Requirements (evolving)

* Inspect current settings UI and code for app version, swap sidebar, data folder, and font management.
* Determine whether each option still has Android-only product value.
* Identify related code and package dependencies that can be removed safely.
* Prefer removing Android-irrelevant settings affordances from user-visible settings.
* Perform the deeper Android-only cleanup selected by the user:
  * Remove updater UI/code/dependencies/config that only serves desktop update flow.
  * Remove data-folder settings UI and related open/copy folder behavior.
  * Remove swap-sidebar setting and associated desktop sidebar swap state/logic.
  * Remove Android-entry-unreachable desktop shell components when code reachability checks prove they are not imported by the Android app.
  * Remove global font-management settings UI and the custom font upload/conversion pipeline.
  * Remove package/dependency entries that are only used by the removed code paths.
* Ensure deletion safety by:
  * Keeping Android-reachable shared modules even if they have desktop-era names.
  * Replacing any remaining type-only dependency on deleted packages with local types.
  * Running import searches and build/type checks after deletion.

## Acceptance Criteria (evolving)

* [x] Each candidate setting has a keep/remove recommendation grounded in code usage.
* [x] Any proposed removal includes the impacted files, code paths, and dependency/package implications.
* [x] The MVP cleanup scope is explicit before implementation begins.
* [x] If a dependency/package is proposed for removal, no remaining Android code path imports or invokes it.
* [x] The Android app still builds and keeps core reading, library, notes, AI, and reader style controls working.
* [x] Removed workspace/package dependencies are also removed from lockfiles/configs where applicable.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Implementing cleanup before requirements and scope are confirmed.
* Broad settings redesign unrelated to the four named candidates.
* Removing shared storage/path APIs used by books, prompts, app storage, or reader state.
* Removing curated built-in reader font selection unless it depends on the deleted custom-font upload pipeline.
* Removing `layout-store` completely in this task, because Android currently uses its `openBook` bridge from the library.

## Technical Notes

* Task created at `.trellis/tasks/05-16-android-only-settings-cleanup`.
* Initial repo context had packages: `app`, `app-tabs`, and `foliate-js`; default package was `app`.
* Cleanup removed `app-tabs`, leaving Trellis package context as `app` and `foliate-js`.
* Reachability findings recorded in `research/android-entry-reachability.md`.
* Inspected `packages/app/src/main.tsx`, `packages/app/src/mobile/app-shell.tsx`, `packages/app/src/mobile/settings/mobile-settings-entry.tsx`.
* Inspected settings files:
  * `packages/app/src/components/settings/settings-dialog.tsx`
  * `packages/app/src/components/settings/general.tsx`
  * `packages/app/src/components/settings/font-manager.tsx`
* Inspected related code:
  * `packages/app/src/store/theme-store.ts`
  * `packages/app/src/components/reader-layout.tsx`
  * `packages/app/src/components/markdown/annotation-popover.tsx`
  * `packages/app/src/pages/reader/components/settings-dropdown.tsx`
  * `packages/app/src/mobile/reader/reader-sheet-host.tsx`
  * `packages/app/src/utils/font.ts`
  * `packages/app/src/services/font-service.ts`
  * `packages/app/src/hooks/use-font-upload.ts`
  * `packages/app/src-tauri/src/lib.rs`
  * `packages/app/src-tauri/src/core/fonts/commands.rs`
  * `packages/app/src-tauri/tauri.conf.json`
  * `packages/app/src-tauri/tauri.android.conf.json`
  * `packages/app/src-tauri/capabilities/default.json`
  * `packages/app/src-tauri/Cargo.toml`
  * `packages/app/package.json`

### Initial audit

| Candidate | Android-only value | Current coupling | Initial recommendation |
|---|---|---|---|
| App version | Useful as read-only "about" metadata; update check is explicitly disabled on Android/iOS | `GeneralSettings` calls `getVersion`; updater UI hidden on Android; Rust updater plugin is gated to non-mobile but dependency/config remains | Keep version display if there is still an About section; remove update-check code/package/config for Android-only cleanup |
| Swap sidebar | Low Android value; mobile reader uses sheets/tool dock, not desktop left/right sidebars | Still affects old desktop `ReaderLayout`, `HeaderBar`, and annotation popover; `main.tsx` uses `AndroidAppShell` instead | Remove Android settings entry and consider deleting `swapSidebars` state only if desktop reader code is also pruned |
| Data folder | Low Android user value; raw app data path and "open folder" are desktop affordances | `GeneralSettings` calls `appDataDir`, `exists`, `mkdir`, clipboard, and `openPath`; path/fs APIs are heavily used elsewhere | Remove the settings section and related `GeneralSettings` imports/state; do not remove path/fs packages |
| Font management | Mixed: settings-page drag/drop/path selection is desktop-ish, but custom fonts are consumed by Android reader style panel | `FontManager`, `useFontUpload`, `font-service`, Tauri font commands, `fonteditor-core`, shell sidecar, and font mounting are linked | Recommended MVP: remove global settings-page FontManager entry/UI only; keep reader font loading and custom-font service unless choosing deeper cleanup |

### User decision

* User selected Approach 2: thorough cleanup.
* This means custom font upload/conversion support should be removed, not merely hidden from settings.
* The implementation should keep built-in/curated reader font choices, but remove custom installed font discovery and mounting unless a direct Android requirement is identified.
* User also selected the wider desktop-shell cleanup and explicitly requested deletion safety. Implementation must be reachability-driven:
  * Delete a file only after confirming no import path from `src/main.tsx` / `AndroidAppShell`.
  * Prefer removing imports first and letting TypeScript expose stale references.
  * Keep shared reader, library, AI, notes, storage, and Tauri plugin code when still reachable from Android.

## Technical Approach

1. Settings cleanup:
   * Simplify `GeneralSettings` to Android-relevant settings only: version display, theme mode, and auto-scroll.
   * Remove updater check logic, data folder path display, clipboard/open-folder handling, and swap-sidebar control.
   * Remove `FontManager` from `SettingsDialog`.
2. Font cleanup:
   * Keep curated built-in reader fonts and font-size/theme/reading-mode controls.
   * Remove custom installed-font discovery from reader style and font mounting.
   * Delete custom font upload/conversion UI, hooks, store, services, font converter, Tauri font commands, sidecar config, and related packages.
3. Desktop shell cleanup:
   * Delete Android-entry-unreachable desktop shell files identified by reachability audit.
   * Keep shared components directly imported by mobile shell, reader sheets, library, notes, or AI.
   * Replace `app-tabs` type imports with local tab shape types before deleting the `app-tabs` package/dependency.
4. Dependency/config cleanup:
   * Remove updater dependencies/config/artifact settings.
   * Remove custom-font-only dependencies and shell sidecar config.
   * Remove `re-resizable` and `app-tabs` only after their remaining imports are gone.

## Decision (ADR-lite)

**Context**: The app entry is now Android-only, but settings and source tree still contain desktop update, data-folder, sidebar, tab shell, and custom font-management affordances.

**Decision**: Perform a thorough Android-only cleanup, with deletion gated by import reachability and build verification.

**Consequences**: The source tree and packages become smaller, but desktop app surfaces and custom installed font support are intentionally removed. Shared Android functionality is preserved even when it lives in files originally shaped for desktop reuse.

## Implementation Plan

* PR1: Remove settings entries and reachable custom-font references while keeping Android reader style controls.
* PR2: Delete now-unreachable font pipeline, Tauri font commands, updater config/dependencies, and desktop shell files.
* PR3: Clean package manifests/lockfiles and run TypeScript/build/Rust verification; fix any stale references.

## Implementation Result

* Kept Android-relevant app version display, theme mode, auto-scroll, curated built-in reader font choices, and shared `layout-store` compatibility bridge.
* Removed update check/updater config, data-folder settings UI, swap-sidebar settings/state, global font manager, custom font upload/conversion pipeline, desktop tab/sidebar shell files, desktop chat/skills pages, `app-tabs`, and related package dependencies.
* Replaced deleted `app-tabs` type usage with local tab types.
* Replaced the stale `/chat` route-based shared chat behavior check with explicit `ChatSurfaceProvider` context for standalone Android AI versus reader-scoped AI.
* Synced Trellis package/spec metadata so removed packages and desktop shell contracts are no longer advertised as active.
* Verification completed:
  * `pnpm --filter app build` passed.
  * `cargo check --manifest-path packages\app\src-tauri\Cargo.toml` passed with unrelated existing warnings in `jan-utils` and `tauri-plugin-llamacpp`.
  * `git diff --check` passed.
  * Residual search over app code, manifests, lockfile, and Tauri config found no target cleanup references.

### Package/dependency implications

* Updater cleanup candidate:
  * Frontend: remove `@tauri-apps/plugin-updater` if update check code is deleted.
  * Rust: remove `tauri-plugin-updater` if desktop update support is no longer needed.
  * Tauri config: remove updater plugin config and updater artifact settings when Android-only.
* Data folder cleanup:
  * Do not remove `@tauri-apps/plugin-fs`, `@tauri-apps/api/path`, or Tauri fs/path permissions because storage, books, prompts, and reader code still use them.
  * `@tauri-apps/plugin-opener` still has another use in `EmbeddingDialog`; package removal needs a separate decision on that developer/test UI.
* Font cleanup:
  * Removing only the settings-page FontManager does not permit removing `fonteditor-core`, Tauri font commands, shell sidecar, or `woff2_compress`.
  * Full custom-font removal could remove `fonteditor-core`, `utils/font-converter.ts`, `services/font-service.ts`, `store/font-store.ts`, `hooks/use-font-upload.ts`, Tauri font commands/events, `tauri-plugin-shell`, `externalBin`/`woff2_compress`, and shell execute capability, but would also remove reader custom-font support.
