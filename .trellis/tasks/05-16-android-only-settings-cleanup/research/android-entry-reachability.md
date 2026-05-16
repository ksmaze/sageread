# Android Entry Reachability Audit

## Method

Built a temporary import graph from `packages/app/src/main.tsx`, resolving relative imports and the `@/` alias inside `packages/app/src`.

## Findings

Android entry currently reaches:

* `mobile/app-shell.tsx`
* `components/settings/settings-dialog.tsx`
* shared settings pages such as provider, llama, and TTS settings
* shared reader components via `mobile/reader/mobile-reader.tsx`
* shared library, notes, side-chat, prompt-kit, and reader style components
* `store/layout-store.ts` through the current library open-book bridge

Android entry does not reach these desktop shell surfaces:

* `components/reader-layout.tsx`
* `components/home-layout.tsx`
* `components/sidebar.tsx`
* `components/window-controls.tsx`
* `components/tabs/index.tsx`
* `components/tabs/types.ts`
* `pages/chat/index.tsx`
* `pages/skills/index.tsx`
* `pages/skills/components/skill-editor-dialog.tsx`
* `pages/skills/components/skill-item.tsx`
* `pages/skills/hooks/use-skills.ts`

## Safety Notes

* Do not delete `store/layout-store.ts` wholesale. Despite its desktop shape, Android currently uses it as a bridge from existing library `BookItem` click handling to the mobile shell reader.
* Do not delete shared `components/side-chat/*`; mobile AI imports these directly.
* Do not delete shared `components/notepad/*`; mobile reader sheets import these directly.
* Do not delete `pages/statistics`; mobile stats destination imports it.
* `app-tabs` is only needed by desktop tabs and a couple of local type imports. If desktop shell is removed, replace those type imports with local tab shapes before removing the workspace dependency/package.

## Custom Font Reachability

Before cleanup, custom font support remains reachable because:

* `main.tsx` imports `mountFontsToMainApp` from `utils/font.ts`.
* `ReaderStylePanel` imports `useFontStore` and merges custom fonts into curated fonts.
* `foliate-viewer-manager.ts` imports `mountAdditionalFonts`.

For the chosen cleanup, remove custom installed-font discovery from these reachable files first. After that, `services/font-service.ts`, `store/font-store.ts`, `hooks/use-font-upload.ts`, `utils/font-converter.ts`, and the Tauri font commands can be removed safely if no imports remain.
