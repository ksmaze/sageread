# Hook Guidelines

> How hooks are used in `packages/app-tabs`.

---

## Overview

Hooks in this package exist to bridge React to an imperative DOM tab controller. They should keep callback identities stable, hold current values in refs, and clean up DOM listeners when components unmount.

There is no data fetching hook in this package.

## Custom Hook Patterns

### `useChromeTabs`

`useChromeTabs` is the main bridge hook. It:

- owns the root `HTMLDivElement` ref
- creates and destroys `ChromeTabsClz` once
- updates draggable behavior when `options.draggable` changes
- maps custom DOM events to typed listener callbacks
- returns stable imperative methods plus a `ChromeTabs` render function

```tsx
const chromeTabs = new ChromeTabsClz(options);
chromeTabsRef.current = chromeTabs;
chromeTabs.init(ref.current as HTMLDivElement);
return () => {
  chromeTabs.destroy();
};
```

When adding a new tab event, follow the existing pattern:

```tsx
useEffect(() => {
  const ele = chromeTabsRef.current?.el;
  const listener = ({ detail }: any) => {
    const tabEle = detail.tabEl as HTMLDivElement;
    const tabId = tabEle.getAttribute("data-tab-id") as string;
    listenersLest.current.onTabClose?.(tabId);
  };
  ele?.addEventListener("tabClose", listener);
  return () => {
    ele?.removeEventListener("tabClose", listener);
  };
}, []);
```

### Stable Callback Helpers

- `useLatest<T>(data)` returns a mutable ref whose `.current` is refreshed every render.
- `usePersistFn(fn)` returns a stable callback that delegates to the latest function ref.
- `usePrevious(state)` captures the previous render's value after effects run.

Use these helpers instead of adding frequently changing listener props to DOM subscription dependency arrays.

## Data Fetching

`app-tabs` must not fetch data. It receives all tab data from the consuming app through props. If a feature needs book metadata, favicons, or persisted tab state, fetch it in `packages/app` and pass a `TabProperties[]` value into `Tabs`.

## Naming Conventions

- Hook filenames and exported functions use `use*`.
- Hooks that are part of the package API must be exported from `src/index.tsx`.
- Internal bridge helpers stay under `src/hooks/`.
- Keep hook names behavior-oriented: `useLatest`, `usePersistFn`, `usePrevious`, `useChromeTabs`.

## Effect Dependency Rules

The hook intentionally suppresses exhaustive dependency linting in places where DOM subscriptions must be installed once and read current listeners through `useLatest`.

```tsx
// biome-ignore lint/correctness/useExhaustiveDependencies: stable DOM subscription; listener ref supplies current callbacks
useEffect(() => {
  // add/remove DOM event listener
}, []);
```

If you add a suppression, replace generic placeholder text with a concrete reason. Do not add props directly to those dependency arrays unless you also rework event removal and controller lifecycle.

## Common Mistakes

- Recreating `ChromeTabsClz` when listener props change. Use `useLatest` for listeners.
- Forgetting to remove a DOM listener in the effect cleanup.
- Calling `chromeTabsRef.current` methods before `init` has assigned `el`.
- Adding fetch, store, or router logic to hooks in this package.
- Exporting every helper hook publicly. Only expose hooks meant for app consumers.
