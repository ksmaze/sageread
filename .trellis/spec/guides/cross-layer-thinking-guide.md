# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |
| Trigger Surface ↔ Portal Root | z-index, collision boundary, viewport clamping, focus/outside-click behavior |
| Dynamic SQL ↔ Service Error UI | malformed generated SQL, hidden backend string errors |
| Library Runtime Assets ↔ Bundler ↔ Tauri Static Server | computed URLs that bundlers cannot statically discover, missing copied asset directories, production-only `/assets/undefined` URLs |
| Foliate Renderer ↔ Reader UI/Annotations | one renderer emits/returns the expected navigation and overlayer contract while another renderer silently lacks it |
| Reader Progress CFI ↔ Annotation Replay | reflowable EPUB progress is a visible range CFI, while fixed-layout/PDF progress can be a page-level CFI with `range: null`; replay logic must branch on that contract |
| Reader Pending Target ↔ Saved Location Restore | opening from notes requires the pending target to win over stale saved reader location during initialization |
| Fixed-Layout/PDF Async Renderer ↔ Annotation Replay | app replay treats `relocate` as page-ready, so stale section/iframe/render completions must not mutate current frames or emit readiness events |
| Note Dialog Portal ↔ Reader Navigation | modal focus cleanup must finish before PDF/fixed-layout navigation replaces iframes |
| Reader Navigation Request ↔ Logcat Observability | when note jumps stay intermittent, every layer must log the same request metadata so the failing boundary can be identified from Android logcat without guessing |
| Generated PDF Page HTML ↔ Android Tauri WebView | assigning generated PDF pages as `blob:` iframe URLs can be intercepted by Wry `shouldOverrideUrlLoading` and block the UI thread |
| Android Launch Intent ↔ Tauri RunEvent ↔ Frontend Import | Android cold-start file opens arrive as `MainActivity.intent`, while Tauri `RunEvent::Opened` is driven by `onNewIntent`; frontend imports must drain the visible activity/plugin queue and preserve `content://` URI shape across the JS fs boundary |
| AI SDK UI Messages ↔ Model Prompt Conversion | SDK conversion helpers can be async even when their output is an array shape; callers must await conversion before handing data to prompt standardization or streaming APIs |
| Foliate Search Stream ↔ App Consumers | section-scoped search yields direct `{ cfi, excerpt }` matches while book-wide search can yield grouped `{ label, subitems }` results; consumers must type and handle both shapes |
| Bundled Default Skills ↔ Existing User Database | changing `default-skills.json` only affects newly inserted rows unless startup safely refreshes stock legacy rows without overwriting user edits |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Treating Portalled UI As If It Stayed In Its Parent

**Bad**: A popover opened from a mobile sheet uses desktop sidebar left/right placement and fixed width because the trigger component was originally written for a side panel.

**Good**: Map the trigger surface, portal root, stacking layer, collision boundary, and viewport constraints. Use the relevant layer spec for concrete contracts; for Android mobile overlays see `../app/frontend/android-mobile-shell.md`.

### Mistake 5: Trusting Bundlers To Discover Runtime Asset Directories

**Bad**: A library builds a computed `./vendor/pdfjs/${path}` URL for both files and directories, then assumes the production bundle will copy `cmaps/` and `standard_fonts/`.

**Good**: Treat runtime-fetched asset trees as an explicit cross-layer contract. Keep directory URLs runtime-relative and make the consuming app copy and test the emitted asset tree.

### Mistake 6: Treating Every Reader Location As A Visible Range

**Bad**: Filtering saved annotations with `CFI.compare(annotation.cfi, collapse(location))` and `collapse(location, true)` for every renderer.

**Good**: Check the renderer/progress contract first. Reflowable renderer progress can expose a visible range, but fixed-layout/PDF relocate events may report `range: null` and a page-level CFI. In that case, resolve the saved annotation CFI and current page CFI to section indexes and compare the indexes.

### Mistake 7: Treating Reader Startup As Separate From Pending Navigation

**Bad**: Always restore the saved book location first, then consume a pending note jump after `isViewerReady`; a stale saved CFI can fail initialization before the note target runs.

**Good**: If a pending reader target exists, use it as the initial foliate location and only fall back to the saved location when no target is pending. Treat both thrown navigation errors and unresolved `goTo()` results as failures.

### Mistake 8: Emitting Reader Readiness Before Fixed-Layout/PDF Async Work Settles

**Bad**: A fixed-layout renderer sets the current index or emits `relocate` as soon as a target page is requested, while old section loads, iframe loads, or PDF renders can still complete later and replace the visible frame.

**Good**: Treat fixed-layout/PDF navigation as a tokened async transaction. Only the latest navigation may mutate active frame fields, redraw overlays, or emit `relocate`, and the event should fire after the PDF text layer and overlayer are ready for annotation replay.

### Mistake 9: Navigating The Reader Before Closing A Note Dialog

**Bad**: A note dialog button calls `view.goTo(cfi)` first and closes the Radix dialog afterward. PDF/fixed-layout navigation can replace iframe content while the portal is still trapping/restoring focus.

**Good**: Close the dialog first, then schedule the reader navigation on the next turn. This keeps modal focus cleanup separate from foliate iframe replacement and page render work.

### Mistake 10: Chasing A Cross-Layer Reader Jump Without Runtime Evidence

**Bad**: Re-running a note-to-original flow, seeing it fail in different ways, and applying another behavioral fix without logs that show which boundary dropped the request.

**Good**: Add a shared log prefix and emit the target/request metadata at each boundary: click handler, dialog dismissal, shell/store handoff, reader-store request, `ReaderViewer` consume, foliate initialization, and `relocate`. Once the logs show the first failing boundary, change behavior there.

### Mistake 11: Treating Generated PDF Pages As Navigable URLs

**Bad**: Build a generated PDF page document, wrap it in `URL.createObjectURL(new Blob([html]))`, and assign that `blob:` URL to a fixed-layout iframe on Android/Tauri.

**Good**: Treat generated PDF page HTML as inline renderer state. Use `iframe.srcdoc` or an equivalent same-document write, keep PDF rendering cancellation tokened, and clear inline frames without assigning a replacement URL to `iframe.src`.

### Mistake 12: Treating Android Open-With As A Pure Rust Event

**Bad**: Add file associations and wait only for `RunEvent::Opened` to import EPUB/PDF files. On Android, that event is emitted from `onNewIntent`, while a cold-start `ACTION_VIEW` file open is the activity's initial intent.

**Good**: Map the Android activity lifecycle, Tauri runtime event, native plugin command, and frontend import service as one flow. Read `MainActivity.intent` through a native plugin for cold starts, call `setIntent(intent)` on warm starts, merge/dedupe native URLs with any Tauri queued URLs, and keep `content://` values as strings when crossing the JS fs API.

### Mistake 13: Assuming SDK Conversion Helpers Are Synchronous

**Bad**: Pass the return value of `convertToModelMessages(...)` directly into `streamText` because the eventual value is a `ModelMessage[]`.

**Good**: Treat UI-message to model-message conversion as an async boundary. Wrap it in a focused helper, await it before streaming, and regression-test the helper with a quick-action-style prompt so runtime prompt standardization receives an array, not a Promise.

### Mistake 14: Assuming Foliate Search Always Returns Grouped Results

**Bad**: Consume every `view.search()` item as `{ subitems }` and treat direct section matches as malformed or empty.

**Good**: Check the selected search scope. Section-scoped search can yield `{ cfi, excerpt }` directly, while book-wide search can yield grouped section results. Type the stream as a union, narrow at the consumer boundary, and regression-test both shapes before adding fallback behavior.

### Mistake 15: Assuming Bundled Default Skill Changes Reach Existing Databases

**Bad**: Edit `default-skills.json` and assume existing users will receive the changed skill. Startup uses database rows, and `INSERT OR IGNORE` leaves same-name rows unchanged.

**Good**: Treat bundled skill text and persisted skill rows as a cross-layer contract. Insert missing skills by name, and only refresh an existing row when its content exactly matches a known old stock default. Preserve user-edited skills.

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens
- [ ] For portalled UI, identified the trigger surface, portal root, z-index layer, collision boundary, and max viewport size
- [ ] For runtime library assets, identified which layer owns URL construction, asset copying, and packaged static serving
- [ ] For reader renderer features, checked every mounted renderer type (`foliate-paginator` and `foliate-fxl`) exposes the methods/events consumed by app chrome, annotations, and TOC/progress code
- [ ] For annotation replay, identified whether the current renderer reports a visible range CFI or a page-level CFI
- [ ] For reader jumps, identified whether pending navigation or saved location owns initial foliate startup

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] For dynamic SQL, tested the generated query against a real/in-memory database, not only by reading the builder code
- [ ] For Tauri/backend string errors, verified the frontend service preserves the real message instead of replacing it with a generic fallback
- [ ] For runtime library assets, verified the production output contains the directories fetched at runtime
- [ ] For renderer contracts, verified annotation overlays and previous/next/TOC navigation against both reflowable and fixed-layout/PDF books
- [ ] For close/reopen flows, reopened the same PDF after teardown and verified stale renderer events and cached object URLs do not survive the previous session
- [ ] For fixed-layout/PDF annotation replay, tested close/reopen and note-jump flows with saved page-internal highlight and note-marker CFIs
- [ ] For note jumps, tested invalid/stale saved locations do not prevent the pending target from initializing the reader
- [ ] For fixed-layout/PDF navigation races, tested stale section loads, stale iframe loads, and stale PDF render completions resolving after a newer page navigation
- [ ] For note-dialog "open original", verified the dialog closes before reader navigation is scheduled
- [ ] For intermittent note jumps, verified the same request metadata appears in logcat across the UI, shell/store, reader, and foliate layers
- [ ] For Android PDF note/page jumps, verified generated page loads do not produce `blob:` iframe navigation warnings or `shouldOverrideUrlLoading` ANRs
- [ ] For Android open-with imports, verified both cold-start and warm-start intents reach the visible main activity/plugin queue and that `content://` URIs are passed to Tauri fs as strings
- [ ] For AI SDK prompt conversion, verified async conversion helpers are awaited before calling streaming APIs and the result has the array shape those APIs inspect
- [ ] For Foliate search consumers, verified both direct section matches and grouped book-search results are handled before declaring "no results"
- [ ] For bundled default skill changes, verified existing stock rows migrate and user-edited rows are preserved

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
