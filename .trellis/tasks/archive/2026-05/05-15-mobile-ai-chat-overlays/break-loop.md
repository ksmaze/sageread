## Bug Analysis: Mobile AI Chat Blank State And Hidden Overlays

### 1. Root Cause Category

- **Category**: D - Test Coverage Gap, E - Implicit Assumption
- **Specific Cause**: `useChatState` used a ref (`isInit.current`) to decide whether to render the empty state. When a book had no existing chat thread, initialization set the ref but did not update state, so React never re-rendered from the blank message container into the empty state. Separately, reader AI runs inside `MobileSheet z-[100]`, while shared portalled Radix controls were still at `z-50`, so model dropdowns and settings rendered behind the sheet.

### 2. Why Fixes Failed

1. Initial UI-only fixes would have missed the hook-level render bug because the blank state depended on the empty async result path.
2. Raising only the settings dialog would have left nested dropdown/select/popover controls behind the dialog or sheet.
3. Reusing desktop `ChatPage` in mobile carried desktop-only layout assumptions (`Resizable`, desktop empty state/input placement) into the Android shell.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added a focused regression for book chat initialization with no existing thread. | DONE |
| P0 | Documentation | Captured mobile AI and portalled overlay stacking contracts in `android-mobile-shell.md`. | DONE |
| P1 | Hook Guidelines | Documented that ref-driven render branches need state/force render after async completion. | DONE |
| P1 | Architecture | Replaced mobile AI's direct desktop `ChatPage` embedding with a mobile-native layout. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any reader sheet content that opens `Dialog`, `DropdownMenu`, `Popover`, or `Select` can fail if the portalled content stays under `z-[100]`.
- **Design Improvement**: Mobile destinations should adapt shared feature logic, not embed desktop page chrome directly.
- **Process Improvement**: For async initialization bugs, inspect all empty-result paths, not only success-with-data and error paths.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/android-mobile-shell.md`.
- [x] Updated `.trellis/spec/app/frontend/hook-guidelines.md`.
- [x] No `src/templates/markdown/spec/` tree exists in this repository, so there was no template copy to sync.
