# State Management

> How state is managed in `packages/app-tabs`.

---

## Overview

`app-tabs` is intentionally not a state management package. It renders a controlled tab array and reports DOM interactions to the caller. The consuming app owns persistence, active tab selection, tab creation, tab removal, and tab reorder effects.

The package only keeps transient bridge state that is required to synchronize React props with DOM elements and drag operations.

## State Categories

### Caller-Owned State

The app provides:

- `tabs: TabProperties[]`
- the active tab through each tab's `active` field
- callback effects such as `onTabActive`, `onTabClose`, and `onTabReorder`

Example caller-owned data in `packages/app/src/store/reader-store.ts`:

```ts
export interface TabInfo extends TabProperties {
  bookId: string;
}

interface ReaderStore {
  tabs: TabInfo[];
  activeTabId: string | null;
  addTab: (bookId: string, title?: string) => void;
  removeTab: (tabId: string) => void;
  activateTab: (tabId: string) => void;
}
```

### Package-Local Refs

Use refs for bridge state that should not cause React renders:

- `chromeTabsRef` stores the imperative controller instance.
- `tabsLatest` stores the latest controlled array for drag bookkeeping.
- `moveIndex` tracks drag origin and destination until `onDragEnd`.

```tsx
const moveIndex = useRef({ tabId: "", fromIndex: -1, toIndex: -1 });
```

### DOM State

The imperative controller stores current layout state on DOM elements and class/attribute flags:

- `.chrome-tab[active]`
- `is-small`, `is-smaller`, and `is-mini`
- `data-tab-id`
- transform and width styles for layout and scrolling

DOM state is derived from props or live pointer interaction. It must not become persisted business state.

## When to Use Global State

Never add global state inside `app-tabs`. If state must survive component unmounts, coordinate multiple readers, or persist between app launches, keep it in `packages/app` stores and pass the result down as props.

## Server State

There is no server state in this package. It has no React Query, no Tauri service calls, and no backend access. Any metadata needed for display must be resolved by the app before creating `TabProperties`.

## Derived State

Derived values should stay close to the code that consumes them:

- tab widths and positions are getters in `ChromeTabs`
- active tab DOM lookup is `activeTabEl`
- React previous prop comparison uses `usePrevious(tabs)`
- drag reorder origin/destination is collapsed into one `onTabReorder` callback after drag end

## Common Mistakes

- Adding a `useTabs` state hook because the README mentions one. That API does not exist in the current entrypoint.
- Persisting tab order in this package. The caller must handle `onTabReorder`.
- Treating `.chrome-tab[active]` as authoritative app state after React has passed a new `tabs` prop.
- Triggering React renders for every drag move. Drag state belongs in refs and DOM layout until the drag ends.
