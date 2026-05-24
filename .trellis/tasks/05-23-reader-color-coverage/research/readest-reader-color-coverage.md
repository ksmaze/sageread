# Readest Reader Color Coverage

## Source

* DeepWiki MCP repository question for `readest/readest`: Readest reader theme and color configuration.
* GitHub source at commit `336a719e08ceff1d330079cc58a82637e86e10db`:
  * `apps/readest-app/src/styles/themes.ts`
  * `apps/readest-app/src/utils/style.ts`
  * `apps/readest-app/src/hooks/useTheme.ts`

## Palette Values To Reuse

Use only the Readest light-mode values for this app's comfort reader backgrounds:

| Reader background | Readest theme | bg | fg | primary |
|---|---|---|---|---|
| paper | Sepia light | `#f1e8d0` | `#5b4636` | `#008b8b` |
| green | Grass light | `#d7dbbd` | `#232c16` | `#177b4d` |

Do not copy Readest's dark Sepia/Grass variants. This app's product decision is that dark mode always resolves to the existing default dark reader palette.

## Readest Content Surfaces Worth Mirroring

Readest's `getColorStyles()` does not only recolor paragraphs. When color override is enabled it targets:

```css
section, aside, blockquote, article, nav, header, footer, main, figure,
div, p, font, h1, h2, h3, h4, h5, h6, li, span
```

For this selector set it applies:

* `background-color: <bg> !important`
* `color: <fg> !important`
* `border-color: <fg> !important`

Other relevant surfaces:

* `pre, span` inline code background.
* `a:any-link` color from `primary`.
* `img` light-mode `mix-blend-mode: multiply` when colors are overridden.
* `svg, img` transparent background when colors are overridden.
* Horizontal-rule background image workaround:
  * `*:has(> hr.background-img):not(body)` background color.
  * `hr.background-img` multiply blend mode.
* Single-image paragraph workaround:
  * `p[width][height] > img:only-child` multiply blend mode.
* Inline images with text siblings:
  * parent background set to `bg`.
  * image blend mode based on light/dark.
* Hardcoded black text override includes both `font[color]` and inline `style*="color: ..."` selectors.
* EPUB template workarounds:
  * Gutenberg header color inheritance.
  * `.x-ebookmaker*` background unset.
  * Feedbooks `.chapterHeader` background/border reset.
  * `.calibre` color/background unset.

## Mapping To This App

This app already has the same base palette values in `packages/app/src/styles/themes.ts` and already derives `forceContentColors` for non-default light reader backgrounds. The implementation should expand the injected reader CSS in `packages/app/src/utils/style.ts` without changing store shape or UI.

Testing can remain pure string-policy tests in `packages/app/src/utils/style.test.ts`, because the behavior is generated CSS rather than DOM renderer state.
