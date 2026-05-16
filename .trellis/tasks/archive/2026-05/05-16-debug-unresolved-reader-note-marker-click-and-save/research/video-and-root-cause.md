# Video Evidence and Root Cause Notes

## Source

`D:\Downloads\Record_2026-05-16-15-24-18_d96bc14e7eba6069301f5c6a43c045ae.mp4`

- Duration: 18.538s
- Resolution: 720x1570

## Observations

- 00:00-00:05: repeated taps around the small blue bookmark marker do not open the note editor. The reader bottom chrome appears/disappears, which means the tap is still being handled as a generic reader click.
- 00:05-00:08: opening the bottom note sheet and selecting a note opens the editor.
- 00:08-00:12: entering `aaa` and tapping Save triggers `更新笔记失败`.
- 00:12-00:17: after returning to the reader, marker-area taps continue to toggle reader chrome instead of opening the note editor.

## Save Failure Root Cause

`packages/app/src-tauri/src/core/notes/commands.rs` uses `sqlx::QueryBuilder::separated(", ")` like this:

```rust
separated.push("content = ").push_bind(content_opt.clone());
```

In sqlx 0.8.6, `Separated::push()` and `Separated::push_bind()` both push the separator when applicable. Chaining them treats the SQL fragment and bind as separate separated items, so an assignment can be rendered with an unwanted comma before the placeholder.

Correct usage must append the bind placeholder without a separator after the assignment fragment, e.g. `push_bind_unseparated()`, or avoid `Separated` for assignment fragments.

## Click Failure Root Cause Hypothesis

The prior fix increased the transparent rectangle drawn inside `Overlayer.noteMarker()`, but `Overlayer.hitTest()` still tests `obj.element.getBoundingClientRect()` on the returned SVG group.

That is browser-dependent for transparent SVG children. Android WebView appears to behave as if the marker click is outside the tested element bounds, so the foliate annotation click is not consumed and the app's generic `iframe-single-click` path toggles reader chrome.

The next fix should make hit-testing explicit: mark the transparent rect as the hit area and compare click coordinates to its explicit SVG geometry, or otherwise store explicit hit bounds with the overlay object.
