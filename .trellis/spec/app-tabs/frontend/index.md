# Frontend Development Guidelines

> Best practices for frontend development in `packages/app-tabs`.

---

## Overview

This directory contains the current frontend conventions for `packages/app-tabs`, the private React tab-strip bridge used by the desktop app shell.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Captured |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Captured |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Captured |
| [State Management](./state-management.md) | Local state, global state, server state | Captured |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Captured |
| [Type Safety](./type-safety.md) | Type patterns, validation | Captured |

---

## Maintenance Rule

When the `app-tabs` public API, DOM controller, hook bridge, CSS selectors, or app integration contract changes, update the matching spec file in the same task. Document actual current behavior, not aspirational patterns.

---

**Language**: All documentation should be written in **English**.
