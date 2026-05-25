# brainstorm: expand reading font options

## Goal

Improve the reader font selection by understanding the current font support implementation, comparing Readest's approach, researching readable Chinese and English fonts, and adding better reading-oriented options to the app's font choices.

## What I already know

* The current supported font list feels too limited.
* Chinese and English each need additional fonts that are better suited for long-form reading.
* The user can source/download font files if needed.
* If font format conversion is needed, Codex should identify or use appropriate tooling.
* The final outcome should add the selected fonts to the font options.
* Sageread currently exposes only `CURATED_FONTS` through the reader style selector.
* Sageread currently bundles only one CJK WOFF2 font: `ChillHuoFangSong_Regular.woff2`.
* Readest's current font system is broader: built-in lists, platform font discovery, CJK font links/fallbacks, and custom font management.

## Assumptions (temporary)

* Fonts should be added through the existing font option mechanism rather than introducing a separate font management feature unless the codebase requires it.
* We should prefer fonts that are legally distributable or already available as system fonts/web fonts.
* Bundling is acceptable when release behavior must not depend on device-installed fonts; package-size impact must stay visible in the task notes.

## Open Questions

* None for MVP.

## Requirements (evolving)

* Inspect how font support is implemented today.
* Use DeepWiki to research how Readest implements font support.
* Research readable Chinese and English font choices.
* Add selected Chinese and English reading fonts to the available font options.
* Prefer reading-oriented options: Source Han/Noto Serif SC, Source Han/Noto Sans SC, LXGW WenKai for Chinese; Literata, Merriweather, and Atkinson Hyperlegible for English.
* Keep the MVP compatible with the existing combined preset selector unless the chosen strategy requires a broader UI change.
* Use the hybrid strategy:
  * Add reading-oriented curated presets and fallback stacks now.
  * Refactor built-in font loading into a small registry that can mount multiple bundled font faces.
  * Keep the existing bundled `ChillHuoFangSong` font working.
  * Bundle small open English reading fonts where needed so English presets do not collapse to only Android serif/sans fallbacks.

## Acceptance Criteria (evolving)

* [x] Existing font support path is documented in this task.
* [x] Readest's comparable implementation is summarized with source notes.
* [x] Chinese and English font recommendations are recorded with rationale and source/licensing notes.
* [x] The app exposes the selected additional fonts in the reader font options.
* [x] Built-in font mounting supports a registry of bundled font-face definitions instead of a single hardcoded font.
* [x] Existing `ChillHuoFangSong` behavior is preserved and no longer depends on CJK language/environment detection.
* [x] English reading presets include bundled WOFF2 fonts (`Literata`, `Merriweather`, `Source Sans 3`, `Atkinson Hyperlegible`) so visible options are not limited to WebView fallback aliases.
* [x] Release-stable English presets put a bundled family first on their active Latin axis.
* [x] CJK release-stable presets include bundled WOFF2 fonts (`Noto Serif CJK SC`, `Noto Sans CJK SC`, `LXGW WenKai Lite`) in both source resources and generated Android assets.
* [x] Legacy conceptual presets (`经典衬线`, `现代无衬线`, `优雅楷体`) are hidden from the selector and their persisted settings migrate to visible bundled font choices.
* [x] Android release font debugging emits native logcat diagnostics for every registered bundled font, including APK asset existence and WebView font-face load/check status.
* [x] Android release font loading materializes APK font assets into app cache when Tauri resource-byte reads fail, then loads the cache file URL in WebView.
* [x] Android release font debugging distinguishes loadable fonts from active reader styles; selected presets must drive the current Foliate document computed stack instead of leaving it at stale `system-ui`.
* [x] Selecting a font preset updates the active serif/sans axis (`defaultFont`) as well as the font stack names.
* [x] Tests verify every registered bundled font file exists in the source resource directory and generated Android asset directory, with matching bytes.
* [x] Lint/typecheck/tests relevant to the changed files pass, or any blockers are recorded.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Building a full user-managed custom font upload/install feature.
* Porting Readest's whole platform font discovery/custom-font store in this task.
* Downloading proprietary fonts without clear redistribution rights.
* Broad typography redesign outside the font option list.

## Research References

* [`research/current-font-implementation.md`](research/current-font-implementation.md) — Sageread's current reader font support is a fixed curated list plus one bundled CJK font.
* [`research/readest-font-system.md`](research/readest-font-system.md) — Readest combines static lists, fallback stacks, platform discovery, CJK injection, and custom fonts.
* [`research/reading-font-candidates.md`](research/reading-font-candidates.md) — Recommended Chinese/English reading fonts and license/source notes.
* [`research/font-format-tooling.md`](research/font-format-tooling.md) — Practical WOFF2 conversion options using fontTools or Google woff2.
* [`research/bug-analysis-font-selection.md`](research/bug-analysis-font-selection.md) — Root cause and prevention for the font selection cascade and bundled WOFF2 resource loading bugs found during implementation.

## Research Notes

### What similar tools do

* Readest provides richer font selection than Sageread: category lists, platform/system fonts, CJK fallbacks, and custom font support.
* Readest's robust rendering comes partly from CSS fallback stacks, not only from adding more names to a selector.

### Constraints from this repo

* The current reader UI has one combined font preset selector, where each option maps `serif`, `sansSerif`, and `cjk`.
* `nameEn` exists in `CURATED_FONTS` but is not currently used by the selector.
* Adding entries to `CURATED_FONTS` is the smallest change and existing tests already validate that exported options mirror that list.
* Bundled fonts require changing `utils/font.ts` from a one-font hardcoded loader to a registry that mounts multiple `@font-face` rules.
* CJK font files can materially increase app size.

### Feasible approaches here

**Approach A: Curated system/font-stack presets only**

* How it works: add more `CURATED_FONTS` entries using names/stacks such as Literata, Merriweather, Atkinson Hyperlegible, Source Han Serif SC, Noto Serif SC, Source Han Sans SC, Noto Sans SC, LXGW WenKai, plus platform fallbacks.
* Pros: small code change, no font downloads, no app-size increase.
* Cons: exact fonts only render if already available on the user's OS or installed manually.

**Approach B: Bundle selected OFL fonts**

* How it works: add WOFF2 files under `src-tauri/resources/fonts/`, mount them through a font-face registry, and add curated presets referencing those families.
* Pros: reliable cross-platform rendering and better CJK/English typography out of the box.
* Cons: increases package size; requires font sourcing/conversion and careful license tracking.

**Approach C: Hybrid, system stacks plus bundled registry**

* How it works: add curated reading presets with robust fallback stacks and refactor `utils/font.ts` to support multiple bundled fonts. Bundle selected OFL fonts when a preset must work identically in Android release builds.
* Pros: reliable release rendering for chosen fonts, while keeping system aliases as secondary fallbacks.
* Cons: CJK fonts materially increase APK size.

## Technical Approach

Implement Approach C. Keep the UI model as a compact preset selector, but make each preset capable of expressing practical fallback stacks. Update style generation so preset values can be safe CSS font-family stacks rather than always quoted as one literal family name. Refactor `utils/font.ts` from a one-font hardcoded loader to a small built-in font registry containing the selected bundled English and CJK fonts.

Candidate presets for implementation:

* Source Serif / 思源宋体: Literata + bundled Noto Serif CJK SC, then Source Han Serif SC / Noto Serif SC / Songti / SimSun fallback.
* Source Sans / 思源黑体: bundled Source Sans 3 + bundled Noto Sans CJK SC, then Source Sans Pro / Source Han Sans SC / Noto Sans SC / PingFang SC / Microsoft YaHei fallback.
* Merriweather: bundled Merriweather + bundled Noto Serif CJK SC, then Literata / Source Han Serif SC / platform serif fallback.
* WenKai / 霞鹜文楷: Literata + bundled LXGW WenKai Lite, then LXGW WenKai / Kaiti / STKaiti fallback.
* Keep existing system and comfortable options. Hide legacy conceptual duplicates (`classic`, `modern`, `elegant`) when actual bundled font choices cover them.

## Decision (ADR-lite)

**Context**: The user wants more Chinese and English reading fonts, but can source font files separately. Readest shows a more complete long-term direction, but porting system discovery/custom font management is larger than needed for this task.

**Decision**: Use the hybrid strategy: add curated reading presets and robust fallback stacks, refactor the bundled font loader into an extensible registry, and bundle the selected OFL fonts needed for visible Android release behavior.

**Consequences**: The UI improves immediately and the selected Source Serif/Source Sans/WenKai CJK presets no longer depend on device-installed fonts. APK size increases because the three CJK WOFF2 files add roughly 33.4 MB before APK compression. Non-bundled secondary aliases remain best-effort fallbacks.

## Implementation Plan

* PR1: Add font-family stack helpers and update `getFontStyles()` so family values can be multi-font CSS stacks safely.
* PR2: Add curated reading presets to `CURATED_FONTS` and update/extend reader font option tests.
* PR3: Refactor `utils/font.ts` to a built-in font registry that preserves `ChillHuoFangSong` and can accept future bundled font files.
* PR4: Bundle selected OFL English and CJK fonts as WOFF2 in source resources and generated Android assets.
* PR5: Run focused tests/typecheck and document any remaining font-file follow-up.

## Technical Notes

* Task path: `.trellis/tasks/05-24-expand-reading-font-options`.
* Implemented files:
  * `packages/app/src/services/constants.ts`
  * `packages/app/src/utils/style.ts`
  * `packages/app/src/utils/font.ts`
  * `packages/app/src/pages/reader/components/reader-style-font-options.ts`
  * `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/style-manager.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/index.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts`
  * `packages/app/src/utils/style.test.ts`
  * `packages/app/src/utils/font.test.ts`
  * `packages/app/src-tauri/src/core/android_system.rs`
  * `packages/app/src-tauri/src/lib.rs`
  * `packages/app/src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/AndroidSystemPlugin.kt`
  * `packages/app/src-tauri/resources/fonts/AtkinsonHyperlegible_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/Literata_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/Merriweather_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/SourceSans3_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/NotoSerifCJKsc_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/NotoSansCJKsc_Regular.woff2`
  * `packages/app/src-tauri/resources/fonts/LXGWWenKaiLite_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/AtkinsonHyperlegible_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/Literata_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/Merriweather_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/SourceSans3_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/NotoSerifCJKsc_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/NotoSansCJKsc_Regular.woff2`
  * `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/LXGWWenKaiLite_Regular.woff2`
* Verification:
  * `pnpm exec tsx --test src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts src/pages/reader/components/reader-style-font-options.test.ts src/utils/style.test.ts src/utils/font.test.ts` from `packages/app` (29 tests)
  * `git diff --check`
  * `pnpm exec biome check src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts src/pages/reader/hooks/use-foliate-viewer/style-manager.ts src/pages/reader/hooks/use-foliate-viewer/index.ts src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts src/utils/font.ts src/utils/font.test.ts src/utils/style.ts src/utils/style.test.ts src/pages/reader/components/settings-dropdown.tsx src/pages/reader/components/reader-style-font-options.ts src/pages/reader/components/reader-style-font-options.test.ts --diagnostic-level=error --max-diagnostics=20` from `packages/app`
  * `cargo check --manifest-path packages/app/src-tauri/Cargo.toml`
  * `./gradlew.bat :app:compileUniversalDebugKotlin` from `packages/app/src-tauri/gen/android`
  * `pnpm --filter app build`
* Bug fix note: `overrideFont` must force descendants to `font-family: inherit !important`; `revert` made selected root font stacks ineffective for EPUB body descendants.
* Bundled font fix note: Tauri Android can resolve packaged resources as `asset://localhost/...`, but Android WebView does not reliably accept that URI as a CSS `@font-face` source. Built-in WOFF2 loading now reads resource bytes with `readFile(..., BaseDirectory.Resource)`, emits `blob:` font URLs, and keeps `blob:` in CSP `font-src`. Built-in fonts mount in every reader document rather than only for CJK language/environment matches.
* Bundled WOFF2 metadata fix note: `ChillHuoFangSong_Regular.woff2` contained Chinese glyphs but lacked standard OpenType family/full-name records (`nameID` 1 and 4), which can make Android WebView reject the font during sanitization. The source resource and generated Android asset now have normalized name records and a regression test requiring name IDs 1, 2, 4, and 6.
* Preset application fix note: The reader style selector must update `defaultFont` together with `serifFont`, `sansSerifFont`, and `defaultCJKFont`. Otherwise a selected option can keep using the previous serif/sans axis, making many English presets render as only two fallback fonts.
* CJK fallback priority fix note: The reader body font stack must put CJK aliases/bundled CJK families before the active Latin stack. Android/WebView can otherwise satisfy Chinese glyphs through the earlier Latin family's system fallback, making CJK preset changes appear inert while English changes. Bundled CJK fonts are constrained with CJK `unicode-range`, and non-system presets keep `ChillHuoFangSong` as a bundled CJK fallback until their preferred CJK fonts are bundled.
* Release CJK bundle fix note: `source-serif`, `source-sans`, and `wenkai` now put bundled `Noto Serif CJK SC`, `Noto Sans CJK SC`, and `LXGW WenKai Lite` first in their CJK stacks. The registry test also verifies every bundled font exists under both `src-tauri/resources/fonts/` and generated Android assets with matching bytes.
* Legacy preset visibility fix note: `classic`, `modern`, and `elegant` used Android-optional CJK names (`SimSun`, `PingFang SC`, `STKaiti`/`KaiTi`) before the bundled fallback. On Android release those fonts can be absent, making all three fall through to `ChillHuoFangSong`; after bundling semantically matching fonts, the labels were still conceptual duplicates rather than actual font choices. The selector now hides those legacy ids and migrates old/current persisted settings to visible bundled options (`merriweather`, `source-sans`, `wenkai`).
* Release English bundle fix note: `source-sans` now starts its active sans-serif stack with bundled `Source Sans 3`, and the new `merriweather` preset starts its active serif stack with bundled `Merriweather`. The registry and preset tests treat release-stable English presets the same way as CJK presets: first active family must be bundled and copied into Android assets.
* Native font diagnostic note: `mountAdditionalFonts()` and `mountFontsToMainApp()` now call `log_reader_font_diagnostics`, which forwards a per-font payload to Android `AndroidSystemPlugin.logReaderFontDiagnostics`. Logcat tag `SageReadReaderFont` with message prefix `[SageRead:ReaderFont]` records APK asset existence/byte count via `activity.assets.open(...)`, Tauri resource read status, CSS mount status, `document.fonts.load/check`, and whether the currently computed reader stack contains the family.
* Android APK asset materialization note: On release builds, `readFile(..., BaseDirectory.Resource)` can still fail after native APK inspection proves the font exists because Tauri FS attempts to open `asset://localhost/resources/fonts/<file>.woff2` as a filesystem path. The frontend now calls `prepare_reader_font_asset` in that failure path. `AndroidSystemPlugin.prepareReaderFontAsset` copies the APK asset to a versioned app cache directory and returns a local file path; the frontend converts that path with `convertFileSrc(...)` for `@font-face`. Logcat includes `nativeAssetPreparedOk`, `nativeAssetBytes`, and `nativeAssetFilePath`.
* Reader style activation note: `webViewLoadOk=true` only proves the font face is loadable. If the summary still says `computedBodyFontFamily=system-ui`, the bug is stale/not-applied reader styles. `FoliateViewerManager` now keeps its config synchronized with live `globalViewSettings`, applies current styles immediately on document load, and emits `reader-document-style` diagnostics after live style updates.
* Current implementation files inspected:
  * `packages/app/src/services/constants.ts`
  * `packages/app/src/pages/reader/components/reader-style-font-options.ts`
  * `packages/app/src/pages/reader/components/settings-dropdown.tsx`
  * `packages/app/src/utils/style.ts`
  * `packages/app/src/utils/font.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/style-manager.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/index.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.test.ts`
  * `packages/app/src-tauri/tauri.conf.json`
* DeepWiki page used: https://deepwiki.com/readest/readest/3.4-font-system-and-typography
