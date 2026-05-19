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

---

## Bug Analysis: Android PDF Iframe URL ANR

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, D - Test Coverage Gap, E - Implicit Assumption.
- **Specific Cause**: Generated PDF page HTML was converted to `blob:` URLs and assigned to fixed-layout iframes. On Android/Tauri, those iframe URL navigations can pass through Wry's `shouldOverrideUrlLoading` path on the UI thread. The captured ANR showed the main thread blocked in `RustWebViewClient.shouldOverrideUrlLoading -> wry::android::binding::shouldOverride -> tauri_runtime_wry::create_webview -> WebviewManager::prepare_webview`, while logcat also showed PDF iframe sandbox/blob warnings.

### 2. Why Fixes Failed

1. Earlier PDF annotation fixes focused on replay visibility, stale renderer state, and dialog sequencing. They did not remove the Android WebView URL-navigation boundary used by generated PDF pages.
2. The sandbox warning looked like a security warning, but the blocking stack was actually Tauri/Wry URL override handling. Treating the warning as the cause would leave the `blob:` iframe navigation path intact.
3. Existing tests covered stale loads and PDF cleanup, but did not assert that generated PDF page frames avoid `iframe.src` URL assignments.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Represent generated PDF page HTML as inline frame content (`srcdoc`) instead of cached `blob:` page URLs. | DONE |
| P0 | Runtime Cleanup | Clear PDF `srcdoc` frames without assigning `about:blank` to `iframe.src`, while still cancelling PDF render work. | DONE |
| P0 | Test Coverage | Add fixed-layout tests proving generated inline frames do not assign `iframe.src` on load or clear. | DONE |
| P0 | Test Coverage | Update PDF lifecycle tests to assert page sections expose `srcdoc` and do not allocate/revoke page blob URLs. | DONE |
| P1 | Runtime Observability | Serialize `[SageRead:ReaderNav]` details as one JSON string so logcat no longer collapses them to `[object Object]`. | DONE |
| P1 | Documentation | Record the Android/Tauri generated PDF page URL contract in foliate and cross-layer specs. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Comic-book and fixed-layout EPUB generated documents still use object URLs in places; only the generated PDF page path is changed here because the ANR was tied to repeated PDF page iframe navigations.
- **Design Improvement**: Treat generated renderer documents as inline state when they do not need independent resource URL identity.
- **Process Improvement**: For Android WebView ANRs, inspect native main-thread stacks before chasing adjacent console warnings.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/foliate-js/frontend/component-guidelines.md`
- [x] Updated `.trellis/spec/foliate-js/frontend/state-management.md`
- [x] Updated `.trellis/spec/app/frontend/state-management.md`
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Verified no `src/templates/markdown/spec/` tree exists in this repo to sync.

---

## Bug Analysis: Note Jump Debuggability Gap

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, D - Test Coverage Gap, E - Implicit Assumption.
- **Specific Cause**: The note-to-original path spans dialog UI, unified notes, mobile/desktop shell stores, per-book reader stores, `ReaderViewer`, and foliate. Previous fixes changed individual layers, but the runtime chain did not expose whether a failed Android jump lost the request at the click handler, shell handoff, reader store, viewer readiness, foliate `goTo`, or fixed-layout relocate boundary.

### 2. Why Fixes Failed

1. The renderer lifecycle and pending-target fixes addressed real bugs, but they still relied on local reasoning when Android behavior remained intermittent.
2. The dialog sequencing fix closed a plausible portal/focus race, but did not prove that the scheduled navigation reached the shell and reader layers.
3. Direct `view.goTo()` paths in mounted reader notes/annotations ignored missing views, thrown errors, and unresolved foliate results, so failures could look identical to a no-op.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Runtime Observability | Add `[SageRead:ReaderNav]` logcat-visible logs at every note-to-reader boundary. | DONE |
| P0 | Runtime Guard | Route direct mounted-reader note/annotation jumps through a shared helper that logs missing CFI/view, thrown errors, and unresolved results. | DONE |
| P1 | Test Coverage | Add stable tests for reader navigation debug target/result summaries. | DONE |
| P1 | Documentation | Document reader-jump observability requirements in state-management and cross-layer specs. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Search result jumps, TOC jumps, and annotation list jumps can fail silently if they ignore `goTo` results.
- **Design Improvement**: Treat cross-layer reader navigation as a traceable request, not a fire-and-forget UI callback.
- **Process Improvement**: After two failed fixes in a cross-layer Android reader flow, add boundary logs before another behavioral change.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/state-management.md`
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Verified no `src/templates/markdown/spec/` tree exists in this repo to sync.

---

## Bug Analysis: PDF Fixed-Layout Stale Navigation Race

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, D - Test Coverage Gap, E - Implicit Assumption.
- **Specific Cause**: `FixedLayout.goToSpread()` updated navigation state and allowed `section.load()`, iframe `load`, and PDF `onZoom()` completions to continue after a newer navigation had started. A stale page could replace the active iframe or emit `relocate` after the app had already moved on, so app annotation replay sometimes targeted a page that was not actually displayed.

### 2. Why Fixes Failed

1. Overlay exposure fixes made `getContents()` include overlayers, but did not prove that the returned frame still belonged to the latest navigation.
2. PDF render awaiting made `relocate` later, but the first version only suppressed stale `relocate`; it still allowed stale async loads to replace the DOM before the suppression check.
3. Lifecycle cleanup reduced repeat-open white screens, but stale fixed-layout navigations could still leave orphan render work alive while the app paged through the document.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Treat fixed-layout navigation as a tokened async transaction; stale work cannot mutate frames, sides, current index, overlays, or readiness events. | DONE |
| P0 | Test Coverage | Add regression tests for stale `section.load()`, stale iframe `load`, stale async render completion, and unchanged-scale PDF rerender suppression. | DONE |
| P0 | Runtime Cleanup | Cancel in-flight PDF page renders and destroy frames when a page is replaced or the renderer closes. | DONE |
| P1 | Documentation | Document the fixed-layout/PDF readiness and stale-navigation contract in foliate specs and cross-layer guide. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any renderer that emits readiness before async document construction finishes can break annotations, search indicators, TTS, or note jumps.
- **Design Improvement**: Keep fixed-layout current index aligned with the frames actually displayed; do not commit requested navigation state before the spread is ready.
- **Process Improvement**: Future reader renderer tests need adversarial async ordering, not only happy-path `await goTo()` cases.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/foliate-js/frontend/state-management.md`
- [x] Updated `.trellis/spec/foliate-js/frontend/quality-guidelines.md`
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Verified no `src/templates/markdown/spec/` tree exists in this repo to sync.

---

## Bug Analysis: Note Dialog Navigation Freeze

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract, E - Implicit Assumption.
- **Specific Cause**: The note editor and unified notes dialog triggered reader navigation synchronously from inside an open Radix dialog. For PDF/fixed-layout books, that let foliate replace iframe/page state while the modal was still closing and restoring focus, which could hang the note-to-original flow even though normal reading and annotation replay worked.

### 2. Why Fixes Failed

1. The renderer race fix was necessary but not sufficient; it did not address dialog focus cleanup.
2. Direct `view.goTo()` from modal button handlers assumed navigation and dialog teardown could happen in the same turn.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | UI sequencing | Close note dialogs first, then schedule foliate navigation on the next turn. | DONE |
| P0 | Test Coverage | Add a regression test for dialog-close-before-navigation ordering. | DONE |
| P1 | Documentation | Record the note-dialog portal vs reader-navigation contract in the app state guide and cross-layer guide. | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any portal dialog that launches reader navigation, sheet switching, or book opening can race focus cleanup.
- **Design Improvement**: Keep portal teardown and reader navigation in separate turns.
- **Process Improvement**: For modal actions, verify the close path and the navigation path independently.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/app/frontend/state-management.md`
- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
