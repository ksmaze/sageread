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
