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

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
