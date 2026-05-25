# Current Sageread Font Implementation

## Summary

Sageread currently exposes a small fixed set of curated reader font combinations. The reader settings UI does not discover installed system fonts and does not expose custom font upload/management. One bundled CJK WOFF2 font, `ChillHuoFangSong_Regular.woff2`, is mounted for CJK environments/books.

## Key Files

* `packages/app/src/services/constants.ts`
  * `DEFAULT_BOOK_FONT` defaults to Georgia / Helvetica / Consolas and `defaultCJKFont: "ChillHuoFangSong"`.
  * `CURATED_FONTS` is the actual reader font option list shown in the current UI.
  * Legacy-style exported font arrays exist (`SERIF_FONTS`, `SANS_SERIF_FONTS`, platform font lists, CJK regex), but current search shows they are not consumed outside this constants file.
* `packages/app/src/pages/reader/components/reader-style-font-options.ts`
  * `getReaderStyleFontOptions()` simply returns `CURATED_FONTS`.
* `packages/app/src/pages/reader/components/settings-dropdown.tsx`
  * `ReaderStylePanel` reads `getReaderStyleFontOptions()`.
  * It matches the current setting by `serif`, `sansSerif`, and `cjk`.
  * When a font option is selected, it updates `serifFont`, `sansSerifFont`, and `defaultCJKFont` in global view settings.
  * It displays `font.name`; `nameEn` is defined in constants but currently unused.
* `packages/app/src/utils/style.ts`
  * `getFontStyles()` writes CSS variables for serif, sans-serif, monospace, and CJK fonts.
  * The active document font stack is only the selected Latin font plus the selected CJK font plus the generic serif/sans-serif fallback.
  * Unlike Readest, it does not build a broad platform/CJK fallback chain from the exported font arrays.
* `packages/app/src/utils/font.ts`
  * Hardcodes one bundled resource: `resources/fonts/ChillHuoFangSong_Regular.woff2`.
  * Uses Tauri `resourceDir()` and `convertFileSrc()` to create an asset URL.
  * Injects one `@font-face` rule for `ChillHuoFangSong`.
  * Mounts this font into the main app only in CJK environment, and into book documents when the book language/environment is CJK.
* `packages/app/src/pages/reader/hooks/use-foliate-viewer/foliate-viewer-manager.ts`
  * Calls `mountAdditionalFonts(doc, isCJKLang(language))` when Foliate loads a book document.
* `packages/app/src-tauri/tauri.conf.json`
  * Allows fonts in CSP.
  * Bundles `resources/fonts/*` as Tauri resources.
* `packages/app/src/pages/reader/components/reader-style-font-options.test.ts`
  * Current test asserts options exactly mirror `CURATED_FONTS`, which is compatible with adding entries there.

## Current Options

* `system` -> system-ui for Latin and CJK.
* `comfortable` -> Georgia / Helvetica / ChillHuoFangSong.
* `classic` -> Times New Roman / Arial / SimSun.
* `modern` -> Helvetica / Helvetica / PingFang SC.
* `elegant` -> Georgia / Helvetica / STKaiti.

## Constraints

* Adding options only to `CURATED_FONTS` is low risk, but non-bundled family names render only when installed or provided by the OS.
* Bundling additional fonts requires extending `utils/font.ts` from one hardcoded font to a small font-face registry.
* Bundled CJK fonts are large. The existing single WOFF2 is about 7.8 MB.
* The current UI is one combined preset selector, not separate English/CJK selectors.

