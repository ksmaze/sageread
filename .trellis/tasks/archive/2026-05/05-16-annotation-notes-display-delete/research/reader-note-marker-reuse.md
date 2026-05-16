# Reader Note Marker Reuse Research

## Question

Can the old reading-page note marker implementation be found and reused for independent notes?

## Findings

* No dedicated historical React component for independent user note markers was found in the app history.
* The initial commit already had the current notepad structure and reader annotation overlay flow.
* `foliate-js` has reusable overlay support:
  * `View.addAnnotation(annotation)` resolves a CFI and uses the page overlayer.
  * `draw-annotation` lets the app choose how to draw annotation overlays.
  * Search indicators already use `indicatorType: "arrow"` and `Overlayer.arrow`.
  * `Overlayer` includes highlight, underline, squiggly, outline, and arrow drawing helpers.
* `foliate-js/reader.js` also has a built-in Calibre highlight demo that displays embedded highlight notes with `alert(annotation.note)`, but this is library/demo behavior and not a reusable app-level note marker UI.

## Reuse Path

Use the existing `View.addAnnotation` / overlayer mechanism for position-bound notes, but create an app-level note marker draw path instead of coupling notes to highlight `BookNote` records.

Likely shape:

* Map each position-bound `Note` into a lightweight overlay annotation keyed by its note id or CFI.
* On page/overlay creation and progress changes, add markers for visible notes.
* Draw a compact note marker using existing overlayer primitives or a small new `Overlayer` helper.
* A tag/badge at the top of the selected text's end position is feasible because overlay draw helpers receive the selection `DOMRectList`; use the last rect for horizontal text and account for vertical writing mode when positioning the marker.
* Clicking the marker opens the independent note detail/editor rather than the highlight annotation popup.

## Risks

* `View.addAnnotation` currently emits `show-annotation` for non-search overlays and the current app handles that as a `BookNote` annotation lookup. Independent note markers need a separate value prefix, item map, or event dispatch branch to avoid being interpreted as highlights.
* Overlays are inside paginated iframe documents, so marker hit targets must remain touch-friendly on Android without blocking selection or page gestures.
* Persistent markers should not use the existing auto-hiding search arrow behavior.

## Recommendation

Reuse the foliate overlayer infrastructure, not old app UI. Keep independent notes separate by using a distinct marker value namespace and app-side mapping, then render markers from `Note` records with CFI/source fields.
