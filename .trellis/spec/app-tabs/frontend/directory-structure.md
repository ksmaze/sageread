# Directory Structure

> How frontend code is organized in `packages/app-tabs`.

---

## Overview

`packages/app-tabs` is a private React package that exposes the tab strip used by the desktop app shell. It is not a general tab state library despite the stale README text; the real public API is `Tabs`, `useChromeTabs`, `TabsProps`, and `TabProperties` exported from `src/index.tsx`.

The package is organized around one public React wrapper, one imperative DOM controller, a few React hooks that make the bridge stable, and global CSS copied into consumers by importing the package entrypoint.

## Directory Layout

```text
packages/app-tabs/
+-- package.json          # Private workspace package; React peer dependency
+-- tsconfig.json         # Strict TypeScript build to dist/
+-- README.md             # Stale; do not treat as API truth
+-- src/
    +-- index.tsx         # Public entrypoint and CSS imports
    +-- component.tsx     # Public <Tabs /> controlled React component
    +-- chrome-tabs.ts    # Imperative DOM layout/drag controller
    +-- types.ts          # Legacy tab types; not exported from the package entry
    +-- hooks/
    |   +-- useChromeTabs.tsx
    |   +-- useLatest.ts
    |   +-- usePersistFn.ts
    |   +-- usePrevious.ts
    +-- utils/
    |   +-- util.ts
    +-- css/
        +-- app-tabs.css
        +-- app-tabs-dark.css
```

## Module Organization

### Public API

- Add new exports only through `src/index.tsx`.
- Keep the CSS imports in `src/index.tsx`; consumers rely on importing `app-tabs` once and receiving both the light and dark tab styles.
- Prefer extending `TabsProps` in `src/component.tsx` when app-facing behavior changes.
- Export reusable types from their implementation source only when they are part of the package contract.

```tsx
import "./css/app-tabs.css";
import "./css/app-tabs-dark.css";

export { useChromeTabs } from "./hooks/useChromeTabs";
export { Tabs } from "./component";
export type { TabsProps } from "./component";
export type { TabProperties } from "./chrome-tabs";
```

### React Bridge

- `component.tsx` owns the controlled React API and compares incoming tab arrays against previous values.
- `hooks/useChromeTabs.tsx` owns the lifecycle of `ChromeTabsClz`, DOM event subscriptions, and imperative methods such as `activeTab`, `removeTab`, and `updateTabByIndex`.
- Keep React-only concerns out of `chrome-tabs.ts`; that file should stay a DOM controller.

### Imperative DOM Controller

- `chrome-tabs.ts` owns tab element creation, layout calculation, dragging, scroll translation, and custom event emission.
- Constants for tab dimensions and overlap live at the top of `chrome-tabs.ts`.
- DOM event names are plain strings such as `tabClick`, `tabClose`, `tabReorder`, `dragStart`, and `dragEnd`; if a new event is added, wire it through `useChromeTabs` before exposing it to `Tabs`.

### Styling

- Keep package CSS under `src/css/`.
- `app-tabs.css` contains the base chrome-tab layout.
- `app-tabs-dark.css` is activated by adding `chrome-tabs-dark-theme` to the root tab element.
- Use CSS custom properties or existing `.chrome-tabs*` selectors rather than app-level Tailwind classes inside this package.

## Naming Conventions

- Public React components use PascalCase in code and live in descriptive files such as `component.tsx`.
- Hooks use `use*.ts` or `use*.tsx`.
- Utility files are plain lower-case names under `utils/`.
- The DOM controller remains `chrome-tabs.ts` because its class and CSS selectors match the original chrome-tabs naming.
- CSS class names use the `chrome-tabs` / `chrome-tab` prefix. Do not introduce unrelated prefixes for tab internals.

## Examples

### Correct: app shell imports the public component

```tsx
import { Tabs } from "app-tabs";

<Tabs
  tabs={tabs}
  onTabActive={activateTab}
  onTabClose={removeTab}
  draggable={true}
  darkMode={isDarkMode}
  enableDragRegion={true}
  marginLeft={isWindows ? 0 : 60}
/>;
```

Real use: `packages/app/src/components/reader-layout.tsx`.

### Correct: tab properties flow through the shared type

```ts
import type { TabProperties } from "app-tabs";

export interface TabInfo extends TabProperties {
  bookId: string;
}
```

Real use: `packages/app/src/store/reader-store.ts`.

### Wrong: following the stale README API

```tsx
// Wrong: these symbols are not exported by src/index.tsx.
import { useTabs, TabContainer } from "app-tabs";
```

## Common Mistakes

- Treating `README.md` as current API documentation. The current export list is `src/index.tsx`.
- Adding app shell layout logic directly to `chrome-tabs.ts` instead of passing it through `TabsProps`.
- Editing CSS selectors without checking the DOM template in `chrome-tabs.ts`.
- Adding a hook that reaches into the app store; this package must stay app-state agnostic.
