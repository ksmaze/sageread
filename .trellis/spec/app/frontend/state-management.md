# State Management

> How state is managed in `packages/app`.

---

## Overview

The app uses Zustand for client state, TanStack React Query for async/server-like data, URL search params for shareable route filters, and local component state for transient UI. Tauri-backed persisted state uses `tauriStorage` through Zustand persistence where applicable.

## State Categories

### Global App State

Use `src/store/*-store.ts` for state that crosses pages, shell components, or reader tabs.

- `layout-store.ts`: open reader tabs, active tab, home visibility, per-tab reader store map, chat/notepad visibility.
- `app-settings-store.ts`: persisted system settings and global reader settings.
- `theme-store.ts`: theme mode, dark mode, system UI flags, chat auto-scroll, sidebar swapping.
- `library-store.ts`: library data, search query, refresh functions.
- `mobile/shell/mobile-shell-store.ts`: Android presentation state for active destination, active book, reader open state, reader chrome, and active reader sheet.

### Feature Local State

Use component state for transient UI that does not need persistence or cross-component access:

- open/closed dialogs
- selected editor item
- hover/drag overlays
- temporary form fields
- active tab inside notepad

### URL State

Use URL search params when the state should survive navigation or be externally addressable:

```ts
const selectedTagFromUrl = searchParams.get("tag") || "all";
navigate(tagId === "all" ? "/" : `/?tag=${tagId}`);
```

### Server / Async State

Use React Query or service-backed stores for data loaded from Tauri/backend services. Keep backend calls inside `services/` modules.

## When to Use Global State

Promote state to a store only when one of these is true:

- the app shell and child pages both need it
- reader tabs must preserve it across visibility switches
- settings must persist across app restarts
- multiple features need one source of truth
- async data refresh should update multiple consumers

Do not promote purely local dialog or input state.

## Android Reader Shell Contract

The current Android shell uses `useMobileShellStore` for presentation state and supports one active reader book at a time.

- `activeDestination`: `"library" | "notes" | "ai" | "stats"`.
- `activeBook`: `{ id: string; title: string } | null`.
- `isReaderOpen`: whether the reader overlay is mounted.
- `isReaderChromeVisible`: whether the dock/chrome is visible.
- `activeReaderSheet`: `"toc" | "search" | "notes" | "ai" | "style" | null`.

Opening a book from Android library code should route through `useMobileShellStore.openBook`. If reusing legacy library components that call `useLayoutStore.openBook`, adapt that call at the mobile destination boundary instead of rewriting book cards.

```ts
useLayoutStore.setState({
  openBook: (bookId: string, title: string) => {
    openMobileBook({ id: bookId, title });
  },
});
```

`MobileReader` creates the existing per-book reader store with `createReaderStore(activeBook.id)` and provides it through `ReaderProvider`.

## Legacy Reader Layout Contract

Reader tabs are managed by `useLayoutStore`. Opening a book creates or activates a tab and creates a per-tab reader store keyed by `reader-${bookId}`.

```ts
openBook: (bookId: string, title: string) => {
  const tabId = `reader-${bookId}`;
  const existingTab = tabs.find((t) => t.id === tabId);
  if (existingTab) {
    activateTab(tabId);
    return;
  }

  if (!readerStores.has(tabId)) {
    readerStores.set(tabId, createReaderStore(bookId));
  }
}
```

Persist only serializable layout state. Recreate `readerStores` in the persisted store `merge` function.

## Reader Navigation Target Contract

### 1. Scope / Trigger

Use this contract when UI outside the mounted reader needs to open a book and then navigate to a precise foliate location, such as unified notes opening a source annotation.

### 2. Signatures

```ts
interface ReaderNavigationTarget {
  cfi: string;
  requestedAt: number;
  source?: "unified-notes";
}

useMobileShellStore.openBook(book: ActiveBookRef, navigationTarget?: ReaderNavigationTarget): void;
useLayoutStore.openBook(bookId: string, title: string, navigationTarget?: ReaderNavigationTarget): void;

readerStore.getState().requestNavigation(target: ReaderNavigationTarget): void;
readerStore.getState().clearNavigationTarget(target: ReaderNavigationTarget): void;
```

### 3. Contracts

- The navigation target carries only reader-local data. Mobile shell may attach `bookId` internally while handing the target to `MobileReader`.
- Callers pass `undefined` when they only need to open the book at the existing saved location.
- `ReaderViewer` must wait for the foliate view to be ready before calling `view.goTo(target.cfi)`.
- Clearing a completed target must only clear the same `{ cfi, requestedAt }` target so a newer request cannot be accidentally removed by an older effect.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Note has no `bookId` | Do not show an open-reader action. |
| Note has `bookId` but no `cfi` | Open the book without a navigation target. |
| Reader view is not ready | Keep the target pending in the reader store. |
| A newer target arrives before an older target clears | Keep the newer target. |
| `view.goTo(cfi)` throws | Log the failure and leave the reader mounted. |

### 5. Good/Base/Bad Cases

- Good: Unified notes opens a book with `{ cfi, requestedAt, source: "unified-notes" }`; the reader mounts, becomes ready, and then consumes the target.
- Base: Library opens a book without a target and resumes the saved location.
- Bad: Calling `view.goTo` directly from a notes page before the reader exists, or clearing `pendingNavigationTarget` without checking which request completed.

### 6. Tests Required

- `reader-navigation.test.ts` must cover stale-target clearing behavior.
- Unified note model tests must cover whether a display item can produce a reader target.
- Run `pnpm --filter app build` after signature changes to stores or reader hooks.

### 7. Wrong vs Correct

#### Wrong

```ts
openBook({ id, title });
view.goTo(cfi); // view may not exist yet
```

#### Correct

```ts
openBook({ id, title }, { cfi, requestedAt: Date.now(), source: "unified-notes" });
// ReaderViewer consumes the target after foliate initialization.
```

## Settings Contract

`useAppSettingsStore.settings` contains `globalReadSettings` and `globalViewSettings`. When reader settings change, update both persisted settings and the live foliate renderer when available.

```ts
setSettings({
  ...currentSettings,
  globalViewSettings: updatedSettings,
});
currentView?.renderer.setStyles?.(getStyles(updatedSettings));
```

`useThemeStore` owns the document `.dark` class and localStorage-backed theme preferences. Do not create component-local dark mode state.

## Server State

- Library refresh flows through `useLibraryStore.refreshBooks`.
- Book upload calls `uploadBook(file)` from `services/book-service` and refreshes the library after successful imports.
- Tags and book operations use feature hooks under `pages/library/hooks/`.
- Notes and annotations use dedicated hooks under `components/notepad/hooks/`.

## Common Mistakes

- Storing `Map`, class instances, or reader stores directly in persisted JSON without reconstructing them on merge.
- Using local component state for active book tabs instead of `useLayoutStore`.
- Duplicating selected tag state outside the URL.
- Updating theme classes manually instead of using `useThemeStore.setThemeMode`.
- Updating persisted reader settings without applying them to the current renderer.
