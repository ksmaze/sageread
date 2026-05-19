# Fix Biome Major Upgrade

## Goal

Restore Biome CLI checks after upgrading the workspace to `@biomejs/biome` 2.4.15.

## Requirements

* Update the root Biome configuration to use Biome 2 config keys and schema.
* Preserve the existing formatting, lint rule, and import organization intent.
* Keep the change scoped to Biome configuration unless verification exposes another upgrade issue.

## Acceptance Criteria

* [x] `pnpm exec biome check .` no longer fails during configuration deserialization.
* [x] Biome still formats with spaces, line width 120, and double-quoted JavaScript strings.
* [x] Import organization remains enabled under the Biome 2 assist configuration.

## Definition of Done

* Biome check command run before and after the fix.
* Project type/build checks run if the Biome command reaches source analysis.
* Task notes capture the root cause and relevant Biome 2 documentation.

## Technical Approach

Migrate the root `biome.json` from the old v1.9 schema to the Biome 2.4 schema. Replace removed `files.ignore` with the v2-compatible `files.includes` shape, scope Biome to root config files and the app workspace, enable gitignore-aware scanning for generated output, and move top-level import organization settings into `assist.actions.source.organizeImports`.

## Out of Scope

* Broad lint cleanup for source files flagged after the configuration loads.
* Reformatting the full repo unless needed to validate the config migration.

## Technical Notes

* Reproduction: `pnpm exec biome check .` fails with Biome 2.4.15 because `biome.json` points at schema `1.9.4`, uses removed `files.ignore`, and still has top-level `organizeImports`.
* Verification: `pnpm exec biome migrate` reports no migration needed after the fix.
* Verification: `pnpm exec biome check biome.json package.json pnpm-workspace.yaml --diagnostic-level=error --max-diagnostics=20` passes.
* Verification: `pnpm exec biome check .` passes after applying Biome safe and unsafe fixes plus focused manual lint fixes.
* With `.gitignore` integration enabled, Biome checks 349 files instead of scanning generated build/target output.
* Verification: `pnpm --filter app build` passes.
* See `research/biome-v2-config-migration.md` for official migration references.
