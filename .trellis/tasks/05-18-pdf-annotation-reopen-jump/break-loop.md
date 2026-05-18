## Bug Analysis: PDF Annotation Replay And Note Jump Blank State

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, plus async lifecycle semantics.
- **Specific Cause**: App annotation replay assumed every reader progress location was a visible range CFI. PDF/fixed-layout relocate events provide `range: null` with a page-level CFI, so saved page-internal annotation CFIs never matched the current page after reopen or navigation.
- **Second-order Cause Missed In The First Fix**: Reader startup restored the saved book location before a pending note target could run. If that saved CFI was stale or invalid, foliate initialization could fail/blank before the notes jump executed. `view.goTo()` also catches renderer failures internally and resolves `undefined`, so simply awaiting the promise and clearing the target was still unsafe.

### 2. Why Fixes Failed

1. Previous lifecycle cleanup fixed stale PDF renderer/book resources, but did not address the app-side annotation replay filter.
2. Previous fixed-layout overlay work ensured `getContents()` exposed overlayers, but saved overlays still needed to be re-added by the app after a page became visible.
3. The first app-side fix verified the visibility helper and rejected `goTo()` promises, but did not cover foliate's "failure resolved as undefined" behavior.
4. The first app-side fix consumed note jumps only after `isViewerReady`; that meant a stale saved location could prevent readiness and block the pending target entirely.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Add PDF page-level annotation visibility regression tests. | DONE |
| P0 | Test Coverage | Add pending navigation consumption tests for await-before-clear, unresolved `goTo()`, and pending-target initial location precedence. | DONE |
| P0 | Implementation Guard | Initialize foliate from a pending note target before the saved location, and fall back to start if initial restore fails. | DONE |
| P0 | Implementation Guard | Keep live view/readiness state null/false on init failure and cleanup. | DONE |
| P1 | Documentation | Document fixed-layout page-level CFI replay and pending navigation startup contract in app state-management spec. | DONE |
| P1 | Documentation | Add cross-layer guide warning for reader progress CFI and startup/navigation contracts. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Bookmark/excerpt replay or search indicators can fail if they reuse EPUB-only range comparisons for PDF/fixed-layout pages.
- **Similar Issues**: Any "open book then go to target" feature can fail if saved location restore is allowed to run before the target.
- **Design Improvement**: Keep renderer-specific CFI visibility logic behind a shared helper instead of duplicating `CFI.compare()` filters in hooks.
- **Process Improvement**: Any future reader feature must verify both `foliate-paginator` and `foliate-fxl` progress/navigation contracts before filtering by visible location or clearing a pending target.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/state-management.md`
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Verified no `src/templates/markdown/spec/` tree exists in this repo to sync.
