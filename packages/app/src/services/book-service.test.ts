import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toGetBooksBackendOptions } from "./book-query-options";

describe("book-service query options", () => {
  it("normalizes get_books sort fields to database column names", () => {
    assert.deepEqual(toGetBooksBackendOptions({ sortBy: "updatedAt", sortOrder: "desc" }), {
      sortBy: "updated_at",
      sortOrder: "desc",
    });
    assert.deepEqual(toGetBooksBackendOptions({ sortBy: "createdAt", sortOrder: "asc" }), {
      sortBy: "created_at",
      sortOrder: "asc",
    });
  });

  it("preserves non-date book query fields", () => {
    assert.deepEqual(
      toGetBooksBackendOptions({
        limit: 20,
        offset: 40,
        searchQuery: "sci-fi",
        sortBy: "title",
        sortOrder: "asc",
        tags: ["fiction"],
      }),
      {
        limit: 20,
        offset: 40,
        searchQuery: "sci-fi",
        sortBy: "title",
        sortOrder: "asc",
        tags: ["fiction"],
      },
    );
  });
});
