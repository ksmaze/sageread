# Design And Proposal: Simplify Reader Font Architecture

## Design Principles

1. **Visible choices must be physical choices**

   A selector item should map to either `system-ui` or explicit bundled font faces. Do not expose conceptual labels that collapse to the same Android fallback.

2. **Keep release fixes, reduce runtime breadth**

   The old `resourceDir()` path and CJK metadata gate were fragile. Keep the Android-compatible materialized-file loading path, but stop treating every reader load as an all-font diagnostic run.

3. **Load the selected preset, not the whole registry**

   A reader document only needs the font definitions required by the current reader font setting. Mounting every bundled font into every document made debugging easier, but it makes normal behavior less direct and harder to verify.

4. **Keep current assets, keep extension space**

   Do not delete the current WOFF2 files as part of this simplification. Instead, make the manifest clear enough that future fonts can be added by a repeatable conversion/register/test workflow.

5. **Diagnostics should be intentional**

   Logcat diagnostics helped break the release-build loop. Keep them, but default diagnostics should describe the selected font path. Full registry diagnostics should be an explicit verbose/debug action.

## Proposal Options

### Option A: Minimal Rollback Plus Release Fixes

**How it works**

* Keep only `system` and `寒蝉活宋体`.
* Keep only `ChillHuoFangSong_Regular.woff2`.
* Simplify `font.ts` back toward a one-font helper while preserving Android-compatible loading, style upsert, and selected settings/style sync.
* Hide native diagnostics behind an explicit command/build flag.

**Pros**

* Closest to the pre-expansion behavior.
* Smallest app/repo size.
* Very easy to reason about and verify.

**Cons**

* Drops the current extra CJK and English font assets/options.
* Conflicts with the user's preference to keep current fonts and leave room for future additions.

### Option B: Selected-Font Lazy Loading With Extensible Registry (Selected)

**How it works**

* Keep all current bundled WOFF2 files and physical options for now.
* Keep a registry/manifest, but treat it as metadata, not as "load everything":
  * physical family name;
  * resource filename/path;
  * CSS metadata such as weight/style/unicode range;
  * sample text / script role;
  * Android generated asset expectation.
* Add a selected-preset resolver:
  * input: current reader font settings/preset;
  * output: only the font definitions required by that selected preset.
* Reader documents resolve/materialize/mount only that resolver output.
* Logcat diagnostics default to selected fonts only; verbose all-font diagnostics remain available for debugging.
* The settings panel may temporarily load all candidate fonts for accurate selector previews while that UI is open.
* Future font additions follow a documented workflow: acquire source, verify license, convert/normalize to WOFF2, copy into resources, sync generated Android assets, register metadata, map a preset, and run tests.

**Pros**

* Keeps current user-visible font choices.
* Removes the main runtime problem: eager all-font loading and noisy all-font diagnostics.
* Preserves release-build fixes from the native materialization work.
* Leaves a clean path for adding new WOFF2 fonts later.

**Cons**

* Does not reduce APK/repo size in this task.
* Still needs registry discipline and tests so metadata does not drift from bundled assets.
* Preview loading must stay scoped so it does not reintroduce all-font loading into reader documents.

### Option C: Keep Current Full Eager Registry

**How it works**

* Keep all bundled fonts and current broad diagnostics.
* Continue mounting all registered font faces in the main app and each reader document.
* Rename/rework selector labels so users understand physical font choices.

**Pros**

* Minimal code churn from the current state.
* Best if the product goal is a built-in font platform.

**Cons**

* Does not address the core complaint that the current model is over-expanded.
* Keeps every reader load dependent on every bundled font path.
* Makes "does the selected font work?" harder to reason about because unrelated fonts are always involved.

## Selected Direction

Choose **Option B: Selected-Font Lazy Loading With Extensible Registry**.

This keeps the current fonts, including English fonts, but changes the operational contract: normal reader rendering should prove and use only the selected preset's required font files. The registry remains because it is useful for future additions, but the registry is no longer synonymous with eager loading.

Selector preview behavior is a deliberate exception: when the reader style/settings panel is open, the app can temporarily load candidate fonts so non-selected options preview accurately. That exception belongs to the main-app preview surface, not to reader document mounting.

## Proposed MVP

1. Keep the current WOFF2 resources and generated Android asset copies.
2. Convert the current broad font registry into a manifest plus selected-font resolver.
3. Change reader document font mounting to resolve only the selected preset's required font definitions.
4. Add a separate settings-preview loading path that can load candidate fonts only while the style/font picker UI needs previews.
5. Change native Android materialization calls in the reader hot path to run only for selected font files.
6. Change logcat diagnostics to selected-font diagnostics by default.
7. Keep style sync and CJK-before-Latin stack generation for presets that mix CJK and Latin faces.
8. Add tests for:
   * every manifest entry has a source resource and generated Android asset;
   * visible options map to real manifest/system entries;
   * selected preset maps only to selected font files;
   * CSS generation includes only selected families;
   * settings preview loading is separate from reader document mounting;
   * reader style still applies the selected stack.
9. Add a short future-font addition note/test contract so later WOFF conversion work has a clear checklist.

## Future Font Addition Contract

When adding another bundled font later:

1. Record source URL/license in the task or docs.
2. Convert/normalize to WOFF2 with a stable internal family name.
3. Place the WOFF2 under `src-tauri/resources/fonts`.
4. Sync the generated Android asset copy.
5. Add one manifest entry with family, filename, CSS metadata, script role, and sample text.
6. Add or update one visible preset mapping only if the font should be user selectable.
7. Run tests that prove source/generated asset parity and selected-only loading.

## Explicit Non-Goals

* Reintroducing custom user-uploaded font management.
* Deleting current bundled fonts in this simplification pass.
* Restoring Android-optional system font presets as visible choices.
* Rebuilding Readest's full font platform.

## Open Product Decision

Resolved: use scoped preview loading when the settings panel is open, while keeping reader document mounting selected-only.
