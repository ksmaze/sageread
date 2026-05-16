# Smaller Reader Note Marker

## Context

The current reader note marker is a blue rounded badge with the Chinese character `笔`. On Android-sized reading pages it appears too large and overlaps body text. The user wants a smaller, semi-transparent bookmark-style icon instead.

The user also accepted the Superpowers visual companion, but this environment is Windows. The existing visual companion scripts only include `.sh` launchers, so the workflow should add a PowerShell launcher before using the browser companion.

## Requirements

- Replace the reader note marker visual with a smaller semi-transparent bookmark icon.
- The marker should be less visually intrusive and avoid covering readable text.
- The marker should remain tappable enough on Android/mobile.
- The marker should keep the existing behavior: tapping it opens the independent note editor.
- The marker should not claim the whole selected text range; only the icon should be clickable.
- Preserve note/highlight independence.
- Add Windows-friendly PowerShell visual-companion launch scripts to the Superpowers brainstorming skill before starting the companion.

## Confirmed Design Direction

1. Add `start-server.ps1` and, if needed, `stop-server.ps1` beside the existing Superpowers brainstorming `.sh` scripts.
2. Use the PowerShell visual companion launcher to show a small visual comparison of possible note marker styles.
3. Implement the selected marker by changing `Overlayer.noteMarker` and the reader draw options.
4. Verify with focused build/type checks.

## Confirmation

Confirmed by the user. Implement directly on `main`; do not create a separate branch.

## Visual Decision

The user selected option A from the visual companion: a 9x12 semi-transparent bookmark marker positioned at the selected text end/top, with the smallest visual footprint.
