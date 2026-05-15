# Type Safety

> Type safety patterns in `packages/foliate-js`.

---

## Overview

`foliate-js` is plain JavaScript, not TypeScript. Its type safety comes from documented runtime interfaces, small modules, explicit shape checks, custom error classes, and consumer-side ambient declarations where TypeScript apps import the library.

Do not convert files to TypeScript as part of ordinary feature work. That would change the package architecture and build model.

## Type Organization

### Library Side

The library documents interface shapes in `README.md` rather than `.d.ts` files. Key contracts include:

- book objects returned by format adapters
- section objects inside `book.sections`
- renderer methods and events
- loader objects for archived formats
- CFI parsed array/object shapes
- overlayer objects with `element` and `redraw()`

Exports stay close to implementation modules:

```js
export class ResponseError extends Error { }
export class NotFoundError extends Error { }
export class UnsupportedTypeError extends Error { }

export const makeBook = async file => {
    // detects file type and returns a book interface object
}
```

### Consumer Side

TypeScript consumers add declarations for the exact modules they import. In this repo, `packages/app/src/vite-env.d.ts` declares consumed `foliate-js/*.js` modules.

```ts
declare module "foliate-js/epubcfi.js" {
  export function collapse(location: any, end?: boolean): string;
  export function compare(cfi1: string, cfi2: string): number;
}
```

If a `foliate-js` export shape changes, update the consumer declarations in the same task.

## Validation

Runtime validation is lightweight and local:

- file type detection checks magic bytes and MIME/name suffixes
- unsupported input throws custom errors
- optional interface methods are guarded before use
- DOM operations check for nullable values where needed

```js
if (book.splitTOCHref && book.getTOCFragment) {
    const splitHref = book.splitTOCHref.bind(book)
    const getFragment = book.getTOCFragment.bind(book)
    // initialize TOC progress
}
```

There is no Zod/Yup/io-ts layer.

## Common Patterns

### Optional Interface Methods

Most book properties and methods are optional. Code should use guards and defaults:

```js
await this.#tocProgress.init({
    toc: book.toc ?? [],
    ids,
    splitHref,
    getFragment,
})
```

### Custom Error Classes

Use exported error classes for caller-distinguishable failure modes:

- `ResponseError`
- `NotFoundError`
- `UnsupportedTypeError`

### Dynamic Import Shapes

Destructure the symbols needed from dynamically imported modules:

```js
const { EPUB } = await import('./epub.js')
book = await new EPUB(loader).init()
```

### Plain Data Shapes

CFI parsed values are plain arrays/objects. Do not wrap them in classes unless the README contract changes.

## Forbidden Patterns

- Do not add broad TypeScript annotations or build steps inside `foliate-js` without an explicit migration task.
- Do not rely on consumer-side `any` declarations as proof that a runtime method exists.
- Do not change event `detail` shapes without updating README/specs and app consumers.
- Do not throw generic strings or untyped sentinel values for public failure modes.
- Do not make optional book interface methods required unless every adapter and consumer is updated.
