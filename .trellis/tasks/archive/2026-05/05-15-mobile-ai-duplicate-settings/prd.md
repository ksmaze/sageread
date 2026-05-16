# Fix Duplicate Mobile AI Settings Button

## Goal

The mobile settings surfaces should be usable from the AI destination and reader-scoped AI sheet. The standalone mobile AI page currently renders duplicate settings buttons, and the settings dialog can overflow horizontally on tablet portrait viewports because the `sm` layout forces an 800px minimum width.

## Requirements

- Hide the shell-level floating `MobileSettingsEntry` while the active destination is `"ai"`.
- Keep the `MobileAiChat` header settings button visible for the standalone AI destination.
- Keep the `MobileAiChat` settings button visible for reader-scoped AI sheets, where the shell-level floating entry is not the right control surface.
- Preserve shell-level floating settings access on non-AI destinations.
- Make the settings dialog fit tablet portrait widths by using viewport-constrained width at `sm` and removing the fixed 800px minimum width.

## Acceptance Criteria

- [ ] Library, Notes, and Stats destinations still render the shell-level floating settings entry.
- [ ] The standalone AI destination renders only the AI header settings entry.
- [ ] Reader-scoped AI sheet still renders its own settings entry.
- [ ] Settings opened on tablet portrait fits within the viewport instead of clipping the sidebar/content.
- [ ] The app builds successfully.

## Definition of Done

- Focused regression test covers the shell settings visibility rule.
- Biome check passes for changed files.
- `pnpm --filter app build` succeeds.

## Technical Approach

Extract the shell settings visibility decision into a tiny pure helper and use it from `AndroidAppShell`. Move the settings dialog layout class into a small exported contract so a focused `node:test` regression can guard against reintroducing `sm:min-w-[800px]`.

## Decision (ADR-lite)

**Context**: `AndroidAppShell` owns a global floating settings button, while `MobileAiChat` owns chat-specific header controls including settings.

**Decision**: Hide the global floating settings button only on the `"ai"` destination and keep the chat-local settings button.

**Consequences**: AI keeps one reachable settings control aligned with its model/new/history controls. Other destinations retain their global settings shortcut. Reader AI sheets remain self-contained.

## Out of Scope

- Redesigning the AI chat header.
- Changing settings dialog content or provider/model settings behavior.
- Changing reader sheet controls unrelated to duplicate settings.

## Technical Notes

- Root cause confirmed in `packages/app/src/mobile/app-shell.tsx`: `MobileSettingsEntry` is fixed at the shell level for every destination.
- `packages/app/src/mobile/ai/mobile-ai-chat.tsx` intentionally renders its own settings button and is shared by the standalone AI page and reader-scoped AI sheet.
- Tablet portrait root cause confirmed in `packages/app/src/components/settings/settings-dialog.tsx`: `sm:min-w-[800px]` and `sm:w-[800px]` force a dialog wider than some tablet portrait viewports.
- Relevant spec: `.trellis/spec/app/frontend/android-mobile-shell.md`.
