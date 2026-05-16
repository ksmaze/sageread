# Recording Observation

Source: `D:\Downloads\screenrecorder-20260515-192003.mp4`

## Observed Behavior

- Duration is about 8.3 seconds at 1600x2560.
- The user begins with text already selected in the reader.
- A custom annotation toolbar is visible above the selected text.
- When the user drags the start/left selection handle near the paragraph starting "Shifting your persuasive style...", the selected range jumps upward and begins selecting text from the previous paragraph.
- The page does not visibly flip during the failure.
- The toolbar remains visible and close to the handle movement area throughout the drag.

## Implication

The previous fix in `foliate-js/paginator.js` only guarded touch paging. The recording points to a separate failure path during Android native selection-handle adjustment, not a normal swipe page turn.

## Later Finding

The user's note that the bug did not reproduce in another Chinese book is important. The affected EPUB has paragraph HTML/CSS that can change selection boundary geometry at paragraph starts:

- Paragraph starts use `<p id="filepos198217" class="calibre_21">...`
- `.calibre_21` applies `text-align: justify`, `text-indent: 1em`, and `margin: 0`

That means the issue can depend on book content. The final root cause is in foliate's `selectionchange` auto-paging path: it was intended for mouse drag selection across pages, but touch selection handles could reach the same path and trigger range comparison against `#lastVisibleRange`.
