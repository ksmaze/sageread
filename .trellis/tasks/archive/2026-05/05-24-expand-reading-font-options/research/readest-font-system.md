# Readest Font System Research

## Sources

* DeepWiki page: https://deepwiki.com/readest/readest/3.4-font-system-and-typography
* DeepWiki asked directly about `readest/readest` font selection, built-in fonts, custom fonts, and source paths.

## Summary

Readest has a more complete typography system than Sageread currently keeps. It combines static font lists, platform-aware fallback stacks, CJK-specific font injection, and user custom font management.

## Key Readest Files Identified by DeepWiki

* `apps/readest-app/src/services/constants.ts` -> built-in and platform font constants.
* `apps/readest-app/src/components/settings/FontPanel.tsx` -> font settings UI.
* `apps/readest-app/src/store/customFontStore.ts` -> custom font metadata, loading, activation, sync, and state.
* `apps/readest-app/src/styles/fonts.ts` -> additional font links / `@font-face` helpers / custom font mounting.
* `apps/readest-app/src/utils/style.ts` -> generated reader CSS font stacks.
* `apps/readest-app/src/utils/font.ts` -> font metadata parsing.
* `apps/readest-app/src/app/reader/components/FoliateViewer.tsx` -> injects additional/custom fonts into book documents.
* `apps/readest-app/src-tauri/plugins/tauri-plugin-native-bridge/android/src/main/java/NativeBridgePlugin.kt` -> Android native system font listing.

## Implementation Shape

* Font settings include default font family, serif, sans-serif, monospace, CJK font, size, minimum size, weight, and override flags.
* `getFontStyles()` builds robust stacks:
  * selected user font first,
  * selected default CJK font,
  * other built-in fonts in that category,
  * CJK category fonts,
  * platform/generic fallbacks.
* DeepWiki lists Readest serif options such as Bitter, Literata, Merriweather, Roboto Slab, Vollkorn, PT Serif, Georgia, Times New Roman.
* DeepWiki lists Readest CJK serif options such as LXGW WenKai GB Screen, LXGW WenKai TC, Source Han Serif CN, Huiwen-MinchoGBK, KingHwa_OldSong.
* DeepWiki lists Readest sans options such as Roboto, Noto Sans, Open Sans, PT Sans, Helvetica, and CJK sans options Noto Sans SC / TC.
* CJK support includes injecting additional fonts/links and mapping generic Chinese family names such as Kaiti, Heiti, XiHeiti, and FangSong to better local or web fonts.
* Custom font support stores font metadata, loads font binaries into Blob URLs, and injects `@font-face` into both the main document and Foliate iframe documents.
* Platform font discovery broadens choices on desktop; mobile has predefined platform lists.

## Mapping to Sageread

* Sageread has retained many static font constants but currently bypasses them through a simplified `CURATED_FONTS` selector.
* Sageread removed custom font management, and the existing test explicitly expects only curated built-in choices.
* A full Readest-style system font/custom font port is larger than this task. The practical MVP is to improve curated presets and, if needed, add a small built-in font-face registry for a limited number of bundled OFL fonts.

