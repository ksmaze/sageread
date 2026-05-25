# Bug Analysis: Reader Font Selection Appeared Not To Change Display

## 1. Root Cause Category

* **Category**: D - Test Coverage Gap, plus E - Implicit Assumption
* **Specific Cause**: The generated reader stylesheet put the selected font stack on `html, body`, but also emitted `body * { font-family: revert !important; }` when `overrideFont` was enabled. Descendant text elements are where EPUB content usually renders, and `revert` can roll those descendants back to book/user-agent font choices. The earlier tests verified that the selected stack was generated, but did not verify that descendants inherited it.

## 2. Why Fixes Failed

* No earlier fix attempt happened in this session. The original implementation was a surface-level CSS generation test: it proved the root `font-family` line existed, but did not test the full cascade that determines visible reader text.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added a style regression test asserting `overrideFont` emits `font-family: inherit !important` for descendants and never emits `font-family: revert !important`. | DONE |
| P0 | Documentation | Updated the Reader Appearance Contract to require descendant inheritance for font override and forbid `revert` for this use case. | DONE |
| P1 | Code Review | When changing reader styles, inspect both the root declaration and descendant cascade rules that can override it. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Reader appearance settings can fail when tests inspect generated root CSS but not descendant selectors, especially colors, fonts, and EPUB-specific cleanup rules.
* **Design Improvement**: Treat reader style output as a cascade contract. For inherited properties, tests should include the selector that forces descendants to inherit the chosen root value.
* **Process Improvement**: For visual settings that update live Foliate content, add regression tests for both persistence/root setting generation and the final CSS selector that affects document descendants.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Added regression coverage in `packages/app/src/utils/style.test.ts`.
* [x] Recorded this analysis in the task research directory.
* [x] Checked for `src/templates/markdown/spec/`; no matching template directory exists in this repo.

# Bug Analysis: Bundled WOFF2 Font Did Not Load On Android

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus E - Implicit Assumption
* **Specific Cause**: The font loader treated `resourceDir()` as a normal filesystem directory, appended `resources/fonts/<fileName>`, and passed the result through `convertFileSrc()`. Tauri's installed API docs state that Android `resourceDir()` returns an `asset://localhost/` resource URI prefix, not a filesystem path. Appending to it and converting again can produce a double-encoded URL that the WebView cannot fetch. Even after the double-conversion was removed, device testing showed Android WebView still reports `NetworkError` when `asset://localhost/...` is used directly as a CSS `@font-face` source. The loader also mounted built-in fonts only when the UI/book language looked CJK, so missing EPUB language metadata could prevent the bundled font from being injected at all.
* **Follow-up Specific Cause**: `ChillHuoFangSong_Regular.woff2` had CJK glyph coverage, but its OpenType `name` table only had style/version/PostScript records and lacked required family/full-name records (`nameID` 1 and 4). Android WebView/Chromium can reject fonts during sanitization when required metadata is missing, leaving English/punctuation to change via CSS while Chinese glyphs silently fall back to the system CJK font.

## 2. Why Fixes Failed

1. **CSS cascade fix**: Replacing `revert` with `inherit` fixed one visible-font-selection issue, but it did not address the separate resource URL boundary where the WOFF2 file was never fetchable on Android.
2. **Preset expansion**: Adding more font-family names improved the option list, but those names only work if the OS already has them or if a matching bundled `@font-face` loads.
3. **Resource URL fix**: Fixing `asset://` handling removed double conversion, but device testing showed `asset://localhost/...` itself was still not a fetchable CSS font URL in Android WebView.
4. **Font metadata fix**: Normalizing `name` records made the file acceptable, but CSS still needed a loadable URL form. The final Android path reads resource bytes through Tauri FS and uses a generated `blob:` URL.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added tests for Android `asset://localhost/...` resource URLs, desktop filesystem path conversion, and reader document font style mounting. | DONE |
| P0 | Test Coverage | Updated the mounting test to require bundled fonts to be read from `BaseDirectory.Resource` and injected as `blob:` URLs. | DONE |
| P0 | Test Coverage | Added a shipped WOFF2 metadata test that parses the file and requires OpenType name records 1, 2, 4, and 6. | DONE |
| P0 | Documentation | Added a bundled reader font asset contract to `.trellis/spec/app/frontend/state-management.md`. | DONE |
| P1 | Thinking Guide | Updated the cross-layer runtime asset guide to call out platform-specific resource URL/file-path differences. | DONE |
| P1 | Architecture | Centralized URL normalization in `toBuiltInFontAssetUrl()` and style insertion in `upsertBuiltInFontFaceStyle()`. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any Tauri packaged asset loaded at runtime can fail the same way if code assumes `resourceDir()` is always a filesystem path, passes a URL-like resource through `convertFileSrc()`, or assumes a native resource URI is accepted by browser CSS/fetch APIs. Any bundled font can also fail if glyph coverage is checked but OpenType metadata/sanitizer requirements are ignored.
* **Design Improvement**: Runtime asset loading should have a pure URL normalization helper for fallback paths, but CSS fonts should prefer resource bytes plus `blob:` URLs on Android. Bundled font acceptance should be treated as a file and browser-consumer contract, not only CSS generation.
* **Process Improvement**: When a bug only reproduces in packaged Android/WebView, inspect local dependency docs/source for platform-specific path contracts, validate font metadata, and use WebView DevTools evidence (`document.fonts.load`, computed `@font-face` source URL) before changing CSS or assuming font format incompatibility.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
* [x] Added regression coverage in `packages/app/src/utils/font.test.ts`.
* [x] Normalized `ChillHuoFangSong_Regular.woff2` name records in both source resources and Android generated assets.
* [x] Added `fs:allow-resource-read-recursive` and `blob:` font CSP support for resource-byte font loading.
* [x] Checked for `src/templates/markdown/spec/`; no matching template directory exists in this repo.

# Bug Analysis: Font Presets Collapsed To Two Visible English Fonts

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus D - Test Coverage Gap
* **Specific Cause**: The reader selector treated each preset as only `{ serif, sansSerif, cjk }`, while `getStyles()` decides the active Latin stack from a separate persisted `defaultFont` field. Selecting a preset did not update that `defaultFont` axis, so Android could keep using the previous serif/sans branch regardless of the visible option. On top of that, several newly added English font names were only fallback names, not bundled fonts, so Android WebView collapsed them to generic serif/sans aliases.

## 2. Why Fixes Failed

1. **CSS stack parsing fix**: It made comma-separated stacks valid CSS, but it did not change which serif/sans branch `getStyles()` selected.
2. **Bundled CJK font fixes**: They fixed `ChillHuoFangSong` loading, but did not make non-bundled English names such as Literata or Atkinson Hyperlegible available.
3. **Visual-only testing**: The video showed the user-facing result, but earlier tests only asserted option list content and generated CSS shape, not that selecting a preset updates the active font axis or that referenced bundled families exist.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added a reader style option test asserting font preset application updates `defaultFont` and preview family consistently. | DONE |
| P0 | Architecture | Added `defaultFont` to curated preset data and centralized application in `applyReaderStyleFontOption()`. | DONE |
| P0 | Architecture | Bundled `Literata` and `Atkinson Hyperlegible` WOFF2 files and registered them in the built-in font registry. | DONE |
| P0 | Documentation | Updated the Reader Appearance Contract to treat preset data, active serif/sans axis, and bundled font availability as one contract. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any reader appearance preset that maps to several lower-level settings can appear selected while leaving a separate active-mode field stale.
* **Design Improvement**: Presets should be applied through a pure helper instead of hand-copying individual fields in UI handlers.
* **Process Improvement**: For font work, use runtime evidence from WebView DevTools (`document.fonts`, generated `@font-face` URLs, computed families) before concluding that a font format is incompatible.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.
* [x] Added bundled English WOFF2 files and extended `packages/app/src/utils/font.test.ts` metadata coverage to all registry fonts.
* [x] Recorded Google Fonts conversion steps in `font-format-tooling.md`.

# Bug Analysis: CJK Font Presets Were Shadowed By Latin Fallback

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus D - Test Coverage Gap
* **Specific Cause**: `getStyles()` generated the reader body stack as selected Latin fonts first, then the configured CJK stack. On Android/WebView, a Latin family can satisfy Chinese glyphs through system fallback before the later CJK stack is considered. Several new CJK preset names were also not bundled, so Source Han/LXGW choices could collapse to the same system CJK fallback while bundled English fonts visibly changed.

## 2. Why Fixes Failed

1. **Comma-separated stack parsing**: It made preset values valid CSS, but it preserved the wrong fallback priority for CJK text.
2. **Bundled English fonts**: Literata and Atkinson Hyperlegible made Latin differences visible, which made the unchanged CJK path more obvious.
3. **Bundled CJK font loading**: `ChillHuoFangSong` could load, but it was still behind Latin families in the body stack, so Android fallback could bypass it.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Test Coverage | Added a style regression requiring CJK aliases/bundled CJK families to appear before the active Latin stack. | DONE |
| P0 | Test Coverage | Added a font CSS regression requiring bundled CJK fonts to declare CJK `unicode-range` so they do not steal Latin glyphs. | DONE |
| P0 | Test Coverage | Added a preset regression requiring every non-system preset to keep a bundled CJK fallback. | DONE |
| P0 | Architecture | Added CJK-only local aliases for non-bundled local CJK families and moved the CJK stack before the active Latin stack. | DONE |
| P0 | Documentation | Updated the Reader Appearance Contract and bundled font asset contract with CJK priority and unicode-range requirements. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any script-specific font stack can be made inert when it is placed after a broader fallback family that the platform expands internally.
* **Design Improvement**: Treat CJK font selection as a script-specific cascade. Non-bundled local CJK names should use CJK-only aliases, while bundled CJK fonts should use `unicode-range`.
* **Process Improvement**: Font tests must assert the order and script range of the generated CSS, not only that a font name appears somewhere in the stack.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Added regression coverage in `packages/app/src/utils/style.test.ts`.
* [x] Added regression coverage in `packages/app/src/utils/font.test.ts`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.

# Bug Analysis: Release CJK Presets Still Depended On Device Fonts

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus C - Change Propagation Failure, plus D - Test Coverage Gap
* **Specific Cause**: The previous CJK fix made the cascade order correct, but `source-serif`, `source-sans`, and `wenkai` still named preferred CJK families that were not shipped in the APK. Debug/test devices could show changes when those fonts or aliases existed, while release devices without them fell back to the same system CJK font. The registry tests parsed existing WOFF2 metadata, but did not assert that every preferred preset family had a bundled resource in both `src-tauri/resources/fonts/` and generated Android assets.

## 2. Why Fixes Failed

1. **CJK-before-Latin cascade fix**: It made loaded fonts win in the correct order, but did not make missing preferred CJK fonts available in release builds.
2. **Bundled CJK fallback**: Keeping `ChillHuoFangSong` prevented total fallback to generic system CJK, but different presets could still collapse to the same bundled fallback when their preferred fonts were absent.
3. **Metadata/resource tests**: They validated files already present in the registry, but did not force Source/Noto/LXGW preset families to be registered and copied into Android assets.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Bundled `Noto Serif CJK SC`, `Noto Sans CJK SC`, and `LXGW WenKai Lite` WOFF2 files and registered them as CJK `unicode-range` faces. | DONE |
| P0 | Test Coverage | Added a registry test requiring every registered font file to exist in both source resources and generated Android assets with matching bytes. | DONE |
| P0 | Test Coverage | Added a preset regression requiring release-stable CJK presets to put the bundled family first. | DONE |
| P0 | Documentation | Updated the bundled reader font contract to require preferred CJK families to be bundled before being first in a release-stable preset. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any preset/list entry that names a runtime asset without registering and packaging that asset can appear correct on a developer machine but fail in Android release.
* **Design Improvement**: Treat font presets, registry entries, source resources, generated Android assets, and CSS family order as one contract. A user-visible preset should not depend on device-installed fonts unless it is explicitly best-effort.
* **Process Improvement**: When a release build bug depends on asset existence, add a test that checks the packaged/generated resource location, not only the source registry or CSS text.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/research/font-format-tooling.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/research/reading-font-candidates.md`.
* [x] Added regression coverage in `packages/app/src/utils/font.test.ts`.
* [x] Added regression coverage in `packages/app/src/utils/style.test.ts`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.

# Bug Analysis: Release English Presets Still Depended On Device Fonts

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus C - Change Propagation Failure, plus D - Test Coverage Gap
* **Specific Cause**: After the CJK release fix, English preset visibility still partly depended on fonts installed on the test device. `source-sans` could put `Source Sans Pro` first even though only `Atkinson Hyperlegible` was bundled, and there was no bundled `Merriweather` preset despite exposing Merriweather as a candidate. Release devices without those system fonts could collapse English options to the same generic serif/sans fallback.

## 2. Why Fixes Failed

1. **Bundling CJK fonts**: It made Chinese choices release-stable, but did not guarantee the active Latin `serif` or `sansSerif` family existed in the APK.
2. **English fallback stacks**: Fallback names are useful on developer machines, but they are not a packaging contract unless the first active family is registered and shipped.
3. **Registry asset tests**: They checked registered files, but did not assert that release-stable presets start with a bundled English family on the active `defaultFont` axis.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Bundled `Merriweather` and `Source Sans 3` WOFF2 files and registered them in the built-in font registry. | DONE |
| P0 | Architecture | Updated `source-sans` so the active sans axis starts with bundled `Source Sans 3`, keeping `Source Sans Pro` as a legacy/system alias after it. | DONE |
| P0 | Architecture | Added a `merriweather` preset whose active serif axis starts with bundled `Merriweather`. | DONE |
| P0 | Test Coverage | Added a preset regression requiring release-stable English presets to start the active Latin axis with a bundled registry family. | DONE |
| P0 | Test Coverage | Kept the source-vs-generated Android asset byte equality test so new English WOFF2 files are copied into both packaging locations. | DONE |
| P0 | Documentation | Updated the bundled reader font contract to require preferred English preset families to be bundled before being first on the active Latin axis. | DONE |
| P1 | Observability | Added native Android logcat diagnostics under `SageReadReaderFont` / `[SageRead:ReaderFont]` so release devices show APK asset existence, Tauri resource reads, WebView font-face load/check status, and active computed stack membership for every bundled font. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any visible preset can look correct on a test machine if the machine happens to have a named font installed, while release devices without that font silently use a generic fallback.
* **Design Improvement**: Treat the preset's active axis (`defaultFont`) as the packaging requirement. The first family on that axis must be bundled for release-stable presets; later families can be opportunistic aliases.
* **Process Improvement**: When adding a preset, add a unit test that maps the selected preset through the same helper used by the UI and verifies the first active family is present in `getBuiltInFontFaceDefinitions()`.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/research/font-format-tooling.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/research/reading-font-candidates.md`.
* [x] Added regression coverage in `packages/app/src/utils/font.test.ts`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.
* [x] Added Android native logcat diagnostics through `AndroidSystemPlugin.logReaderFontDiagnostics`.

# Bug Analysis: Tauri Resource Reads Failed For Android APK Font Assets

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus E - Implicit Assumption
* **Specific Cause**: Android logcat showed `apkAssetExists=true` and a non-zero APK byte count for `resources/fonts/ChillHuoFangSong_Regular.woff2`, while the frontend Tauri FS read failed with `failed to open file at path: asset://localhost/resources/fonts/...`. That means the asset was packaged correctly, but the JavaScript resource-byte loader crossed into a Tauri FS path that was not a real readable filesystem path. The fallback CSS URL was still an `asset://localhost/resources/fonts/...` APK resource URL, which Android WebView did not accept for `@font-face`.

## 2. Why Fixes Failed

1. **Bundling fonts**: Copying fonts into source resources and generated Android assets made `activity.assets.open(...)` succeed, but it did not give WebView a fetchable font URL.
2. **Blob-first loader**: Reading bytes and creating `blob:` URLs is correct when Tauri FS can read `BaseDirectory.Resource`, but Android release can fail before bytes reach JavaScript.
3. **Resolve-resource fallback**: `resolveResource(...)` could return the same `asset://localhost/...` form that had already failed WebView font loading.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Added `prepare_reader_font_asset`, which asks the Android plugin to copy packaged APK assets into a versioned app cache directory and return a local file path. | DONE |
| P0 | Frontend Fallback | When `readFile(..., BaseDirectory.Resource)` fails, the font loader calls `prepare_reader_font_asset`, converts the returned cache path with `convertFileSrc(...)`, and only then falls back to `resolveResource(...)` if native materialization fails. | DONE |
| P0 | Test Coverage | Added a font loader regression that forces Tauri resource reads to fail and asserts every registered font is materialized through the native bridge without emitting `asset://localhost/resources/fonts/...` in CSS. | DONE |
| P0 | Observability | Extended `SageReadReaderFont` logcat entries with `nativeAssetPreparedOk`, `nativeAssetBytes`, `nativeAssetFilePath`, and `nativeAssetError`. | DONE |
| P0 | Documentation | Updated the bundled reader font asset contract to distinguish packaged APK asset existence from JavaScript/WebView font loadability. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any large packaged runtime asset can exist in `activity.assets` while still failing a JavaScript-side read or browser-side URL load. APK asset existence, Tauri FS readability, and WebView fetchability are separate boundaries.
* **Design Improvement**: Android resource fallbacks should produce a real local file path or JavaScript bytes before handing assets to browser APIs. Do not use APK `asset://localhost/...` resource URLs directly as proof that CSS/fetch/image consumers can load them.
* **Process Improvement**: For Android release-only asset bugs, keep native logcat diagnostics that report both packaged asset status and the browser consumer result. The first useful log line should show which boundary failed.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/prd.md`.
* [x] Added regression coverage in `packages/app/src/utils/font.test.ts`.
* [x] Added Rust command registration in `packages/app/src-tauri/src/core/android_system.rs` and `packages/app/src-tauri/src/lib.rs`.
* [x] Added Android native materialization in `AndroidSystemPlugin.prepareReaderFontAsset`.

# Bug Analysis: Loaded Fonts Were Not Active In The Reader Style Stack

## 1. Root Cause Category

* **Category**: C - Change Propagation Failure, plus B - Cross-Layer Contract and E - Implicit Assumption
* **Specific Cause**: Android logcat showed APK assets existed, native cache materialization succeeded, WebView `document.fonts.load/check` succeeded, and `webViewLoadOk=true`, but `computedBodyFontFamily` and `computedDocumentElementFontFamily` stayed `system-ui`. The remaining failure was not font loading; the active Foliate document style stack was stale. Reader load callbacks and settings persistence could use constructor-time/captured settings, while direct `renderer.setStyles(...)` calls did not keep `FoliateViewerManager` and `StyleManager` state synchronized.

## 2. Why Fixes Failed

1. **Asset bundling and native materialization**: These made every WOFF2 file available and loadable, but did not prove the selected family was present in the computed reader CSS stack.
2. **Font diagnostics at mount time**: The first diagnostic ran when `@font-face` CSS was mounted. It showed font availability, but could not distinguish "font is loaded but current reader style still says `system-ui`".
3. **Direct renderer style updates**: React hooks and the style panel could write CSS directly to the Foliate renderer while the manager's stored `globalViewSettings` remained old. A later document load could merge or persist the old settings back.
4. **Stale React closure**: `setViewSettingsCallback` merged updated Foliate settings into the hook's captured `settings` object instead of the current persisted store state, so load-derived settings could overwrite newer font selections.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | State Sync | `FoliateViewerManager.updateViewSettings()` now merges changes into manager config and the style manager, so later load/transform boundaries use the latest `globalViewSettings`. | DONE |
| P0 | Load Boundary | Foliate document load now derives settings from the latest style manager state, updates manager config, and immediately reapplies styles before font diagnostics. | DONE |
| P0 | React Store Safety | `setViewSettingsCallback` now merges against `useAppSettingsStore.getState().settings` instead of a stale hook closure. | DONE |
| P0 | Observability | Added `reader-document-style` diagnostics after live reader style updates so logcat can show whether a selected font is active in the computed stack, not only loadable. | DONE |
| P0 | Test Coverage | Added a manager regression test that updates font settings, triggers a new document load, and asserts load-derived settings/CSS still use the latest bundled font stack rather than the initial `system-ui` stack. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any renderer state that can be updated both through a manager object and direct renderer calls can drift if the manager remains the source for later lifecycle callbacks.
* **Design Improvement**: Treat "asset exists", "font face loads", and "font is active in computed style" as three separate runtime states. The selected preset is only effective when the loaded font also appears in the current computed reader stack.
* **Process Improvement**: When logcat shows `webViewLoadOk=true` but `activeEffective=false` for the selected family, first inspect current style stack and stale settings propagation before changing font files or resource URLs again.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/prd.md`.
* [x] Added regression coverage in `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts`.

# Bug Analysis: Legacy CJK Presets Collapsed To ChillHuoFangSong

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus D - Test Coverage Gap
* **Specific Cause**: The visible legacy presets `经典衬线`, `现代无衬线`, and `优雅楷体` started their CJK stacks with Android-optional system fonts (`SimSun`, `PingFang SC`, `STKaiti`/`KaiTi`) and only ended with bundled `ChillHuoFangSong`. On Android release those system names can be absent, so all three presets fall through to the same bundled fallback and become visually identical to `寒蝉活宋体`.

## 2. Why Fixes Failed

1. **Bundling preferred CJK fonts**: It fixed the newly added release-stable presets, but the older visible presets were not covered by the same "first CJK family must be bundled" rule.
2. **Bundled fallback requirement**: Requiring every non-system preset to include `ChillHuoFangSong` prevented generic fallback, but it also hid that several presets had no release-stable first CJK face.
3. **Tests focused on new presets**: Existing regressions checked `source-serif`, `source-sans`, and `wenkai`, but not legacy `classic`, `modern`, and `elegant`.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | First fix updated `classic`, `modern`, and `elegant` so their CJK stacks started with bundled `Noto Serif CJK SC`, `Noto Sans CJK SC`, and `LXGW WenKai Lite` respectively. Later superseded by hiding those legacy conceptual ids and migrating them to visible bundled choices. | SUPERSEDED |
| P0 | Test Coverage | First regression required `comfortable`, `classic`, `modern`, and `elegant` to start with distinct bundled CJK families on release builds. Later superseded by visible-option and migration-alias tests. | SUPERSEDED |
| P0 | Documentation | Updated the bundled reader font contract to treat legacy visible presets as release presets, then superseded it with the hidden legacy alias contract. | SUPERSEDED |

## 4. Systematic Expansion

* **Similar Issues**: Any UI-visible preset can collapse to another preset if its first practical family is an unbundled system font that is absent on Android.
* **Design Improvement**: Treat every visible reader preset as release-stable unless it is explicitly labeled system/default. Secondary system names can remain as opportunistic aliases, but the first active CJK family should be bundled.
* **Process Improvement**: When adding or preserving preset options, test the first bundled CJK family for both new and legacy presets, not only whether a bundled fallback appears somewhere in the stack.

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/prd.md`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.

# Bug Analysis: Legacy Conceptual Presets Stayed Visible After Bundling

## 1. Root Cause Category

* **Category**: B - Cross-Layer Contract, plus F - Product Surface Drift
* **Specific Cause**: After fixing release fallback by putting bundled families first, `经典衬线`, `现代无衬线`, and `优雅楷体` still appeared as selectable presets even though they were legacy conceptual labels, not actual bundled font names. This made the selector look like it contained fonts that may not exist on the device.

## 2. Why Fixes Failed

1. **Availability and visibility were conflated**: Making a preset technically renderable does not mean the label should remain visible if the user expects the list to represent real font choices.
2. **Migration lacked a display policy**: Old settings needed compatibility, but compatibility can be handled through aliases instead of keeping deprecated ids in `CURATED_FONTS`.
3. **Tests only checked rendering stability**: The prior regression required distinct first CJK families, but did not assert that the visible selector excludes deprecated conceptual options.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Removed `classic`, `modern`, and `elegant` from visible `CURATED_FONTS`. | DONE |
| P0 | Migration | Mapped old/current persisted legacy settings to visible bundled options: `classic` -> `merriweather`, `modern` -> `source-sans`, `elegant` -> `wenkai`. | DONE |
| P0 | Test Coverage | Added regressions requiring the visible selector to contain only bundled/generic choices and legacy settings to map to visible options. | DONE |

## 4. Systematic Expansion

* **Similar Issues**: Any display option whose label is not an actual bundled/generic font choice should be hidden or renamed; fallback aliases can remain in CSS stacks without becoming user-facing choices.
* **Design Improvement**: Separate persisted compatibility aliases from visible option definitions.
* **Process Improvement**: When adding font options, test both "does it render with bundled first families" and "should this id be visible to users".

## 5. Knowledge Capture

* [x] Updated `.trellis/spec/app/frontend/state-management.md`.
* [x] Updated `.trellis/tasks/05-24-expand-reading-font-options/prd.md`.
* [x] Added regression coverage in `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`.
