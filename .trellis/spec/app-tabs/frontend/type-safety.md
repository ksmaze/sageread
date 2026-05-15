# Type Safety

> Type safety patterns in `packages/app-tabs`.

---

## Overview

`app-tabs` is TypeScript with strict compiler settings and declaration output. Public types should describe the React-facing API, while DOM-controller internals can use localized assertions where browser APIs do not expose the needed specific element type.

## Type Organization

- Public component props live next to the component in `src/component.tsx`.
- Public tab shape lives in `src/chrome-tabs.ts` as `TabProperties` because the DOM controller consumes it directly.
- Event listener props live in `src/hooks/useChromeTabs.tsx` as `Listeners`.
- `src/types.ts` contains legacy unused types and is not exported by `src/index.tsx`; do not treat it as public API unless it is deliberately revived.
- Re-export public types from `src/index.tsx`.

```tsx
export type TabsProps = Listeners & {
  tabs: TabProperties[];
  className?: string;
  darkMode?: boolean;
  pinnedRight?: React.ReactNode;
  pinnedLeft?: React.ReactNode;
  draggable?: boolean;
  enableDragRegion?: boolean;
  marginLeft?: number;
};
```

## Validation

There is no runtime validation library in this package. The caller is expected to pass valid `TabProperties`.

Use defensive DOM checks where elements can be missing:

```tsx
const ele = ref.current?.querySelector(`[data-tab-id="${tabId}"]`) as HTMLDivElement;
if (ele) {
  chromeTabsRef.current?.updateTab(ele, { ...tab });
} else {
  chromeTabsRef.current?.addTab(tab);
}
```

## Common Patterns

### Generic Ref Helpers

`useLatest` and `usePersistFn` preserve argument and return types through generics:

```ts
export function useLatest<T>(data: T): { current: T } {
  const ref = useRef<T>(data);
  ref.current = data;
  return ref;
}

export function usePersistFn<T extends (...args: any[]) => any>(fn: T) {
  const latest = useLatest(fn);
  return useCallback((...args: Parameters<T>) => {
    return latest.current(...args);
  }, []) as T;
}
```

`usePersistFn` currently uses `any[]` to support arbitrary callback shapes; keep it contained to this generic helper.

### DOM Type Assertions

DOM queries often require assertions:

```ts
const tabEle = detail.tabEl as HTMLDivElement;
const tabId = tabEle.getAttribute("data-tab-id") as string;
```

Keep assertions close to DOM boundaries and convert immediately into typed values such as `tabId`.

### Wrapper Prop Drift

`ChromeTabsWrapper` and the `ChromeTabs` render function returned from `useChromeTabs` both need to accept the same wrapper props. When adding integration props such as `enableDragRegion` or `marginLeft`, update both prop types.

```tsx
const ChromeTabs = useCallback(function ChromeTabs(props: {
  className?: string;
  darkMode?: boolean;
  toolbar?: React.ReactNode;
  pinnedLeft?: React.ReactNode;
  enableDragRegion?: boolean;
  marginLeft?: number;
}) {
  return <ChromeTabsWrapper {...props} ref={ref} />;
}, []);
```

If this type drifts, `pnpm --filter app-tabs build` fails even though the app alias can still compile through Vite.

### Optional Callback Calls

Use optional chaining for listener calls:

```ts
listenersLest.current.onTabReorder?.(tabId, originIndex, destinationIndex);
```

## Forbidden Patterns

- Do not broaden public props to `any`.
- Do not export `ChromeTabs` internals as public API unless the app has a concrete consumer.
- Do not use app-side ambient declarations as a substitute for package types. `packages/app/src/global.d.ts` should not drift from `app-tabs` exports.
- Do not silently accept missing `id` or `title` on public tab objects; those fields are required.
- Do not put React types in `chrome-tabs.ts` unless the DOM controller is intentionally becoming React-aware.
