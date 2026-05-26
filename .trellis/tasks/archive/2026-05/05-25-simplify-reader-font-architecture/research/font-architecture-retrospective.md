# Reader Font Architecture Retrospective

## Scope

This note compares the recent reader font work and asks whether the current architecture became more complex than the product problem requires.

Reviewed sources:

* `.trellis/tasks/archive/2026-05/05-16-android-only-settings-cleanup/prd.md`
* `.trellis/tasks/archive/2026-05/05-24-expand-reading-font-options/prd.md`
* `git show a74202d^:packages/app/src/utils/font.ts`
* `git show a74202d^:packages/app/src/services/constants.ts`
* Current `packages/app/src/utils/font.ts`
* Current `packages/app/src/utils/style.ts`
* Current `packages/app/src/services/constants.ts`
* Current `packages/app/src/pages/reader/components/reader-style-font-options.ts`
* Current Android plugin `AndroidSystemPlugin.kt`

## Timeline

### 05-15: Font Select Visibility

This task fixed the font family select UI in the Android reader sheet. It did not change the font rendering model. The important lesson was that the reader font selector is a mobile-sheet surface, so UI bugs can look like font bugs when the control is hidden or clipped.

### 05-16: Android-Only Cleanup

This task intentionally removed the custom font management pipeline:

* Removed global font manager UI.
* Removed custom font upload/conversion/discovery path.
* Kept curated built-in reader font choices.

After this task, the architecture was deliberately smaller: curated presets plus a built-in font mounting helper.

### 05-24: Expand Reading Font Options

This task expanded the font model substantially:

* Added seven new WOFF2 files in addition to `ChillHuoFangSong`.
* Duplicated those files into generated Android assets.
* Reworked `font.ts` from a one-font helper into a registry, Android resource resolver, native fallback materializer, main-app/reader mounting utility, and logcat diagnostics bridge.
* Added native Android plugin behavior for APK asset inspection, app-cache font copying, and per-font diagnostics.
* Reworked style generation so CJK stacks are injected before Latin stacks, with CJK-only `unicode-range`.
* Added preset migration and hidden legacy conceptual preset aliases.
* Added tests proving registry, metadata, assets, diagnostics, native materialization, and style sync.

This did address real release-build failures. It also made the font system much larger than the original goal of "add WOFF fonts and let users pick them."

## Old Simple Model

Before `a74202d`, `src/utils/font.ts` was roughly:

* one cached built-in URL;
* `resourceDir()` -> `resources/fonts/ChillHuoFangSong_Regular.woff2`;
* `convertFileSrc(fontPath)`;
* one hardcoded `@font-face` for `ChillHuoFangSong`;
* mount only when `isCJKEnv()` or book language is CJK;
* append a new `<style>` node.

The old `CURATED_FONTS` list exposed:

* `system`
* `comfortable` -> bundled `ChillHuoFangSong` for CJK
* `classic` -> system `SimSun`
* `modern` -> system `PingFang SC`
* `elegant` -> system `STKaiti`

### What Was Good

* Very small mental model.
* One bundled font, one loading path, one CSS family.
* Selector labels were simple and stable.
* Failure blast radius was small.
* App size impact was limited to one CJK WOFF2.

### What Was Not Actually Good

* Android release could resolve resources to `asset://localhost/...`, but WebView did not reliably load that URL as an `@font-face` source.
* Mounting only for CJK env/book language was fragile because EPUB language metadata is often absent or wrong.
* Each document load appended a new style instead of upserting.
* The system-font presets were not reliable on Android release; missing CJK system fonts collapsed to the same fallback.
* There was no runtime evidence for "asset exists", "WebView accepted it", or "the selected family is active in computed styles".

## Current Complex Model

Current source resources contain:

| File | Bytes |
|---|---:|
| `ChillHuoFangSong_Regular.woff2` | 7,830,168 |
| `NotoSerifCJKsc_Regular.woff2` | 16,708,536 |
| `NotoSansCJKsc_Regular.woff2` | 11,425,248 |
| `LXGWWenKaiLite_Regular.woff2` | 5,269,840 |
| `Literata_Regular.woff2` | 52,868 |
| `Merriweather_Regular.woff2` | 369,024 |
| `SourceSans3_Regular.woff2` | 103,104 |
| `AtkinsonHyperlegible_Regular.woff2` | 21,524 |

Total source font bytes: about 41.8 MB before APK compression. The same files are also present under generated Android assets, so the repo carries duplicate copies.

Current `font.ts` now:

* registers every bundled font;
* reads each font from `BaseDirectory.Resource`;
* creates blob URLs when resource bytes are readable;
* falls back to native Android `prepare_reader_font_asset` when Tauri resource reads fail;
* falls back again to `resolveResource`;
* logs diagnostics for every registered font;
* mounts all built-in font faces into every reader document and the main app.

### What Is Better

* Release-build observability is materially better.
* Android APK asset existence can be proven independently through native code.
* The WebView-facing font URL avoids direct `asset://localhost/...` as the primary CSS source.
* CJK `unicode-range` prevents bundled CJK fonts from stealing Latin glyphs.
* Style sync bugs are covered by tests.
* Font asset and metadata regression tests now exist.

### What Is Worse

* The implementation solves too many concerns in one layer: registry, URL resolution, Android fallback, diagnostics, main-app previews, and reader mounting.
* Every registered font is resolved and diagnosed even when the current selected preset needs only one or two faces.
* The product UI still compresses multiple axes into a single preset label, so additional bundled fonts do not necessarily create a clear perceived UX win.
* CJK fonts are large, and multiple CJK families may not create enough visible difference to justify the app/repo size and native-path complexity.
* The debugging machinery was useful during diagnosis, but keeping it as always-on behavior may make normal font loading harder to reason about.
* The architecture now resembles a partial font platform, but 05-16 explicitly removed the full custom font platform.

## Core Difference

The old model was simple but brittle. The current model is robust but over-expanded.

The most important distinction:

* Old product model: "one bundled WOFF plus a few preset names."
* Current product model: "a mini bundled font platform with release diagnostics."

The current model is not necessarily better for the user if the visible outcome is still "some presets look similar" or "I cannot tell whether this choice maps to a real font." Reliability improved, but product clarity did not improve at the same rate.

## What Should Not Be Rolled Back Blindly

Do not restore these old behaviors unchanged:

* Direct `resourceDir()` + `convertFileSrc()` as the only Android release path.
* Language/env-gated mounting for built-in fonts.
* Invisible system-font assumptions for release presets.
* Appending duplicate style nodes.
* Persisting stale reader settings from hook-captured state.

Those were real bugs.

## What Should Be Simplified

The simplification target should be the architecture shape, not the bug fixes:

* Keep a proven Android-compatible font URL path.
* Keep selected-setting style sync.
* Keep tests that prove bundled files exist and can produce CSS.
* Keep the current bundled fonts for now, but do not eagerly load all of them.
* Load/mount only fonts needed by the current selected preset.
* Make visible options correspond to actual bundled families or system default.
* Move heavyweight diagnostics behind an explicit debug mode or one-shot diagnostic helper.

## User Decision Addendum

The selected direction is not an asset rollback. The current bundled fonts can stay, including English fonts. The simplification should happen in the runtime path:

* registry remains as a manifest for current and future bundled fonts;
* current reader selection determines which manifest entries are resolved;
* only selected entries are materialized into Android cache and mounted into the reader document by default;
* settings-panel previews may temporarily load candidate fonts, but that is a scoped UI-preview exception rather than the reader document loading model;
* full-registry checks remain useful as tests or explicit diagnostics, not as normal rendering behavior.

## Conclusion

The user's concern is justified. The current code is more robust than the old code, but it likely overshot the product need. The better direction is not a full rollback; it is a "rollback of runtime scope" while preserving the hard-earned release-build fixes and the ability to add new bundled WOFF2 fonts later.
