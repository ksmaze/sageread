# Android Mobile Shell

> Current Android phone/tablet UI contracts for `packages/app`.

---

## Scope / Trigger

`packages/app` is currently Android mobile/tablet first. The active UI root is the Android shell, while the former desktop shell remains as legacy reference code unless it is imported again intentionally.

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

**Context**: The app is a Tauri reader targeting Android phone and tablet layouts. The previous desktop tab/sidebar shell does not fit the target interaction model.

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
- Phone navigation is `MobileBottomNav` with safe-area bottom padding.
- Tablet navigation is `TabletRail` from the `md` breakpoint upward.
- Shared destination frames use `MobileSurface`, which applies `mobile-paper`, safe-area horizontal padding, and mobile scroll containment.
- A floating `MobileSettingsEntry` opens global settings outside the reader overlay.

## Reader Contracts

- Android reader supports one active book at a time through `activeBook`.
- `LibraryDestination` adapts existing `useLayoutStore.openBook` calls into `useMobileShellStore.openBook` so existing library components can remain functional.
- `MobileReader` mounts `ReaderProvider` with `createReaderStore(activeBook.id)` and renders the existing `ReaderViewer`.
- `ReaderViewer` may hide desktop `HeaderBar` and `FooterBar` when `mobileChrome` is enabled, but it must keep reading-session visibility and foliate lifecycle behavior intact.
- Reader chrome toggles from foliate single-click events; do not add a transparent tap catcher over the reader because it blocks iframe text selection and page interaction.
- `ReaderToolDock` exposes TOC, search, notes, AI, and style tools.
- `ReaderSheetHost` renders real reader tool content in `MobileSheet`.
- Android/browser back should close the active reader sheet, then hide reader chrome, then close the reader.

## Unified Notes Contracts

- `mobile/notes/unified-note-model.ts` is the source of truth for mapping standalone `Note` records and `BookNote` records into display items.
- Keep type labels and filters in the shared model (`UNIFIED_NOTE_TYPE_LABELS`, `UNIFIED_NOTE_FILTERS`) instead of duplicating `"笔记"`, `"标注"`, `"摘录"`, or `"书签"` labels in page components.
- `UnifiedNotesPage` owns destination-level filter state and may be reused by `NotesDestination` and legacy `HomeLayout` `/notes`; do not create a second app-level notes page with separate mapping logic.
- Unified notes cards should expose enough content to identify the record: title, body preview, type label, source book/author when available, and updated time. Full content belongs in the detail dialog.
- Unified notes detail dialogs may offer `打开原文` / `打开书籍` for book-linked items. Use `getUnifiedNoteReaderTarget` plus the shared reader navigation target contract from `state-management.md`; do not call foliate `view.goTo` directly from the notes page.

## Settings Contract

- Settings are shared with the existing `SettingsDialog`.
- On phones, settings content is full-screen using `100dvh` and stacked navigation/content.
- From `sm` upward, settings keep the bounded `800px` modal and two-column layout.
- Pages embedded in the Android shell should not mount duplicate settings dialogs. Pass an opt-out prop when a legacy page already owns a settings dialog.

## Safe Area And Touch Contracts

- Use `pb-safe`, `pt-safe`, and `px-safe` for fixed Android controls.
- Interactive Android controls must be at least `--mobile-touch-target` (`44px`) in both dimensions, or be inside a larger fixed-height/wide grid cell.
- Use `mobile-scroll-area` for sheet and destination scroll containers to contain overscroll.
- Reader selection popups sit above the dock (`z-[80]`); active sheet content sits above them (`z-[100]`).
- Portalled controls opened from reader sheets must render above the active sheet layer. For example, a `SelectContent` used inside `ReaderStylePanel` needs a z-index above `z-[100]`, such as `z-[120]`, because the shared select content portals to `document.body`.

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
| Android/browser back fires with a sheet open | Close only the sheet. |
| Android/browser back fires with chrome visible | Hide chrome. |
| Android/browser back fires in reader with no sheet/chrome | Close reader. |
| Settings opens on phone | Use full-screen settings content. |
| Settings opens on tablet | Use bounded `800px` modal content. |

## Good / Base / Bad Cases

- Good: A 390x844 phone shows Library/Notes/AI/Stats bottom navigation, a single active reader, reachable reader dock tools, full-screen settings, and no bottom control overlap.
- Base: No book is open. The active destination fills the safe-area-aware mobile surface and bottom navigation remains reachable.
- Bad: Reintroducing desktop app tabs as the root, mounting duplicate settings dialogs, blocking foliate selection with a reader overlay, or placing popups below the reader dock.

## Tests Required

For Android shell changes, run at minimum:

```bash
pnpm --filter app build
```

Manual or device-emulated checks should cover:

- `390x844` phone portrait.
- `844x390` phone landscape.
- `800x1280` tablet portrait.
- `1280x800` tablet landscape.
- Library upload/search/tags/open-book workflows.
- Reader TOC/search/style/notes/AI sheets and text selection popups.
- Global AI chat and reader-scoped AI chat.
- Unified Notes filters and reader-scoped notes.
- Unified Notes model mapping with a focused `tsx --test` regression when display fields or supported note types change.
- Stats scroll behavior.
- Settings access for general, providers, models, fonts, TTS, and vector model settings.

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

## Common Mistakes

- Treating desktop `ReaderLayout` and app-tabs as the current shell contract.
- Adding a mobile sheet that contains placeholder content instead of existing reader tools.
- Forgetting to hide duplicate settings dialogs from legacy pages embedded in the mobile shell.
- Letting bottom navigation cover chat inputs, settings rows, or sheet content.
- Using z-index values that put reader selection controls under the dock.
- Forgetting that portalled option lists/popovers opened from `MobileSheet` need to stack above the sheet, not at the shared primitive default `z-50`.
