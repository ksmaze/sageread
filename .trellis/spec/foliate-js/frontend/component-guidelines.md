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
```

### 3. Contracts

- `annotation.value` must stay resolvable by `resolveNavigation(value)`.
- `annotation.overlayKey ?? annotation.value` is used for `overlayer.add()` and `overlayer.remove()`.
- `show-annotation` emits the overlayer key, so consumers can route `note:<id>` separately from normal CFI annotation clicks.
- Badge-like overlays that should not claim the full text range must pass `hitElementOnly: true`; `Overlayer.hitTest()` then skips range rects and checks only the drawn element bounds.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| `overlayKey` is omitted | Preserve existing behavior by using `value` as the key. |
| `value` is not resolvable | Do not add the overlay; let existing navigation resolution fail. |
| A badge overlay uses full-range hit testing | Treat as a bug because it can intercept highlight clicks. |
| A normal highlight uses `hitElementOnly` | Treat as a bug because the highlighted range should remain clickable. |

### 5. Good/Base/Bad Cases

- Good: A note marker uses `value: cfi`, `overlayKey: note:<id>`, and `hitElementOnly: true`.
- Base: A highlight uses only `value: cfi` and keeps full-range hit testing.
- Bad: Replacing `value` with `note:<id>`, because foliate cannot resolve it as a navigation target.

### 6. Tests Required

- Run `pnpm --filter foliate-js build` after changing `view.js` or `overlayer.js`.
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
