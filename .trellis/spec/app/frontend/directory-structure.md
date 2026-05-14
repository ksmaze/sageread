# Directory Structure

> How frontend code is organized in `packages/app`.

---

## Overview

`packages/app` is a Tauri + React desktop reader. The real UI entrypoint is `src/main.tsx`, which mounts `ReaderLayout`; `src/App.tsx` is still a Vite starter stub and must not be treated as the app shell.

The codebase is organized by app surface first, with shared primitives under `components/`, persisted state under `store/`, service boundaries under `services/`, and cross-cutting helpers under `hooks/`, `utils/`, and `types/`.

## Directory Layout

```text
packages/app/src/
+-- ai/                  # AI tools, providers, and message processing helpers
+-- assets/              # Bundled React assets
+-- components/          # Shared app components and UI primitives
|   +-- ui/              # Radix/shadcn-style primitives
|   +-- settings/        # Global settings dialog sections
|   +-- side-chat/       # Reader side assistant panel
|   +-- notepad/         # Reader notes/annotations side panel
|   +-- prompt-kit/      # Chat/prompt rendering primitives
|   +-- tools/           # Tool-result viewers such as RAG and mind maps
+-- constants/           # Static app constants
+-- helpers/             # Small cross-cutting helpers
+-- hooks/               # Shared React hooks
+-- lib/                 # App infrastructure wrappers
+-- pages/               # Routed top-level surfaces and feature-local modules
|   +-- library/
|   +-- reader/
|   +-- chat/
|   +-- skills/
|   +-- statistics/
+-- services/            # Tauri/backend-facing service APIs
+-- store/               # Zustand stores
+-- styles/              # Theme models
+-- themes/              # CSS token definitions
+-- types/               # Shared TypeScript domain types
+-- utils/               # Pure utilities and platform helpers
+-- index.css            # Tailwind v4, theme mapping, global app styles
+-- main.tsx             # Actual React entrypoint
```

## Module Organization

### App Shell

- `main.tsx` mounts `ReaderLayout` inside `QueryClientProvider` and `HashRouter`.
- `components/reader-layout.tsx` owns the desktop shell: top tab strip, home view, reader tabs, resizable sidebars, settings dialog, notifications, and native window controls.
- `components/home-layout.tsx` owns the home/library routed frame and fixed sidebar.
- `components/sidebar.tsx` owns primary navigation, library search, tag selection, and settings access.

### Feature Pages

Use `pages/<feature>/` for routed or reader-local feature surfaces. Put feature-only components and hooks under the page directory:

```text
pages/library/
+-- index.tsx
+-- components/
+-- hooks/

pages/reader/
+-- index.tsx
+-- components/
+-- hooks/
+-- store/
+-- utils/
```

Shared components graduate to `src/components/` only when they are used outside one feature.

### Shared UI

- Put reusable low-level UI primitives in `components/ui/`.
- Put domain-specific shared widgets in `components/<domain>/`, for example `components/side-chat/` and `components/notepad/`.
- Keep visual tokens in `index.css` and `themes/default.css`; do not create a second theme directory for a feature.

### Services, Stores, and Types

- `services/` wraps backend/Tauri operations and external service calls.
- `store/` holds app-wide Zustand stores such as layout, app settings, library, and theme state.
- Feature-local stores can live inside the feature, as `pages/reader/store/create-reader-store.ts` does for per-tab reader stores.
- `types/` contains shared domain types used across features and services.

## Naming Conventions

- Component files use kebab-case names: `reader-layout.tsx`, `settings-dialog.tsx`, `book-action-drawer.tsx`.
- Hooks use `use-*.ts` or feature-local `hooks/use-*.ts`.
- Stores use `*-store.ts`.
- Service wrappers use `*-service.ts`.
- Shared constants use descriptive kebab-case files such as `preset-models.ts` and `tauri-storage.ts`.
- Route page entry files are `index.tsx` inside the route folder.

## Examples

### Correct: feature-local hook stays with the feature

```text
pages/library/hooks/use-books-filter.ts
pages/library/hooks/use-books-operations.ts
pages/library/hooks/use-tags-management.ts
```

### Correct: shared shell component lives in `components/`

```text
components/reader-layout.tsx
components/home-layout.tsx
components/sidebar.tsx
```

### Wrong: mounting around the Vite stub

```tsx
// Wrong: App.tsx is not the real app shell.
createRoot(root).render(<App />);
```

### Correct: preserve the desktop shell

```tsx
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <ReaderLayout />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);
```

## Common Mistakes

- Adding new top-level folders before checking whether the feature belongs under `pages/<feature>/`, `components/<domain>/`, or `services/`.
- Moving reader-specific state out of `pages/reader/store/` without preserving per-tab store isolation.
- Treating `src/App.tsx` as active app architecture.
- Putting backend/Tauri calls directly inside leaf components when a `services/*-service.ts` wrapper already exists.
