# Fix AI Annotation Popup Overflow

## Goal

Fix the mobile AI assistant annotation/citation popup so tapping AI-generated markers never renders the popup outside the visible screen.

## What I already know

* User reported that clicking annotations provided by the AI can open a window that exceeds the screen bounds.
* The screenshot shows the Android reader with the AI assistant bottom sheet open, Chinese assistant content, inline citation chips, and a narrow overflowed popup edge on the left side of the viewport.
* The app package is `packages/app` and is Android mobile/tablet first.

## Assumptions

* The failing control is the inline annotation/citation marker inside AI assistant responses.
* The expected behavior is to clamp the popup horizontally and vertically within the visual viewport, respecting safe areas and the assistant sheet boundaries where applicable.
* The fix should preserve existing citation/annotation behavior and only change positioning/overflow handling.

## Requirements

* AI annotation/citation popups must remain fully visible inside the current viewport on narrow mobile screens.
* Popup positioning must handle anchors near the left, right, top, and bottom edges.
* The implementation must avoid layout jumps and should remain responsive across phone and tablet viewports.

## Acceptance Criteria

* [ ] Tapping an AI-provided annotation marker near any viewport edge does not render popup content off-screen.
* [ ] The popup remains usable inside the assistant bottom sheet while the sheet is scrolled.
* [ ] Existing annotation/citation content and click behavior continue to work.
* [ ] Relevant automated test coverage or a focused regression check exists.

## Definition of Done

* Tests added or updated where practical.
* Lint/typecheck and relevant test commands pass.
* Trellis spec guidance is updated to capture this UI containment lesson.
* Changes are committed after user confirmation of the commit plan.

## Out of Scope

* Redesigning the AI assistant sheet.
* Changing citation data format or model output.
* Reworking the broader reader annotation system unless it shares the same positioning primitive.

## Technical Notes

* Start by tracing the popup implementation and comparing with any existing bounded overlay/popover utilities.
* Relevant spec index: `.trellis/spec/app/frontend/index.md`.
* Root cause found in `packages/app/src/components/markdown/annotation-popover.tsx`: the popover uses desktop/sidebar positioning (`side="left"` for reader-scoped chat and `side="right"` for standalone chat) with fixed `w-80` content. Inside the full-screen Android `MobileSheet`, a citation near the edge can therefore position most of the 320px panel outside the viewport before the user can read it.
* Fix direction: use viewport-colliding top/bottom placement for annotation popovers and clamp content width/height to Radix available-size variables plus `100vw`.
