# Font Format Tooling

## Recommended Tools

### fontTools

* Docs: https://fonttools.readthedocs.io/en/latest/subset/index.html
* `fonttools subset` can subset and optimize OTF/TTF/WOFF fonts.
* It can output WOFF2 with `--flavor=woff2`, but requires the Brotli Python extension.
* Useful command shape:

```bash
python -m pip install fonttools brotli
fonttools subset Input.ttf --output-file=Output.woff2 --flavor=woff2 --unicodes='*'
```

For CJK fonts, subsetting to `--unicodes='*'` is only format conversion and may still be large. Actual subset ranges reduce size but risk missing characters in arbitrary books.

### Google woff2

* Repo: https://github.com/google/woff2
* Provides `woff2_compress myfont.ttf` and `woff2_decompress myfont.woff2`.
* Useful if we have a local binary available or build it. On Windows, fontTools is usually easier to run from Python.

## Recommended Project Workflow

1. Prefer upstream WOFF2 releases where the font project provides them.
2. If only TTF/OTF is available, use `fonttools subset --flavor=woff2` with Brotli.
3. For full CJK coverage, avoid aggressive subsetting unless we define supported Unicode ranges and accept missing rare glyphs.
4. Before shipping a WOFF2, validate both glyph coverage and OpenType `name` records. At minimum, bundled fonts need name IDs 1 (family), 2 (subfamily), 4 (full name), and 6 (PostScript name), otherwise WebView font sanitization can reject the file even when CSS and glyph coverage look correct.
5. Keep bundled fonts under `packages/app/src-tauri/resources/fonts/`.
6. Extend `packages/app/src/utils/font.ts` to mount multiple named font faces from a registry instead of hardcoding `ChillHuoFangSong`.

## Metadata Normalization

Use fontTools `ttx`/Python APIs when a WOFF2 has glyphs but missing or inconsistent name records. The reader currently has a regression test in `packages/app/src/utils/font.test.ts` that parses shipped WOFF2 files and requires name IDs 1, 2, 4, and 6.

Minimal inspection command:

```bash
python -m pip install fonttools brotli
ttx -t name -o - packages/app/src-tauri/resources/fonts/ChillHuoFangSong_Regular.woff2
```

After normalizing a source font under `packages/app/src-tauri/resources/fonts/`, sync the same WOFF2 to generated Android assets when that generated asset exists:

```bash
Copy-Item -LiteralPath packages/app/src-tauri/resources/fonts/ChillHuoFangSong_Regular.woff2 -Destination packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/ChillHuoFangSong_Regular.woff2
```

## English Font Bundling Used In This Task

Small Latin reading fonts were sourced from Google Fonts and converted from TTF to WOFF2 with fontTools:

```bash
python -m pip install fonttools brotli
fonttools subset AtkinsonHyperlegible-Regular.ttf --output-file=AtkinsonHyperlegible_Regular.woff2 --flavor=woff2 --unicodes='*'
fonttools subset Literata-Regular.ttf --output-file=Literata_Regular.woff2 --flavor=woff2 --unicodes='*'
```

Merriweather and Source Sans 3 were downloaded as upstream Google Fonts variable TTFs, instantiated to regular static fonts with fontTools `varLib.instancer`, normalized to stable regular-family name records, then saved as WOFF2:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = instantiateVariableFont(TTFont("Merriweather.ttf"), {"wght": 400, "wdth": 100, "opsz": 18})
font.flavor = "woff2"
font.save("Merriweather_Regular.woff2")

font = instantiateVariableFont(TTFont("SourceSans3.ttf"), {"wght": 400})
font.flavor = "woff2"
font.save("SourceSans3_Regular.woff2")
```

Source URLs used:

```text
https://fonts.gstatic.com/s/atkinsonhyperlegible/v12/9Bt23C1KxNDXMspQ1lPyU89-1h6ONRlW45GE5Q.ttf
https://fonts.gstatic.com/s/literata/v40/or3PQ6P12-iJxAIgLa78DkrbXsDgk0oVDaDPYLanFLHpPf2TbBG_F_Y.ttf
https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather%5Bopsz%2Cwdth%2Cwght%5D.ttf
https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf
```

Converted output sizes:

```text
Merriweather_Regular.woff2 369,024 bytes
SourceSans3_Regular.woff2 103,104 bytes
```

After conversion, copy the WOFF2 files to both source resources and generated Android assets, then run `src/utils/font.test.ts` so the registry, Android resource URL behavior, and WOFF2 `name` metadata are checked together.

## CJK Font Bundling Used In This Task

The release-stable CJK presets use full upstream fonts converted directly to WOFF2 with fontTools `TTFont(...).flavor = "woff2"` so arbitrary books keep broad glyph coverage:

```python
from fontTools.ttLib import TTFont

font = TTFont("NotoSerifCJKsc-Regular.otf")
font.flavor = "woff2"
font.save("NotoSerifCJKsc_Regular.woff2")
```

Source URLs used:

```text
https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf
https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf
https://raw.githubusercontent.com/lxgw/LxgwWenKai-Lite/main/fonts/TTF/LXGWWenKaiLite-Regular.ttf
```

Converted output sizes:

```text
NotoSerifCJKsc_Regular.woff2 16,708,536 bytes
NotoSansCJKsc_Regular.woff2 11,425,248 bytes
LXGWWenKaiLite_Regular.woff2 5,269,840 bytes
```

After conversion, copy each WOFF2 to both `packages/app/src-tauri/resources/fonts/` and `packages/app/src-tauri/gen/android/app/src/main/assets/resources/fonts/`. The registry test must verify both locations exist with matching bytes, in addition to checking WOFF2 `name` records.
