# Legacy Desktop App Design

> Legacy desktop-first UI contracts for `packages/app`.

---

## Scope / Trigger

This document captures the former desktop app design. It remains useful when maintaining legacy desktop shell files, but the current mounted shell is documented in [Android Mobile Shell](./android-mobile-shell.md).

Primary sources:

- `packages/app/src/main.tsx`
- `packages/app/src/components/reader-layout.tsx`
- `packages/app/src/components/home-layout.tsx`
- `packages/app/src/components/sidebar.tsx`
- `packages/app/src/pages/library/**`
- `packages/app/src/pages/reader/**`
- `packages/app/src/components/notepad/**`
- `packages/app/src/components/side-chat/**`
- `packages/app/src/components/settings/**`
- `packages/app/src/index.css`
- `packages/app/src/themes/default.css`
- `packages/app/src/components/ui/**`

## Design Decision: Desktop Reading Workspace First

**Context**: The app is a Tauri desktop reader with a library, multi-tab reader, notes, and AI chat. The productive desktop surface is the primary design target.

**Decision**: The app is mounted through `ReaderLayout`, not `App.tsx`. `ReaderLayout` owns the top tab strip, home view, reader tabs, resizable side panels, settings dialog, notifications, and native window controls.

**Why**: This keeps book tabs and the home/library surface in one persistent workspace. Reader stores are tied to tab IDs, so remounting or bypassing the layout can lose reader state.

```tsx
// Correct entry shape in packages/app/src/main.tsx
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <ReaderLayout />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);
```

## Layout Contracts

### App Shell

- Root shell: `ReaderLayout` uses `flex h-screen flex-col bg-muted`.
- Tab bar: use `app-tabs` with `className="h-7"`, `draggable={true}`, and `enableDragRegion={true}`.
- Home affordance: the pinned left tab item is a `HomeIcon`; clicking it must call `navigateToHome`.
- Native controls: `WindowControls` render only on Windows. Non-Windows keeps a left tab margin of `60`, Windows uses `0`.
- Main surface: `main` is `relative flex-1 overflow-hidden rounded-md`. Home and reader tab contents are absolute siblings that switch with `visibility` and `zIndex`, not route-only remounting.

### Home / Library Shell

- Home layout wrapper: `flex h-dvh w-full rounded-xl bg-transparent p-1 py-0`.
- Inner desktop frame: `flex h-[calc(100vh-40px)] w-full rounded-xl border bg-background shadow-around`.
- Sidebar: fixed `w-48`, full-height, select-none, vertically scrollable navigation.
- Content frame: `h-full flex-1 overflow-hidden p-1`; routed page surfaces use rounded frames and `shadow-around`.
- Library search belongs in the sidebar. Search updates `useLibraryStore.searchQuery` and navigates to `/` when the user searches from another route.
- Tags are URL state: selected tag is `?tag=<id>`, with `"all"` as the default.

### Reader Workspace

- Reader tab content: `absolute inset-0 flex bg-background p-1`.
- Center reader pane: `relative min-w-0 flex-1 rounded-md border shadow-around`.
- Reader panel has `HeaderBar`, foliate content, `FooterBar`, and `Annotator` in a full-height column.
- Header and footer controls are hover/interaction surfaces. They can fade to opacity 0, but they still reserve `h-11` each so reader content insets remain stable.
- Sidebars are optional and resizable:
  - Chat default width: `370`, min `190`, max `580`.
  - Notepad default width: `300`, min `200`, max `500`.
  - Compact portrait reader layout is `viewport.width < 900 && height > width`.
  - Compact chat width: `max(150, floor(width * 0.42))`, min `140`, max `max(180, floor(width * 0.55))`.
  - Compact notepad width: `max(150, floor(width * 0.4))`, min `140`, max `max(180, floor(width * 0.5))`.
- `swapSidebars` from `useThemeStore` swaps chat/notepad placement and resize handles.
- During window or panel resize, show an absolute overlay over the reader pane. On resize stop, dispatch:

```ts
window.dispatchEvent(
  new CustomEvent("foliate-resize-update", {
    detail: { bookId: tab.bookId, source: "resize-drag" },
  }),
);
```

### Legacy Settings Dialog

- Global settings were a desktop modal with a fixed two-column layout.
- `SettingsDialog` content must stay `min-w-[800px] max-w-[800px] min-h-[80vh] max-h-[80vh]`.
- The left settings nav is `w-48`; right content is scrollable and owns its page-specific layout.

## Component Contracts

### UI Library

- Prefer existing `@/components/ui/*` primitives before adding a new component wrapper.
- UI primitives follow Radix/shadcn-style composition and merge classes with `cn`.
- Buttons default to `size="sm"` in `Button`; choose explicit `size` when a control needs desktop toolbar density.
- Use `lucide-react` icons for app controls unless the current surface already uses another icon family, such as reader sidebar collapse icons from `react-icons/tb`.
- Input fields disable browser writing assistance by default: `spellCheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`.

```tsx
// Button variant contract
<Button variant="soft" size="sm">
  <Plus className="size-4" />
  New Skill
</Button>
```

### Visual Tokens

- Use Tailwind v4 tokens from `index.css` and `themes/default.css`: `bg-background`, `bg-muted`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, and related semantic tokens.
- Dark mode is the `.dark` class on `document.documentElement`; do not create component-local theme systems.
- Use `shadow-around` for the app's subtle framed surfaces.
- Keep toolbar controls compact: common icon buttons are `size-7`, `size-8`, `size-9`, or `size-11` depending on surface.
- Custom scrollbars are global. Avoid introducing per-component scrollbar styles unless the surface intentionally hides or virtualizes scroll.

### Library Cards

- Library grid uses responsive columns: `grid-cols-2`, then `xs:3`, `sm:4`, `lg:5`, `xl:6`, `2xl:7`, `3xl:8`.
- `BookItem` is currently card-first. Although it accepts `viewMode?: "grid" | "list"`, the implementation does not render a separate list layout. Do not depend on list mode until it is implemented.
- Book cards use:
  - title above cover, truncated
  - cover area `aspect-[4/5]`
  - bottom metadata row height `h-7` or `sm:h-8`
  - More menu as a bottom drawer
  - long press on touch to open the same action drawer
- Empty library state is an import surface, not a marketing page. It uses drag/drop, a file input, an import button, and the `reading-expert.png` asset on `sm` and above.

### Reader Controls

- Reader toolbar controls should be icon-first and small.
- TOC dropdown uses `w-[min(20rem,calc(100vw-1rem))]` and `max-h-[calc(100vh-8rem)]`.
- TOC rows virtualize when flattened items exceed `256`; desktop row size is `37`, small/translation row size is `57`.
- Reader settings dropdown is `w-80` and updates both persisted `globalViewSettings` and the live foliate renderer styles.
- Do not add reader settings that only update store state; live renderer state must also be updated when the current view exists.

### Chat / Notepad Panels

- Side chat is a narrow assistant panel, not a full chat page. Header controls are compact `size-7` icon buttons.
- Reader chat quick actions use compact `Button variant="soft"` controls.
- Notepad is tabbed between `"notes"` and `"annotations"` with pill tabs and a compact `h-10` header.
- Long-running note lists and TOCs should scroll inside their panel, not the whole reader shell.

## Responsive Contract

Desktop is the base contract. Responsive behavior exists to avoid broken layouts, not to redesign the app mobile-first.

- Use `min-w-0` on flex children that contain reader content, chat messages, book titles, or page titles.
- Preserve the desktop shell on wide screens. Do not replace the tab strip or fixed library sidebar with mobile navigation for desktop breakpoints.
- Compact reader side panel math applies only when `width < 900` and portrait.
- `useResponsiveSize(baseSize)` increases sizes by `1.25` for phones and tablets (`<= 1024px`) while keeping desktop as the base size.
- Safe-area insets are read from CSS custom properties and applied to reader content insets. Keep `useSafeAreaInsets` null checks.

## Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Safe-area insets are not ready | Home/library may render `null` until insets exist; the reader pane falls back to zero insets. |
| Library has not finished initial refresh | Home/library may render `null`; avoid partial empty-state flicker. |
| Dragged files contain no supported extension | Show an error toast/event; do not create partial book UI. |
| Library is empty | Show the import surface. |
| Search has no matches but library has books | Show the search empty state with the query. |
| Reader book is loading | Center a loading message/spinner in the reader pane. |
| Reader book load errors | Center the error text in red. |
| Reader book data or config is missing | Render `null`; do not mount foliate without config. |
| Sidebar resize is in progress | Cover the reader pane with the resize overlay. |
| Sidebar resize stops | Hide overlay and dispatch `foliate-resize-update`. |
| Edit book title or author is empty | Disable save and show invalid input styling. |
| Settings dialog opens | Keep the desktop two-column `800px` modal contract. |

## Good / Base / Bad Cases

- Good: A 1440x900 desktop reader with tab strip, active reader tab, chat visible at about `370px`, notepad hidden by default, centered reader pane, hover-visible header/footer controls, and no layout jump when controls fade.
- Base: No reader tabs open. The home surface is visible, the fixed `w-48` sidebar is present, library refresh completes, and an empty library shows the import surface.
- Bad for legacy desktop maintenance: new pages mounted outside `ReaderLayout`, reader panes remounted on tab switches, sidebars without `minWidth`/`maxWidth`, search local to one page instead of `useLibraryStore`, or desktop settings converted to a full-screen mobile sheet.

## Tests Required

When changing these surfaces, add or run checks appropriate to the touched area:

- Desktop shell visual check at about `1440x900`: tab strip, home button, content frame, and window controls on Windows.
- Reader layout check: open a book, toggle chat/notepad, toggle `swapSidebars`, resize panels, and assert `foliate-resize-update` fires on resize stop.
- Library check: empty state, upload drag overlay, search empty state, tag URL selection, and grid card truncation.
- Settings check: dialog keeps `800px` width, two-column layout, scrollable right pane, and dark mode tokens.
- Compact check at portrait width below `900px`: side panels use percentage widths and do not collapse the reader pane below usable width.
- Theme check: light and dark modes use semantic tokens and do not introduce hard-coded unreadable foreground/background pairs.

## Wrong vs Correct

### Wrong: Mounting Feature UI Around `App.tsx`

```tsx
// Wrong: App.tsx is a Vite stub and is not the real app shell.
createRoot(root).render(<App />);
```

### Correct: Preserve `ReaderLayout`

```tsx
// Correct: ReaderLayout owns tabs, home, reader panes, settings, and shell state.
createRoot(root).render(
  <HashRouter>
    <ReaderLayout />
  </HashRouter>,
);
```

### Wrong: Local Reader Tabs

```tsx
// Wrong: Local tab state cannot recreate reader stores or home visibility.
const [activeBookId, setActiveBookId] = useState<string | null>(null);
```

### Correct: Use Layout Store

```tsx
// Correct: openBook creates or activates a tab and its per-tab reader store.
const { openBook } = useLayoutStore();
openBook(book.id, book.title);
```

### Wrong: One-off Visual Tokens

```tsx
// Wrong: Hard-coded surface colors drift from dark mode and theme tokens.
<div className="rounded-xl bg-white text-black shadow-lg" />
```

### Correct: Semantic App Tokens

```tsx
// Correct: Uses existing theme tokens and app shadow.
<div className="rounded-xl border bg-background text-foreground shadow-around" />
```

## Common Mistakes

- Treating `App.tsx` as the app root. It is currently a stub; Android builds mount `AndroidAppShell`, while this legacy document describes the old `ReaderLayout` shell.
- Removing `min-w-0` from flex children, causing long titles, chat text, or reader content to overflow.
- Adding full-page hero/marketing layouts inside the app. This project is a dense desktop productivity reader.
- Updating persisted reader settings without applying styles to the live foliate renderer.
- Adding mobile-only drawers for desktop workflows that already have fixed panels, popovers, or the `800px` settings dialog.
- Changing side panel widths without preserving compact portrait math and `foliate-resize-update`.
