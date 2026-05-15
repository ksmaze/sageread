# Quality Guidelines

> Code quality standards for `packages/app-tabs`.

---

## Overview

This package is strict TypeScript and DOM-heavy. The quality bar is preserving the controlled React contract while keeping the imperative chrome-tabs controller deterministic, cleanup-safe, and isolated from app state.

Run the package build after changes:

```bash
pnpm --filter app-tabs build
```

When the app integration is touched, also run:

```bash
pnpm --filter app build
```

## Forbidden Patterns

- Do not add app store imports, route imports, Tauri APIs, or data fetching to `packages/app-tabs`.
- Do not expose stale README APIs such as `useTabs` or `TabContainer` unless they are actually implemented and exported.
- Do not use `innerHTML` for tab titles or user-provided favicon classes.
- Do not create DOM listeners without paired cleanup in hooks or controller destruction paths.
- Do not make `chrome-tabs.ts` own persisted active tab or tab order state.
- Do not change `.chrome-tab*` class names without updating `src/css/*.css` and the DOM template together.

## Required Patterns

- Keep the package entrypoint as the public API source of truth.
- Keep React props controlled and optional callbacks defensive with `?.`.
- Use `textContent` for tab labels.
- Use `data-tab-id` as the bridge between DOM tab elements and app tab IDs.
- Preserve the `destroy()` lifecycle for window/document listeners and Draggabilly cleanup.
- Use strict TypeScript signatures for public props, listener types, and tab properties.

```ts
export interface TabProperties {
  id: string;
  title: string;
  active?: boolean;
  favicon?: boolean | string;
  faviconClass?: string;
  isCloseIconVisible?: boolean;
}
```

## Testing Requirements

There are no package-local tests today. For documentation-only or type-only edits, a TypeScript build is the minimum check. For behavior changes:

- run `pnpm --filter app-tabs build`
- run `pnpm --filter app build`
- manually verify tab activation, close, reorder, dark mode, and window drag region in the desktop shell when a UI runtime is available
- verify both draggable enabled and disabled modes if `draggable` behavior changes

## Code Review Checklist

- Public API changes are exported from `src/index.tsx` and reflected in this spec.
- `Tabs` still treats `tabs` as controlled caller-owned state.
- New event names are emitted by `chrome-tabs.ts`, subscribed in `useChromeTabs`, and exposed through typed listener props if public.
- Event listeners and Draggabilly instances are cleaned up.
- CSS selectors match the DOM template in `tabTemplate`.
- TypeScript build passes with `strict`, `noUnusedLocals`, and `noUnusedParameters`.

## Common Mistakes

- Ignoring `tsconfig.json` because the package is small. It has strict checks and declaration output.
- Leaving generic lint suppression comments. If a hook dependency rule is suppressed, document the specific bridge reason.
- Removing `stopImmediatePropagation()` from the close button click path and reintroducing close-then-activate behavior.
- Updating app-side ambient declarations without updating package exports.
