## Bug Analysis: AI Annotation Popover Overflow

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, D - Test Coverage Gap, E - Implicit Assumption
- **Specific Cause**: The AI annotation popover was triggered from inline markdown inside `MobileAiChat`, but the popover content is portalled to `document.body`. The implementation treated the trigger as if it lived in a desktop side-chat container, forced left/right placement, computed offsets from `#chat-sidebar`, and used a fixed `w-80` panel. In the Android reader AI `MobileSheet`, that assumption lets a citation near an edge render most of the popover outside the phone viewport.

### 2. Why Fixes Failed

1. No failed code fixes were attempted in this session; root-cause tracing found the desktop side-placement assumption before implementation.
2. A z-index-only fix would not address this bug because the panel was above the sheet but geometrically outside the viewport.
3. A width-only fix would reduce the blast radius but still preserve the wrong left/right placement behavior for edge anchors.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Use Radix collision-aware vertical placement and viewport-clamped dimensions for AI annotation popovers. | DONE |
| P0 | Test Coverage | Added a regression test that rejects desktop side placement and requires collision padding plus viewport/available-height clamping. | DONE |
| P0 | Documentation | Captured mobile sheet popover containment in `android-mobile-shell.md`. | DONE |
| P1 | Documentation | Added a cross-layer thinking checklist for trigger-surface-to-portal-root UI boundaries. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any `PopoverContent`, `DropdownMenuContent`, `SelectContent`, tooltip, or custom overlay opened from a mobile sheet can repeat this class of bug if it keeps desktop side-panel placement, fixed dimensions, or parent-relative assumptions after portalling to `document.body`.
- **Design Improvement**: Treat portalled overlays as cross-boundary UI: the trigger surface, portal root, z-index layer, collision boundary, and viewport size are all part of the contract.
- **Process Improvement**: For mobile overlay bugs, inspect both stacking and geometry. Passing z-index does not imply the overlay is visible or contained.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/android-mobile-shell.md`.
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
- [x] No `src/templates/markdown/spec/` tree exists in this repository, so there was no template copy to sync.
