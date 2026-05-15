# Mobile UI Component Strategy Research

## Question

For an Android mobile/tablet-only redesign in the existing Tauri React app, should the project keep the current Tailwind/Radix/shadcn/Vaul-style UI stack or adopt a broader mobile UI framework?

## Sources

* Tauri homepage: https://tauri.app/
* shadcn/ui Drawer docs: https://ui.shadcn.com/docs/components/drawer
* Radix Primitives introduction: https://www.radix-ui.com/primitives/docs/overview/introduction
* Radix styling guide: https://www.radix-ui.com/primitives/docs/guides/styling
* Ionic React overview: https://ionicframework.com/react
* Ionic docs introduction: https://ionicframework.com/docs
* Material UI overview: https://mui.com/material-ui/

## Findings

* Tauri supports arbitrary frontend stacks and does not provide or require a native Android component library for the webview UI.
* The existing app already uses React, Tailwind CSS v4, Radix UI primitives, shadcn-style components, Vaul-backed drawers, lucide-react, Sonner, and Zustand.
* Radix primitives are low-level, accessible, unstyled components. That fits a custom Stitch-derived visual language because styling remains under our control.
* shadcn/ui Drawer is built on Vaul and documents React drawer composition, side selection, scrollable content, and responsive dialog/drawer patterns. This matches the chosen bottom-dock/sheet reader model.
* Ionic React is a mature mobile-first UI toolkit with many ready-made mobile components, gestures, and platform-adaptive behavior. It would add a large design system and app-shell opinion on top of the current app.
* Material UI is a mature React component library implementing Material Design. It is production-ready and mobile-first, but its default visual language would compete with the quieter Stitch `Luminous Scholar` direction unless heavily themed.

## Feasible Approaches

### Approach A: Keep Tailwind + Radix/shadcn + Vaul (Recommended)

Use the current stack as primitives, then build a small Android design system around Stitch tokens: app shell, bottom navigation, rail, bottom sheets, reader dock, list/card primitives, segmented controls, chips, and settings forms.

Pros:
* Lowest migration overhead.
* Preserves current React component assumptions.
* Full control over the Stitch visual language.
* Existing dependencies already include most primitives.

Cons:
* More custom composition work.
* Must manually enforce Android touch ergonomics and sheet behavior.

### Approach B: Add Ionic React for shell/components

Adopt Ionic React for mobile navigation, sheets/modals, form controls, and gestures while keeping Tauri and React.

Pros:
* Strong mobile component coverage.
* Mature mobile interaction patterns.

Cons:
* Adds a second design system and app-shell model.
* Harder to make the UI feel like the Stitch reading app instead of a generic Ionic app.
* More migration and integration risk with existing shadcn/Radix components.

### Approach C: Add Material UI

Use Material UI for Android-familiar components and responsive layout primitives.

Pros:
* Mature React component library.
* Android-adjacent Material Design defaults.

Cons:
* Visual language conflicts with Stitch unless deeply customized.
* Adds another styling/theming system beside Tailwind.
* Could make the app feel like a general productivity app rather than a quiet reader.

## Recommendation

Use Approach A. Keep the existing stack and create a focused mobile design-system layer for the Android shell and reading workflows. Add individual targeted dependencies only if a specific gap appears during implementation.
