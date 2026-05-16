# PRD: Mobile AI Chat Overlay Reliability

## Problem

The Android mobile AI surfaces are unreliable:

- Opening AI from the home destination or reader sheet can show a mostly blank chat area.
- In the reader AI sheet, the model selector may appear unresponsive.
- New conversation and history controls are difficult to tap.
- Settings opened from the reader AI sheet renders behind the chat sheet and only becomes visible after closing AI.

## Goal

Make the Android AI chat usable from both the standalone AI destination and the reader-scoped AI sheet.

## MVP Scope

- Provide a mobile-native AI chat layout for `MobileAiChat` instead of embedding desktop-only resizable chat chrome on phones.
- Keep reader-scoped AI chat inside `MobileSheet` with a stable header, scrollable content area, and bottom input.
- Ensure portalled overlays opened from mobile sheets render above the active `z-[100]` sheet layer.
- Make chat header controls meet Android touch target expectations.
- Preserve existing shared chat state, model selection, thread history, settings, and message rendering behavior.

## Acceptance Criteria

- Standalone mobile AI destination shows a visible empty state or messages and input controls instead of a blank page.
- Reader AI sheet shows visible empty state/messages and the input stays reachable above the safe area.
- Model selector opened inside the reader AI sheet is visible and tappable above the sheet.
- History and new conversation controls use reliable touch targets.
- Settings opened from AI is visible above the reader AI sheet.
- Existing desktop chat components remain available for legacy desktop surfaces.
- `pnpm --filter app build` succeeds.

## Technical Notes

- `ReaderSheetHost` renders AI content in `MobileSheet`, whose `DrawerContent` uses `z-[100]`.
- Shared Radix primitives currently portal dropdown/dialog/popover content to `document.body` with default `z-50`, which places them behind the mobile sheet.
- `MobileAiChat` currently renders `ChatPage` when no `bookId` is provided. `ChatPage` is desktop-oriented and uses `Resizable`, rounded desktop chrome, and a desktop empty state.
- `SideChat` is closer to the reader-scoped mobile use case but still needs mobile touch targets and stable flex sizing when mounted inside a full-height sheet.
