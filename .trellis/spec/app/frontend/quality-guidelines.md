# Quality Guidelines

> Code quality standards for frontend development in `packages/app`.

---

## Overview

Quality in this package means preserving the Android phone/tablet reader workflow, keeping state boundaries clear, and using existing UI/service/store patterns. The app is not a generic website; changes should be verified against the shell, library, reader, sheets, settings, and dark mode when those surfaces are touched.

## Required Patterns

- Keep `AndroidAppShell` as the mounted app shell for the current Android build.
- Use semantic theme tokens and existing UI primitives.
- Keep service calls behind `src/services/*`.
- Keep persistent cross-surface state in Zustand stores.
- Keep feature-only state and hooks inside the feature folder.
- Use `min-w-0` in flex panes with long or dynamic content.
- Clean up global event listeners, iframe listeners, Tauri listeners, observers, and timers.
- Copy runtime asset trees explicitly in `vite.config.ts` when a bundled library fetches files by computed URL at runtime.

```tsx
return () => {
  window.removeEventListener("resize", handleResize);
  if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
};
```

## Forbidden Patterns

### Do Not Reintroduce a Starter App Wrapper

`src/main.tsx` mounts `AndroidAppShell` directly. `src/App.tsx` and the Vite starter assets have been removed; do not recreate them as an app root.

```tsx
// Wrong
createRoot(root).render(<App />);
```

### Do Not Reintroduce Desktop App Tabs As Root

```tsx
// Wrong for the current Android build
createRoot(root).render(<ReaderLayout />);
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
| Settings dialog | Use full-screen content on phones and the bounded `800px` two-column modal from `sm` upward. |
| Runtime library asset trees | Production build copies required runtime directories and keeps emitted URLs resolvable under Tauri static assets. |

## Testing Requirements

There is no dedicated frontend test script in `packages/app/package.json` today. For code changes, run at minimum:

```bash
pnpm --filter app build
```

When bundler/runtime asset wiring changes, also run the focused build-output regression:

```bash
pnpm --filter app exec tsx --test src/lib/pdf-assets.test.ts
```

For docs-only changes, verify the edited docs have no placeholders and links point to existing files.

When UI behavior changes, manually or with device emulation verify the relevant Android surfaces:

- `390x844` phone portrait
- `844x390` phone landscape
- `800x1280` tablet portrait
- `1280x800` tablet landscape
- library empty, upload, search, tag filters, and grid card truncation
- reader open book, dock tools, sheets, text selection popups, and Android back behavior
- notes, AI, stats, settings size, and scroll behavior
- light and dark modes

## Code Review Checklist

- Does the change preserve `AndroidAppShell` shell ownership?
- Are existing primitives, hooks, stores, and services reused?
- Are long text and flex panes protected with `min-w-0`, truncation, or scrolling?
- Does dark mode use semantic tokens?
- Are global listeners cleaned up?
- Are persisted settings and live runtime state kept in sync?
- If a dependency fetches runtime assets by URL, does the production build copy and test those assets?
- Are route/URL states preserved where users expect them, such as tag filters?
- Did the change avoid unrelated refactors?

## Common Mistakes

- Treating deleted desktop shell code or `app-tabs` as the current app root.
- Adding a new component abstraction when a feature-local component is enough.
- Duplicating service calls in components.
- Forgetting that `BookItem` list mode is not implemented even though the prop exists.
- Running only visual inspection for changes that affect TypeScript contracts or Tauri service calls.
