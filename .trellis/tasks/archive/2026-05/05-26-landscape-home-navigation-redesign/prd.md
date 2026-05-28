# brainstorm: redesign landscape home navigation

## Goal

Redesign the home screen navigation for landscape layouts so the interface no longer shows duplicate navigation controls in both the left rail and bottom tab bar. The result should make better use of wide screens while preserving clear access to the main app sections.

## What I already know

* The current landscape home screen shows functionally identical navigation on the left side and at the bottom.
* The visible navigation items are library, notes, AI, and statistics.
* The screenshot shows the duplicate navigation consuming space and making the home page feel redundant.
* The affected screen is likely in the `app` package frontend.
* Code inspection confirms the Android shell intentionally has two navigation components: `TabletRail` and `MobileBottomNav`.
* `TabletRail` is hidden below `md` and displayed from `md` upward.
* `MobileBottomNav` is always rendered when not explicitly hidden, so `md` and wider layouts can show both global navigation surfaces.
* Destination wrappers already use `pb-20 md:pb-0`, implying the intended design is bottom navigation on phone widths and no bottom nav from `md` upward.
* User accepted a visual companion for layout comparisons.

## Assumptions (temporary)

* Portrait/mobile layouts may still need a bottom tab bar.
* Landscape/tablet or desktop-like layouts should use one primary navigation surface, not two.
* The redesign should remain consistent with existing app styling unless code inspection shows a better local pattern.

## Open Questions

* None.

## Requirements

* Landscape home screen must avoid showing duplicate global navigation.
* The four main app sections must remain reachable.
* The design should respect the current Android mobile/tablet shell contract unless we intentionally revise it.
* Use the adaptive navigation approach: phone widths keep `MobileBottomNav`; `md` and wider layouts use `TabletRail` as the only global navigation.
* MVP scope is limited to fixing the duplicated navigation surface across shared shell destinations.

## Acceptance Criteria

* [x] In `md` and wider layouts, only `TabletRail` is visible as global navigation; `MobileBottomNav` is hidden.
* [x] In widths below `md`, `MobileBottomNav` remains visible and `TabletRail` remains hidden.
* [x] Library, notes, AI, and statistics remain accessible from the visible navigation.
* [x] Existing destination bottom padding remains correct: phone layouts reserve bottom-nav space, `md` and wider layouts do not.
* [x] The redesign is verified against the current app's responsive layout for library, notes, AI, and stats destinations.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint/typecheck pass.
* Docs or task notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Redesigning the book-card content area beyond spacing needed for the navigation change.
* Changing core reader, notes, AI, or statistics functionality.
* Visual polish to the existing tablet rail width, selected state, icon treatment, or spacing.
* Library landscape content/grid/header refinements beyond avoiding bottom navigation overlap.
* Introducing a new top navigation pattern.

## Technical Notes

* Initial user evidence: landscape screenshot of the home/library screen.
* Visual comparison screen: `.superpowers/brainstorm/codex-1779819778/content/landscape-navigation-options.html`.
* Relevant spec: `.trellis/spec/app/frontend/android-mobile-shell.md`.
* Relevant files inspected:
  * `packages/app/src/mobile/app-shell.tsx`
  * `packages/app/src/mobile/components/tablet-rail.tsx`
  * `packages/app/src/mobile/components/mobile-bottom-nav.tsx`
  * `packages/app/src/mobile/destinations/*-destination.tsx`
  * `packages/app/src/mobile/constants.ts`
* Current spec says: phone uses `MobileBottomNav`; tablet uses `TabletRail`.
* Implementation added a regression test at `packages/app/src/mobile/components/mobile-bottom-nav.test.tsx`.
* Code-spec sync updated `.trellis/spec/app/frontend/android-mobile-shell.md` to capture the `MobileBottomNav` `md:hidden` contract.

## Feasible Approaches

**Approach A: adaptive rail (recommended)**

* How it works: keep bottom navigation for phone widths, hide it from `md` upward, and use the existing tablet rail as the only global navigation on landscape/tablet widths.
* Pros: minimal change, matches the current Android shell spec, fixes the duplicate navigation directly.
* Cons: phone landscape widths that cross `md` will also use the rail.
* Decision: selected by user.

**Approach B: bottom navigation only**

* How it works: remove or hide the tablet rail and keep bottom navigation across all widths.
* Pros: consistent phone-style navigation everywhere.
* Cons: wastes vertical space in landscape and conflicts with the current tablet shell spec.

**Approach C: top navigation for landscape**

* How it works: replace rail/bottom nav with a top navigation row in landscape.
* Pros: maximizes lateral and bottom content area.
* Cons: largest redesign and requires revisiting settings placement, safe areas, and the current shell contract.

## Decision (ADR-lite)

**Context**: The current Android shell already separates phone and tablet navigation in code and spec, but `MobileBottomNav` is still visible at tablet/landscape widths. This produces duplicate global navigation.

**Decision**: Use Approach A, adaptive rail. Hide bottom navigation from the `md` breakpoint upward and keep the existing `TabletRail` as the only global navigation on wider layouts.

**Consequences**: The implementation should be small and aligned with the shell spec. The main trade-off is that sufficiently wide phone landscape layouts will follow the tablet rail behavior, which is acceptable if the breakpoint remains the current shell boundary.

## Technical Approach

Implement the chosen adaptive shell behavior in `MobileBottomNav` by making the bottom navigation hidden from the Tailwind `md` breakpoint upward. Keep `TabletRail` unchanged because it already follows the intended `hidden ... md:flex` behavior. Add focused regression coverage for the bottom nav class contract so the shell cannot accidentally show both global navigation surfaces again.

## Implementation Plan

* Add a focused test that asserts `MobileBottomNav` includes the responsive `md:hidden` class.
* Run the test and confirm it fails before changing production code.
* Add `md:hidden` to the `MobileBottomNav` root `<nav>` class list.
* Re-run the focused test and package build.
* Verify no spec update is needed unless implementation reveals a new shell convention.
