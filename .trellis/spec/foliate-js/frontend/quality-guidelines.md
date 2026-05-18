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

## Scenario: Submodule Compatibility Patches

### 1. Scope / Trigger

- Applies when updating `packages/foliate-js`, changing app-facing exports, or preserving Sageread-specific compatibility behavior on top of upstream `foliate-js`.

### 2. Signatures

- Parent repo submodule path: `packages/foliate-js`
- Submodule remote: `https://github.com/ksmaze/foliate-js.git`
- Parent dependency: `packages/app/package.json` uses `"foliate-js": "workspace:*"`
- App-facing module imports include direct file paths such as `foliate-js/view.js`, `foliate-js/overlayer.js`, `foliate-js/epubcfi.js`, and `foliate-js/vendor/fflate.js`

### 3. Contracts

- The parent repository must record `packages/foliate-js` as a gitlink, not regular source files.
- Any source edit inside `packages/foliate-js` must be committed in the submodule before updating the parent gitlink.
- The submodule commit referenced by the parent must be pushed to `https://github.com/ksmaze/foliate-js.git` before sharing the parent commit with another clone.
- App compatibility APIs such as `View.addAnnotation()` overlay keys, `View.setSearchIndicator()`, `Overlayer.noteMarker()`, and `Overlayer.arrow()` are app-facing behavior and must not be dropped during upstream updates.

### 4. Validation & Error Matrix

- Parent points at an unpushed local submodule commit -> other clones cannot initialize the referenced commit.
- App-facing API removed without updating `packages/app/src/vite-env.d.ts` and consumers -> app build/type checks fail or runtime annotation/search behavior regresses.
- `vendor/pdfjs/*` edited by hand -> generated assets drift from dependency/build inputs.
- PDF.js assets referenced without a relative `./vendor/pdfjs/` URL in `pdf.js` -> Vite may warn or fail to transform the worker/asset path correctly.
- PDF.js directory assets referenced through a Vite-transformable dynamic `new URL(`./vendor/pdfjs/${path}`, import.meta.url)` helper -> production builds can rewrite only known files, return `undefined` for `cmaps/` or `standard_fonts/`, and make PDF open fail at runtime.
- Parent app build does not copy `vendor/pdfjs/cmaps` and `vendor/pdfjs/standard_fonts` beside the emitted PDF adapter chunk -> PDF.js may receive valid directory URLs but fail later when fetching CMaps or standard fonts.

### 5. Good/Base/Bad Cases

- Good: rebase/apply compatibility patches on latest upstream, commit them inside the submodule, verify app build, then update the parent gitlink.
- Good: keep PDF.js runtime asset URLs relative to `import.meta.url` without a bundler-generated file lookup table, and let the parent app copy the PDF.js vendor tree to the built `assets/vendor/pdfjs/` directory.
- Base: updating only the submodule pointer to a reachable upstream commit is acceptable when no app compatibility patches are needed.
- Bad: copying upstream files into the parent repo as regular files or leaving uncommitted source edits inside the submodule.
- Bad: relying on Vite to infer directory assets from a dynamic `new URL` template; it may emit `/assets/undefined` for directory paths.

### 6. Tests Required

- Run `pnpm --filter foliate-js build`.
- Run focused foliate tests for touched helpers, for example `node --test packages/foliate-js/tests/selection-tests.js`.
- Run `pnpm --filter app build` when app-facing modules, ambient declarations, or package wiring changed.
- When touching `pdf.js` asset URLs, run the app build-output regression that checks the emitted PDF adapter and copied `assets/vendor/pdfjs/` directory.

### 7. Wrong vs Correct

#### Wrong

```bash
git add packages/foliate-js/view.js
git commit -m "patch foliate"
```

#### Correct

```bash
git -C packages/foliate-js add view.js overlayer.js
git -C packages/foliate-js commit -m "chore: preserve sageread app compatibility"
git add packages/foliate-js
```

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
