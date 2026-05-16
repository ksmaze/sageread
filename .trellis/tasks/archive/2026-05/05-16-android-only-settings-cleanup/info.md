# Android-Only Settings Cleanup Implementation Plan

## Goal

Remove settings and code paths that only serve the legacy desktop shell or desktop update/font-management flows, while preserving the Android shell, library, reader, notes, AI, stats, and reader style controls.

## Architecture

`packages/app/src/main.tsx` mounts `AndroidAppShell`; deletion decisions are based on reachability from that root. Shared reader and library code stay when Android imports them. Desktop shell files can be removed only after import search confirms no Android path depends on them.

## Tasks

- Add focused tests for the Android settings/sidebar model before editing production code.
- Remove updater, data folder, swap-sidebar, and global font-management entries from `components/settings`.
- Remove custom font upload/discovery/mounting from frontend reader integration while preserving built-in font mounting and curated style controls.
- Remove proven-unreachable desktop shell components and stale package imports.
- Prune unused frontend dependencies and Tauri updater/shell/font-command config after import checks prove they are obsolete.
- Run focused node tests and `pnpm --filter app build`; then run Trellis quality verification.

## Deletion Guards

- Search for every removed symbol/import before deleting files.
- Prefer removing imports first and let TypeScript expose stale references.
- Do not remove `@tauri-apps/plugin-fs`, `@tauri-apps/api/path`, storage/path utilities, reader stores, library services, notes services, AI services, or Tauri capabilities still used by Android flows.
- Keep `packages/app/src/components/ui/sidebar.tsx` unless a separate import audit proves that shared UI primitive is unused; this task targets legacy shell `components/sidebar.tsx`.
