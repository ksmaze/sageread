# Component Guidelines

> How UI components and custom elements are built in `packages/foliate-js`.

---

## Overview

`foliate-js` components are native custom elements and DOM helper factories, not React components. Public renderer components are registered with `customElements.define()` and communicate through methods, attributes, parts, and `CustomEvent` details.

Core custom elements:

- `foliate-view` from `view.js`
- `foliate-paginator` from `paginator.js`
- `foliate-fxl` from `fixed-layout.js`
- `foliate-quoteimage` from `quote-image.js`

## Component Structure

Use classes extending `HTMLElement` for custom elements. Keep private state in class private fields and expose a small method/attribute surface.

```js
export class View extends HTMLElement {
    #root = this.attachShadow({ mode: 'closed' })
    #sectionProgress
    #tocProgress
    #pageProgress
    #searchResults = new Map()

    async open(book) {
        if (typeof book === 'string' || typeof book.arrayBuffer === 'function' || book.isDirectory)
            book = await makeBook(book)
        this.book = book
        // initialize renderer and progress helpers
    }
}

customElements.define('foliate-view', View)
```

For non-custom-element UI helpers, return plain DOM elements and methods. `ui/tree.js` returns `{ element, setCurrentHref }`; `ui/menu.js` returns a menu element.

## Props Conventions

There are no React props. Use these surfaces instead:

- Methods for actions: `open(book)`, `goTo(target)`, `prev()`, `next()`.
- Attributes for renderer configuration, such as `animated`, `flow`, `margin`, `gap`, `max-inline-size`, `max-block-size`, and `max-column-count` on the paginator.
- Custom events for outbound state: `load`, `relocate`, `create-overlayer`, and renderer-specific progress events.
- CSS parts for styling controlled internals: `filter`, `head`, and `foot`.

Do not add a JS property API where the README says an attribute API is the current contract.

## Composition Patterns

`foliate-view` composes lower-level renderers based on book layout:

```js
if (this.isFixedLayout) {
    await import('./fixed-layout.js')
    this.renderer = document.createElement('foliate-fxl')
} else {
    await import('./paginator.js')
    this.renderer = document.createElement('foliate-paginator')
}
```

Keep optional format and renderer modules dynamically imported so the library stays modular and avoids hard dependencies until a file type needs them.

## Fixed Layout Renderer Contract

### 1. Scope / Trigger

Use this contract when changing `fixed-layout.js`, `pdf.js`, `foliate-view` renderer selection, or any app-facing behavior for pre-paginated formats such as PDF and fixed-layout EPUB.

### 2. Signatures

```js
renderer.addEventListener('create-overlayer', event => {
    const { doc, index, attach } = event.detail
    attach(new Overlayer())
})

renderer.getContents()
// [{ doc, index, overlayer }]

renderer.prevSection()
renderer.nextSection()
renderer.firstSection()
renderer.lastSection()
```

### 3. Contracts

- `foliate-fxl` must emit `load`, `relocate`, and `create-overlayer` with the same app-facing semantics as `foliate-paginator`.
- `create-overlayer` detail must include `{ doc, index, attach }`; `attach(overlayer)` must store the overlayer on that frame and append `overlayer.element` over the matching iframe.
- `getContents()` must return each loaded non-blank frame with its `doc`, section `index`, and attached `overlayer`. Annotation drawing in `View.addAnnotation()` depends on `index` and `overlayer`.
- `prevSection()`, `nextSection()`, `firstSection()`, and `lastSection()` must navigate between linear book sections for fixed-layout renderers. App chrome may call these methods without knowing whether the active renderer is paginated or fixed-layout.
- Navigating to another page in the same spread must update the active side and emit `relocate`; otherwise progress, TOC highlighting, and annotation loading can remain on the old page.
- Overlay geometry must be redrawn after fixed-layout zoom/fit changes because PDF render frames can change iframe dimensions without remounting the document.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| A PDF page frame loads | Emit `create-overlayer` before the next `relocate` for that frame. |
| `View.addAnnotation()` targets a loaded PDF page | `renderer.getContents()` finds a matching `{ index, overlayer }`, and the annotation draws on the PDF. |
| App reader chrome calls `nextSection()` on a PDF | Move to the next linear page/section or no-op at the boundary. |
| Target page is in the currently loaded spread | Update `#side`, redraw, and emit `relocate`. |
| Frame is blank filler for a spread | Exclude it from `getContents()` and do not create an overlayer. |

### 5. Good/Base/Bad Cases

- Good: A selected PDF highlight is saved, `view.addAnnotation()` resolves its fake CFI to the PDF page index, and fixed-layout exposes that page's overlayer so the highlight is visible.
- Good: The mobile reader dock calls `renderer.nextSection()` and a PDF moves from page 1 to page 2 through the same renderer contract used by reflowable books.
- Base: A fixed-layout EPUB without annotations still emits `load` and `relocate` normally.
- Bad: Returning only `{ doc }` from `getContents()`; annotations cannot find the page overlayer.
- Bad: Implementing page movement only in `next()`/`prev()` while leaving adjacent-section methods undefined; app controls can silently no-op.

### 6. Tests Required

- Run `node --test packages/foliate-js/tests/fixed-layout-tests.js` after changing `fixed-layout.js` renderer contracts.
- Run `pnpm --filter foliate-js build` after changing `fixed-layout.js`, `view.js`, or renderer event shapes.
- Run `pnpm --filter app build` after changing app-facing renderer methods, emitted event details, or ambient declarations.
- Manual reader checks for PDF must cover creating a highlight, reloading/navigating back to the page, tapping previous/next reader controls, and selecting a TOC item that targets a loaded spread side.

### 7. Wrong vs Correct

#### Wrong

```js
getContents() {
    return Array.from(this.#root.querySelectorAll('iframe'), frame => ({
        doc: frame.contentDocument,
    }))
}
```

#### Correct

```js
getContents() {
    return [this.#left, this.#right, this.#center]
        .filter(frame => frame?.iframe?.contentDocument && !frame.blank)
        .map(frame => ({
            doc: frame.iframe.contentDocument,
            index: frame.index,
            overlayer: frame.overlayer,
        }))
}
```

## View Lifecycle Contract

### 1. Scope / Trigger

Use this contract when changing `view.js`, renderer teardown, or any book adapter that allocates document workers, blob URLs, or other per-open resources.

### 2. Signatures

```js
view.close()
book.destroy()
```

### 3. Contracts

- `View.close()` must destroy the active renderer, remove it from the DOM, call the active book's `destroy()` method if present, and clear live `book`/`renderer` references.
- `View.open()` must ignore late `load`, `relocate`, and `create-overlayer` events from a stale renderer after close or reopen.
- PDF and other cached-resource book adapters must make `destroy()` idempotent and release cached `blob:` URLs or similar per-open resources before delegating to the underlying parser cleanup.
- A closed view must not retain a stale book object that can keep PDF.js workers, transports, or cache maps alive after the UI is torn down.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `close()` runs after `open()` | Destroy the renderer, destroy the book, and clear references. |
| A stale renderer emits `load` after `close()` | Ignore the event and do not read from the old book. |
| A book adapter exposes cached object URLs | Revoke them inside `destroy()` and clear the cache map. |
| `destroy()` is called more than once | No throw; repeated cleanup should be safe. |

### 5. Good/Base/Bad Cases

- Good: Closing a PDF reader leaves no active renderer/book references and the same PDF can be reopened cleanly.
- Good: A late `load` event from an orphaned iframe is ignored because the renderer is no longer current.
- Base: A book adapter without extra resources can still implement `destroy()` as a no-op.
- Bad: Clearing only the renderer element while leaving `this.book` pointing at a live PDF document.
- Bad: Letting a stale renderer call `#onLoad()` after a close because its listeners were never gated.

### 6. Tests Required

- Run `node --test packages/foliate-js/tests/view-lifecycle-tests.js` after changing `view.js` or adapter cleanup behavior.
- Run `node --test packages/foliate-js/tests/pdf-lifecycle-tests.js` after changing PDF cache or `book.destroy()` behavior.
- Run `pnpm --filter foliate-js build` after changing close/reopen behavior.
- Exercise close/reopen manually with the same PDF file to verify no blank white state or stuck loading indicator appears on the second open.

### 7. Wrong vs Correct

#### Wrong

```js
close() {
    this.renderer?.destroy()
    this.renderer?.remove()
}
```

#### Correct

```js
close() {
    const { renderer, book } = this
    this.renderer = null
    this.book = null
    renderer?.destroy()
    renderer?.remove()
    const destroy = book?.destroy?.()
    destroy?.catch?.(e => console.warn(e))
}
```

## Annotation Overlay Key Contract

### 1. Scope / Trigger

Use this contract when one CFI-backed location needs more than one overlay, such as a highlight plus a separate reader note marker. The CFI remains the navigation target; `overlayKey` is only the overlayer map key and emitted click identity.

### 2. Signatures

```js
await view.addAnnotation({
    value: 'epubcfi(/6/8)',
    overlayKey: 'note:note-id',
    markerType: 'note',
})

draw(Overlayer.noteMarker, { hitElementOnly: true })

Overlayer.noteMarker(rects, { hitPadding: 12 })
Overlayer.hitTest({ x, y })
```

### 3. Contracts

- `annotation.value` must stay resolvable by `resolveNavigation(value)`.
- `annotation.overlayKey ?? annotation.value` is used for `overlayer.add()` and `overlayer.remove()`.
- `show-annotation` emits the overlayer key, so consumers can route `note:<id>` separately from normal CFI annotation clicks.
- A successful annotation hit must consume the iframe `click` in the capture phase with `preventDefault()` and `stopImmediatePropagation()` before emitting `show-annotation`. Reader chrome, page-turn, and generic iframe single-click handlers must not run for the same tap.
- Badge-like overlays that should not claim the full text range must pass `hitElementOnly: true`; `Overlayer.hitTest()` then skips range rects and checks only the drawn element bounds.
- `Overlayer.noteMarker()` renders a small semi-transparent bookmark path at the end/top of the selected text. Its default visual size is `9x12`, with a transparent hit area around the icon so it remains tappable without returning to full-range hit testing.
- Transparent hit areas are part of the marker contract. `Overlayer.noteMarker()` must mark the transparent hit rectangle with `data-overlayer-hit-area="true"`, and `Overlayer.hitTest()` must check those explicit `x/y/width/height` bounds before falling back to `getBoundingClientRect()` on the returned group.
- Do not rely on an SVG `<g>` bounding box to include transparent children. Android WebView can treat the group as only the visible bookmark path, which lets marker taps fall through to generic reader click handlers.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `overlayKey` is omitted | Preserve existing behavior by using `value` as the key. |
| `value` is not resolvable | Do not add the overlay; let existing navigation resolution fail. |
| `overlayer.hitTest(e)` returns a non-search annotation | Consume the click and emit exactly one `show-annotation` event. |
| Point is inside a note marker's transparent hit area but outside the visible bookmark path | Return the `note:<id>` overlay key. |
| Browser group bounds exclude the transparent hit rectangle | Use the explicit hit-area attributes instead of missing the marker. |
| A badge overlay uses full-range hit testing | Treat as a bug because it can intercept highlight clicks. |
| A normal highlight uses `hitElementOnly` | Treat as a bug because the highlighted range should remain clickable. |

### 5. Good/Base/Bad Cases

- Good: A note marker uses `value: cfi`, `overlayKey: note:<id>`, and `hitElementOnly: true`.
- Good: A note marker customizes only icon options such as `{ color, width, height, opacity, hitPadding }`, while keeping `hitElementOnly: true`.
- Good: A marker tap emits `show-annotation` and does not also trigger reader chrome/page click behavior.
- Good: A tap lands in the transparent hit rectangle around the compact bookmark, and `Overlayer.hitTest()` returns `note:<id>` even if the SVG group bbox only covers the visible path.
- Base: A highlight uses only `value: cfi` and keeps full-range hit testing.
- Bad: Replacing `value` with `note:<id>`, because foliate cannot resolve it as a navigation target.
- Bad: Emitting `show-annotation` from a bubble-phase listener without consuming the event, because app iframe click handlers can process the same tap.
- Bad: Reintroducing a text label inside `Overlayer.noteMarker()`; the marker should stay a compact bookmark so it does not cover reader text.
- Bad: Increasing the visual bookmark size to improve tapping; keep the visual compact and enlarge only the explicit transparent hit area.

### 6. Tests Required

- Run `pnpm --filter foliate-js build` after changing `view.js` or `overlayer.js`.
- Run or update `packages/foliate-js/tests/overlayer-tests.js` when changing `Overlayer.noteMarker()` geometry, opacity, or hit area behavior. The test must include a point inside the explicit transparent hit area but outside the visible bookmark/group bbox.
- Run `pnpm --filter app build` after changing emitted event shapes or consumed ambient declarations.
- Manual reader checks must cover clicking the note badge, clicking a highlight under/near the badge, and removing both independently.

### 7. Wrong vs Correct

#### Wrong

```js
view.addAnnotation({ value: `note:${id}` });
```

#### Correct

```js
view.addAnnotation({ value: cfi, overlayKey: `note:${id}`, markerType: 'note' });
```

#### Wrong

```js
const box = obj.element.getBoundingClientRect()
if (box.left <= x && x < box.right && box.top <= y && y < box.bottom)
    return [key, obj.range]
```

#### Correct

```js
for (const hitArea of getExplicitHitAreas(obj.element)) {
    const box = getExplicitHitBox(hitArea)
    if (box && containsPoint(box, x, y)) return [key, obj.range]
}
```

## Styling Patterns

- Custom elements attach shadow roots where internals need encapsulation.
- Expose styling through CSS parts instead of requiring consumers to pierce internals.
- Use inline styles only for generated DOM helpers or layout state calculated at runtime.
- Preserve the `::part(filter)` contract for book-content filters and overlayer separation.

```css
foliate-view::part(filter) {
    filter: invert(1) hue-rotate(180deg);
}
```

## Accessibility

- Demo UI helpers should use semantic roles where they implement widgets. `ui/tree.js` uses `role="tree"`, `role="treeitem"`, `role="group"`, `aria-expanded`, and `aria-current`.
- Keyboard behavior belongs with the DOM helper that creates the interactive structure.
- Renderer internals must preserve selection and text ranges because annotation, search, TTS, and CFI features depend on DOM `Range` fidelity.
- Do not hide book content from assistive technologies unless the rendering mode has a documented reason.

### Gotcha: Text Selection Beats Paging Gestures

**Symptom**: On Android, text selection handles jump or become difficult to adjust when a selection starts at a paragraph boundary.

**Cause**: Paging and cross-page selection helpers can treat the iframe as a renderer control surface while the browser is still managing native text selection.

**Fix**: Yield touch handling to the selection state before calling `preventDefault()`, scrolling, or snapping pages. Also keep `selectionchange` auto-paging mouse-only.

**Example**:
```js
import {
    hasActiveTextSelection,
    shouldAutoTurnPageForPointerSelection,
} from './selection.js'

#onTouchMove(e) {
    if (!this.#touchState || hasActiveTextSelection(this.#view?.document)) return
    // keep swipe paging only when there is no active selection
}

#onTouchEnd() {
    if (this.scrolled || !this.#touchState || hasActiveTextSelection(this.#view?.document)) return
}

doc.addEventListener('selectionchange', () => {
    if (shouldAutoTurnPageForPointerSelection({
        isPointerSelecting,
        pointerType: pointerSelectionType,
        selectionType: doc.getSelection()?.type,
    }))
        checkPointerSelection(range, sel)
})
```

**Selection auto-paging contract**: `checkPointerSelection()` is for desktop mouse drag selection across paginated columns. Do not run it for `touch` or `pen` pointers. Android and iOS native selection handles can emit transient `selectionchange` events while handles are moving, and EPUB CSS can make paragraph-start geometry look like it crossed `#lastVisibleRange`. Common triggers include `text-indent`, justified paragraphs, block boundaries, empty anchors, and column fragmentation.

**Prevention**: Any future touch gesture in the reader must check for active selection ranges before it claims the pointer sequence. Any future selection auto-paging change must inspect `PointerEvent.pointerType` and preserve native touch and pen selection handles.

## Common Mistakes

- Adding React components or JSX to `foliate-js`; framework wrappers belong in consumers.
- Emitting plain `Event` when consumers need structured details. Use `CustomEvent` with a documented `detail` shape.
- Breaking `customElements.define()` side effects by moving registration out of module load without updating consumers.
- Styling internals through undocumented selectors instead of public parts or generated element contracts.
