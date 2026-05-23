# brainstorm: reader theme backgrounds

## Goal

Improve the reading experience by expanding background/theme options beyond the current black and white backgrounds. The user is considering either adding new theme modes or separating background selection from text styling, with new paper-like and green eye-comfort backgrounds while preserving readable text contrast.

## What I already know

* Current app appears to have black and white reading backgrounds.
* Desired additions include paper-toned color and green eye-comfort color.
* The design needs to consider whether text should sit directly on the background or have its own backing/surface for contrast.
* `packages/app/src/pages/reader/components/settings-dropdown.tsx` currently exposes theme mode as auto/light/dark in the reader style panel.
* `packages/app/src/styles/themes.ts` already includes palette presets that map closely to the request, including `sepia` and `grass`.
* `packages/app/src/utils/style.ts` reads a `themeColor` value from `localStorage` and maps it through existing theme palettes, but `packages/app/src/store/theme-store.ts` does not expose a setter or UI for changing it.
* `ViewSettings.overrideColor` controls whether book content colors are overridden; its default is currently `false`, so colored backgrounds may not always force readable text unless MVP changes that behavior.

## Assumptions (temporary)

* The feature affects a reader or reading view rather than the full application shell.
* Theme/background choice should be persisted if existing theme preferences are persisted.
* Existing black/white behavior should remain available and compatible.

## Open Questions

* None.

## Requirements (evolving)

* Use a separate reader background/color preset rather than extending the existing auto/light/dark theme mode.
* In dark mode, force the existing dark/black reader background; paper and green eye-comfort backgrounds only apply when the resolved theme mode is light.
* Add exactly three reader background presets for MVP: default, paper, and green eye-comfort.
* Do not add separate white/original options beyond the default preset.
* Ensure readable contrast between text and background in all supported modes.
* When a non-default light-mode reader background such as paper or green is selected, force compatible text and content background colors instead of respecting the book's original colors.
* Apply non-default reader background colors to the reader document/page background, not only to text block backgrounds.
* Users who need original book colors can switch back to the default/original background preset.
* Reader background choice should persist globally with other reader appearance settings and apply live to the current reader view.

## Acceptance Criteria

* [x] Users can choose exactly three reader background presets: default, paper, and green eye-comfort.
* [x] Paper and green backgrounds are available/effective in light mode.
* [x] Dark mode uses the existing dark reader background regardless of selected light-mode background preset.
* [x] Paper and green backgrounds apply to the reader page background and force readable foreground/background colors in book content.
* [x] Default/original preset remains available as the way to return to original-color behavior.
* [x] The selected reader background persists globally and updates the current reader view without reopening the book.
* [x] Reading text remains readable on each background.
* [x] Existing theme behavior does not regress.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Custom user-defined colors unless explicitly added to MVP.
* Per-book background presets.
* Additional presets beyond default, paper, and green eye-comfort.
* Full application rebranding or unrelated theme overhaul.

## Technical Notes

* Initial PRD seeded before repo inspection.
* Relevant package: `packages/app` frontend.
* Relevant files inspected:
  * `packages/app/src/pages/reader/components/settings-dropdown.tsx`
  * `packages/app/src/store/theme-store.ts`
  * `packages/app/src/styles/themes.ts`
  * `packages/app/src/utils/style.ts`
  * `packages/app/src/types/book.ts`
  * `packages/app/src/services/constants.ts`
  * `packages/app/src/pages/reader/hooks/use-foliate-viewer/index.ts`
* Implementation added:
  * `ReaderBackground` presets and legacy `themeColor` fallback mapping in `packages/app/src/styles/themes.ts`.
  * Derived reader style policy in `packages/app/src/utils/style.ts`, including dark-mode override and forced content colors for non-default light backgrounds.
  * Persisted `readerBackground` state and app-theme isolation in `packages/app/src/store/theme-store.ts`.
  * Three reader background buttons in `packages/app/src/pages/reader/components/settings-dropdown.tsx`.
  * Policy tests in `packages/app/src/utils/style.test.ts`.
* Verification:
  * `pnpm exec tsx --test src/utils/style.test.ts` from `packages/app`.
  * `pnpm exec tsc --noEmit --pretty false` from `packages/app`.
  * `pnpm exec biome check src/styles/themes.ts src/utils/style.ts src/utils/style.test.ts src/store/theme-store.ts src/pages/reader/components/settings-dropdown.tsx --diagnostic-level=error --max-diagnostics=50` from `packages/app`.
  * `pnpm --filter app build` from repo root.

## Research References

* [`research/reader-background-patterns.md`](research/reader-background-patterns.md) - Existing code and comparable reader patterns favor a separate reader background/color preset over extending auto/light/dark theme mode.

## Research Notes

### Feasible approaches

**Approach A: Separate reader background preset** (Recommended)

* How it works: keep theme mode as auto/light/dark, add a reader background/color preset control backed by the existing `themeColor` concept.
* Pros: clear mental model, reuses existing palettes, avoids multiplying theme mode values.
* Cons: requires a real `themeColor` setter/store state and reader UI.
* User decision: chosen.

**Approach B: Extend theme mode**

* How it works: add paper/green beside auto/light/dark in the current theme mode group.
* Pros: fewer visible controls.
* Cons: mixes brightness mode with reading surface color and creates wider type churn.

**Approach C: Text backing surface**

* How it works: render colored page/background, then place text on a neutral readable surface.
* Pros: stronger contrast protection for rich backgrounds.
* Cons: more layout risk inside EPUB/PDF/fixed-layout content; likely unnecessary for flat paper/green MVP.

## Decision (ADR-lite)

**Context**: The reader needs paper and green eye-comfort backgrounds without confusing them with system light/dark behavior.

**Decision**: Add a separate reader background/color preset control. Keep theme mode as auto/light/dark. Dark mode forces the existing dark reader background; paper and green backgrounds are light-mode-only.

**Consequences**: Implementation should add theme color state and UI while preserving existing theme mode behavior. Future reader background colors only need light-mode definitions, avoiding a growing matrix of dark variants. Non-default comfort backgrounds should override book foreground/background colors; users can switch back to default/original when they want author-provided styling.
