# Remove unused jan-utils crate

## Goal

Remove the unused local Rust `jan-utils` crate from the Tauri app so the backend dependency graph no longer includes dead utility code copied from unrelated functionality.

## Requirements

* Remove the `jan-utils` path dependency from `packages/app/src-tauri/Cargo.toml`.
* Delete the local crate directory at `packages/app/src-tauri/utils/`.
* Regenerate or update Cargo lockfile state as needed.
* Do not change app runtime behavior or replace utilities that are not currently imported.

## Acceptance Criteria

* [x] `rg "jan-utils|jan_utils" packages/app/src-tauri -S -g "!target/**"` finds no source or manifest references except historical lockfile output if not regenerated.
* [x] `cargo check` passes from `packages/app/src-tauri`.

## Definition of Done

* Cargo dependency graph no longer includes `jan-utils`.
* Verification command output is recorded in the session summary.
* No unrelated refactors or frontend behavior changes are introduced.

## Technical Approach

Use the existing Cargo workspace/package layout. Remove the direct dependency, delete the unused local crate, and let Cargo update `Cargo.lock` during verification.

## Decision

**Context**: Repository inspection found `jan-utils` only in `Cargo.toml`, `Cargo.lock`, and its own local crate files. There were no `jan_utils` imports in the Tauri source.

**Decision**: Remove the crate completely rather than retaining it as dormant code.

**Consequences**: If future backend code needs one of these helpers, it should reintroduce only the specific helper in the relevant module instead of restoring the whole copied crate.

## Out of Scope

* Reworking unrelated Rust dependencies.
* Moving any utility functions into app code.
* Changing frontend behavior.

## Technical Notes

* `packages/app/src-tauri/Cargo.toml` declares `jan-utils = { path = "utils" }`.
* `cargo tree -i jan-utils` shows only `SageRead` depends on it.
* Repo search found no `jan_utils` imports outside the dependency and lockfiles.
