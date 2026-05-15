import type { BookQueryOptions } from "@/types/simple-book";

export interface GetBooksBackendOptions extends Omit<BookQueryOptions, "sortBy"> {
  sortBy?: "title" | "author" | "created_at" | "updated_at";
}

const GET_BOOKS_SORT_FIELDS: Record<NonNullable<BookQueryOptions["sortBy"]>, GetBooksBackendOptions["sortBy"]> = {
  author: "author",
  createdAt: "created_at",
  title: "title",
  updatedAt: "updated_at",
};

export function toGetBooksBackendOptions(options: BookQueryOptions = {}): GetBooksBackendOptions {
  const { sortBy, ...rest } = options;

  return {
    ...rest,
    ...(sortBy ? { sortBy: GET_BOOKS_SORT_FIELDS[sortBy] } : {}),
  };
}
