# Frontend Development Guidelines

> Best practices for frontend/library development in `packages/foliate-js`.

---

## Overview

This directory contains the current conventions for `packages/foliate-js`, the git submodule native ES module ebook-rendering library consumed by the app.

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

When `foliate-js` module boundaries, custom element contracts, renderer/book interfaces, event shapes, security constraints, or app-facing module declarations change, update the matching spec file in the same task. Document actual current behavior, not aspirational patterns.

---

**Language**: All documentation should be written in **English**.
