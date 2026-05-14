# Component Guidelines

> How components are built in `packages/app`.

---

## Overview

Components are dense desktop app surfaces, not marketing sections. The primary composition model is:

- desktop shell components under `components/`
- route and feature components under `pages/<feature>/`
- Radix/shadcn-style primitives under `components/ui/`
- stateful behavior extracted into hooks and Zustand stores

Prefer existing primitives and semantic theme tokens before introducing new wrappers or hard-coded visual styles.

## Component Structure

Use function components with typed props interfaces near the component. Keep feature-local types near the component unless they are shared across services, stores, or pages.

```tsx
interface BookItemProps {
  book: BookWithStatusAndUrls;
  viewMode?: "grid" | "list";
  onDelete?: (book: BookWithStatusAndUrls) => Promise<boolean>;
  onUpdate?: (bookId: string, updates: BookUpdateData) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
}

export default function BookItem({ book, onDelete, onUpdate, onRefresh }: BookItemProps) {
  // component state and handlers
}
```

Keep routed page `index.tsx` files thin enough to read the page shape. Move repeated or noisy sub-surfaces into `components/` under that feature.

## Props Conventions

- Use `interface` for component props.
- Event callbacks should describe the event domain: `onOpenChange`, `onBookUpdate`, `onRefresh`, `onTabChange`.
- Async callbacks should return `Promise` when callers depend on success/failure.
- Keep controlled component props explicit, for example `open` plus `onOpenChange`.

```tsx
interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

## Styling Patterns

- Use Tailwind classes with semantic tokens: `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border`, `shadow-around`.
- Merge reusable primitive classes with `cn` from `@/lib/utils`.
- Use `clsx` for local conditional classes where merge semantics are not needed.
- Keep desktop controls compact: common icon buttons use `size-7`, `size-8`, `size-9`, or `size-11`.
- Use `min-w-0` on flex children that contain long text, chat content, book titles, or reader content.

```tsx
<div className="relative min-w-0 flex-1 rounded-md border shadow-around">
  <ReaderViewer />
</div>
```

## UI Primitive Contracts

- Prefer `@/components/ui/*` primitives before adding new component systems.
- UI primitives follow Radix composition with `data-slot` markers and class-variance-authority variants where useful.
- `Button` defaults to `size="sm"`; pass an explicit size for toolbars or full forms.
- Input primitives disable browser writing assistance by default.

```tsx
<Button variant="soft" size="sm" onClick={handleCreate}>
  <Plus className="size-4" />
  New Skill
</Button>
```

## Desktop Surface Contracts

- `ReaderLayout` is the app shell. Components that need active reader tabs, home visibility, sidebars, settings, notifications, or window controls belong under that shell.
- Home/library pages render inside a bordered rounded frame next to a fixed `w-48` sidebar.
- Reader pages render as a center pane with optional resizable chat and notepad sidebars.
- Settings are a desktop modal, not a full-screen mobile route: keep the `800px` two-column contract.
- Library empty state is an import tool, not a landing page.

## Accessibility

- Use native buttons for clickable controls.
- Add `title` or tooltip text for icon-only controls when the action is not obvious.
- Preserve Radix dialog/dropdown behavior by using the existing primitives instead of hand-rolled overlays.
- Keep focus rings from primitives unless the local component has a documented replacement.
- For images, use meaningful `alt` text when the image carries content; decorative chat avatars may use empty `alt`.

## Common Mistakes

- Creating a new button/input/dialog style instead of extending existing `components/ui` primitives.
- Using hard-coded `bg-white text-black` surfaces that fail dark mode.
- Removing `min-w-0`, causing desktop panes to overflow.
- Making large hero/card layouts inside the desktop app shell.
- Treating `BookItem` list mode as implemented. The prop exists, but the current implementation renders card-first.
