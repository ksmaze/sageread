# Quality Guidelines

> Code quality standards for `packages/foliate-js`.

---

## Overview

This package is a browser ESM library with custom elements, direct DOM APIs, and file-format parsers. Quality means preserving modular interfaces, avoiding framework coupling, maintaining security constraints for ebook content, and testing parsing/rendering edge cases with browser APIs.

Build command:

```bash
pnpm --filter foliate-js build
```

The package has an ESLint config but no package `lint` script today.

## Forbidden Patterns

- Do not add React, Zustand, Tailwind, Radix, Tauri, or app-specific imports to `foliate-js`.
- Do not enable EPUB scripted content by default. The README explicitly warns that CSP is required and scripted content is not supported as a safe default.
- Do not make optional format dependencies hard dependencies loaded at module startup.
- Do not edit `vendor/*` as normal source.
- Do not replace documented custom events with consumer-specific callbacks.
- Do not assume old browser support. The README says latest WebKitGTK, Firefox, and Chromium are the target.
- Do not break direct file-path imports; `package.json` exports `./*.js`.

## Required Patterns

- Keep modules native ESM.
- Keep core modules modular and interface-driven.
- Use browser primitives directly: `CustomEvent`, `EventTarget`, `Range`, `TreeWalker`, `DOMParser`, `XMLSerializer`, `Blob`, `File`, and dynamic `import()`.
- Preserve the book interface documented in `README.md`.
- Preserve custom element names and renderer method contracts.
- Keep security-sensitive behavior explicit and caller-controlled.

```js
if (!book) throw new UnsupportedTypeError('File type not supported')
```

## Formatting and Linting

`eslint.config.js` defines these package-local preferences:

- browser globals
- ignore `vendor`
- no semicolons
- 4-space indentation warning
- single quotes warning
- trailing commas for multiline values
- `console.debug`, `console.warn`, `console.error`, and `console.assert` allowed

The existing source is not perfectly uniform across every file. For normal changes, match the surrounding file style and keep diffs minimal. Use a dedicated cleanup task for broad formatting changes.

## Testing Requirements

Existing tests are browser tests under `tests/` and use `console.assert`.

For parser or pure helper changes:

- run or open `packages/foliate-js/tests/tests.html` in a browser when possible
- add assertions to `tests/epubcfi-tests.js` for CFI parser/range changes

For renderer or custom element changes:

- run the package build
- exercise `reader.html` through a local server with at least one EPUB or supported sample file
- verify `load` and `relocate` events still fire
- verify selection/range behavior if touching pagination, annotations, search, or TTS

For app integration changes:

- run `pnpm --filter app build`
- verify ambient declarations in `packages/app/src/vite-env.d.ts` still match consumed `foliate-js` exports

## Code Review Checklist

- Does the change preserve the public README-documented interfaces?
- Are dynamic imports still lazy and format-specific?
- Are custom events still named and shaped compatibly?
- Does renderer code preserve `Range`, selection, writing mode, RTL, and vertical text behavior?
- Are security assumptions around scripted content and iframe sandboxing unchanged or explicitly documented?
- Are `vendor/*` changes generated from dependency/build inputs?
- Did any consumer-facing API change get reflected in `packages/app` type augmentations?

## Common Mistakes

- Treating `reader.js` convenience code as a stable library API.
- Replacing DOM `Range` objects with strings and breaking annotations or CFI conversion.
- Forgetting that files can be large and archive loaders should avoid reading whole books when the current adapter uses random access.
- Adding a formatting-only sweep while making behavior changes.
