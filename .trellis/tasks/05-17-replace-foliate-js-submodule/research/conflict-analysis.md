# foliate-js Replacement Conflict Analysis

## Upstream Target

* Remote: `https://github.com/ksmaze/foliate-js.git`
* Latest `main` at replacement time: `78914aef4466eb960965702401634c2cb348e9b1`
* Parent repo before replacement: vendored `packages/foliate-js` tracked as 42 regular files; no `.gitmodules`.

## Current-vs-Upstream Classification

### Preserved As App Compatibility

These changes are used by the app or protect current reader behavior, so they were reapplied on top of upstream:

* `overlayer.js`
  * `Overlayer.noteMarker()` for reader note markers.
  * `Overlayer.arrow()` for chat/annotation search navigation.
  * `hitElementOnly` and explicit transparent hit areas so note markers are clickable without making the whole annotated text range a note hit target.
* `view.js`
  * `overlayKey` support so note marker overlays can use keys like `note:<id>` while the annotation value remains the source CFI.
  * `setSearchIndicator()` compatibility for existing app code.
  * Annotation overlay clicks run in capture phase and stop the underlying document click/link handler.
  * Safe `decodeURIComponent()` on string navigation targets.
* `paginator.js` and `selection.js`
  * Touch text selection no longer triggers automatic page turns; auto-turn remains limited to mouse range selection.
  * Touch-end snapping is skipped when an active text selection exists.
* `pdf.js`
  * `new URL()` asset path changed from `vendor/pdfjs/...` to `./vendor/pdfjs/...` to satisfy Vite's relative asset transform.

### Accepted From Upstream

These upstream changes were kept instead of reverting to the older vendored behavior:

* PDF support added through `pdf.js` and `vendor/pdfjs/**`.
* Latest upstream `view.js` enables PDF detection in `makeBook()`.
* EPUB metadata/source/srcset improvements.
* MOBI fixes for guide/filepos setup, reduce initial value, and fragment slicing.
* EPUB CFI regression fixes around `FILTER_SKIP` wrappers.
* FB2 external link behavior from upstream commit `78914ae`.

### Not Preserved

These differences were intentionally not carried over:

* Local disabling of `makeBook()` PDF handling. The latest upstream package now includes PDF support and the app already declares `foliate-js/pdf.js`.
* Local dependency bumps inside the previously vendored package. The package now follows upstream package metadata; `pnpm-lock.yaml` records workspace-compatible resolutions.

## Submodule Patch Commit

The app compatibility changes are recorded as a local submodule commit:

* Branch: `sageread-app-patches`
* Commit: `a60d5f0 chore: preserve sageread app compatibility`
* Base: `78914ae Use original hrefs for external links and add isExternal in fb2.js (#129)`

This commit must be pushed to `https://github.com/ksmaze/foliate-js.git` before the parent repo commit is shared with another clone.

## Verification

* `node --test packages/foliate-js/tests/selection-tests.js` passed.
* `pnpm --filter foliate-js build` passed.
* `pnpm --filter app build` passed.

Notes:

* `pnpm --filter foliate-js build` emits Rollup resolver warnings for `rollup/fflate.js` and `rollup/zip.js`, but exits successfully.
* `pnpm --filter app build` emits the existing large chunk warning, but exits successfully.
