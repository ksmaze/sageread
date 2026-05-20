# Bug Analysis: Android EPUB Open-With Black Screen

## 1. Root Cause Category

- **Category**: B - Cross-Layer Contract
- **Specific Cause**: Android cold-start `ACTION_VIEW` opens were treated as if they would always arrive through Tauri `RunEvent::Opened`. In the Android stack, Wry/Tao emits that runtime event from `onNewIntent`, while the first file-open launch is stored as `MainActivity.intent`. The frontend also wrapped parseable `content://` URIs as JavaScript `URL` objects, which the Tauri fs JS wrapper rejects before Android can read them. A follow-up inaccessible-file case also showed that raw app-private `file://` paths from other apps must be rejected before read, and open-with errors must use the mounted Sonner toaster directly because the current Android root has no `"toast"` event listener.

## 2. Why Fixes Failed

1. **Initial file association fix**: Added the OS registration and a Rust opened-URL queue, but only covered the Tauri runtime event path. That missed Android cold starts.
2. **Frontend read path**: Assumed every parseable URL should become `new URL(...)`. That is valid for `file://`, but not for Android `content://` values crossing `@tauri-apps/plugin-fs`.
3. **Error reporting path**: Used `eventDispatcher.dispatch("toast", ...)` for open-with failures even though the current Android root mounts Sonner directly and has no listener for that event.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Documentation | Update Android mobile shell spec with the launch-intent/plugin contract. | DONE |
| P0 | Documentation | Update the cross-layer thinking guide with Android open-with as a multi-layer boundary. | DONE |
| P0 | Test Coverage | Add regression coverage for Android launch-intent capture and `content://` string reads. | DONE |
| P0 | Test Coverage | Add regression coverage for Android app-private path rejection and unable-access toast messaging. | DONE |
| P0 | Compile-time | Run Android Kotlin compilation after changing generated Android code. | DONE |
| P1 | Manual Runtime | Verify EPUB and PDF open-with flows on a device or emulator. | TODO |

## 4. Systematic Expansion

- **Similar Issues**: Android process-text flows, future share/open-with imports, any backup/import path that handles `content://` provider URIs, and any UI path still dispatching `"toast"` through `eventDispatcher` without an active listener.
- **Design Improvement**: Treat native Android launch state as a first-class source of truth for open-with imports; Tauri `RunEvent::Opened` is supplemental on Android.
- **Process Improvement**: Test cold-start and warm-start file opens separately, and run Android Kotlin compilation whenever Kotlin bridge code changes.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/android-mobile-shell.md`.
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
- [x] Added regression tests for file associations, native launch-intent capture, opened URL import, read failures, and `content://` path handling.
- [x] Added regression tests for app-private path rejection and unable-access toast copy.
- [x] Verified frontend build, Rust checks/tests, Biome, diff whitespace, and Android Kotlin compilation.
- [ ] Run a manual Android device/emulator open-with test for EPUB and PDF.
