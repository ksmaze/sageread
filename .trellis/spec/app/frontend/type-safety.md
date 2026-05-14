# Type Safety

> Type safety patterns in `packages/app`.

---

## Overview

The package uses TypeScript with React 19, Vite, Zustand, TanStack Query, Tauri APIs, and service/domain types under `src/types/`. Prefer explicit domain types at service and store boundaries, local interfaces for component props, and narrow union types for UI modes.

## Type Organization

- Shared domain types live in `src/types/*.ts`.
- Component props live next to the component unless reused broadly.
- Store state/action interfaces live in the store file.
- Service request/response shapes should be typed at the service boundary.
- Generated or external declarations live in `global.d.ts`, `vite-env.d.ts`, or package-specific `.d.ts` files.

```ts
export type LibraryViewModeType = "grid" | "list";
export type LibrarySortByType = "title" | "author" | "updated" | "created" | "size" | "format";
export type LibraryCoverFitType = "crop" | "fit";
```

## Props and Callback Types

Use explicit props interfaces and typed callbacks.

```tsx
interface SearchToggleProps {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
```

Prefer domain-specific update payloads over loose objects.

```ts
interface BookUpdateData {
  title?: string;
  author?: string;
  coverPath?: string;
  tags?: string[];
}
```

## Validation

Runtime validation is mixed today:

- UI forms often validate with local derived booleans.
- Constants define supported file/image extensions.
- Service and AI/provider areas may use schema libraries where already established.

For UI form validation, keep validation explicit and close to the form:

```ts
const validation = useMemo(() => {
  const isTitleValid = title.trim().length > 0;
  const isAuthorValid = author.trim().length > 0;
  return { isTitleValid, isAuthorValid, isFormValid: isTitleValid && isAuthorValid };
}, [title, author]);
```

For uploaded files, validate against `FILE_ACCEPT_FORMATS` / `SUPPORTED_FILE_EXTS` before calling `uploadBook`.

## Common Patterns

### Union Types for UI Modes

Use literal unions for mode state:

```ts
export type NotepadTab = "notes" | "annotations";
export type OpenDropdown = "toc" | "search" | "settings" | null;
```

### Optional Runtime Data

Reader data and config can be absent during initialization. Guard before mounting foliate.

```tsx
if (!bookData?.bookDoc || !config || !contentInsets) {
  return null;
}
```

### Persisted Store Merges

When persisted JSON cannot represent runtime objects such as `Map`, reconstruct those objects in the `merge` function and cast only at the final return boundary.

```ts
const readerStores = new Map<string, ReaderStore>();
for (const tab of persisted?.tabs ?? []) {
  readerStores.set(tab.id, createReaderStore(tab.bookId));
}
```

## Forbidden Patterns

- Do not use `any` for new domain contracts. If external tool output is unknown, narrow it before use.
- Do not assume optional settings fields exist unless the defaults guarantee them.
- Do not mount reader or foliate components before data/config guards pass.
- Do not represent UI modes as arbitrary `string` when a union type is known.
- Do not share feature-local prop types globally unless multiple features consume them.

## Common Mistakes

- Treating persisted state as if it preserves `Map` or class instances.
- Forgetting that `book.status`, `book.coverUrl`, and vectorization metadata can be absent.
- Adding a new reader dropdown value without updating the `OpenDropdown` union.
- Passing untyped service payloads through components instead of defining a boundary type.
