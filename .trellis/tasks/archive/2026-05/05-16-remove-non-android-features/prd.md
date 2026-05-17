# cleanup: remove non-android features

## Goal

Clean the application by removing code paths, UI, dependencies, and feature surfaces that are unused or unrelated to the Android-focused product direction, starting with all Llama-related functionality.

## What I already know

* The user wants Llama-related code and features removed because they are not related to Android.
* The user also wants a broader cleanup of unused non-Android features, including hidden views/components and legacy features where appropriate.
* This is likely broader than a single-file edit and needs codebase inspection before locking scope.

## Assumptions (temporary)

* "Android-related" means features that directly support the Android app/product workflow and its reader/library behavior.
* "Unused" should be established from code reachability, routes, build configuration, dependencies, and visible/hidden UI entry points rather than file names alone.
* Cleanup should avoid deleting shared reader infrastructure used by the Android flow, even if it lives in browser-facing packages.

## Open Questions

* None.

## Requirements (evolving)

* Remove Llama-related feature code, UI entry points, routes, copy, dependencies, tests, permissions, and backend hooks where present.
* Identify other unused or non-Android legacy surfaces before removing them.
* Preserve Android-relevant reader/library behavior.
* Preserve Android vector/RAG support only if it can survive without the local Llama.cpp backend.
* Remove the unused Vite starter app files and references (`src/App.tsx`, `src/App.css`, `src/assets/react.svg`, `/vite.svg`, starter title/copy).

## Acceptance Criteria (evolving)

* [x] No active source, UI, route, test, dependency, or documentation path references Llama features unless intentionally retained as historical notes.
* [x] Candidate hidden/legacy/non-Android features are inventoried with evidence before removal.
* [x] Removed features no longer appear in navigation, routing, commands, or build/runtime code paths.
* [x] The local Llama.cpp plugin, Rust commands, permissions, and cleanup hooks are gone.
* [x] The stale Vite starter app files and references are gone.
* [x] Lint/type-check/tests pass for the affected package(s).

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent checks are green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Removing core reader/parsing infrastructure needed by Android reader behavior.
* Broad dependency upgrades unrelated to cleanup.
* Rewriting architecture solely for cleanup unless required by removal.
* Removing Android vector/RAG or book vectorization features.

## Technical Notes

* Task created at `.trellis/tasks/05-16-remove-non-android-features`.
* Relevant package index discovered: `packages/app` with frontend specs at `.trellis/spec/app/frontend/index.md`.
* Shared thinking guide index discovered at `.trellis/spec/guides/index.md`.
* Research reference: [`research/codebase-cleanup-audit.md`](research/codebase-cleanup-audit.md).
* Key cleanup candidates: `packages/app/src/App.tsx`, `packages/app/src/components/settings/llama.tsx`, `packages/app/src/store/llama-store.ts`, `packages/app/src-tauri/plugins/tauri-plugin-llamacpp/**`, `packages/app/src-tauri/src/core/llama/**`.
* Android vector/RAG path currently flows through `getCurrentVectorModelConfig()` and `plugin:epub|search_db`.

## Decision (ADR-lite)

**Context**: The codebase mixes Android-relevant vector/RAG features with a local Llama.cpp backend and several stale starter/legacy surfaces.

**Decision**: Remove the local Llama.cpp backend, plugin, settings UI, local model download/server management, related permissions/backup hooks, and stale Vite starter files. Preserve Android vector/RAG behavior by keeping generic external embeddings and book vectorization.

**Consequences**: This will require state/storage naming cleanup where `llama` currently means generic vector settings, plus build and spec updates. It intentionally does not remove the Android AI/RAG feature set.

## Research References

* [`research/codebase-cleanup-audit.md`](research/codebase-cleanup-audit.md) — Llama spans frontend, Rust backend, permissions, backup scope, and a separate Android-relevant vector/RAG path.

## Research Notes

### What similar surfaces do here

* Android app shell still uses vector/RAG and settings surfaces, but the local Llama.cpp backend is separate from the EPUB search pipeline.

### Constraints from our repo/project

* Android shell currently expects vector model settings in the settings dialog.
* Backup/import now includes `vector-store.json`.

## Implementation Notes

* Replaced `llama-store` with generic `vector-store` settings for external embeddings.
* Removed the local Llama.cpp Tauri plugin, Rust command module, permissions, local server/model download UI, and related frontend helper files.
* Removed the debug vectorization test dialog from the Android library drawer while keeping the production book vectorization action.
* Removed unused Vite/Tauri starter assets and updated `index.html` title/favicon.

## Verification

* `tsx --test src/components/settings/settings-navigation.test.ts src/utils/model.test.ts`
* `pnpm build`
* `cargo check --manifest-path packages/app/src-tauri/Cargo.toml`
* `cargo test --manifest-path packages/app/src-tauri/Cargo.toml backup::tests::backup_config_scope_uses_vector_store_name --lib`

### Feasible approaches here

**Approach A: Remove Local Llama.cpp, Preserve Generic Remote Vector/RAG** (Recommended)

* How it works: delete the local backend/plugin path and rename or re-home generic vector settings away from `llama` naming.
* Pros: keeps Android AI behavior.
* Cons: more refactoring and migration work.

**Approach B: Remove All Vector/RAG/Embedding Features**

* How it works: delete the entire vector/embedding stack, including Android book vectorization.
* Pros: maximum cleanup.
* Cons: likely breaks intended Android AI features.

**Approach C: Minimal Llama Deletion Only**

* How it works: delete the backend/plugin but leave some `llama` naming and persisted state in place.
* Pros: low risk.
* Cons: leaves cleanup unfinished.
