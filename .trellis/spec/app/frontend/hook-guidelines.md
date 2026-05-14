# Hook Guidelines

> How hooks are used in `packages/app`.

---

## Overview

Hooks isolate browser, Tauri, store, data-fetching, and reader-runtime behavior from components. Components should read like UI composition; hooks should own event listeners, persistence sync, fetch lifecycles, and imperative viewer integration.

## Custom Hook Patterns

- Shared hooks live in `src/hooks/`.
- Feature-specific hooks live under `pages/<feature>/hooks/`.
- Reader foliate integration is grouped under `pages/reader/hooks/use-foliate-viewer/`.
- Hooks that register global listeners must clean them up in the effect return.
- Hooks that use refs for one-time initialization should guard repeat calls explicitly.

```tsx
useEffect(() => {
  const handleResize = () => updateSafeAreaInsets();
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, [updateSafeAreaInsets]);
```

## Data Fetching

- Use React Query for server-like async lists and pagination.
- Use services from `src/services/` as the IO boundary.
- Keep refresh callbacks in stores or feature hooks when multiple components need the same data.
- Reader session tracking uses `useReadingSession(bookId, { saveInterval, isVisible })` and must be visibility-aware so inactive tabs do not keep recording active reading time.

## Event and Platform Hooks

- `useBookUpload` owns drag/drop, hidden file input selection, supported extension validation, import state, and refresh after upload.
- `useSafeAreaInsets` reads CSS safe-area custom properties and returns `null` until it has attempted an update. Home/library surfaces may wait for it; reader content falls back to zero insets.
- `useResponsiveSize(baseSize)` uses desktop as the base and scales phones/tablets by `1.25`.
- Reader hooks that integrate with foliate must dispatch or listen to explicit events such as `foliate-resize-update` when layout changes affect rendering.

```ts
window.dispatchEvent(
  new CustomEvent("foliate-resize-update", {
    detail: { bookId, source: "resize-drag" },
  }),
);
```

## Reader Hook Contracts

- `useBookShortcuts` owns keyboard shortcuts and must apply changes to both persisted settings and the live viewer.
- `useAutoHideControls` owns hover/interaction visibility for reader header/footer controls; do not replace it with local timers in each bar.
- `useFoliateViewer` and its manager own imperative foliate setup, style application, progress updates, and iframe event handling.
- `usePagination` owns click, wheel, and key pagination behavior. Respect `globalViewSettings.scrolled`, `disableClick`, `swapClickArea`, and `volumeKeysToFlip`.

## Naming Conventions

- Hook names must start with `use`.
- Feature hooks should include the feature noun when exported outside their folder, for example `useBookUpload`, `useReadingSession`, `useChatState`.
- Hooks returning event handlers should use `handle*` names for callbacks and expose state with clear booleans such as `isUploading`, `isDragOver`, `hasNextPage`.

## Common Mistakes

- Registering `window`, `document`, Tauri, or iframe listeners without cleanup.
- Updating app settings in a hook but forgetting to update the live foliate renderer.
- Letting inactive reader tabs continue session timers or subscriptions.
- Duplicating upload/search/tag logic in components instead of using existing library hooks and stores.
- Treating safe-area insets as always available on first render.
