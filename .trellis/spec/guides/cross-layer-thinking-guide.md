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

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] For dynamic SQL, tested the generated query against a real/in-memory database, not only by reading the builder code
- [ ] For Tauri/backend string errors, verified the frontend service preserves the real message instead of replacing it with a generic fallback
- [ ] For runtime library assets, verified the production output contains the directories fetched at runtime
- [ ] For renderer contracts, verified annotation overlays and previous/next/TOC navigation against both reflowable and fixed-layout/PDF books
- [ ] For close/reopen flows, reopened the same PDF after teardown and verified stale renderer events and cached object URLs do not survive the previous session

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
