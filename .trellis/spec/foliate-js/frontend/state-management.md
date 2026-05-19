# State Management

> How state is managed in `packages/foliate-js`.

---

## Overview

`foliate-js` uses instance-local state, private class fields, maps, DOM attributes, and custom events. It has no global app store and no persisted application state. Consumers such as `packages/app` own persistence, user settings, note state, and reader tab state.

## State Categories

### Custom Element Instance State

Custom elements keep state on the element instance:

- `View` stores `book`, `renderer`, `history`, progress helpers, search results, current layout flags, and last location.
- `Paginator` stores iframe/view state, selection state, pagination dimensions, anchors, and animation state.
- `FixedLayout` stores fixed-page rendering state.

Prefer private fields for internal state:

```js
export class View extends HTMLElement {
    #sectionProgress
    #tocProgress
    #pageProgress
    #searchResults = new Map()
    history = new History()
}
```

### Interface State

Book state is represented by plain objects that implement the README-documented book interface:

- `sections`
- `metadata`
- `toc`
- `pageList`
- `rendition`
- `resolveHref(href)`
- `resolveCFI(cfi)`
- optional transform and TOC helper methods

Do not introduce a shared base class just to satisfy this interface; current adapters return compatible objects.

### DOM and Attribute State

Renderer configuration is often stored as attributes because custom elements are configured from the DOM:

- paginator `flow`
- `animated`
- margin and gap attributes
- maximum inline/block size and column count

Selection and location state often uses live DOM `Range`, `Element`, and `Document` objects. Preserve those shapes because CFI, annotations, search, and TTS consume them.

### Event State

Outbound state changes are published with events. Use event detail objects for structured state:

- `relocate` reports current reading location
- `load` reports loaded document and section index
- `create-overlayer` lets consumers attach an overlayer to a page

For fixed-layout/PDF pages, `relocate` is also the app-facing readiness signal for
annotation replay. Do not emit it until the active page iframe has loaded, the PDF
`onZoom()` render has completed, and the page overlayer can be returned from
`getContents()`.

### Async Renderer State

Fixed-layout navigation crosses several async boundaries:

- section `load()`
- iframe `load`
- PDF `onZoom()` rendering
- resize/zoom-triggered redraw

Guard those boundaries with a navigation generation or equivalent token. A stale
section load, iframe load, or render promise must not replace the current frame,
mutate `#left`/`#right`/`#center`, update the visible side, redraw overlays, or emit
`relocate` after a newer navigation has started. Keep the current index aligned
with the frames actually displayed; do not mark a target index current before the
new spread is ready.

## When to Use Global State

Do not add global state to `foliate-js`. If a value is user preference or application workflow state, it belongs in the consumer.

Appropriate local state:

- current renderer instance
- current book object
- pending animation or resize observers
- per-view history
- in-memory search result map

Inappropriate local state:

- last-opened book list
- app theme settings
- reader tab order
- annotation database

## Server State

The package has no server-state cache. Network access is direct `fetch` for URL inputs and OPDS/helper consumers. Callers are responsible for request policy, caching, authentication, offline storage, and retry behavior.

## Derived State

Keep derived state close to its source:

- `SectionProgress` derives location/time progress from section sizes.
- `TOCProgress` derives current TOC item from section IDs and DOM ranges.
- `languageInfo()` derives locale, CJK, and direction data from book metadata.
- `getDirection()` derives writing mode and RTL state from rendered document styles.

## Common Mistakes

- Persisting app settings in a custom element. Consumers must store settings and set attributes or call methods.
- Replacing `Range` or `Element` values with serialized strings too early. Many features need live DOM objects.
- Sharing one mutable singleton across multiple reader instances.
- Making format adapters depend on `View` internals instead of the documented book interface.
- Letting late fixed-layout/PDF async work write into the active renderer after a newer navigation. This can make the app think page N is active while the iframe still displays page N-1, which breaks annotation replay and can leave stale PDF render tasks alive.
