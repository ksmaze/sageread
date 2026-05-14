# Quality Guidelines

> Code quality standards for frontend development in `packages/app`.

---

## Overview

Quality in this package means preserving the desktop reader workflow, keeping state boundaries clear, and using existing UI/service/store patterns. The app is not a generic website; changes should be verified against the shell, library, reader, side panels, settings, and dark mode when those surfaces are touched.

## Required Patterns

- Keep `ReaderLayout` as the mounted app shell.
- Use semantic theme tokens and existing UI primitives.
- Keep service calls behind `src/services/*`.
- Keep persistent cross-surface state in Zustand stores.
- Keep feature-only state and hooks inside the feature folder.
- Use `min-w-0` in flex panes with long or dynamic content.
- Clean up global event listeners, iframe listeners, Tauri listeners, observers, and timers.

```tsx
return () => {
  window.removeEventListener("resize", handleResize);
  if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
};
```

## Forbidden Patterns

### Do Not Mount Around `App.tsx`

`src/App.tsx` is still a Vite stub. The real app is `ReaderLayout`.

```tsx
// Wrong
createRoot(root).render(<App />);
```

### Do Not Create One-Off Theme Systems

```tsx
// Wrong
<div className="bg-white text-black dark:bg-black dark:text-white" />

// Correct
<div className="border bg-background text-foreground shadow-around" />
```

### Do Not Remount Reader Tabs on Visibility Changes

Reader tab panes switch with `visibility` and `zIndex` so tab state survives. Avoid route-only remounting for active reader tabs.

### Do Not Skip Live Renderer Updates

If a setting affects the foliate view, update persisted settings and the live renderer.

## Validation & Error Behavior

| Area | Required behavior |
|---|---|
| Upload unsupported files | Show an error toast/event and do not import. |
| Empty library | Show the import surface. |
| Search with no matches | Show a query-specific empty state. |
| Reader loading | Center a loading state in the reader pane. |
| Reader error | Center error text in red. |
| Missing reader data/config | Render `null`, do not mount foliate. |
| Sidebar resize | Show overlay during resize; dispatch `foliate-resize-update` on stop. |
| Invalid edit info form | Disable save and show invalid input styling. |
| Settings dialog | Keep the `800px` two-column desktop modal. |

## Testing Requirements

There is no dedicated frontend test script in `packages/app/package.json` today. For code changes, run at minimum:

```bash
pnpm --filter app build
```

For docs-only changes, verify the edited docs have no placeholders and links point to existing files.

When UI behavior changes, manually or with Playwright verify the relevant surfaces:

- desktop shell at about `1440x900`
- library empty, search, drag overlay, and grid card truncation
- reader open book, header/footer hover controls, chat/notepad toggles, sidebar resize
- `swapSidebars` behavior
- settings modal size and scroll behavior
- light and dark modes
- compact portrait reader width below `900px`

## Code Review Checklist

- Does the change preserve `ReaderLayout` shell ownership?
- Are existing primitives, hooks, stores, and services reused?
- Are long text and flex panes protected with `min-w-0`, truncation, or scrolling?
- Does dark mode use semantic tokens?
- Are global listeners cleaned up?
- Are persisted settings and live runtime state kept in sync?
- Are route/URL states preserved where users expect them, such as tag filters?
- Did the change avoid unrelated refactors?

## Common Mistakes

- Treating desktop-first responsive support as permission to redesign the desktop shell for mobile.
- Adding a new component abstraction when a feature-local component is enough.
- Duplicating service calls in components.
- Forgetting that `BookItem` list mode is not implemented even though the prop exists.
- Running only visual inspection for changes that affect TypeScript contracts or Tauri service calls.
