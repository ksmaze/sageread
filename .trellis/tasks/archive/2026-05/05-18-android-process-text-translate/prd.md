# Android Process Text Translation Action

## Goal

Add an Android reader selection action that lets users send selected book text to the Android system text-processing/translation flow. The immediate UX target is to insert a `翻译` action into the existing reader selection popup order: `复制`, `翻译`, `解释`, `询问AI`.

## What I Already Know

- User requested an Android system-level translation feature using `Intent.ACTION_PROCESS_TEXT`.
- When content is selected, the action order should be `复制`, `翻译`, `解释`, `询问AI`.
- The existing reader selection popup is in `packages/app/src/pages/reader/components/annotator/index.tsx`.
- The existing popup order is `复制`, `解释`, `询问AI`, then highlight/delete and note actions.
- Existing selection behavior lives in `packages/app/src/pages/reader/hooks/use-annotator.ts` and `packages/app/src/pages/reader/hooks/use-text-selector.ts`.
- Android native code currently lives in `packages/app/src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/MainActivity.kt` and already bridges touch/key events to the WebView.
- The app minSdk is 28, so Android API 23 `ACTION_PROCESS_TEXT` is available across the supported Android range.

## Assumptions

- "System-level translation" means SageRead should invoke Android's external text-processing flow for the selected text, not run an in-app AI translation.
- Selected book text is read-only, so the process-text intent should use `EXTRA_PROCESS_TEXT_READONLY=true`.
- The returned processed text should not replace book content.
- The first MVP target is reader selection inside SageRead, not registering SageRead as a global Android process-text target for selections in other apps.

## Open Questions

- None.

## Requirements

- Add a `翻译` action to the reader text selection popup.
- Preserve visible ordering for text actions: `复制`, `翻译`, `解释`, `询问AI`.
- Invoke Android `Intent.ACTION_PROCESS_TEXT` for selected text when the user taps `翻译`.
- Pass selected text through `Intent.EXTRA_PROCESS_TEXT`.
- Mark the selected text as read-only through `Intent.EXTRA_PROCESS_TEXT_READONLY=true`.
- Keep existing copy, explain, ask-AI, highlight/delete, and note behaviors intact.
- Provide a graceful fallback if Android has no process-text handler.
- Scope the change to the reader's in-app selection popup only.

## Acceptance Criteria

- [ ] Selecting reader text shows the action order `复制`, `翻译`, `解释`, `询问AI`.
- [ ] Tapping `翻译` on Android launches an Android process-text handler/chooser with the selected text.
- [ ] If no process-text handler is available, the user sees a clear failure message and the app does not crash.
- [ ] Tapping `解释` still opens the existing explain flow.
- [ ] Tapping `询问AI` still opens the existing ask-AI popup.
- [ ] Popup sizing remains usable on phone portrait and landscape.
- [ ] Non-Android behavior is unchanged or intentionally hidden per final scope decision.

## Definition of Done

- Tests added or updated where practical.
- `pnpm --filter app build` passes.
- Android shell/reader selection behavior is manually checked where feasible.
- Docs/spec notes updated if implementation adds a reusable native bridge convention.

## Out of Scope

- Replacing selected book text with translated text.
- Building an in-app translation UI or AI translation workflow.
- Registering SageRead as a global Android process-text target for selections made in other apps.
- Changing global AI prompt behavior.
- Changing highlight/note data models.

## Decision (ADR-lite)

**Context**: The user wants an Android translation action added to the reader selection popup using `Intent.ACTION_PROCESS_TEXT`.

**Decision**: Limit the MVP to the reader's in-app selection popup and insert `翻译` between `复制` and `解释`. Use Android's process-text intent for the selected text only.

**Consequences**: This keeps the change small and focused on the current reader flow. It does not create a cross-app text-processing entry point, so the app remains unchanged when users select text elsewhere on Android.

## Research References

- [`research/android-process-text.md`](research/android-process-text.md) - Android `ACTION_PROCESS_TEXT` and Tauri Android bridge notes.

## Technical Notes

- Relevant spec files:
  - `.trellis/spec/app/frontend/index.md`
  - `.trellis/spec/app/frontend/android-mobile-shell.md`
  - `.trellis/spec/app/frontend/component-guidelines.md`
  - `.trellis/spec/app/frontend/quality-guidelines.md`
- Relevant app files:
  - `packages/app/src/pages/reader/components/annotator/index.tsx`
  - `packages/app/src/pages/reader/components/annotator/annotation-popup.tsx`
  - `packages/app/src/pages/reader/components/annotator/popup-button.tsx`
  - `packages/app/src/pages/reader/hooks/use-annotator.ts`
  - `packages/app/src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/MainActivity.kt`
  - `packages/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml`

## Complexity

Moderate. The UI change is small, but a native Android intent bridge needs careful scoping and fallback behavior.
