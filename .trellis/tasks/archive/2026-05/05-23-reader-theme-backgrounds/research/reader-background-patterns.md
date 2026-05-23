# Reader Background Patterns

## Question

Should the new paper and green eye-comfort colors be modeled as additional theme modes, or as a separate reader background/color preset?

## Comparable Patterns

* Kindle describes reading comfort controls that include text size, font, margins, alignment, orientation, continuous scroll, brightness, and background colors inside the book reading menu.
* Apple Books separates reader appearance controls from the surrounding app shell: the current iPhone User Guide says Books has a `Themes & Settings` menu with background mode, display brightness, page theme, font, and spacing controls.
* Apple Books' App Store listing describes reading themes with fonts and background colors, and separately mentions Auto-Night Theme, so dark/night behavior is not presented as the same thing as manual background selection.
* Kobo highlights reader customization, night mode, and accessibility support for sufficient text/background contrast.
* This repo already distinguishes app shell theme mode (`auto` / `light` / `dark`) from reading content styles: `ViewSettings` drive the iframe content CSS, while `themeColor` is already read by `getThemeCode()` but is not currently surfaced in reader UI.

## Repo Constraints

* `packages/app/src/store/theme-store.ts` persists `themeMode` only and exposes no `themeColor` setter.
* `packages/app/src/utils/style.ts` reads `themeColor` from `localStorage`, then maps it to `themes` in `packages/app/src/styles/themes.ts`.
* `packages/app/src/styles/themes.ts` already includes `sepia`, `grass`, `solarized`, `gruvbox`, `contrast`, and other palettes, so the implementation likely needs exposure and naming more than a brand-new color engine.
* `packages/app/src/pages/reader/components/settings-dropdown.tsx` currently exposes only `themeMode` buttons in the reader style panel.
* `getColorStyles()` can override document colors when `overrideColor` is enabled, but the current default is `overrideColor: false`, so book CSS can keep its own text/background unless the user or implementation changes that behavior.

## Feasible Approaches

### Approach A: Separate Reader Background Preset (Recommended)

Add a reader-facing background/color preset control, backed by the existing `themeColor` concept. Keep `themeMode` as auto/light/dark. Presets can start with default, paper, green, and contrast/dark-compatible choices.

Pros:
* Clear mental model: mode controls light/dark; background controls reading comfort.
* Reuses existing theme palette infrastructure.
* Allows paper/green to work with auto/light/dark without multiplying theme mode values.

Cons:
* Requires adding a proper store setter and UI state for `themeColor`.
* Needs careful naming because existing `sepia` and `grass` labels may not match the desired product language.

### Approach B: Add Theme Mode Values

Extend `ThemeMode` beyond auto/light/dark to include paper and green.

Pros:
* Small apparent UI change if added beside current buttons.
* Fewer controls in the style panel.

Cons:
* Conflates system brightness mode with reading surface color.
* Auto/dark compatibility becomes awkward, e.g. "green dark" versus "dark".
* Existing code assumes `ThemeMode = auto | light | dark`, so this creates broader type and behavior churn.

### Approach C: Text Backing Surface Per Preset

Keep the page background colored, but optionally render text on a neutral content surface for colored backgrounds.

Pros:
* Can preserve contrast even on stronger background colors.
* Useful if future backgrounds become images/textures.

Cons:
* More visual complexity in paginated/scrolled iframe content.
* Can fight EPUB/CSS layout and fixed-layout books.
* Probably not necessary for flat paper/green colors if text color and override rules are controlled.

## Recommendation

Use Approach A for MVP. Treat "paper" and "green eye-comfort" as reader background/color presets. Apply the selected preset to the reading content by default using appropriate foreground colors, and only add a text backing surface later if actual contrast/layout problems appear.

For dark-mode interaction, mirror the Apple Books mental model: keep manual reader background selection separate, and let auto/light/dark mode resolve the brightness variant of that selected background. For example, `paper` can have a light paper palette and a dark warm-paper palette; `green` can have a light green palette and a dark muted-green palette. This preserves user intent while keeping contrast acceptable.

## Sources

* Apple Books App Store listing: https://apps.apple.com/us/app/id364709193
* Apple Books iPhone User Guide: https://support.apple.com/guide/iphone/read-books-iphc1af7c57/ios
* Amazon Kindle App Store listing: https://apps.apple.com/us/app/amazon-kindle/id302584613
* Kobo Books App Store listing: https://apps.apple.com/us/app/kobo-books/id301259483
