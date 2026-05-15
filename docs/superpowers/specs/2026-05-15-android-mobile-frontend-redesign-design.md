# Android Mobile Frontend Redesign Design

## Goal

Redesign `packages/app` as an Android mobile/tablet-only reading app while preserving existing user-facing functionality. The Stitch `AI Reading Assistant` design and `Luminous Scholar` design system define the visual language and component direction, but not the feature scope.

The redesign keeps the current React/Vite/Tauri frontend foundation. It does not migrate to Vue, Ionic React, or Material UI.

## Product Decisions

* **Platform scope**: Android mobile and tablet only. Desktop UX preservation is out of scope.
* **Frontend stack**: Keep React, Tailwind CSS, Radix/shadcn-style primitives, Vaul/drawer patterns, lucide icons, Zustand, TanStack Query, and Tauri v2.
* **Design source**: Use Stitch for components, spacing, typography, color, and interaction tone. Do not copy Stitch's feature coverage as the complete product map.
* **Navigation model**: Phone uses bottom navigation. Tablet uses an adaptive navigation rail with optional split panes in non-reader areas.
* **Top-level destinations**: Library, Notes, AI, Stats.
* **Search model**: Search is contextual. Library search lives in Library; reader search lives in the reader dock; semantic/RAG search is exposed through AI and reader context.
* **Book model**: Android has one active book at a time. Opening a book replaces the current reader. Prior books are reached through Library/recent/progress paths, not visible multi-book tabs.
* **Reader tools**: Reader uses a reveal-on-tap bottom dock. TOC, search, notes, AI, annotation actions, text/style settings, and tool details open as bottom sheets or full-height sheets.
* **Notes model**: Notes is a unified reading notebook for standalone notes, book-linked notes, highlights/annotations, excerpts, and bookmarks.
* **AI model**: AI is chat-first. Top-level AI and reader AI share chat/thread/tool infrastructure, with context scoped by entry point.
* **MVP boundary**: Full feature-preserving shell redesign. Do not invent new product features beyond what is required to preserve current behavior cleanly.

## Current Features To Preserve

The Android redesign must preserve reachable flows for:

* Library: book upload, drag/drop or file-picker upload where Android supports it, search, tags, book grid/list, edit/delete/update, embedding status.
* Reader: Foliate-based viewing, progress/session saving, TOC, reader search, reader settings, page/section navigation, text selection, annotation/highlight/excerpt creation, ask-AI from selection.
* Notes: standalone notes, book-linked notes, annotations, excerpts, bookmarks, note detail, update/delete actions, filtering by book/type.
* AI: chat, thread history, model selector, context selector, attachments, retry/stop, RAG search/context/TOC/range tools, notes tool, mind map tool, books tool, skills tool, reading stats tool, tool result viewers.
* Stats: reading statistics and heat map.
* Settings: general settings, font manager, vector model settings, TTS settings, model providers, provider details, model management.
* System behavior: safe-area handling, Android back behavior, theme/system UI behavior, toasts/errors, loading states.

## App Architecture

The redesign should replace the desktop shell, not the service/store layer.

### Android Shell

Create a mobile-first shell that owns:

* Top-level destination state: Library, Notes, AI, Stats.
* Active book state for the single-reader model.
* Reader overlay state: controls visible, dock visible, active sheet.
* Sheet stack and Android back-button resolution.
* Phone/tablet layout switching.
* Safe-area placement for navigation, dock, sheets, chat input, and reader controls.

The shell should remove or bypass desktop assumptions from the current app shell:

* No top app-tabs strip for Android.
* No persistent desktop sidebar.
* No desktop window controls in the Android UI.
* No resizable side panels in the reader.

Existing services and stores should remain data owners where practical: library, reader, settings, provider/model, theme, TTS, chat/thread, notes, and statistics.

### Phone Layout

Phone uses a bottom navigation bar with four destinations:

* Library
* Notes
* AI
* Stats

The reader is a focused full-screen surface opened from Library. Bottom navigation does not compete with reading content while the reader is active; reader tools are reached through the reader dock.

### Tablet Layout

Tablet uses a navigation rail for the same four destinations. Non-reader destinations may use split panes when useful, such as a list/detail notes layout or AI thread list plus active chat.

The reader still uses the bottom dock model rather than a persistent side inspector. This keeps reader behavior consistent across phone and tablet.

## Visual System

Use the Stitch `Luminous Scholar` direction:

* Paper-like light surfaces.
* Ink-charcoal primary text and primary actions.
* Muted scholarly green reserved for AI/helpful states and subtle progress cues.
* Low-contrast borders and tonal layers instead of heavy shadows.
* Serif rhythm for reading content, sans-serif rhythm for UI chrome.
* Thin progress indicators.
* Small-radius cards and controls, avoiding bulky desktop panels.

Core mobile primitives to define:

* Android app shell.
* Bottom navigation.
* Tablet navigation rail.
* Reader top context bar.
* Reader bottom tool dock.
* Bottom sheet and full-height sheet variants.
* Book cards/list rows.
* Note cards/list rows.
* Chat message and tool-result cards.
* Filter chips and tags.
* Segmented controls.
* Settings list rows and form controls.
* Empty, loading, error, and retry states.

## Destination Design

### Library

Library is the primary entry. It should show the user's books with search and tag filtering. Book opening activates the single current reader.

Library should preserve upload, search, tags, edit, delete, refresh, embedding status, and empty states. On phone, controls should be reachable from the top app bar, filter chips, and contextual menus. On tablet, the rail stays visible and Library may use wider grids.

### Reader

Reader is a focused surface. A tap reveals:

* Top context bar: back, current section/chapter, overflow/menu when needed.
* Bottom dock: TOC, search, note, AI, style/settings.
* Thin progress/page indicator.

Reader sheets:

* TOC sheet.
* Search sheet with results and jump actions.
* Notes sheet scoped to active book/current selection.
* AI sheet scoped to book, section, or selected text.
* Style/settings sheet for reading layout, typography, theme, and related controls.
* Annotation/selection sheet or popover for highlight, note, excerpt, ask-AI.

Android back behavior in reader:

1. Close active sheet.
2. Hide visible dock/controls.
3. Return to Library.

### Notes

Notes is a unified reading notebook. It includes:

* Standalone notes.
* Book-linked notes.
* Highlights/annotations.
* Excerpts.
* Bookmarks.

Required filters:

* Book.
* Type.
* Recency or updated date.

Reader note entry opens this same system scoped to the current book or selected text. Top-level Notes supports cross-book review.

### AI

AI is a chat-first workspace. It includes:

* Thread history.
* Model selector.
* Optional book/context selector.
* Attachments where supported.
* Prompt suggestions.
* Tool result cards/sheets.
* Retry, stop, and error states.

Reader AI uses the same infrastructure but defaults context to active book, section, selection, and references.

AI tools remain available through chat/tool calls. The default entry is not an AI lab dashboard.

### Stats

Stats preserves existing reading statistics and heat map. It should become a mobile/tablet scanning surface with quiet summary cards, streak/reading-time context, and the existing heat-map behavior adapted to small screens.

### Settings And Skills

Settings and Skills are secondary surfaces:

* Settings can be reached from destination overflow menus, AI controls, or Library profile/menu entry.
* Skills can be reached through AI or a secondary settings/tools menu.

They are not top-level Android destinations.

## Data Flow

The redesign keeps existing behavior sources where practical:

* Library data comes from book services and `library-store`.
* Reader data comes from reader store creation, Foliate hooks, reader config, progress/session services, and app settings.
* Notes use note and book-note services.
* AI uses existing chat state, thread state, provider/model stores, and AI tool modules.
* Settings use existing settings/provider/model/font/TTS stores and services.

The new shell should coordinate presentation state and navigation state only. It should not duplicate persistence logic already owned by services/stores.

## Error Handling

Errors should appear where the user initiated the action:

* Book load failures: reader error state with return to Library and retry.
* Upload failures: Library upload item/error toast with retry where possible.
* Note save/delete failures: inline message or toast, preserving unsaved content.
* AI provider/model failures: chat message error with retry/change-model affordance.
* Tool failures: tool card error state with retry or explanation.
* Embedding/RAG failures: contextual AI/library status, not a blocking global crash.

Long-running AI/tool states must be cancellable and must not trap the reader in a sheet.

## Testing And Acceptance

### Build And Type Quality

`pnpm --filter app build` must pass. Changed hooks, stores, and components should preserve TypeScript strictness and avoid broad `any` except where existing AI tool payloads already require it.

### Behavior Preservation Checks

Manual verification must cover:

* Library upload/search/tags/open-book/edit/delete.
* Reader load/progress/TOC/search/settings/navigation/annotation/ask-AI.
* Notes filters, note details, create/update/delete where supported.
* AI chat/thread/context/model/tool-result flows.
* Stats loading and responsive display.
* Settings access for providers, models, fonts, TTS, vector model, and general settings.
* Android back and sheet-stack behavior.

### Responsive Visual Checks

Verify:

* Phone portrait.
* Phone landscape.
* Tablet portrait.
* Tablet landscape.

Check safe areas, bottom nav/rail switching, reader dock, sheets, text selection popups, chat input, and absence of overlapping controls.

## Out Of Scope

* Vue migration.
* Ionic React or Material UI adoption.
* Desktop UX parity.
* Strict feature copying from Stitch.
* New product features not needed for existing feature preservation.
* Simultaneous multi-book tabs in the Android shell.
* Persistent reader side inspectors.

## References

* Trellis task: `.trellis/tasks/05-14-mobile-android-frontend-redesign`
* Stitch project: `AI Reading Assistant`
* Stitch design system: `Luminous Scholar`
* Component strategy research: `.trellis/tasks/05-14-mobile-android-frontend-redesign/research/mobile-ui-component-strategy.md`
* Visual companion session: `.superpowers/brainstorm/codex-54932-1778818880`
