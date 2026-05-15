# brainstorm: fix font family select option display

## Goal

Fix the UI issue where the "字体系列" font-family select option cannot show, so users can see and choose font family values reliably.

## What I already know

* The reported issue is: "字体系列 select option cannot show".
* The affected control is in `packages/app/src/pages/reader/components/settings-dropdown.tsx`.
* The shared select primitive is `packages/app/src/components/ui/select.tsx`, based on `@radix-ui/react-select`.
* The settings panel is currently hosted inside `DropdownMenu`, while `SelectContent` portals to the document body.
* Existing `Popover` usage exists in `packages/app/src/components/side-chat/context-popover.tsx` for interactive floating panels.
* User verified that other selects work and only `字体系列` remains broken after the first wrapper change.
* The active Android reader style surface renders through `MobileSheet`, whose `DrawerContent` uses `z-[100]`, while default `SelectContent` uses `z-50`.

## Assumptions (temporary)

* "字体系列" refers to a font-family control in the reader/settings UI.
* "select option cannot show" means the dropdown/options list is not visible or not usable when opened.
* The desired fix is a targeted bug fix, not a redesign of the typography settings UI.

## Open Questions

* None.

## Requirements (evolving)

* The font-family select should display its available options.
* The fix should preserve existing styling and settings behavior.
* The reader settings trigger should continue to participate in the existing `openDropdown` state so it remains consistent with the reader header controls.
* Use Approach A: convert the reader settings wrapper from `DropdownMenu` to `Popover`.
* Scan other app frontend `DropdownMenu` usages for nested `Select` controls and adjust any equivalent issue found.

## Acceptance Criteria (evolving)

* [ ] Opening the font-family select displays the expected font-family options.
* [ ] Selecting a font family continues to update the relevant reading/settings state.
* [ ] The settings panel still opens/closes from the reader header settings button.
* [ ] Other `DropdownMenu` usages containing `Select` controls are identified and either fixed or documented as not applicable.
* [ ] Existing lint/type checks pass.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Redesigning the typography settings UI.
* Adding new font families unless required to restore the missing options.
* Replacing all dropdown menus globally when they do not contain nested interactive select behavior.

## Technical Notes

* Task created: `.trellis/tasks/05-15-fix-font-family-select-option-display`.
* Relevant package: `app` frontend.
* Relevant spec indexes inspected: `.trellis/spec/guides/index.md`, `.trellis/spec/app/frontend/index.md`.
* Likely root cause: nesting a portalled Radix `SelectContent` inside a Radix `DropdownMenuContent` can cause outside-interaction/focus behavior to close the parent menu before the select options can be shown or used.
* Recommended approach: use `Popover` for the interactive reader settings panel instead of `DropdownMenu`, preserving current placement and `openDropdown` state.
* Expanded-scope scan result: `packages/app/src/pages/reader/components/settings-dropdown.tsx` is the only app frontend `.tsx` file that imports both `DropdownMenu` and the shared `Select`.
* Other shared `Select` uses are in settings content (`tts-settings.tsx`, `llama.tsx`) without `DropdownMenu`; other `DropdownMenu` uses (`model-selector.tsx`, reader TOC/search, notifications, general theme menu) do not nest the shared `Select`.
* Corrected active-surface root cause: on Android, `ReaderStylePanel` is rendered inside `ReaderSheetHost`/`MobileSheet`; the font select options were portalled below the sheet because the sheet is `z-[100]` and default select content is `z-50`.
* Implementation keeps the Popover wrapper improvement for the legacy reader header and raises the font `SelectContent` to `z-[120]` so it appears above the active reader sheet.

## Technical Approach Options

**Approach A: Convert settings wrapper to Popover** (Recommended)

* How it works: Replace only `SettingsDropdown`'s `DropdownMenu` wrapper with the existing `Popover` primitive; keep `ReaderStylePanel` and select implementation unchanged.
* Pros: Matches the semantics of an interactive settings panel, avoids nested Radix dropdown/select portal conflicts, and is localized to one component.
* Cons: Slightly changes the outer primitive, so close/focus behavior must be checked.

**Approach B: Keep DropdownMenu and patch event behavior**

* How it works: Add event handling around the select or dropdown content to prevent the parent dropdown from closing when the select portal is opened.
* Pros: Keeps the current primitive.
* Cons: More brittle because it relies on Radix outside-interaction details and may fail for future interactive controls.

**Approach C: Change the shared Select primitive**

* How it works: Modify `SelectContent` portal/container behavior globally.
* Pros: Could help other nested select cases.
* Cons: Higher blast radius; existing settings and model selects may change unintentionally.

## Decision (ADR-lite)

**Context**: The reader settings panel contains interactive controls, including a Radix `Select` whose option list is portalled. Nesting that inside Radix `DropdownMenu` can make the parent dropdown close or interfere when the select opens.

**Decision**: Use Approach A. Replace the settings panel wrapper with the existing `Popover` primitive while keeping the `ReaderStylePanel`, font option list, and setting update logic unchanged.

**Consequences**: The fix is localized to the reader settings trigger and should avoid changing global select behavior. The implementation must verify panel open/close behavior and font option selection still work.

## Verification Notes

* `pnpm --filter app build` passed after the code change.
* `pnpm exec biome check packages/app/src/pages/reader/components/settings-dropdown.tsx` passed.
* Static scan confirmed `packages/app/src/pages/reader/components/settings-dropdown.tsx` is the only app frontend `.tsx` file that imports both `DropdownMenu` and the shared `Select`.
* After user reported the first wrapper-only change did not fix the active surface, `pnpm exec biome check packages/app/src/pages/reader/components/settings-dropdown.tsx` and `pnpm --filter app build` passed again after raising the font select content above the reader sheet.
* Manual runtime UI verification was not run in this CLI session after the z-index change.
