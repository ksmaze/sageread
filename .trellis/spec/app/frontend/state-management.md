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

## Reader Layout Contract

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
