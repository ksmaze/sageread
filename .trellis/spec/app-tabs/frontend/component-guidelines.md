# Component Guidelines

> How components are built in `packages/app-tabs`.

---

## Overview

`app-tabs` has one public React component: `Tabs`. It renders the `ChromeTabs` wrapper returned by `useChromeTabs`, then keeps the imperative DOM controller synchronized with the controlled `tabs` prop.

Do not add app-specific tab state here. The desktop app owns tab data in its stores; this package only renders and reports tab actions.

## Component Structure

Use a function component with an exported props type near the component. The existing structure in `src/component.tsx` is the pattern:

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

export function Tabs({ tabs, darkMode, onTabActive, onTabClose }: TabsProps) {
  // bridge controlled props to the imperative ChromeTabs controller
}
```

Keep the top-level component thin:

- derive refs and stable callbacks
- create the `useChromeTabs` bridge
- synchronize DOM tab elements from the `tabs` prop
- render the `ChromeTabs` root

Move low-level DOM mutations, layout calculations, and drag behavior into `chrome-tabs.ts`.

## Props Conventions

- `tabs` is a controlled array of `TabProperties`.
- Listener props come from the shared `Listeners` type in `hooks/useChromeTabs.tsx`.
- Use optional callbacks for app events: `onTabActive`, `onTabClose`, `onTabReorder`, `onDragBegin`, `onDragEnd`, `onContextMenu`.
- Use `React.ReactNode` for pinned toolbar regions.
- Keep window-drag integration explicit with `enableDragRegion`; this maps to the Tauri `data-tauri-drag-region` attribute.
- Keep platform spacing explicit with `marginLeft`; the app passes `0` on Windows and `60` on macOS-like titlebars.

```tsx
const dragRegionProps = props.enableDragRegion ? { "data-tauri-drag-region": true } : {};
const marginLeft = props.marginLeft ?? 60;
```

## Controlled DOM Synchronization

`Tabs` compares the current `tabs` prop with the previous prop via `lodash.isequal`. When the array changes, it removes excess DOM tabs, updates or adds each tab by index, and then applies the active tab.

```tsx
if (!isEqual(beforeTabs, tabs)) {
  const retainTabs = beforeTabs.slice(tabs.length);
  retainTabs.forEach((tab) => removeTab(tab.id));

  tabs.forEach((tab, index) => {
    updateTabByIndex(index, tab);
  });

  tabs.forEach((tab) => {
    if (tab.active) activeTab(tab.id);
  });
}
```

Preserve this controlled model. Do not let `chrome-tabs.ts` become the source of truth for application tab order or active tab state.

## Styling Patterns

- Use the package CSS files; do not style tab internals with Tailwind in React components.
- Apply theme by toggling the `chrome-tabs-dark-theme` class through the `darkMode` prop.
- Root layout styles are inline only for integration values that are dynamic at runtime: flex behavior, z-index, margin left, and the `--tab-content-margin` custom property.
- Preserve `minWidth: 0` on `.chrome-tabs-content` so long titles do not push pinned toolbar regions out of the desktop shell.

## Accessibility

Current tabs are pointer-driven DOM elements, not ARIA tabs. When changing tab behavior:

- keep close controls as clickable elements with a stable hit target
- preserve title text with `textContent`, not `innerHTML`
- avoid adding keyboard shortcuts inside `app-tabs`; global shortcuts live in the app shell
- avoid swallowing context menu events without forwarding `onContextMenu`

If keyboard navigation or ARIA roles are added later, add them as a deliberate feature across `chrome-tabs.ts`, `useChromeTabs`, and this spec.

## Common Mistakes

- Adding local React state for active tabs in `Tabs`; the app store already owns active state.
- Updating tabs by `id` only during reconciliation. The current layout uses order-sensitive DOM children, so `updateTabByIndex` is part of the contract.
- Mutating the caller's `tabs` array outside drag-reorder bookkeeping. `handleTabReorder` currently mutates `tabsLatest.current` only to track drag movement before notifying the app.
- Using `dangerouslySetInnerHTML` for tab titles. Use `textContent` as `chrome-tabs.ts` does.
