# Android Process Text Research

## Sources

- Android `Intent` API reference: https://developer.android.com/reference/android/content/Intent#ACTION_PROCESS_TEXT
- Android `EXTRA_PROCESS_TEXT` reference: https://developer.android.com/reference/android/content/Intent#EXTRA_PROCESS_TEXT
- Android `EXTRA_PROCESS_TEXT_READONLY` reference: https://developer.android.com/reference/android/content/Intent#EXTRA_PROCESS_TEXT_READONLY
- Tauri mobile plugin development: https://v2.tauri.app/develop/plugins/develop-mobile/

## Android Contracts

- `Intent.ACTION_PROCESS_TEXT` is available from API 23. The app minSdk is 28, so the API is supported on all target Android installs.
- The input text is passed in `Intent.EXTRA_PROCESS_TEXT`.
- `Intent.EXTRA_PROCESS_TEXT_READONLY` tells the target whether the processed text can be written back. For a reader selection, the selected book text should be treated as read-only.
- A process-text target can return processed text in `Intent.EXTRA_PROCESS_TEXT`, but this feature should not replace book text in SageRead.
- `Intent.ACTION_TRANSLATE` exists from API 29 and is translation-specific, but the requested implementation explicitly names `Intent.ACTION_PROCESS_TEXT`.

## Tauri / Android Bridge Notes

- Existing Android native code lives in `packages/app/src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/MainActivity.kt`.
- Existing native-to-web bridge handles touch and key events by calling `currentWebView?.evaluateJavascript(...)`.
- No existing custom mobile plugin or command exposes a native Android intent from frontend code.
- Tauri's documented mobile path is a Kotlin plugin with `@TauriPlugin` and `@Command`, callable from JavaScript/Rust. A smaller task-scoped alternative may be a direct Android bridge if it fits generated project constraints, but a plugin is cleaner for future native actions.

## Repo Mapping

- Reader selection popup is assembled in `packages/app/src/pages/reader/components/annotator/index.tsx`.
- Selection behavior and popup state are in `packages/app/src/pages/reader/hooks/use-annotator.ts`.
- Current text action order is `复制`, `解释`, `询问AI`; annotation/note tools follow.
- Popup sizing currently uses `annotPopupWidth = min(vertical ? 320 : 280, viewport - padding)`. Adding another labeled action may require increasing/clamping width and moving the separator after `询问AI`.

## Recommended MVP

Add a reader selection popup action labeled `翻译` between `复制` and `解释`. On Android, invoke a native `ACTION_PROCESS_TEXT` intent with the selected text and `EXTRA_PROCESS_TEXT_READONLY=true`; if no handler is available, show a toast and keep the selection stable enough for the user to choose another action. Keep desktop/iOS behavior unchanged unless the button is intentionally hidden off Android.
