# Directory Structure

> How frontend/library code is organized in `packages/foliate-js`.

---

## Overview

`packages/foliate-js` is a native ES module ebook-rendering library checked out as a git submodule. It is not a React package and it has no `src/` directory. Most modules live directly at the package root and are imported by file path, for example `foliate-js/view.js` or `foliate-js/epubcfi.js`.

The parent repository tracks only the submodule gitlink. Source edits inside this package must be committed inside the submodule, and that submodule commit must be reachable from `https://github.com/ksmaze/foliate-js.git` before the parent commit is shared.

The root README is unusually important for this package: it documents the book interface, renderer interface, custom elements, security constraints, and module categories. Keep code and specs aligned with that README.

## Directory Layout

```text
packages/foliate-js/
+-- package.json          # ESM package; exports ./*.js
+-- README.md             # Library and interface documentation
+-- eslint.config.js      # Browser globals, vendored files ignored
+-- rollup.config.js      # Builds vendor bundles only
+-- reader.html           # Demo reader shell
+-- reader.js             # Demo reader controller, not the core library API
+-- view.js               # Main foliate-view custom element and makeBook()
+-- paginator.js          # Reflowable renderer custom element
+-- fixed-layout.js       # Fixed-layout renderer custom element
+-- epub.js               # EPUB adapter
+-- epubcfi.js            # EPUB CFI parser/range helpers
+-- mobi.js               # MOBI/KF8 adapter
+-- fb2.js                # FictionBook adapter
+-- comic-book.js         # CBZ adapter
+-- pdf.js                # PDF adapter and PDF.js worker/asset wiring
+-- overlayer.js          # SVG annotation overlay helpers
+-- progress.js           # Reading progress helpers
+-- search.js             # Text search helpers
+-- selection.js          # Selection helper utilities
+-- text-walker.js        # DOM text walker
+-- tts.js                # SSML/TTS helpers
+-- dict.js               # Dictd/StarDict helpers
+-- opds.js               # OPDS conversion/search helpers
+-- footnotes.js          # Footnote event handler
+-- quote-image.js        # foliate-quoteimage custom element
+-- ui/
|   +-- menu.js           # Demo UI menu helpers
|   +-- tree.js           # Demo TOC tree helpers
+-- tests/
|   +-- tests.html
|   +-- tests.js
|   +-- epubcfi-tests.js
|   +-- overlayer-tests.js
|   +-- selection-tests.js
+-- rollup/
|   +-- fflate.js
|   +-- zip.js
+-- vendor/
|   +-- pdfjs/             # PDF.js assets copied by build tooling
    +-- fflate.js
    +-- zip.js
```

## Module Organization

### Core Entry Points

- `view.js` defines `makeBook()` and the `foliate-view` custom element.
- `paginator.js` defines `foliate-paginator` for reflowable books.
- `fixed-layout.js` defines `foliate-fxl` for fixed-layout books.
- `epub.js`, `mobi.js`, `fb2.js`, `comic-book.js`, and `pdf.js` adapt file formats to the documented book interface.

### Utility Modules

Keep format-agnostic DOM and reader helpers in standalone modules:

- `epubcfi.js` for CFI parsing, stringifying, comparison, and range conversion
- `overlayer.js` for SVG overlays
- `progress.js` for TOC and section progress
- `search.js`, `selection.js`, `text-walker.js`, and `tts.js` for text processing
- `opds.js` and `dict.js` for optional catalog/dictionary features

### Demo UI

`reader.js`, `reader.html`, and `ui/*` are demo reader code. They can use the library APIs, but core modules should not depend on the demo UI.

### Vendor and Build

- `vendor/*` contains generated or bundled third-party files. Do not hand-edit vendored output except for a dedicated vendor update.
- `rollup/*` contains small entry files used to generate `vendor/fflate.js` and `vendor/zip.js`.
- The package build copies PDF.js assets into `vendor/pdfjs/` and bundles vendor dependencies; it does not bundle the whole library.

## Naming Conventions

- Root modules use lower-case kebab-case or concise domain names: `fixed-layout.js`, `text-walker.js`, `quote-image.js`, `epubcfi.js`.
- Custom elements use the `foliate-*` prefix: `foliate-view`, `foliate-paginator`, `foliate-fxl`, `foliate-quoteimage`.
- Exported classes use PascalCase: `View`, `Paginator`, `FixedLayout`, `EPUB`, `MOBI`, `Overlayer`.
- Exported functions and constants use lower camel case or upper-case constants depending on existing module style.

## Examples

### Correct: import modules directly by file path

```js
import './foliate-js/view.js'

const view = document.createElement('foliate-view')
document.body.append(view)
await view.open(file)
```

### Correct: keep optional features modular

```js
const { isMOBI, MOBI } = await import('./mobi.js')
if (await isMOBI(file)) {
    const fflate = await import('./vendor/fflate.js')
    book = await new MOBI({ unzlib: fflate.unzlibSync }).open(file)
}
```

Real pattern: `packages/foliate-js/view.js`.

### Wrong: adding a framework wrapper to the library package

```tsx
// Wrong in foliate-js. React integration belongs in packages/app.
export function FoliateView() {
  return <foliate-view />
}
```

## Common Mistakes

- Looking for `src/`; this package is intentionally flat root ESM.
- Expecting parent-repo diffs to show source edits after the submodule conversion. Use `git -C packages/foliate-js status` and `git -C packages/foliate-js diff`.
- Treating `reader.js` as the core API. It is a demo reader and integration example.
- Adding cross-module imports where the README says modules are interface-based and mostly independent.
- Editing `vendor/*` directly instead of changing `rollup/*` or dependency inputs.
