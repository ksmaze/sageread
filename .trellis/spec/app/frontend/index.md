# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains the current frontend conventions for `packages/app`. The active app shell is Android mobile/tablet first; legacy desktop shell documents remain as reference for code that is still present but not mounted by default.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Android Mobile Shell](./android-mobile-shell.md) | Current Android phone/tablet app shell, reader dock/sheets, safe areas, and verification matrix | Captured |
| [Desktop App Design](./desktop-app-design.md) | Legacy desktop-first app shell, reader workspace, visual tokens, and UI contracts | Legacy reference |
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Captured |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Captured |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Captured |
| [State Management](./state-management.md) | Local state, global state, server state | Captured |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Captured |
| [Type Safety](./type-safety.md) | Type patterns, validation | Captured |

---

## Maintenance Rule

When the Android shell, reader workspace, services, stores, or shared UI primitives change, update the matching spec file in the same task. Document actual current behavior, not aspirational patterns.

---

**Language**: All documentation should be written in **English**.
