# Mobile Android Frontend Redesign

## Goal

Redesign the application frontend as an Android mobile/tablet-only reading app while preserving the existing product functionality. Use the Stitch `AI Reading Assistant` design as a mobile-friendly component and visual-language reference, not as a strict feature map.

## What I Already Know

* The user wants a full frontend redesign for Android mobile and tablet only.
* Existing functionality must be preserved, including features not represented in the Stitch screens.
* Stitch should guide components, tone, layout, typography, and interaction style, but should not define the feature set.
* The current desktop-focused component structure does not need to be reused if a cleaner mobile-first design benefits the app.
* The user is open to existing popular UI components if they fit Tauri/mobile constraints, but does not want a high-overhead framework migration.
* Stitch project visible: `AI Reading Assistant`, design system `Luminous Scholar`.
* Stitch representative mobile screens include library home, reader, reading settings, semantic search, AI lab/chat, unified notes, book notes, and mind map.
* The user accepted the visual companion for layout/mockup questions. Companion URL: `http://localhost:58327`.

## Current Repo Findings

* `packages/app` is currently a React/Vite/Tauri frontend, not Vue. Key entry files:
  * `packages/app/src/main.tsx`
  * `packages/app/src/components/reader-layout.tsx`
  * `packages/app/src/components/home-layout.tsx`
* The current app uses React 19, React Router, Zustand, TanStack Query, Tailwind CSS v4, Radix/shadcn-style components, lucide-react, vaul, and Tauri v2.
* Main app routes in `HomeLayout`:
  * `/` library
  * `/chat` AI chat
  * `/skills` skills
  * `/statistics` reading statistics
  * `/notes` placeholder route
* Main preserved feature areas discovered so far:
  * Library: book upload, drag/drop upload, search, tags, book grid/list, edit/delete/update, embedding status.
  * Reader: Foliate-based viewer, TOC, search, reading settings, progress, keyboard/page navigation, text annotation, ask-AI popup, highlight options.
  * AI: side chat, full chat page, model selector, context selection, thread history, tool detail panel, RAG/search/TOC/context tools, mind map tool.
  * Notes: side notepad and book note services; current `/notes` route is placeholder but services/components exist.
  * Settings: general, font manager, vector model, TTS, model providers, provider details.
  * Reading statistics: reading sessions and heat map.
  * System/mobile: safe-area inset hook, theme/system UI visibility store, Android Tauri config.
* Current layout is desktop-oriented:
  * top tab strip via `app-tabs`
  * left sidebar navigation
  * resizable side chat and notepad panels
  * large desktop settings dialog
  * desktop window controls
* Android config exists in `packages/app/src-tauri/tauri.android.conf.json`:
  * fullscreen Android window
  * non-resizable
  * `minSdkVersion: 28`
* Existing mobile-aware pieces:
  * `useSafeAreaInsets`
  * reader content insets
  * recent commits mention mobile touch selection and responsive layout fixes.

## Stitch Design Notes

* Visual direction: quiet, scholarly, paper-and-ink, mobile-first reading.
* Typography:
  * reading content uses Literata-like serif rhythm
  * UI chrome uses Hanken Grotesk-like sans rhythm
* Color direction:
  * paper/light surfaces
  * ink charcoal primary text/actions
  * muted library green reserved for AI-assisted affordances
  * tonal layers and low-contrast outlines over heavy shadows
* Component direction:
  * mobile bottom/overlay navigation patterns instead of desktop sidebars
  * drawers/sheets for settings, chat, note, TOC, and tool details
  * thin progress indicators
  * low-distraction reader controls

## Assumptions To Validate

* The final implementation should remain in the current React frontend unless the user confirms a Vue migration is actually intended.
* "Android mobile/tablet only" means the desktop layout and desktop-only affordances can be removed or hidden in this app target.
* The product should preserve feature parity through redesigned flows, not necessarily identical screen locations.
* Tablet should use adaptive split-pane behavior where it helps reading, while phone should prefer bottom sheets and single-task focus.

## Open Questions

* Confirm framework direction: preserve current React/Tauri app, or migrate to Vue despite the current app being React?
* Confirm mobile/tablet navigation model.
* Confirm whether multi-book tabs should survive as a mobile concept or be replaced by recent/current book navigation.
* Confirm how AI, notes, TOC, and settings should coexist around the reader on phone and tablet.
* Confirm whether desktop support is explicitly removed from scope or merely deprioritized.

## Requirements (Evolving)

* Preserve all existing functionality in the redesigned mobile/tablet UX.
* Use Stitch for design language and component inspiration only.
* Do not treat Stitch's limited screen set as the complete product feature scope.
* Favor a clean mobile-first architecture over adapting the previous desktop shell.
* Avoid unnecessary migration overhead.
* Keep the current React/Vite/Tauri frontend foundation; do not migrate to Vue for this redesign.
* Use an adaptive mobile/tablet navigation model:
  * Phones use bottom navigation and modal/bottom-sheet task surfaces.
  * Tablets expand to a navigation rail with optional split panes.
  * The desktop tab strip and persistent desktop sidebar should not define the Android shell.
* Android uses a single active book reader model:
  * Opening a book replaces the current active reader.
  * Recent/history/library progress provide return paths.
  * Simultaneous visible multi-book tabs are treated as desktop-only behavior and are not preserved in the Android shell.
* Reader-adjacent tools use a bottom tool dock:
  * The reader remains a single focused surface.
  * A tap reveals top reading context and a bottom dock for TOC, search, note, AI, and text/settings actions.
  * Each reader tool opens as a bottom sheet or full-height sheet rather than as a persistent tablet side inspector.
  * Tablet may still use adaptive navigation/split panes in non-reader areas, but the reader itself should keep the bottom-dock interaction model unless explicitly revised.
* Top-level Android navigation uses four destinations:
  * Library
  * Notes
  * AI
  * Stats
* Search is contextual:
  * Library search stays inside Library.
  * Reader search stays inside the reader tool dock.
  * Semantic/RAG search is exposed through AI and reader context rather than as a separate global tab.
* Skills and Settings move behind menus or contextual AI/settings entry points rather than appearing as top-level destinations.
* Notes destination is a unified reading notebook:
  * Includes standalone notes, book-linked notes, highlights/annotations, excerpts, and bookmarks.
  * Supports filtering by book and type.
  * Reader dock opens the same note system filtered to the current book/current reading context.
* AI destination is a chat-first assistant workspace:
  * Main AI tab is a normal chat workspace with thread history, model/context selector, attachments, and tool results.
  * Reader AI uses the same chat system scoped to the active book, current section, active selection, or reader references.
  * AI tools such as RAG search/context/TOC/range, notes, mind map, skills, books, and reading stats remain available through chat/tool calls rather than becoming separate dashboard-first destinations.
* Desktop preservation is out of scope for this redesign:
  * The Android shell may remove or bypass desktop tab/sidebar/window-control assumptions.
  * Desktop regressions are acceptable during this Android-only redesign unless they break shared build/runtime requirements.
* Component strategy:
  * Keep Tailwind CSS, Radix/shadcn-style primitives, Vaul/drawer patterns, and lucide icons.
  * Build a focused mobile design-system layer for Android shell/navigation, reader dock, sheets, rail, cards/lists, chips, forms, and settings surfaces.
  * Do not adopt Ionic React or Material UI for this redesign unless a later implementation gap requires a narrow targeted dependency.
* MVP boundary is a full feature-preserving shell redesign:
  * Map all existing user-facing feature surfaces into the new Android shell.
  * Do not invent new product features beyond what is needed to preserve existing functionality cleanly.
  * Include failure/edge handling needed for existing AI, note, reader, and settings workflows.

## Acceptance Criteria (Evolving)

* [ ] All current user-facing feature areas have a mapped mobile/tablet flow.
* [ ] Phone and tablet layouts are specified separately where behavior differs.
* [ ] Stitch-derived visual tokens and component rules are documented.
* [x] Framework/library direction is explicit.
* [ ] Out-of-scope desktop behavior is explicit.
* [ ] Implementation can be broken into small, testable phases.

## Definition of Done

* Requirements and design are approved by the user before implementation.
* A written design spec exists and passes self-review for placeholders, contradictions, ambiguity, and scope.
* Implementation plan is created only after design approval.
* Code changes, when later started, run lint/type-check and relevant tests.
* Specs/docs are updated if the app architecture or frontend guidelines change.

## Out of Scope (Temporary)

* Implementing the redesign during brainstorming.
* Strictly copying Stitch feature coverage.
* Rebuilding non-Android desktop UX unless the user asks for it.

## Technical Notes

* Active task: `.trellis/tasks/05-14-mobile-android-frontend-redesign`
* Visual companion session: `.superpowers/brainstorm/codex-54932-1778818880`
* Framework decision: continue with React/Vite/Tauri; avoid Vue migration.
* Navigation decision: user selected visual option C, adaptive rail + split pane. Browser event history shows A was inspected first, then C selected.
* Open-book decision: user selected single active book only. Preserve return paths through library/recent/progress, not simultaneous open tabs.
* Reader-tool decision: user selected visual option A, bottom tool dock. This intentionally prioritizes a consistent phone-first reader over tablet-pinned inspector panels.
* Top-level destination decision: user selected Library / Notes / AI / Stats. Search remains contextual. Skills and Settings are secondary entry points.
* Notes decision: user selected unified reading notebook for standalone notes plus book-linked notes, annotations, excerpts, and bookmarks.
* AI decision: user selected chat-first assistant. Preserve AI tool capabilities through chat/tool result surfaces, not an AI lab dashboard.
* Desktop scope decision: user selected Android-only shell where desktop can regress. Do not spend design/implementation complexity preserving the desktop shell.
* Component strategy decision: user selected existing Tailwind + Radix/shadcn + Vaul stack. Research saved at `research/mobile-ui-component-strategy.md`.
* MVP boundary decision: user selected full feature-preserving shell redesign.
* Design section approved: shell architecture and surface map. User confirmed the phone bottom nav, tablet rail/split layout, reader bottom dock, and destination map look good.
* Design section approved: Stitch-derived visual/component language. User confirmed calm paper surfaces, reader-first typography, restrained chat UI, chips/progress, low borders, and muted AI green look good.
* Design section approved: workflow/data-flow. User confirmed the Android shell state model, single active reader flow, unified notes flow, chat-first AI context flow, and inline/retry error handling look good.
* Design section approved: testing/acceptance. User confirmed build/type quality, behavior preservation checks, responsive visual checks, and reachable Android flows for all current user-facing features look good.

## Decision (ADR-lite)

### Framework

**Context**: The user initially mentioned Vue, but repository inspection shows `packages/app` is a React/Vite/Tauri frontend with React state, routing, UI primitives, and Foliate integration already in place.

**Decision**: Keep React/Vite/Tauri for this redesign.

**Consequences**: This avoids a large framework migration and lets the task focus on mobile UX, component architecture, and feature preservation.

### Navigation Model

**Context**: The desktop app currently uses an app-tabs strip plus a sidebar. Android phone and tablet need a cleaner shell that preserves feature access without inheriting desktop chrome.

**Decision**: Use an adaptive navigation model. Phone collapses to bottom navigation and sheets; tablet uses a navigation rail and optional split panes.

**Consequences**: This supports both compact phone workflows and productive tablet layouts, but requires explicit design for how reader-adjacent tools replace desktop sidebars.

### Open Book Model

**Context**: The desktop app currently supports multiple open reader tabs. Android phone/tablet top tabs would fight the cleaner mobile reading shell.

**Decision**: Android has one active reader book at a time.

**Consequences**: The implementation can remove mobile tab chrome and simplify reader state. Existing book progress, library entries, and recent/current book affordances must make returning to prior books easy. Simultaneous multi-book tab state is desktop-only and out of scope for the Android shell.

### Reader Tool Surfaces

**Context**: The current desktop reader exposes TOC/search/settings in the header and chat/notepad as resizable sidebars. Android needs to preserve those tools without desktop side panels.

**Decision**: Use a reveal-on-tap bottom tool dock in the reader. Tool entries open bottom sheets or full-height sheets for TOC, search, notes, AI chat, annotation actions, text settings, and tool details.

**Consequences**: The reader interaction stays consistent across phone and tablet. This sacrifices tablet-pinned side tools in favor of a simpler reading surface. Long-running AI and note workflows must have clear sheet states, save/restore behavior, and obvious return-to-reading controls.

### Top-Level Destinations

**Context**: Current desktop navigation exposes Library, Chat, Skills, Statistics, Settings, and a placeholder Notes page. Stitch emphasizes Library, Search, Notes, AI, and reading-specific tool surfaces.

**Decision**: Android top-level navigation is Library, Notes, AI, and Stats.

**Consequences**: The app foregrounds reading, note review, AI assistance, and reading insight. Search is contextual rather than global. Skills and Settings remain available but are secondary surfaces reached from AI/menu/settings affordances.

### Notes Model

**Context**: The current app has note services, a reader notepad for notes/annotations, book note services for bookmarks/annotations/excerpts, and a placeholder top-level Notes route. Stitch includes unified notes and book review concepts.

**Decision**: The Android Notes destination is a unified reading notebook for standalone notes, book-linked notes, annotations, excerpts, and bookmarks.

**Consequences**: The redesign must consolidate existing note surfaces into one coherent model. The reader dock should open this same note system scoped to the active book or selected text. Filters by book/type are required so the unified view does not become noisy.

### AI Model

**Context**: The app already has full chat, side chat, thread history, model selection, context selection, AI tools, RAG results, mind map rendering, and reader selection handoff.

**Decision**: The Android AI destination is chat-first. Reader AI and top-level AI share the same underlying chat/thread/tool model, with context changing based on whether the user is in global chat or reader-scoped chat.

**Consequences**: Existing tool capabilities remain discoverable through assistant suggestions and tool result viewers. The design should avoid a heavy AI lab dashboard as the default entry, while still supporting fast actions and prompts in empty states.

### Desktop Scope

**Context**: The current `packages/app` shell is desktop-first, with top tabs, desktop window controls, persistent sidebars, and resizable panels.

**Decision**: This redesign targets Android mobile/tablet only. Desktop usability does not need to be preserved.

**Consequences**: The implementation can simplify or remove desktop shell assumptions. Shared services, stores, reader engine, and Tauri build/runtime constraints still need to remain coherent, but desktop UX parity is not an acceptance criterion.

### Component Strategy

**Context**: Tauri does not force a mobile UI toolkit. The existing React app already includes Tailwind, Radix/shadcn-style primitives, Vaul-backed drawers, and lucide icons.

**Decision**: Keep the existing component stack and build a small Stitch-derived mobile design-system layer on top.

**Consequences**: The redesign keeps migration risk low and preserves control over the quiet reading visual language. Implementation must define reusable mobile primitives instead of repeatedly hand-composing one-off sheets, dock buttons, list cards, and settings controls.
* Existing package spec index: `.trellis/spec/app/frontend/index.md`
* Relevant current files inspected:
  * `packages/app/package.json`
  * `packages/app/src/main.tsx`
  * `packages/app/src/components/reader-layout.tsx`
  * `packages/app/src/components/home-layout.tsx`
  * `packages/app/src/components/sidebar.tsx`
  * `packages/app/src/pages/library/index.tsx`
  * `packages/app/src/pages/reader/components/reader-viewer.tsx`
  * `packages/app/src/pages/reader/components/header-bar.tsx`
  * `packages/app/src/pages/reader/components/footer-bar.tsx`
  * `packages/app/src/pages/chat/index.tsx`
  * `packages/app/src/components/settings/settings-dialog.tsx`
  * `packages/app/src/index.css`
  * `packages/app/src/styles/themes.ts`
  * `packages/app/src-tauri/tauri.conf.json`
  * `packages/app/src-tauri/tauri.android.conf.json`
  * `packages/app/src-tauri/capabilities/mobile.json`
