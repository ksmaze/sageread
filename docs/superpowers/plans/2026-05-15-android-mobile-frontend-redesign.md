# Android Mobile Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop-first shell in `packages/app` with a feature-preserving Android phone/tablet shell based on the approved Stitch-derived design.

**Architecture:** Keep the existing React/Vite/Tauri service and store layer, then add a focused `src/mobile/` presentation layer that owns Android navigation, shell state, reader dock/sheets, and responsive phone/tablet layouts. Reuse existing Library, Reader, Notes, AI, Stats, Settings, and service hooks wherever practical, but route them through mobile-first surfaces instead of desktop tabs/sidebar/resizable panels.

**Tech Stack:** React 19, TypeScript, Tauri v2, Tailwind CSS v4, Radix/shadcn-style primitives, Vaul drawer primitives, lucide-react, Zustand, TanStack Query, existing Foliate reader integration.

---

## Reference Inputs

Read these before starting implementation:

* Design spec: `docs/superpowers/specs/2026-05-15-android-mobile-frontend-redesign-design.md`
* Trellis PRD: `.trellis/tasks/05-14-mobile-android-frontend-redesign/prd.md`
* Component strategy research: `.trellis/tasks/05-14-mobile-android-frontend-redesign/research/mobile-ui-component-strategy.md`
* Package spec index: `.trellis/spec/app/frontend/index.md`
* Existing entrypoint: `packages/app/src/main.tsx`
* Existing desktop shell: `packages/app/src/components/reader-layout.tsx`
* Existing home shell/routes: `packages/app/src/components/home-layout.tsx`

## File Structure

Create a new mobile presentation layer and keep legacy desktop files available until they are no longer imported:

* `packages/app/src/mobile/app-shell.tsx` — Android shell root and top-level destination router.
* `packages/app/src/mobile/types.ts` — shared mobile navigation, reader sheet, and tool types.
* `packages/app/src/mobile/constants.ts` — destination definitions and tablet breakpoint.
* `packages/app/src/mobile/shell/mobile-shell-store.ts` — Android presentation state: destination, active book, reader open state, dock/sheet state.
* `packages/app/src/mobile/components/mobile-surface.tsx` — safe-area-aware page frame.
* `packages/app/src/mobile/components/mobile-bottom-nav.tsx` — phone bottom navigation.
* `packages/app/src/mobile/components/tablet-rail.tsx` — tablet navigation rail.
* `packages/app/src/mobile/components/mobile-sheet.tsx` — shared bottom/full-height sheet wrapper using existing drawer/sheet primitives.
* `packages/app/src/mobile/components/reader-tool-dock.tsx` — reader bottom dock actions.
* `packages/app/src/mobile/destinations/library-destination.tsx` — mobile Library destination wrapper.
* `packages/app/src/mobile/destinations/notes-destination.tsx` — unified Notes destination.
* `packages/app/src/mobile/destinations/ai-destination.tsx` — chat-first AI destination.
* `packages/app/src/mobile/destinations/stats-destination.tsx` — mobile Stats destination wrapper.
* `packages/app/src/mobile/reader/mobile-reader.tsx` — single-active-book reader host.
* `packages/app/src/mobile/reader/reader-sheet-host.tsx` — reader sheet switching for TOC/search/notes/AI/style.
* `packages/app/src/mobile/reader/reader-back-handlers.ts` — browser/Android back helpers.
* `packages/app/src/mobile/notes/use-unified-notes.ts` — unified note/book-note query composition.
* `packages/app/src/mobile/notes/unified-notes-list.tsx` — shared Notes list UI for top-level Notes and reader-scoped Notes.
* `packages/app/src/mobile/ai/mobile-ai-chat.tsx` — mobile chat adapter for global and reader-scoped chat.

Modify:

* `packages/app/src/main.tsx` — render `AndroidAppShell` instead of desktop `ReaderLayout`.
* `packages/app/src/index.css` — add mobile design tokens and safe-area utilities.
* `packages/app/src/components/settings/settings-dialog.tsx` — allow mobile sheet usage or expose settings content for sheet rendering.
* `packages/app/src/pages/reader/components/reader-viewer.tsx` — allow mobile shell to suppress desktop header/footer when the mobile dock is active.
* `packages/app/src/pages/reader/components/header-bar.tsx` and `footer-bar.tsx` — keep export compatibility, but do not use them in Android mobile reader.
* `packages/app/src/pages/library/index.tsx`, `packages/app/src/pages/chat/index.tsx`, `packages/app/src/pages/statistics/index.tsx` — extract reusable content if needed so mobile wrappers do not inherit desktop chrome.

Use `pnpm --filter app build` as the main automated verification gate because the app currently has no package-level test script.

---

### Task 1: Add Mobile Tokens And Shared Types

**Files:**
* Create: `packages/app/src/mobile/types.ts`
* Create: `packages/app/src/mobile/constants.ts`
* Modify: `packages/app/src/index.css`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create shared mobile types**

Create `packages/app/src/mobile/types.ts`:

```ts
export type MobileDestination = "library" | "notes" | "ai" | "stats";

export type ReaderSheet = "toc" | "search" | "notes" | "ai" | "style" | null;

export interface ActiveBookRef {
  id: string;
  title: string;
}

export interface ReaderContextRef {
  bookId: string;
  sectionLabel?: string;
  selectedText?: string;
}

export interface MobileDestinationDefinition {
  id: MobileDestination;
  label: string;
  ariaLabel: string;
}
```

- [ ] **Step 2: Create destination constants**

Create `packages/app/src/mobile/constants.ts`:

```ts
import { BarChart3, Bot, Library, NotebookTabs, type LucideIcon } from "lucide-react";
import type { MobileDestination, MobileDestinationDefinition } from "./types";

export const MOBILE_TABLET_MIN_WIDTH = 720;

export interface MobileDestinationConfig extends MobileDestinationDefinition {
  icon: LucideIcon;
}

export const MOBILE_DESTINATIONS: MobileDestinationConfig[] = [
  { id: "library", label: "书库", ariaLabel: "打开书库", icon: Library },
  { id: "notes", label: "笔记", ariaLabel: "打开笔记", icon: NotebookTabs },
  { id: "ai", label: "AI", ariaLabel: "打开 AI 助手", icon: Bot },
  { id: "stats", label: "统计", ariaLabel: "打开阅读统计", icon: BarChart3 },
];

export function isMobileDestination(value: string): value is MobileDestination {
  return MOBILE_DESTINATIONS.some((destination) => destination.id === value);
}
```

- [ ] **Step 3: Add mobile design tokens**

Append this block to `packages/app/src/index.css`:

```css
@layer base {
  :root {
    --mobile-paper: #f6faff;
    --mobile-paper-low: #ecf5fe;
    --mobile-paper-high: #ffffff;
    --mobile-ink: #141d23;
    --mobile-ink-muted: #44474a;
    --mobile-outline: #c5c6ca;
    --mobile-ai: #3a5a40;
    --mobile-ai-soft: #c7ecca;
    --mobile-danger: #ba1a1a;
    --mobile-radius-sm: 0.25rem;
    --mobile-radius-md: 0.5rem;
    --mobile-radius-lg: 0.75rem;
    --mobile-touch-target: 44px;
  }
}

@layer utilities {
  .pb-safe {
    padding-bottom: max(env(safe-area-inset-bottom), 0px);
  }

  .pt-safe {
    padding-top: max(env(safe-area-inset-top), 0px);
  }

  .px-safe {
    padding-left: max(env(safe-area-inset-left), 0px);
    padding-right: max(env(safe-area-inset-right), 0px);
  }

  .mobile-paper {
    background: var(--mobile-paper);
    color: var(--mobile-ink);
  }

  .mobile-tonal-border {
    border-color: var(--mobile-outline);
  }
}
```

- [ ] **Step 4: Run the build gate**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/app/src/mobile/types.ts packages/app/src/mobile/constants.ts packages/app/src/index.css
git commit -m "feat: add Android mobile design foundations"
```

---

### Task 2: Build Mobile Shell State And Navigation Primitives

**Files:**
* Create: `packages/app/src/mobile/shell/mobile-shell-store.ts`
* Create: `packages/app/src/mobile/components/mobile-surface.tsx`
* Create: `packages/app/src/mobile/components/mobile-bottom-nav.tsx`
* Create: `packages/app/src/mobile/components/tablet-rail.tsx`
* Create: `packages/app/src/mobile/components/mobile-sheet.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create shell store**

Create `packages/app/src/mobile/shell/mobile-shell-store.ts`:

```ts
import { create } from "zustand";
import type { ActiveBookRef, MobileDestination, ReaderSheet } from "../types";

interface MobileShellState {
  activeDestination: MobileDestination;
  activeBook: ActiveBookRef | null;
  isReaderOpen: boolean;
  isReaderChromeVisible: boolean;
  activeReaderSheet: ReaderSheet;
  setDestination: (destination: MobileDestination) => void;
  openBook: (book: ActiveBookRef) => void;
  closeReader: () => void;
  showReaderChrome: () => void;
  hideReaderChrome: () => void;
  toggleReaderChrome: () => void;
  openReaderSheet: (sheet: Exclude<ReaderSheet, null>) => void;
  closeReaderSheet: () => void;
}

export const useMobileShellStore = create<MobileShellState>((set, get) => ({
  activeDestination: "library",
  activeBook: null,
  isReaderOpen: false,
  isReaderChromeVisible: false,
  activeReaderSheet: null,
  setDestination: (destination) =>
    set({
      activeDestination: destination,
      isReaderOpen: false,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  openBook: (book) =>
    set({
      activeBook: book,
      isReaderOpen: true,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  closeReader: () =>
    set({
      isReaderOpen: false,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  showReaderChrome: () => set({ isReaderChromeVisible: true }),
  hideReaderChrome: () => set({ isReaderChromeVisible: false }),
  toggleReaderChrome: () => set({ isReaderChromeVisible: !get().isReaderChromeVisible }),
  openReaderSheet: (sheet) =>
    set({
      activeReaderSheet: sheet,
      isReaderChromeVisible: true,
    }),
  closeReaderSheet: () => set({ activeReaderSheet: null }),
}));
```

- [ ] **Step 2: Create safe-area mobile surface**

Create `packages/app/src/mobile/components/mobile-surface.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";

interface MobileSurfaceProps extends PropsWithChildren {
  className?: string;
  padded?: boolean;
}

export function MobileSurface({ children, className, padded = true }: MobileSurfaceProps) {
  return (
    <section className={cn("mobile-paper flex min-h-0 flex-1 flex-col overflow-hidden", padded && "px-safe", className)}>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Create phone bottom navigation**

Create `packages/app/src/mobile/components/mobile-bottom-nav.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOBILE_DESTINATIONS } from "../constants";
import type { MobileDestination } from "../types";

interface MobileBottomNavProps {
  activeDestination: MobileDestination;
  onDestinationChange: (destination: MobileDestination) => void;
  hidden?: boolean;
}

export function MobileBottomNav({ activeDestination, onDestinationChange, hidden = false }: MobileBottomNavProps) {
  if (hidden) return null;

  return (
    <nav className="px-safe pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--mobile-paper-high)] mobile-tonal-border">
      <div className="grid h-16 grid-cols-4 px-2">
        {MOBILE_DESTINATIONS.map((destination) => {
          const Icon = destination.icon;
          const isActive = activeDestination === destination.id;

          return (
            <Button
              key={destination.id}
              type="button"
              variant="ghost"
              aria-label={destination.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-full min-h-[var(--mobile-touch-target)] flex-col gap-1 rounded-none text-xs text-[var(--mobile-ink-muted)]",
                isActive && "text-[var(--mobile-ink)]",
              )}
              onClick={() => onDestinationChange(destination.id)}
            >
              <Icon className="size-5" />
              <span>{destination.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create tablet rail**

Create `packages/app/src/mobile/components/tablet-rail.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOBILE_DESTINATIONS } from "../constants";
import type { MobileDestination } from "../types";

interface TabletRailProps {
  activeDestination: MobileDestination;
  onDestinationChange: (destination: MobileDestination) => void;
  hidden?: boolean;
}

export function TabletRail({ activeDestination, onDestinationChange, hidden = false }: TabletRailProps) {
  if (hidden) return null;

  return (
    <aside className="hidden w-22 shrink-0 border-r bg-[var(--mobile-paper-low)] mobile-tonal-border md:flex md:flex-col md:items-center md:gap-3 md:px-2 md:py-5">
      {MOBILE_DESTINATIONS.map((destination) => {
        const Icon = destination.icon;
        const isActive = activeDestination === destination.id;

        return (
          <Button
            key={destination.id}
            type="button"
            variant="ghost"
            aria-label={destination.ariaLabel}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-16 w-full flex-col gap-1 rounded-lg text-xs text-[var(--mobile-ink-muted)]",
              isActive && "bg-[var(--mobile-paper-high)] text-[var(--mobile-ink)]",
            )}
            onClick={() => onDestinationChange(destination.id)}
          >
            <Icon className="size-5" />
            <span>{destination.label}</span>
          </Button>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 5: Create shared mobile sheet wrapper**

Create `packages/app/src/mobile/components/mobile-sheet.tsx`:

```tsx
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";

interface MobileSheetProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  height?: "content" | "full";
  onOpenChange: (open: boolean) => void;
}

export function MobileSheet({
  open,
  title,
  description,
  height = "content",
  onOpenChange,
  children,
}: MobileSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          "border-[var(--mobile-outline)] bg-[var(--mobile-paper-high)]",
          height === "full" && "h-[calc(100dvh-env(safe-area-inset-top))]",
        )}
      >
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-safe">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 6: Run build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/app/src/mobile/shell/mobile-shell-store.ts packages/app/src/mobile/components/mobile-surface.tsx packages/app/src/mobile/components/mobile-bottom-nav.tsx packages/app/src/mobile/components/tablet-rail.tsx packages/app/src/mobile/components/mobile-sheet.tsx
git commit -m "feat: add Android mobile shell primitives"
```

---

### Task 3: Wire The Android App Shell

**Files:**
* Create: `packages/app/src/mobile/app-shell.tsx`
* Create: `packages/app/src/mobile/destinations/library-destination.tsx`
* Create: `packages/app/src/mobile/destinations/notes-destination.tsx`
* Create: `packages/app/src/mobile/destinations/ai-destination.tsx`
* Create: `packages/app/src/mobile/destinations/stats-destination.tsx`
* Modify: `packages/app/src/main.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create destination wrappers with visible pass-through states**

Create `packages/app/src/mobile/destinations/library-destination.tsx`:

```tsx
import LibraryPage from "@/pages/library";
import { MobileSurface } from "../components/mobile-surface";

export function LibraryDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <LibraryPage />
    </MobileSurface>
  );
}
```

Create `packages/app/src/mobile/destinations/notes-destination.tsx`:

```tsx
import { MobileSurface } from "../components/mobile-surface";

export function NotesDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">笔记</h1>
        <p className="text-sm text-[var(--mobile-ink-muted)]">统一笔记库将在后续任务接入现有笔记与标注数据。</p>
      </div>
    </MobileSurface>
  );
}
```

Create `packages/app/src/mobile/destinations/ai-destination.tsx`:

```tsx
import ChatPage from "@/pages/chat";
import { MobileSurface } from "../components/mobile-surface";

export function AiDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <ChatPage />
    </MobileSurface>
  );
}
```

Create `packages/app/src/mobile/destinations/stats-destination.tsx`:

```tsx
import StatisticsPage from "@/pages/statistics";
import { MobileSurface } from "../components/mobile-surface";

export function StatsDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <StatisticsPage />
    </MobileSurface>
  );
}
```

- [ ] **Step 2: Create shell root**

Create `packages/app/src/mobile/app-shell.tsx`:

```tsx
import SettingsDialog from "@/components/settings/settings-dialog";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLlamaStore } from "@/store/llama-store";
import { useEffect } from "react";
import { MobileBottomNav } from "./components/mobile-bottom-nav";
import { TabletRail } from "./components/tablet-rail";
import { AiDestination } from "./destinations/ai-destination";
import { LibraryDestination } from "./destinations/library-destination";
import { NotesDestination } from "./destinations/notes-destination";
import { StatsDestination } from "./destinations/stats-destination";
import { useMobileShellStore } from "./shell/mobile-shell-store";

function ActiveDestination() {
  const activeDestination = useMobileShellStore((state) => state.activeDestination);

  switch (activeDestination) {
    case "library":
      return <LibraryDestination />;
    case "notes":
      return <NotesDestination />;
    case "ai":
      return <AiDestination />;
    case "stats":
      return <StatsDestination />;
  }
}

export default function AndroidAppShell() {
  const insets = useSafeAreaInsets();
  const activeDestination = useMobileShellStore((state) => state.activeDestination);
  const setDestination = useMobileShellStore((state) => state.setDestination);
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore();
  const { hasHydrated, initializeEmbeddingService } = useLlamaStore();

  useEffect(() => {
    if (hasHydrated) {
      void initializeEmbeddingService();
    }
  }, [hasHydrated, initializeEmbeddingService]);

  if (!insets) return null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--mobile-paper)] text-[var(--mobile-ink)]">
      <TabletRail activeDestination={activeDestination} onDestinationChange={setDestination} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ActiveDestination />
      </main>
      <MobileBottomNav activeDestination={activeDestination} onDestinationChange={setDestination} />
      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
    </div>
  );
}
```

- [ ] **Step 3: Replace desktop shell entrypoint**

Modify `packages/app/src/main.tsx` so the render tree uses `AndroidAppShell`:

```tsx
import { Toaster } from "@/components/ui/sonner";
import { invoke } from "@tauri-apps/api/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { flushAllWrites } from "./lib/tauri-storage.ts";
import AndroidAppShell from "./mobile/app-shell.tsx";
import { mountFontsToMainApp } from "./utils/font.ts";

const queryClient = new QueryClient();

import "./index.css";

mountFontsToMainApp();

window.addEventListener("beforeunload", () => {
  flushAllWrites().catch((error) => {
    console.error("Failed to flush writes on app close:", error);
  });
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <AndroidAppShell />
    </HashRouter>
    <Toaster position="top-center" />
  </QueryClientProvider>,
);

invoke("app_ready").catch((err) => {
  console.error("Failed to signal app ready:", err);
});
```

- [ ] **Step 4: Run build**

Run: `pnpm --filter app build`

Expected: PASS or fail only from existing destination components inheriting desktop layout assumptions. Fix import/type errors in the newly created mobile files before moving on.

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/app/src/main.tsx packages/app/src/mobile/app-shell.tsx packages/app/src/mobile/destinations
git commit -m "feat: wire Android mobile app shell"
```

---

### Task 4: Connect Library To Single Active Reader

**Files:**
* Modify: `packages/app/src/mobile/destinations/library-destination.tsx`
* Create: `packages/app/src/mobile/reader/mobile-reader.tsx`
* Modify: `packages/app/src/mobile/app-shell.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Add mobile reader host**

Create `packages/app/src/mobile/reader/mobile-reader.tsx`:

```tsx
import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { createReaderStore } from "@/pages/reader/store/create-reader-store";
import { useMemo } from "react";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function MobileReader() {
  const activeBook = useMobileShellStore((state) => state.activeBook);

  const readerStore = useMemo(() => {
    if (!activeBook) return null;
    return createReaderStore(activeBook.id);
  }, [activeBook]);

  if (!activeBook || !readerStore) return null;

  return (
    <ReaderProvider store={readerStore}>
      <div className="fixed inset-0 z-50 bg-[var(--mobile-paper-high)]">
        <ReaderViewer />
      </div>
    </ReaderProvider>
  );
}
```

- [ ] **Step 2: Render reader above destinations**

Modify `packages/app/src/mobile/app-shell.tsx` by importing and rendering `MobileReader`:

```tsx
import { MobileReader } from "./reader/mobile-reader";
```

Inside the root `<div>`, directly before `<SettingsDialog ... />`, add:

```tsx
<MobileReader />
```

- [ ] **Step 3: Replace desktop `openBook` dependency in Library**

Modify `packages/app/src/mobile/destinations/library-destination.tsx` to provide a mobile open-book bridge by wrapping Library behavior in the existing store after the current Library page is visible:

```tsx
import LibraryPage from "@/pages/library";
import { useLayoutStore } from "@/store/layout-store";
import { useEffect } from "react";
import { MobileSurface } from "../components/mobile-surface";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function LibraryDestination() {
  const openMobileBook = useMobileShellStore((state) => state.openBook);

  useEffect(() => {
    const originalOpenBook = useLayoutStore.getState().openBook;
    useLayoutStore.setState({
      openBook: (bookId: string, title: string) => {
        openMobileBook({ id: bookId, title });
      },
    });

    return () => {
      useLayoutStore.setState({ openBook: originalOpenBook });
    };
  }, [openMobileBook]);

  return (
    <MobileSurface className="pb-20 md:pb-0">
      <LibraryPage />
    </MobileSurface>
  );
}
```

This is a temporary bridge. Later cleanup can replace direct `layout-store` usage in `BookItem` with a passed callback.

- [ ] **Step 4: Run build**

Run: `pnpm --filter app build`

Expected: PASS. If `setState` typing rejects the function replacement, create a dedicated `MobileLibraryContext` instead of mutating `layout-store`.

- [ ] **Step 5: Manual smoke check**

Run: `pnpm --filter app dev`

Expected:
* Library appears without the desktop sidebar.
* Opening a book renders the reader full-screen.
* The old top app-tabs strip is absent.

- [ ] **Step 6: Commit Task 4**

```bash
git add packages/app/src/mobile/destinations/library-destination.tsx packages/app/src/mobile/reader/mobile-reader.tsx packages/app/src/mobile/app-shell.tsx
git commit -m "feat: connect Android library to single reader"
```

---

### Task 5: Add Reader Dock, Sheet Host, And Back Behavior

**Files:**
* Create: `packages/app/src/mobile/components/reader-tool-dock.tsx`
* Create: `packages/app/src/mobile/reader/reader-sheet-host.tsx`
* Create: `packages/app/src/mobile/reader/reader-back-handlers.ts`
* Modify: `packages/app/src/mobile/reader/mobile-reader.tsx`
* Modify: `packages/app/src/pages/reader/components/reader-viewer.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create reader dock**

Create `packages/app/src/mobile/components/reader-tool-dock.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Bot, BookOpenText, NotebookPen, Search, Type } from "lucide-react";
import type { ReaderSheet } from "../types";

interface ReaderToolDockProps {
  visible: boolean;
  onOpenSheet: (sheet: Exclude<ReaderSheet, null>) => void;
}

const READER_TOOLS = [
  { id: "toc", label: "目录", icon: BookOpenText },
  { id: "search", label: "搜索", icon: Search },
  { id: "notes", label: "笔记", icon: NotebookPen },
  { id: "ai", label: "AI", icon: Bot },
  { id: "style", label: "样式", icon: Type },
] as const;

export function ReaderToolDock({ visible, onOpenSheet }: ReaderToolDockProps) {
  if (!visible) return null;

  return (
    <div className="px-safe pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3">
      <div className="pointer-events-auto grid h-14 w-full max-w-md grid-cols-5 rounded-full bg-[var(--mobile-ink)] px-2 text-white shadow-[0_16px_40px_rgba(20,29,35,0.18)]">
        {READER_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.id}
              type="button"
              variant="ghost"
              className="h-full flex-col gap-0.5 rounded-full text-xs text-white hover:bg-white/10 hover:text-white"
              onClick={() => onOpenSheet(tool.id)}
            >
              <Icon className="size-4" />
              <span>{tool.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create sheet host with real shell wiring**

Create `packages/app/src/mobile/reader/reader-sheet-host.tsx`:

```tsx
import { MobileSheet } from "../components/mobile-sheet";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function ReaderSheetHost() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);
  const activeBook = useMobileShellStore((state) => state.activeBook);

  const open = activeReaderSheet !== null;

  const titleBySheet = {
    toc: "目录",
    search: "搜索",
    notes: "笔记",
    ai: "AI 助手",
    style: "阅读样式",
  } as const;

  return (
    <MobileSheet
      open={open}
      title={activeReaderSheet ? titleBySheet[activeReaderSheet] : "阅读工具"}
      height={activeReaderSheet === "ai" || activeReaderSheet === "notes" ? "full" : "content"}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeReaderSheet();
      }}
    >
      <div className="text-sm text-[var(--mobile-ink-muted)]">
        {activeBook ? `${activeBook.title} · ${activeReaderSheet ?? ""}` : activeReaderSheet}
      </div>
    </MobileSheet>
  );
}
```

- [ ] **Step 3: Add Android back helper**

Create `packages/app/src/mobile/reader/reader-back-handlers.ts`:

```ts
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function handleMobileReaderBack(): boolean {
  const state = useMobileShellStore.getState();

  if (state.activeReaderSheet) {
    state.closeReaderSheet();
    return true;
  }

  if (state.isReaderChromeVisible) {
    state.hideReaderChrome();
    return true;
  }

  if (state.isReaderOpen) {
    state.closeReader();
    return true;
  }

  return false;
}
```

- [ ] **Step 4: Wire dock and sheet host into reader**

Modify `packages/app/src/mobile/reader/mobile-reader.tsx`:

```tsx
import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { createReaderStore } from "@/pages/reader/store/create-reader-store";
import { useEffect, useMemo } from "react";
import { ReaderToolDock } from "../components/reader-tool-dock";
import { useMobileShellStore } from "../shell/mobile-shell-store";
import { handleMobileReaderBack } from "./reader-back-handlers";
import { ReaderSheetHost } from "./reader-sheet-host";

export function MobileReader() {
  const activeBook = useMobileShellStore((state) => state.activeBook);
  const isReaderChromeVisible = useMobileShellStore((state) => state.isReaderChromeVisible);
  const toggleReaderChrome = useMobileShellStore((state) => state.toggleReaderChrome);
  const openReaderSheet = useMobileShellStore((state) => state.openReaderSheet);

  const readerStore = useMemo(() => {
    if (!activeBook) return null;
    return createReaderStore(activeBook.id);
  }, [activeBook]);

  useEffect(() => {
    const onPopState = () => {
      if (handleMobileReaderBack()) {
        window.history.pushState({ mobileReader: true }, "");
      }
    };

    window.history.pushState({ mobileReader: true }, "");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (!activeBook || !readerStore) return null;

  return (
    <ReaderProvider store={readerStore}>
      <div className="fixed inset-0 z-50 bg-[var(--mobile-paper-high)]">
        <button
          type="button"
          aria-label="显示或隐藏阅读工具"
          className="absolute inset-0 z-[55] h-full w-full bg-transparent"
          onClick={toggleReaderChrome}
        />
        <div className="relative z-[56] h-full pointer-events-none">
          <div className="pointer-events-auto h-full">
            <ReaderViewer />
          </div>
        </div>
        <ReaderToolDock visible={isReaderChromeVisible} onOpenSheet={openReaderSheet} />
        <ReaderSheetHost />
      </div>
    </ReaderProvider>
  );
}
```

- [ ] **Step 5: Add a mobile mode prop to reader viewer**

Modify `packages/app/src/pages/reader/components/reader-viewer.tsx` so it accepts a prop:

```tsx
interface ReaderViewerProps {
  mobileChrome?: boolean;
}

export default function ReaderViewer({ mobileChrome = false }: ReaderViewerProps) {
```

In the returned JSX, render desktop bars only when `mobileChrome` is false:

```tsx
{!mobileChrome && <HeaderBar />}
<ReaderViewerContent />
{!mobileChrome && <FooterBar />}
<Annotator />
```

Then update `MobileReader` to call:

```tsx
<ReaderViewer mobileChrome />
```

- [ ] **Step 6: Run build and smoke check**

Run: `pnpm --filter app build`

Expected: PASS.

Run: `pnpm --filter app dev`

Expected:
* Reader opens without desktop header/footer.
* Tapping reader reveals the bottom dock.
* Dock buttons open sheets.
* Browser back closes sheet, then dock, then reader.

- [ ] **Step 7: Commit Task 5**

```bash
git add packages/app/src/mobile/components/reader-tool-dock.tsx packages/app/src/mobile/reader packages/app/src/pages/reader/components/reader-viewer.tsx
git commit -m "feat: add Android reader dock and sheets"
```

---

### Task 6: Replace Temporary Reader Sheet Content With Existing Reader Tools

**Files:**
* Modify: `packages/app/src/mobile/reader/reader-sheet-host.tsx`
* Modify: `packages/app/src/pages/reader/components/toc-view.tsx`
* Modify: `packages/app/src/pages/reader/components/search-dropdown.tsx`
* Modify: `packages/app/src/pages/reader/components/settings-dropdown.tsx`
* Modify: `packages/app/src/components/notepad/notepad-container.tsx`
* Modify: `packages/app/src/components/side-chat/index.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Export reusable reader tool content where needed**

For each reader tool currently trapped inside dropdown/sidebar components, extract a content component while preserving existing exports:

* `TOCView` already exports reusable content.
* Search: extract the search input/results content from `search-dropdown.tsx` into `ReaderSearchPanel`.
* Settings: extract settings controls from `settings-dropdown.tsx` into `ReaderStylePanel`.
* Notes: `NotepadContainer` already accepts `bookId`.
* AI: side chat already accepts `bookId` through default export.

The extracted search panel should have this public shape:

```tsx
export interface ReaderSearchPanelProps {
  onResultSelect?: () => void;
}

export function ReaderSearchPanel({ onResultSelect }: ReaderSearchPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchBar />
      <SearchResults onResultSelect={onResultSelect} />
    </div>
  );
}
```

If current `SearchBar` or `SearchResults` signatures do not match, adapt the extracted panel to the existing internal hook state rather than changing search behavior.

- [ ] **Step 2: Render real sheet content**

Replace the temporary body in `packages/app/src/mobile/reader/reader-sheet-host.tsx` with:

```tsx
import { NotepadContainer } from "@/components/notepad";
import SideChat from "@/components/side-chat";
import TOCView from "@/pages/reader/components/toc-view";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { ReaderSearchPanel } from "@/pages/reader/components/search-dropdown";
import { ReaderStylePanel } from "@/pages/reader/components/settings-dropdown";
import { MobileSheet } from "../components/mobile-sheet";
import { useMobileShellStore } from "../shell/mobile-shell-store";

function ReaderSheetContent() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);
  const activeBook = useMobileShellStore((state) => state.activeBook);
  const bookDoc = useReaderStore((state) => state.bookData?.bookDoc);

  if (!activeReaderSheet || !activeBook) return null;

  switch (activeReaderSheet) {
    case "toc":
      return bookDoc?.toc ? (
        <TOCView toc={bookDoc.toc} bookId={activeBook.id} autoExpand onItemSelect={closeReaderSheet} isVisible />
      ) : (
        <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">没有可用的目录</p>
      );
    case "search":
      return <ReaderSearchPanel onResultSelect={closeReaderSheet} />;
    case "notes":
      return <NotepadContainer bookId={activeBook.id} />;
    case "ai":
      return <SideChat bookId={activeBook.id} />;
    case "style":
      return <ReaderStylePanel />;
  }
}

export function ReaderSheetHost() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);

  const open = activeReaderSheet !== null;
  const titleBySheet = {
    toc: "目录",
    search: "搜索",
    notes: "笔记",
    ai: "AI 助手",
    style: "阅读样式",
  } as const;

  return (
    <MobileSheet
      open={open}
      title={activeReaderSheet ? titleBySheet[activeReaderSheet] : "阅读工具"}
      height={activeReaderSheet === "ai" || activeReaderSheet === "notes" ? "full" : "content"}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeReaderSheet();
      }}
    >
      <ReaderSheetContent />
    </MobileSheet>
  );
}
```

- [ ] **Step 3: Run build**

Run: `pnpm --filter app build`

Expected: PASS after extracted panel exports are available.

- [ ] **Step 4: Manual reader tool verification**

Run: `pnpm --filter app dev`

Expected:
* TOC sheet jumps and closes.
* Search sheet can search and jump.
* Notes sheet shows current book notes/annotations.
* AI sheet opens reader-scoped chat.
* Style sheet changes reading settings.

- [ ] **Step 5: Commit Task 6**

```bash
git add packages/app/src/mobile/reader/reader-sheet-host.tsx packages/app/src/pages/reader/components/search-dropdown.tsx packages/app/src/pages/reader/components/settings-dropdown.tsx packages/app/src/components/notepad packages/app/src/components/side-chat
git commit -m "feat: connect Android reader sheets to tools"
```

---

### Task 7: Build Unified Notes Destination

**Files:**
* Create: `packages/app/src/mobile/notes/use-unified-notes.ts`
* Create: `packages/app/src/mobile/notes/unified-notes-list.tsx`
* Modify: `packages/app/src/mobile/destinations/notes-destination.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create unified note query hook**

Create `packages/app/src/mobile/notes/use-unified-notes.ts`:

```ts
import { getBookNotes } from "@/services/book-note-service";
import { getNotes } from "@/services/note-service";
import type { BookNote } from "@/types/book";
import type { Note } from "@/types/note";
import { useQuery } from "@tanstack/react-query";

export type UnifiedNoteType = "note" | "bookmark" | "annotation" | "excerpt";

export interface UnifiedNoteItem {
  id: string;
  type: UnifiedNoteType;
  bookId?: string;
  title: string;
  body: string;
  updatedAt: number;
  source: Note | BookNote;
}

interface UnifiedNotesOptions {
  bookId?: string;
  type?: UnifiedNoteType | "all";
}

function fromNote(note: Note): UnifiedNoteItem {
  return {
    id: note.id,
    type: "note",
    bookId: note.bookId,
    title: note.title || note.bookMeta?.title || "未命名笔记",
    body: note.content || "",
    updatedAt: note.updatedAt,
    source: note,
  };
}

function fromBookNote(note: BookNote): UnifiedNoteItem {
  return {
    id: note.id,
    type: note.type,
    bookId: note.bookId,
    title: note.text || note.note || "书籍标注",
    body: note.note || note.text || "",
    updatedAt: note.updatedAt,
    source: note,
  };
}

export function useUnifiedNotes({ bookId, type = "all" }: UnifiedNotesOptions = {}) {
  return useQuery({
    queryKey: ["mobile-unified-notes", bookId ?? "all", type],
    queryFn: async () => {
      const notes = await getNotes({ bookId, sortBy: "updated_at", sortOrder: "desc" });
      const bookNotes = bookId ? await getBookNotes(bookId) : [];
      return [...notes.map(fromNote), ...bookNotes.map(fromBookNote)]
        .filter((item) => type === "all" || item.type === type)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
  });
}
```

If `BookNote` uses different property names, adjust `fromBookNote` to match `packages/app/src/types/book.ts`.

- [ ] **Step 2: Create unified notes list**

Create `packages/app/src/mobile/notes/unified-notes-list.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnifiedNoteItem, UnifiedNoteType } from "./use-unified-notes";
import { useUnifiedNotes } from "./use-unified-notes";

const FILTERS: Array<{ id: UnifiedNoteType | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "note", label: "笔记" },
  { id: "annotation", label: "标注" },
  { id: "excerpt", label: "摘录" },
  { id: "bookmark", label: "书签" },
];

interface UnifiedNotesListProps {
  bookId?: string;
  activeType: UnifiedNoteType | "all";
  onTypeChange: (type: UnifiedNoteType | "all") => void;
}

function UnifiedNoteCard({ item }: { item: UnifiedNoteItem }) {
  return (
    <article className="rounded-lg border bg-[var(--mobile-paper-high)] p-3 mobile-tonal-border">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="line-clamp-1 font-medium text-[var(--mobile-ink)]">{item.title}</h3>
        <span className="rounded-full bg-[var(--mobile-paper-low)] px-2 py-1 text-xs text-[var(--mobile-ink-muted)]">
          {item.type}
        </span>
      </div>
      <p className="line-clamp-3 text-sm leading-6 text-[var(--mobile-ink-muted)]">{item.body}</p>
    </article>
  );
}

export function UnifiedNotesList({ bookId, activeType, onTypeChange }: UnifiedNotesListProps) {
  const { data = [], isLoading, error } = useUnifiedNotes({ bookId, type: activeType });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant="ghost"
            className={cn(
              "h-8 rounded-full border px-3 text-sm mobile-tonal-border",
              activeType === filter.id && "bg-[var(--mobile-ink)] text-white hover:bg-[var(--mobile-ink)] hover:text-white",
            )}
            onClick={() => onTypeChange(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">正在加载笔记...</p> : null}
      {error ? <p className="py-8 text-center text-sm text-[var(--mobile-danger)]">笔记加载失败</p> : null}
      {!isLoading && !error && data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">暂无笔记</p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {data.map((item) => (
          <UnifiedNoteCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace temporary Notes destination copy**

Modify `packages/app/src/mobile/destinations/notes-destination.tsx`:

```tsx
import { useState } from "react";
import { MobileSurface } from "../components/mobile-surface";
import { UnifiedNotesList } from "../notes/unified-notes-list";
import type { UnifiedNoteType } from "../notes/use-unified-notes";

export function NotesDestination() {
  const [activeType, setActiveType] = useState<UnifiedNoteType | "all">("all");

  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header>
          <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">笔记</h1>
          <p className="text-sm text-[var(--mobile-ink-muted)]">跨书籍回顾笔记、标注、摘录和书签</p>
        </header>
        <UnifiedNotesList activeType={activeType} onTypeChange={setActiveType} />
      </div>
    </MobileSurface>
  );
}
```

- [ ] **Step 4: Run build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 5: Manual notes verification**

Run: `pnpm --filter app dev`

Expected:
* Notes top-level destination loads.
* Filter chips switch note types.
* Empty, loading, and error states fit inside phone width.
* Reader Notes sheet still opens for active book.

- [ ] **Step 6: Commit Task 7**

```bash
git add packages/app/src/mobile/notes packages/app/src/mobile/destinations/notes-destination.tsx
git commit -m "feat: add unified Android notes destination"
```

---

### Task 8: Create Mobile AI Chat Adapter

**Files:**
* Create: `packages/app/src/mobile/ai/mobile-ai-chat.tsx`
* Modify: `packages/app/src/mobile/destinations/ai-destination.tsx`
* Modify: `packages/app/src/mobile/reader/reader-sheet-host.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Create mobile chat adapter**

Create `packages/app/src/mobile/ai/mobile-ai-chat.tsx`:

```tsx
import ChatPage from "@/pages/chat";
import SideChat from "@/components/side-chat";

interface MobileAiChatProps {
  bookId?: string;
}

export function MobileAiChat({ bookId }: MobileAiChatProps) {
  if (bookId) {
    return <SideChat bookId={bookId} />;
  }

  return <ChatPage />;
}
```

- [ ] **Step 2: Use adapter in top-level AI**

Modify `packages/app/src/mobile/destinations/ai-destination.tsx`:

```tsx
import { MobileAiChat } from "../ai/mobile-ai-chat";
import { MobileSurface } from "../components/mobile-surface";

export function AiDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <MobileAiChat />
    </MobileSurface>
  );
}
```

- [ ] **Step 3: Use adapter in reader AI sheet**

In `packages/app/src/mobile/reader/reader-sheet-host.tsx`, replace the direct `SideChat` import/render with:

```tsx
import { MobileAiChat } from "../ai/mobile-ai-chat";
```

And render:

```tsx
return <MobileAiChat bookId={activeBook.id} />;
```

- [ ] **Step 4: Run build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 5: Manual AI verification**

Run: `pnpm --filter app dev`

Expected:
* Top-level AI opens global chat.
* Reader AI sheet opens book-scoped chat.
* Thread history, model selector, retry/stop, and tool result surfaces are reachable.
* Chat input is not covered by bottom navigation or safe-area insets.

- [ ] **Step 6: Commit Task 8**

```bash
git add packages/app/src/mobile/ai/mobile-ai-chat.tsx packages/app/src/mobile/destinations/ai-destination.tsx packages/app/src/mobile/reader/reader-sheet-host.tsx
git commit -m "feat: adapt AI chat for Android shell"
```

---

### Task 9: Adapt Stats, Settings, And Secondary Skills Access

**Files:**
* Modify: `packages/app/src/mobile/destinations/stats-destination.tsx`
* Create: `packages/app/src/mobile/settings/mobile-settings-entry.tsx`
* Modify: `packages/app/src/mobile/app-shell.tsx`
* Modify: `packages/app/src/components/settings/settings-dialog.tsx`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Keep Stats in a mobile frame**

Modify `packages/app/src/mobile/destinations/stats-destination.tsx`:

```tsx
import StatisticsPage from "@/pages/statistics";
import { MobileSurface } from "../components/mobile-surface";

export function StatsDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header>
          <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">阅读统计</h1>
          <p className="text-sm text-[var(--mobile-ink-muted)]">回顾阅读时间、热力图和近期阅读节奏</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StatisticsPage />
        </div>
      </div>
    </MobileSurface>
  );
}
```

- [ ] **Step 2: Create settings entry button**

Create `packages/app/src/mobile/settings/mobile-settings-entry.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { Settings } from "lucide-react";

export function MobileSettingsEntry() {
  const { toggleSettingsDialog } = useAppSettingsStore();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)] rounded-full"
      aria-label="打开设置"
      onClick={toggleSettingsDialog}
    >
      <Settings className="size-5" />
    </Button>
  );
}
```

- [ ] **Step 3: Make settings dialog mobile-safe**

Modify `packages/app/src/components/settings/settings-dialog.tsx` so `DialogContent` uses responsive sizing:

```tsx
<DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-y-auto p-0 sm:h-[80vh] sm:min-h-[80vh] sm:w-[800px] sm:min-w-[800px] sm:max-w-[800px]">
```

Keep the existing internal settings content intact.

- [ ] **Step 4: Add settings entry to shell**

In `packages/app/src/mobile/app-shell.tsx`, import:

```tsx
import { MobileSettingsEntry } from "./settings/mobile-settings-entry";
```

Render it as a fixed top-right affordance outside the reader:

```tsx
<div className="pt-safe px-safe fixed top-2 right-2 z-40 md:top-3 md:right-3">
  <MobileSettingsEntry />
</div>
```

- [ ] **Step 5: Run build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 6: Manual secondary surface verification**

Run: `pnpm --filter app dev`

Expected:
* Stats page is scrollable on phone.
* Settings opens full-screen on phone and bounded dialog on tablet.
* Provider, model, font, TTS, vector model, and general settings remain reachable.
* Skills remain reachable through AI/tool flows or existing secondary settings/tool entry.

- [ ] **Step 7: Commit Task 9**

```bash
git add packages/app/src/mobile/destinations/stats-destination.tsx packages/app/src/mobile/settings/mobile-settings-entry.tsx packages/app/src/mobile/app-shell.tsx packages/app/src/components/settings/settings-dialog.tsx
git commit -m "feat: adapt stats and settings for Android"
```

---

### Task 10: Polish Responsive Layout, Selection, And Safe Areas

**Files:**
* Modify: `packages/app/src/index.css`
* Modify: `packages/app/src/mobile/app-shell.tsx`
* Modify: `packages/app/src/mobile/components/mobile-bottom-nav.tsx`
* Modify: `packages/app/src/mobile/components/tablet-rail.tsx`
* Modify: `packages/app/src/mobile/components/mobile-sheet.tsx`
* Modify: `packages/app/src/mobile/components/reader-tool-dock.tsx`
* Modify: `packages/app/src/pages/reader/components/annotator/*`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Add responsive shell utility classes**

Append to `packages/app/src/index.css`:

```css
@layer utilities {
  .mobile-scroll-area {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-reader-control {
    min-width: var(--mobile-touch-target);
    min-height: var(--mobile-touch-target);
  }

  .mobile-text-fit {
    overflow-wrap: anywhere;
    word-break: normal;
  }
}
```

- [ ] **Step 2: Apply scroll containment to mobile surfaces and sheets**

In `mobile-surface.tsx`, add `mobile-scroll-area` to the root class:

```tsx
"mobile-paper mobile-scroll-area flex min-h-0 flex-1 flex-col overflow-hidden"
```

In `mobile-sheet.tsx`, add `mobile-scroll-area` to the scrollable content container:

```tsx
<div className="mobile-scroll-area min-h-0 flex-1 overflow-y-auto px-4 pb-safe">{children}</div>
```

- [ ] **Step 3: Verify touch target sizing**

Update `reader-tool-dock.tsx`, `mobile-bottom-nav.tsx`, and `tablet-rail.tsx` so every interactive button includes either:

```tsx
className="min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)]"
```

or a larger fixed height/width already present in the component.

- [ ] **Step 4: Check selection popups on top of reader dock**

Inspect `packages/app/src/pages/reader/components/annotator/annotation-popup.tsx` and `ask-ai-popup.tsx`. Ensure popup z-index is above reader content and below active sheets:

```tsx
className="z-[80]"
```

Reader sheets use z-index `50` inside drawer primitives plus wrapper z-index; if a popup appears under the dock during manual testing, raise annotation popups to `z-[90]` and keep sheets at `z-[100]`.

- [ ] **Step 5: Run build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 6: Manual responsive matrix**

Run: `pnpm --filter app dev`

Verify with browser/device emulation:
* 390x844 phone portrait.
* 844x390 phone landscape.
* 800x1280 tablet portrait.
* 1280x800 tablet landscape.

Expected:
* No bottom nav overlap with chat input or sheets.
* Tablet rail appears at tablet width.
* Reader dock stays reachable and does not cover selection actions.
* Text fits inside buttons, chips, cards, and settings rows.

- [ ] **Step 7: Commit Task 10**

```bash
git add packages/app/src/index.css packages/app/src/mobile packages/app/src/pages/reader/components/annotator
git commit -m "style: polish Android responsive layout"
```

---

### Task 11: Final Verification And Documentation

**Files:**
* Modify: `.trellis/spec/app/frontend/desktop-app-design.md` or create a new app frontend spec file if the index indicates a better location.
* Modify: `.trellis/spec/app/frontend/index.md`
* Test: `pnpm --filter app build`

- [ ] **Step 1: Run final build**

Run: `pnpm --filter app build`

Expected: PASS.

- [ ] **Step 2: Run manual feature preservation checklist**

Verify:
* Library upload, search, tags, open book, edit, delete.
* Reader load, progress save, TOC, search, style settings, page/section navigation.
* Reader text selection, annotation/highlight/excerpt, ask-AI.
* Notes top-level filters and reader-scoped notes.
* AI global chat, reader-scoped chat, thread history, model selector, context selector, retry/stop, tool result viewing.
* Stats load and responsive display.
* Settings access for providers, models, fonts, TTS, vector model, and general settings.
* Android back closes sheet, hides dock, exits reader, and does not skip user data saves.

- [ ] **Step 3: Update app frontend spec**

Open `.trellis/spec/app/frontend/index.md` and choose the matching guideline file. If `desktop-app-design.md` is still the only app-shell design document, update it to describe the Android-only shell and rename only if the surrounding index supports it.

Add this concrete guidance to the chosen spec:

```md
## Android Mobile Shell

`packages/app` is currently Android mobile/tablet first. The app shell uses top-level destinations Library, Notes, AI, and Stats. Phone uses bottom navigation; tablet uses a navigation rail. The reader is a single active book surface with a reveal-on-tap bottom dock for TOC, search, notes, AI, and reading style. Desktop app-tabs, persistent desktop sidebars, and resizable reader side panels are not part of the Android shell contract.
```

- [ ] **Step 4: Run final git diff review**

Run:

```bash
git diff --stat
git diff -- packages/app/src/mobile packages/app/src/main.tsx packages/app/src/index.css
```

Expected:
* Changes are scoped to Android redesign files and required adapters.
* No unrelated Trellis or workspace files are included.

- [ ] **Step 5: Commit final docs/spec update**

```bash
git add .trellis/spec/app/frontend packages/app/src
git commit -m "docs: document Android mobile shell"
```

---

## Plan Self-Review

### Spec Coverage

* Android-only scope: covered by Tasks 3, 4, 9, 10, and 11.
* React/Tauri stack preservation: covered by all tasks; no framework migration is planned.
* Stitch-derived visual language: covered by Tasks 1, 2, 5, and 10.
* Phone bottom nav and tablet rail: covered by Tasks 2 and 3.
* Single active book: covered by Task 4.
* Reader bottom dock and sheets: covered by Tasks 5 and 6.
* Unified Notes: covered by Task 7.
* Chat-first AI: covered by Task 8.
* Stats and Settings: covered by Task 9.
* Error/loading/manual verification: covered throughout task verification and Task 11.

### Incomplete Marker Scan

The plan intentionally avoids incomplete markers and names exact files, commands, expected outcomes, and initial code structure for each task.

### Type Consistency

Shared state uses `MobileDestination`, `ReaderSheet`, and `ActiveBookRef` from `packages/app/src/mobile/types.ts`. Later tasks import these types through the same names and keep reader sheet IDs consistent: `toc`, `search`, `notes`, `ai`, and `style`.
