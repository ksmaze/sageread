# reader comfort background content color coverage

## Goal

Align the reader comfort-background color coverage with the useful parts of Readest's reader styling so Sepia/Paper and Grass/Eye-comfort modes recolor the full reader content surface consistently, not only basic paragraph blocks.

## What I already know

* The app already has separate reader background presets: default, paper, and green.
* Paper maps to Readest Sepia light colors: bg `#f1e8d0`, fg `#5b4636`, primary `#008b8b`.
* Green maps to Readest Grass light colors: bg `#d7dbbd`, fg `#232c16`, primary `#177b4d`.
* Dark mode must keep the existing default dark reader palette; do not implement Readest's dark Sepia/Grass variants.
* Current `getColorStyles()` forces colors only for a narrow selector group: `div, p, h1, h2, h3, h4, h5, h6`.
* Readest recolors a wider reader content set including semantic sections, lists, font tags, figures, borders, links, SVG/images, inline hardcoded black text, and selected EPUB template classes.

## Requirements

* Keep the existing Paper/Sepia and Green/Grass color values.
* Keep existing dark mode behavior: selected comfort backgrounds do not create separate dark variants.
* Expand forced content-color coverage for non-default light reader backgrounds to match the relevant Readest selector scope.
* Force `background-color`, `color`, and `border-color` for structural/text elements when comfort backgrounds force content colors.
* Apply link color from the selected palette primary color.
* Keep image/SVG backgrounds transparent and use the existing light-mode multiply behavior for images when content colors are forced.
* Add targeted handling for common EPUB quirks from Readest: `font[color="#000"]`, background image horizontal rules, inline images with text siblings, Feedbooks `.chapterHeader`, and `.calibre`.
* Preserve default background behavior as the user's way to keep original book colors.

## Acceptance Criteria

* [x] Paper and green still use the Readest Sepia/Grass light palette values.
* [x] Default light background still does not force content colors.
* [x] Non-default light backgrounds force colors on semantic reader content elements, not only paragraphs/divs/headings.
* [x] Forced reader content colors include `border-color`.
* [x] Hardcoded black `font[color]` and inline black `style` text are recolored to the selected foreground.
* [x] Link color uses the selected palette primary color under forced reader colors.
* [x] Images/SVGs do not retain opaque book backgrounds when reader colors are forced.
* [x] Tests cover the expanded selector/color policy.

## Definition of Done

* Tests added/updated where appropriate.
* Lint / typecheck / build green.
* Docs/spec notes updated if behavior changes.
* Task changes committed separately from unrelated workspace changes.

## Technical Approach

Expand `packages/app/src/utils/style.ts` `getColorStyles()` to use the Readest-inspired content selector set for `effectiveOverrideColor`, while keeping the existing `forceContentColors` policy and dark-mode override. Add focused assertions to `packages/app/src/utils/style.test.ts` so selector coverage, border color, links, hardcoded black font tags, SVG/image transparency, and default-mode preservation are regression-tested.

## Out of Scope

* Readest dark Sepia/Grass variants.
* Background texture support.
* E-ink-specific selection/highlight behavior.
* Full Tailwind app theme integration for reader background colors.
* Per-book reader color settings.

## Technical Notes

* Existing implementation files:
  * `packages/app/src/utils/style.ts`
  * `packages/app/src/utils/style.test.ts`
  * `packages/app/src/styles/themes.ts`
* Research reference:
  * [`research/readest-reader-color-coverage.md`](research/readest-reader-color-coverage.md)
* Verification:
  * `pnpm exec tsx --test src/utils/style.test.ts`
  * `pnpm exec tsc --noEmit --pretty false`
  * `pnpm exec biome check src/utils/style.ts src/utils/style.test.ts --diagnostic-level=error --max-diagnostics=50`
  * `pnpm --filter app build`
