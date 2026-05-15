# Component Guidelines

> How components are built in `packages/app`.

---

## Overview

Components are dense Android mobile/tablet app surfaces, not marketing sections. The primary composition model is:

- Android shell components under `mobile/`
- legacy desktop shell components under `components/`
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
- Use `DropdownMenu` for command menus made of menu items. Use `Popover` for interactive panels that contain inputs, sliders, switches, or `Select` controls.
- Do not nest the shared `Select` inside `DropdownMenuContent`; `SelectContent` portals to the document body and can conflict with dropdown outside-interaction/focus behavior. Wrap the panel in `PopoverContent` instead.

```tsx
<Button variant="soft" size="sm" onClick={handleCreate}>
  <Plus className="size-4" />
  New Skill
</Button>
```

```tsx
// Correct: interactive settings panel with a Select.
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" />
  </PopoverTrigger>
  <PopoverContent align="end">
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">System</SelectItem>
      </SelectContent>
    </Select>
  </PopoverContent>
</Popover>
```

## Android Surface Contracts

- `AndroidAppShell` is the current app shell. Components that need Android destination state, active book, reader chrome, reader sheets, or mobile settings access belong under `src/mobile/`.
- Phone uses `MobileBottomNav`; tablet uses `TabletRail`.
- Destination pages render in `MobileSurface` and must account for bottom navigation and safe areas.
- Reader pages use a single active book, `ReaderToolDock`, and `MobileSheet` surfaces for TOC, search, notes, AI, and style.
- Settings are full-screen on phones and keep the bounded `800px` two-column modal from `sm` upward.
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
