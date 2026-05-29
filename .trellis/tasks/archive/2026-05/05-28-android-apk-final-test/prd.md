# Require Android APK Build Final Test

## Goal

Record the project convention that implementation work for `packages/app` must finish by running the Android APK build command, so future sessions verify the actual Tauri Android release path instead of only the frontend build.

## Requirements

- Add the final Android APK build command to the app frontend quality/spec guidance.
- The required final test command is `pnpm tauri android build --target aarch64 --apk`.
- Place the rule where future implement/check passes are likely to read it.

## Acceptance Criteria

- [x] The spec explicitly says to run `pnpm tauri android build --target aarch64 --apk` at the end of implementation.
- [x] The wording distinguishes this final Android build from narrower focused checks such as `pnpm --filter app build`.
- [x] No unrelated project files are changed.

## Definition of Done

- [x] Spec updated.
- [x] Edited docs contain no placeholders.
- [x] Git status reviewed.

## Out of Scope

- Changing build scripts or package manager configuration.
- Running a new Android build for this docs-only spec update.

## Technical Notes

- Relevant target: `.trellis/spec/app/frontend/quality-guidelines.md`.
- Related spec: `.trellis/spec/app/frontend/android-mobile-shell.md`.
