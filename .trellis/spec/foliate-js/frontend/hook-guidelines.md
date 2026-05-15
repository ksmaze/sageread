# Hook Guidelines

> How reusable lifecycle and event logic is handled in `packages/foliate-js`.

---

## Overview

`foliate-js` has no React hooks. Reusable behavior is expressed through native classes, generator functions, closures, helper factories, and DOM events.

When a consumer needs React hooks, add them in `packages/app` around the `foliate-js` APIs. Do not add React to this package.

## Reusable Lifecycle Patterns

### EventTarget Helpers

Use `EventTarget` subclasses for non-visual evented helpers. Examples include `History` and `FootnoteHandler`.

```js
class History extends EventTarget {
    #arr = []
    #index = -1

    back() {
        const detail = { state: this.#arr[this.#index - 1] }
        this.dispatchEvent(new CustomEvent('popstate', { detail }))
        this.dispatchEvent(new Event('index-change'))
    }
}
```

### DOM Factories

Use factories when the output is a plain DOM helper rather than a custom element. `createTOCView(toc, onclick)` returns a DOM tree and a method for updating current state.

```js
export const createTOCView = (toc, onclick) => {
    const $toc = document.createElement('ol')
    $toc.setAttribute('role', 'tree')
    // build items and keyboard behavior
    return { element: $toc, setCurrentHref }
}
```

### Generators

Use generators for streaming DOM/text traversal where callers should iterate lazily. `textWalker` and search helpers follow this pattern.

## Data Fetching

There is no framework data-fetching layer. File and URL loading are direct browser API calls:

- `makeBook(file)` accepts a URL string, `File`/`Blob`, directory-like entry, or book object.
- URL strings are fetched and wrapped as `File`.
- Archive formats are loaded through loader interfaces with `loadText`, `loadBlob`, and `getSize`.
- Optional format modules are dynamically imported only after type detection.

```js
const fetchFile = async url => {
    const res = await fetch(url)
    if (!res.ok) throw new ResponseError(`${res.status} ${res.statusText}`, { cause: res })
    return new File([await res.blob()], new URL(res.url).pathname)
}
```

## Naming Conventions

- Factory functions use `make*`, `create*`, or `get*` based on existing module style.
- DOM helper factories in `ui/*` use `create*`.
- Format adapters use `make*` or exported classes: `makeFB2`, `makeComicBook`, `EPUB`, `MOBI`.
- Evented classes use PascalCase.
- Private helper functions stay module-local unless consumers need them.

## Common Mistakes

- Adding `use*` React hooks in this package. React belongs in app integration code.
- Introducing a global event bus. Use instance-local `EventTarget` or custom element events.
- Fetching all optional dependencies eagerly. Preserve dynamic imports for file-format-specific code.
- Returning arrays where a generator is used to avoid unnecessary memory pressure.
