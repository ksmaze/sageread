# Replace foliate-js with upstream submodule

## Goal

Replace the vendored `packages/foliate-js` directory with a git submodule pointing at `https://github.com/ksmaze/foliate-js.git` at the latest upstream `main` commit, while preserving behavior and contracts that this app depends on.

## Requirements

* Convert `packages/foliate-js` from parent-repo tracked files into a git submodule.
* Use the latest upstream commit from `https://github.com/ksmaze/foliate-js.git`.
* Diff the current vendored copy against upstream carefully before replacing it.
* Preserve app-related local behavior, types, imports, and runtime contracts.
* Avoid leaving the submodule with uncommitted local changes; the parent repo should point at a reachable upstream commit unless there is a documented blocker.
* Keep unrelated repo files and user changes untouched.

## Acceptance Criteria

* [x] `.gitmodules` records `packages/foliate-js` with URL `https://github.com/ksmaze/foliate-js.git`.
* [x] The parent repo tracks `packages/foliate-js` as a submodule gitlink, not as vendored files.
* [x] The latest upstream `main` commit was verified and used as the base for the submodule checkout.
* [x] Current vendored-vs-upstream differences are reviewed and app-relevant deltas are either preserved or documented as no longer needed.
* [x] App TypeScript ambient declarations still match consumed `foliate-js` exports.
* [x] Relevant build/type checks pass, or failures are documented with the exact blocker.

## Definition of Done

* Inspect current git state before and after replacement.
* Run `pnpm --filter app build` and any relevant package build/check that exists.
* Update Trellis specs only if this task reveals a new convention or persistent pitfall.

## Technical Approach

1. Inventory app imports, ambient declarations, and package-manager wiring for `foliate-js`.
2. Clone/fetch upstream in a temporary location and compare it against the current vendored directory.
3. Classify differences as upstream drift, app-specific compatibility changes, generated/vendor output, or removable local drift.
4. Replace the directory with a submodule at the latest upstream commit.
5. Apply any required parent-repo app changes for compatibility.
6. Verify with build/type checks and git status.

## Out of Scope

* Broad formatting cleanup in `foliate-js`.
* Publishing or pushing commits to `https://github.com/ksmaze/foliate-js.git`.
* Changing reader UI/UX except where required to preserve existing behavior with the upstream package.

## Technical Notes

* Initial repo state was clean except for this task directory.
* `packages/foliate-js` is currently tracked by the parent repo as 42 regular files, not as a submodule.
* No root `.gitmodules` file existed before this task.
* `git ls-remote https://github.com/ksmaze/foliate-js.git HEAD` reported latest `main` as `78914aef4466eb960965702401634c2cb348e9b1` on 2026-05-17.
* The parent repo points `packages/foliate-js` at local submodule commit `a60d5f0 chore: preserve sageread app compatibility`, based on upstream `78914aef4466eb960965702401634c2cb348e9b1`.
* The submodule commit must be pushed to `https://github.com/ksmaze/foliate-js.git` before the parent repo commit is shared with other clones.
* Conflict decisions are recorded in `research/conflict-analysis.md`.
* Verification completed:
  * `node --test packages/foliate-js/tests/selection-tests.js`
  * `pnpm --filter foliate-js build`
  * `pnpm --filter app build`
* Relevant specs read before implementation:
  * `.trellis/spec/foliate-js/frontend/index.md`
  * `.trellis/spec/foliate-js/frontend/directory-structure.md`
  * `.trellis/spec/foliate-js/frontend/quality-guidelines.md`
  * `.trellis/spec/foliate-js/frontend/type-safety.md`
  * `.trellis/spec/app/frontend/index.md`
  * `.trellis/spec/app/frontend/quality-guidelines.md`
  * `.trellis/spec/app/frontend/type-safety.md`
  * `.trellis/spec/guides/index.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
