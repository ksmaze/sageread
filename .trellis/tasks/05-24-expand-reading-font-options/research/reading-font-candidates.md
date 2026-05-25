# Reading Font Candidates

## Selection Criteria

* Good long-form reading behavior, not just UI display.
* Chinese and English coverage considered separately.
* Prefer OFL/open-source fonts if bundling is considered.
* Avoid proprietary fonts unless used only as optional system fallbacks.
* Keep package size visible because CJK font files are large.

## English Candidates

### Literata

* Best fit: primary English serif for ebooks and long-form text.
* Rationale: created for Google Play Books; repo describes it as a digital text/long-form reading family with OFL licensing.
* License/source: https://github.com/googlefonts/literata
* Good preset pairing: `serif: "Literata"`, `sansSerif: "Atkinson Hyperlegible"` or system sans, CJK paired with Source Han Serif or ChillHuoFangSong.

### Merriweather

* Best fit: warm editorial serif for readable English prose.
* Rationale: repo says it has editorial/news suitability and space-saving proportions.
* License/source: https://github.com/SorkinType/Merriweather
* Bundled source used: `Merriweather[opsz,wdth,wght].ttf` from https://github.com/google/fonts/tree/main/ofl/merriweather, instantiated to regular WOFF2.
* Good preset pairing: `serif: "Merriweather"`, CJK paired with Noto Serif CJK SC or ChillHuoFangSong.

### Source Sans 3

* Best fit: primary English sans-serif for release-stable sans reading presets.
* Rationale: the Adobe Source Sans family is a readable UI/text sans; Source Sans 3 is available from Google Fonts as an OFL variable family that can be bundled.
* License/source: https://github.com/adobe-fonts/source-sans and https://github.com/google/fonts/tree/main/ofl/sourcesans3
* Bundled source used: `SourceSans3[wght].ttf` from Google Fonts, instantiated to regular WOFF2.
* Good preset pairing: `sansSerif: "Source Sans 3, Source Sans Pro, Atkinson Hyperlegible"`, CJK paired with Noto Sans CJK SC.

### Atkinson Hyperlegible

* Best fit: accessibility-oriented English sans-serif option.
* Rationale: designed to increase character recognition and improve readability for low-vision readers.
* License/source: https://github.com/googlefonts/atkinson-hyperlegible
* Good preset pairing: `sansSerif: "Atkinson Hyperlegible"`, CJK paired with Noto Sans SC / Source Han Sans.

## Chinese Candidates

### Source Han Serif SC / Noto Serif SC

* Best fit: serious Simplified Chinese serif/Song-style long-form reading.
* Rationale: Source Han Serif is an OpenType Pan-CJK family and provides Simplified Chinese resources; Noto Serif CJK is the Google-branded sibling.
* License/source: https://github.com/adobe-fonts/source-han-serif
* Bundled source used: `NotoSerifCJKsc-Regular.otf` from https://github.com/notofonts/noto-cjk (`Serif/OTF/SimplifiedChinese/`).
* License note: OFL 1.1 via the repository license.
* Good preset pairing: English `Literata` or `Merriweather`.

### Source Han Sans SC / Noto Sans SC

* Best fit: clean Simplified Chinese sans-serif reading and modern UI-like prose.
* Rationale: Source Han Sans is an OpenType Pan-CJK family and provides Simplified Chinese resources; Noto Sans CJK is the Google-branded sibling.
* License/source: https://github.com/adobe-fonts/source-han-sans
* Bundled source used: `NotoSansCJKsc-Regular.otf` from https://github.com/notofonts/noto-cjk (`Sans/OTF/SimplifiedChinese/`).
* License note: OFL 1.1 via the repository license.
* Good preset pairing: English `Atkinson Hyperlegible`, `Noto Sans`, or system sans.

### LXGW WenKai / LXGW WenKai Screen / Lite

* Best fit: comfortable Chinese reading with handwritten/kai flavor, especially medium-length prose and notes.
* Rationale: open-source Chinese font derived from Klee One; the project includes Screen and Lite variants, where Lite is explicitly positioned as easier to embed.
* License/source: https://github.com/lxgw/LxgwWenKai
* Bundled source used: `LXGWWenKaiLite-Regular.ttf` from https://github.com/lxgw/LxgwWenKai-Lite.
* License note: OFL 1.1; repo says it can be bundled with software, but original names are reserved for derivatives.
* Caution: the author notes the base style may be better for medium-length text than dense long-form books; use as an optional comfort preset, not the only CJK reading recommendation.

## Practical Presets for Sageread

Assuming we stay with a combined preset selector, the recommended MVP additions are:

1. `source-serif` / "思源宋体" / "Source Serif"
   * `serif: "Literata"`
   * `sansSerif: "Atkinson Hyperlegible"`
   * `cjk: "Noto Serif CJK SC"` first, then `"Source Han Serif SC"` and other system fallbacks.
   * Purpose: high-quality Chinese serif plus strong English ebook serif.
2. `source-sans` / "思源黑体" / "Source Sans"
   * `serif: "Merriweather"`
   * `sansSerif: "Source Sans 3"` first, then `"Source Sans Pro"` and `"Atkinson Hyperlegible"`.
   * `cjk: "Noto Sans CJK SC"` first, then `"Source Han Sans SC"` and other system fallbacks.
   * Purpose: modern sans reading and accessibility.
3. `wenkai` / "霞鹜文楷" / "LXGW WenKai"
   * `serif: "Literata"`
   * `sansSerif: "Atkinson Hyperlegible"`
   * `cjk: "LXGW WenKai Lite"` first, then `"LXGW WenKai"` and kai-style system fallbacks.
   * Purpose: optional comfortable/kai-flavored Chinese preset.
4. `merriweather` / "Merriweather"
   * `serif: "Merriweather"` first, then `"Literata"` and system serif fallbacks.
   * `sansSerif: "Source Sans 3"` or `"Atkinson Hyperlegible"` fallback.
   * `cjk: "Noto Serif CJK SC"` first, then Source Han/system Song-style fallbacks and `ChillHuoFangSong`.
   * Purpose: bundled English editorial serif preset that remains visible in Android release builds.

For Android release reliability, the first CJK family in these release-stable presets is bundled as a WOFF2 and mounted through the built-in font registry. The first active English family must also be bundled on the preset's `defaultFont` axis; secondary family names remain opportunistic system or legacy fallbacks.
