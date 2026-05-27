# Android Mobile Shell

> Current Android phone/tablet UI contracts for `packages/app`.

---

## Scope / Trigger

`packages/app` is currently Android mobile/tablet first. The active UI root is the Android shell. The former desktop tab/sidebar shell and `app-tabs` package were removed in the Android-only cleanup.

Primary sources:

- `packages/app/src/main.tsx`
- `packages/app/src/mobile/app-shell.tsx`
- `packages/app/src/mobile/shell/mobile-shell-store.ts`
- `packages/app/src/mobile/components/**`
- `packages/app/src/mobile/destinations/**`
- `packages/app/src/mobile/reader/**`
- `packages/app/src/mobile/notes/**`
- `packages/app/src/mobile/ai/**`
- `packages/app/src/pages/reader/**`
- `packages/app/src/components/settings/**`
- `packages/app/src/index.css`

## Design Decision: Android Mobile Shell First

**Context**: The app is a Tauri reader targeting Android phone and tablet layouts. The previous desktop tab/sidebar shell did not fit the target interaction model and is no longer part of the app package.

**Decision**: `main.tsx` mounts `AndroidAppShell`. Phone uses bottom navigation; tablet uses a navigation rail. The reader is a single active book surface with reveal-on-tap chrome and bottom dock tools.

**Why**: Android users need large touch targets, safe-area-aware bottom/top controls, sheet-based secondary tools, and a single focused reading surface instead of desktop tabs and resizable sidebars.

```tsx
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AndroidAppShell />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);
```

## Shell Contracts

- Top-level destinations are `"library"`, `"notes"`, `"ai"`, and `"stats"`.
- `useMobileShellStore` owns Android presentation state: active destination, active book, reader open state, reader chrome visibility, and active reader sheet.
- Phone navigation is `MobileBottomNav` with safe-area bottom padding, and it must be hidden from the `md` breakpoint upward.
- Tablet navigation is `TabletRail` from the `md` breakpoint upward.
- Shared destination frames use `MobileSurface`, which applies `mobile-paper`, safe-area horizontal padding, and mobile scroll containment.
- A floating `MobileSettingsEntry` opens global settings outside the reader overlay on non-AI destinations.

## Scenario: OS Open-With Book Import

### 1. Scope / Trigger

Use this when adding or changing OS file associations, Android open-with behavior, or frontend handling for files opened into SageRead from outside the in-app library picker. The current contract covers EPUB and PDF imports only.

### 2. Signatures

- Tauri config: `bundle.fileAssociations[]` entries for EPUB and PDF.
- Tauri runtime event: `RunEvent::Opened { urls }`, available on macOS, iOS, and Android targets.
- Frontend event: `"open-file"` with payload `string[]`.
- Android plugin command: `AndroidSystemPlugin.takeOpenedBookUrls`, response `{ "urls": string[] }`.
- Tauri command: `opened_urls() -> Result<Vec<String>, String>`.
- Frontend hook: `useOpenedBookImport()`.
- Frontend service: `importOpenedBookUrls(urls, deps) -> { importedCount, skippedUrls, failedUrls }`.

### 3. Contracts

- Register EPUB with `mimeType: "application/epub+zip"` and PDF with `mimeType: "application/pdf"`.
- Android intent filters must use lowercase `androidIntentActionFilters: ["view"]`. Uppercase values fail Tauri config validation.
- Android cold-start opens must be captured from the visible `MainActivity` path. Do not rely only on `RunEvent::Opened`: Wry/Tao forwards `onNewIntent`, but the initial launch intent must be read from `activity.intent` through the Android system plugin.
- `MainActivity.onNewIntent` must call `setIntent(intent)` after delegating to Tauri so the current Android activity intent matches the latest open-with request.
- Native code stores opened URLs in a one-shot queue so cold-start and warm file opens can be imported after the web UI mounts.
- Native code also emits `"open-file"` for warm opens while the app is already running; the frontend should drain `opened_urls` as the source of truth and use the event payload only as fallback.
- Frontend code reads opened URLs with `@tauri-apps/plugin-fs`, converts them into `File` objects, and delegates to the existing library import path.
- Pass Android `content://` URIs to `@tauri-apps/plugin-fs` as strings. The JS fs wrapper rejects non-`file:` `URL` objects before they reach the Android fs plugin.
- Treat raw Android app-private `file://` paths under `/data/user/0/` or `/data/data/` as inaccessible open-with inputs. Do not attempt to read them; report an unable-access toast and ask the user to move the file to the Downloads directory.
- Open-with import errors must call the mounted Sonner toast API directly. Do not dispatch `"toast"` through `eventDispatcher` unless the current app root has an active listener for that event.
- Reuse `useBookUpload().handleDropedFiles` for opened-file imports so library insertion, parsing, and progress behavior stay consistent with picker/drop imports.
- Opening a file from the OS imports it into the library. Do not automatically open the reader unless product requirements explicitly change.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| No queued opened URLs | Return an empty list and do no frontend work. |
| Android cold-start `ACTION_VIEW` open | Read `activity.intent` through the Android plugin and return those URLs from `opened_urls`. |
| Android warm `ACTION_VIEW` open | Call `setIntent(intent)`, queue URLs in the Android plugin, and dedupe them with any `RunEvent::Opened` URLs. |
| Unsupported extension | Skip the URL and report it through the existing toast path. |
| URL read fails | Keep importing other readable files, then report the failed URL. |
| URL is `content://...` | Keep it as a string when calling `readFile`; do not wrap it in `new URL(...)`. |
| URL is a raw app-private `file:///data/user/0/...` or `file:///data/data/...` path | Do not call `readFile`; show an unable-access toast and leave the library unchanged for that file. |
| App receives a warm open | Emit `"open-file"` and import through the same frontend service as cold-start URLs. |
| Building on non-macOS desktop hosts | Do not reference `RunEvent::Opened` outside a matching `cfg`; the enum variant is target-gated. |
| Tauri config uses invalid action casing | Build/config validation must fail; fix the value to lowercase `"view"`. |

### 5. Good/Base/Bad Cases

- Good: On Android, choosing an EPUB or PDF from another app's open-with/share flow launches SageRead and imports the file into the library using the existing importer.
- Base: Opening SageRead normally drains no queued URLs and leaves the library unchanged.
- Bad: Editing generated Android manifest files manually, using uppercase `"View"` intent actions, relying only on `RunEvent::Opened` for Android cold starts, wrapping `content://` as a JavaScript `URL`, auto-opening the reader after import, or matching `RunEvent::Opened` on every Rust target.

### 6. Tests Required

- Unit-test `tauri.conf.json` for EPUB/PDF `fileAssociations`, MIME types, and lowercase Android intent filters.
- Unit-test the native Android source contract for `MainActivity.onNewIntent`, `setIntent(intent)`, and `AndroidSystemPlugin.takeOpenedBookUrls`.
- Unit-test `importOpenedBookUrls` for supported URL import, unsupported URL skipping, and read-failure reporting while other files continue.
- Unit-test that `content://` imports are passed to `readFile` as strings, while `file://` imports may be passed as `URL` objects.
- Unit-test that raw Android app-private file paths are reported as inaccessible without calling the fs plugin.
- Unit-test the unable-access open-with toast message.
- Unit-test that the open-with hook reports import issues through the mounted Sonner toaster rather than the unused toast event bus.
- Unit-test the Rust opened-URL queue drains queued values once.
- Unit-test that Rust merges Android plugin URLs with Tauri queued URLs without duplicates.
- Run `pnpm --filter app build`.
- Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml`.
- Run `packages/app/src-tauri/gen/android/gradlew.bat :app:compileUniversalDebugKotlin` after editing Android Kotlin source.
- When Android tooling or a device/emulator is available, manually verify opening an EPUB and a PDF from Android file manager or another app.

### 7. Wrong vs Correct

#### Wrong

```json
{ "androidIntentActionFilters": ["View"] }
```

Tauri expects lowercase schema values for Android intent action filters.

#### Correct

```json
{ "androidIntentActionFilters": ["view"] }
```

#### Wrong

```rust
match event {
    tauri::RunEvent::Opened { urls } => handle_opened_urls(urls),
    _ => {}
}
```

This does not compile on host targets where `RunEvent::Opened` is not defined.

#### Correct

```rust
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
if let tauri::RunEvent::Opened { urls } = event {
    handle_opened_urls(urls);
}
```

#### Wrong

```ts
await readFile(new URL("content://downloads/document/book.epub"));
```

The Tauri JS fs wrapper rejects non-`file:` URL objects.

#### Correct

```ts
await readFile("content://downloads/document/book.epub");
```

Android content URIs must cross the JS fs boundary as strings so the Android fs plugin can open the content resolver descriptor.

## Reader Contracts

- Android reader supports one active book at a time through `activeBook`.
- `LibraryDestination` adapts existing `useLayoutStore.openBook` calls into `useMobileShellStore.openBook` so existing library components can remain functional.
- `MobileReader` mounts `ReaderProvider` with `createReaderStore(activeBook.id)` and renders the existing `ReaderViewer`.
- `ReaderViewer` may hide desktop `HeaderBar` and `FooterBar` when `mobileChrome` is enabled, but it must keep reading-session visibility and foliate lifecycle behavior intact.
- Reader chrome toggles from foliate single-click events; do not add a transparent tap catcher over the reader because it blocks iframe text selection and page interaction.
- `ReaderToolDock` is the Android reader chrome stack. Its top row exposes previous/next chapter controls plus current chapter/progress text, and its bottom row exposes TOC, search, notes, AI, and style tools.
- `ReaderSheetHost` renders real reader tool content in `MobileSheet`.
- Android/browser back should close the active reader sheet, then hide reader chrome, then close the reader.

## Scenario: Android Process Text Reader Action

### 1. Scope / Trigger

Use this when adding or changing Android native text-processing actions from the reader selection popup. The current reader selection translation action is Android-only and launches Android's system process-text flow instead of building an in-app translation surface.

### 2. Signatures

- Frontend service: `processSelectedTextWithAndroid(selectedText: string, options?)`.
- Tauri command: `process_text(text: String) -> Result<(), String>`.
- Android plugin command: `AndroidSystemPlugin.processText`, payload `{ "text": string }`, response `{ "started": true }`.
- Android intent: `Intent.ACTION_PROCESS_TEXT` with `Intent.EXTRA_PROCESS_TEXT` and `Intent.EXTRA_PROCESS_TEXT_READONLY=true`.

### 3. Contracts

- The reader selection popup shows `翻译` only when `getOSPlatform()` returns `"android"`.
- The visible text-action order is `复制`, `翻译`, `解释`, `询问AI`; highlight/delete and note actions remain after a separator.
- The frontend trims selected text before invoking `process_text`.
- Native code must treat selected reader text as read-only. Do not replace book content with returned process-text output.
- Use a Tauri command plus Android plugin for native intent launches. Do not expose a broad `addJavascriptInterface` bridge to WebView content because book iframes may contain untrusted document HTML.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Selected text trims to empty | Return `empty-selection`; do not call native code. |
| Platform is not Android | Hide the button in the popup; service returns `unsupported-platform` if called defensively. |
| Android has no process-text handler | Reject with a clear message and show a toast; keep the app running. |
| Native intent starts successfully | Resolve the Tauri command, then dismiss the selection popup and deselect reader text. |
| Native launch throws | Preserve the native error message when possible and show it to the user. |

### 5. Good/Base/Bad Cases

- Good: On Android, selecting reader text shows `复制`, `翻译`, `解释`, `询问AI`; tapping `翻译` opens the Android process-text chooser with read-only selected text.
- Base: On non-Android builds, the existing selection popup omits `翻译` and keeps the previous `复制`, `解释`, `询问AI` order.
- Bad: Registering SageRead as a global cross-app process-text target for this reader-only action, replacing book text with processed output, or exposing a generic JavaScript interface to book iframe content.

### 6. Tests Required

- Unit-test the frontend service: trims text, blocks blank selections, blocks non-Android platforms, preserves native failure messages, and invokes `process_text` with `{ text }`.
- Unit-test selection action ordering for Android and non-Android platforms.
- Run `pnpm --filter app build` for TypeScript/Vite.
- Run `cargo check --manifest-path packages/app/src-tauri/Cargo.toml` for the Rust command path.
- Run an Android Gradle Kotlin compile task such as `:app:compileUniversalDebugKotlin` after adding or editing Kotlin plugin code.

### 7. Wrong vs Correct

#### Wrong

```tsx
window.SageReadAndroid.processText(selectedText);
```

This exposes a broad native bridge to every WebView frame, including book content.

#### Correct

```ts
await invoke("process_text", { text: selectedText.trim() });
```

The frontend calls a typed Tauri command; Rust delegates to the Android plugin, and the Kotlin plugin launches `Intent.ACTION_PROCESS_TEXT` with read-only text extras.

## Unified Notes Contracts

- `mobile/notes/unified-note-model.ts` is the source of truth for mapping standalone `Note` records and `BookNote` records into display items.
- Keep type labels and filters in the shared model (`UNIFIED_NOTE_TYPE_LABELS`, `UNIFIED_NOTE_FILTERS`) instead of duplicating `"笔记"`, `"标注"`, `"摘录"`, or `"书签"` labels in page components.
- `UnifiedNotesPage` owns destination-level filter state and may be reused by `NotesDestination`; do not create a second app-level notes page with separate mapping logic.
- Unified notes cards should expose enough content to identify the record: title, body preview, type label, source book/author when available, and updated time. Full content belongs in the detail dialog.
- Unified notes detail dialogs may offer `打开原文` / `打开书籍` for book-linked items. Use `getUnifiedNoteReaderTarget` plus the shared reader navigation target contract from `state-management.md`; do not call foliate `view.goTo` directly from the notes page.
- For `BookNote.type === "annotation"`, `createUnifiedNoteFromBookNote` must preserve reader-style display metadata on `UnifiedNoteItem.annotationMark`: `style`, `color`, `label`, `text`, `note`, and optional `contextBefore` / `contextAfter`. Keep `typeLabel` as the generic `"标注"` value; use `getUnifiedNoteBadgeLabel(item)` when the UI wants the visible subtype label (`"高亮"`, `"下划线"`, or `"波浪线"`).
- Unified notes annotation cards and detail dialogs should render the selected source text with `getUnifiedAnnotationTextStyle`, matching reader annotation behavior: highlights use the translucent color background, underline/squiggly use colored text decorations, and legacy annotations without saved `style` / `color` default to `highlight` / `yellow`.
- When changing unified annotation display mapping, add or update focused `tsx --test` coverage for both `unified-note-model.ts` metadata and `unified-note-annotation-display.ts` style output.

## Settings Contract

- Settings are shared with the existing `SettingsDialog`.
- On phones, settings content is full-screen using `100dvh` and stacked navigation/content.
- From `sm` upward, settings keep a two-column layout with a viewport-constrained modal: `width: calc(100vw - 2rem)`, max `800px`, and no fixed `800px` minimum width. Tablet portrait must not clip the sidebar or content horizontally.
- Pages embedded in the Android shell should not mount duplicate settings dialogs. Pass an opt-out prop when a reused page already owns a settings dialog.
- The standalone AI destination must hide the shell-level floating `MobileSettingsEntry` because `MobileAiChat` owns its own settings button alongside model, new-thread, and history controls.

## Safe Area And Touch Contracts

- Use `pb-safe`, `pt-safe`, and `px-safe` for fixed Android controls.
- Interactive Android controls must be at least `--mobile-touch-target` (`44px`) in both dimensions, or be inside a larger fixed-height/wide grid cell.
- Reader chrome rows should share one safe-area-aware bottom container, one max width, one shadow, and `--mobile-control-fill` / `--mobile-on-control` tokens so chapter navigation and dock tools read as one control system.
- Use `mobile-scroll-area` for sheet and destination scroll containers to contain overscroll.
- Reader selection popups sit above the dock (`z-[80]`); active sheet content sits above them (`z-[100]`).
- Portalled controls opened from reader sheets must render above the active sheet layer. For example, a `SelectContent` used inside `ReaderStylePanel` needs a z-index above `z-[100]`, such as `z-[120]`, because the shared select content portals to `document.body`.
- Shared portalled primitives that may be used from mobile sheets or dialogs (`DialogContent`, `DropdownMenuContent`, `PopoverContent`, and `SelectContent`) should default to a layer above active sheets, currently `z-[120]`. Do not raise one modal layer without checking nested portalled controls that open from inside it.
- Portalled popovers opened from inline mobile sheet content must also fit the visual viewport. Prefer Radix collision-aware vertical placement (`side="bottom"` with normal flip/shift behavior), `collisionPadding`, and viewport-clamped dimensions such as `w-[min(20rem,calc(100vw-2rem))]` plus `max-h-[min(<cap>,var(--radix-popover-content-available-height))]`. Avoid desktop sidebar assumptions such as forcing `side="left"` / `side="right"`, computing offsets from `#chat-sidebar`, or fixed `w-80` panels that can overflow a phone sheet.
- Mobile dialogs with fixed headers or footers must use a clipped scroll body, for example `mobile-scroll-area min-h-0 flex-1 overflow-y-auto`, and opaque fixed footer backgrounds such as `bg-background`. A transparent footer over a non-clipping scroll primitive can make textarea/source content bleed behind footer buttons on Android.

## Mobile AI Chat Contracts

- `MobileAiChat` is the Android AI surface for both the standalone AI destination and reader-scoped AI sheet.
- The standalone mobile AI destination must not render the desktop `ChatPage`/`Resizable` chrome directly. Keep the mobile surface as a `min-h-0 flex` column with a stable header, scrollable messages/empty state, and bottom input.
- Reader-scoped AI runs inside `MobileSheet` and must preserve the `MobileSheet z-[100]` stacking contract. Header controls must keep at least `44px` touch targets.
- Shared chat components must get their surface context from `ChatSurfaceProvider`, not from router paths such as `/chat`. The standalone AI destination uses `surface="standalone"`; reader-scoped AI uses `surface="reader"`.
- A newly opened or empty book-scoped chat must show a loading or empty state. It must not leave the message container blank while thread initialization completes.
- AI markdown annotation/citation popovers may be triggered from arbitrary inline text positions inside the standalone AI destination or reader-scoped AI sheet. Keep these popovers viewport-contained with collision padding, clamped width, and an internal scroll region instead of preserving old desktop side-chat left/right placement.
- Settings opened from mobile AI must appear above the AI sheet, and model/history popups must remain tappable without closing the sheet first.
- Do not show both the shell-level floating settings shortcut and the `MobileAiChat` header settings button on the standalone AI destination.

## Color Token Contracts

- Mobile shell colors live in `packages/app/src/index.css` as `--mobile-*` tokens.
- Every mobile surface token used for backgrounds and text must have a `.dark` override. Otherwise legacy child pages with `dark:text-*` classes can render light text on light mobile surfaces.
- Do not reuse `--mobile-ink` as a filled-control background. In dark mode `--mobile-ink` is the foreground text color. Use `--mobile-control-fill` with `--mobile-on-control` for reader docks, selected chips, and other filled Android controls.

## Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Safe-area insets are not ready | Android shell may render `null` until insets exist. |
| User changes destination | Close reader, close reader sheet, and hide reader chrome. |
| User opens a book from library | Set `activeBook`, open reader, close sheets, and hide reader chrome. |
| Reader single-click event fires | Toggle reader chrome without blocking foliate selection or gestures. |
| Reader tool opens | Keep chrome visible and show the matching sheet. |
| Reader chapter control is tapped | Use the mounted foliate renderer's adjacent-section navigation; first/last boundaries may no-op quietly. |
| Android/browser back fires with a sheet open | Close only the sheet. |
| Android/browser back fires with chrome visible | Hide chrome. |
| Android/browser back fires in reader with no sheet/chrome | Close reader. |
| Settings opens on phone | Use full-screen settings content. |
| Settings opens on tablet | Use bounded `800px` modal content. |

## Good / Base / Bad Cases

- Good: A 390x844 phone shows Library/Notes/AI/Stats bottom navigation, a single active reader, reachable reader chrome with chapter navigation/progress and dock tools, full-screen settings, and no bottom control overlap.
- Base: No book is open. The active destination fills the safe-area-aware mobile surface and bottom navigation remains reachable.
- Bad: Reintroducing desktop app tabs as the root, mounting duplicate settings dialogs, blocking foliate selection with a reader overlay, or placing popups below the reader dock.

## Tests Required

For Android shell changes, run at minimum:

```bash
pnpm --filter app build
```

When changing shell navigation breakpoint behavior, add or update focused `tsx --test` coverage for the class contract so `MobileBottomNav` cannot be visible at the same breakpoint as `TabletRail`.

Manual or device-emulated checks should cover:

- `390x844` phone portrait.
- `844x390` phone landscape.
- `800x1280` tablet portrait.
- `1280x800` tablet landscape.
- Library upload/search/tags/open-book workflows.
- Reader TOC/search/style/notes/AI sheets and text selection popups.
- AI annotation/citation popovers opened from markers near the left, right, top, and bottom viewport edges.
- Global AI chat and reader-scoped AI chat.
- Unified Notes filters and reader-scoped notes.
- Unified Notes model mapping with a focused `tsx --test` regression when display fields or supported note types change.
- Stats scroll behavior.
- Settings access for general, providers, models, TTS, and vector model settings.

## Wrong vs Correct

### Wrong: Restoring The Desktop Root

```tsx
// Wrong for Android shell work.
<ReaderLayout />
```

### Correct: Mount The Android Shell

```tsx
// Correct current root.
<AndroidAppShell />
```

### Wrong: Catching All Reader Taps

```tsx
// Wrong: blocks iframe/page/text interactions.
<div className="absolute inset-0" onClick={toggleReaderChrome} />
```

### Correct: Use Reader Events

```tsx
window.addEventListener("message", handleIframeSingleClick);
```

### Wrong: Desktop Side Placement Inside Mobile Sheets

```tsx
// Wrong: a fixed 20rem panel forced left/right can leave the phone viewport.
<PopoverContent side={isStandaloneChat ? "right" : "left"} sideOffset={sideOffset} className="w-80" />
```

### Correct: Viewport-Contained Mobile Popovers

```tsx
// Correct: Radix can flip/shift vertically, while width and height stay inside the viewport.
<PopoverContent
  side="bottom"
  align="center"
  sideOffset={8}
  collisionPadding={16}
  className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[min(20rem,calc(100vw-2rem))]"
/>
```

## Common Mistakes

- Treating deleted desktop `ReaderLayout` code or `app-tabs` as the current shell contract.
- Reintroducing route checks such as `location.pathname === "/chat"` for Android AI behavior.
- Adding a mobile sheet that contains placeholder content instead of existing reader tools.
- Forgetting to hide duplicate settings dialogs from reused pages embedded in the mobile shell.
- Letting bottom navigation cover chat inputs, settings rows, or sheet content.
- Using z-index values that put reader selection controls under the dock.
- Forgetting that portalled option lists/popovers opened from `MobileSheet` need to stack above the sheet, not at the shared primitive default `z-50`.
- Treating `MobileAiChat` as a desktop side-chat container. The same `#chat-sidebar` id appears in mobile surfaces, but popover placement must be based on the viewport and Radix collision data, not sidebar offset math.
- Moving long dialog body content into a scroll primitive without verifying clipping and footer opacity. If footer buttons are fixed at the bottom, the body must scroll in a clipping `overflow-y-auto` container and the footer must mask content behind it.
