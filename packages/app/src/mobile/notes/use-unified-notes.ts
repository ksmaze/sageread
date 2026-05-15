import { getBookNotes } from "@/services/book-note-service";
import { getBookById, getBooks } from "@/services/book-service";
import { getNotes } from "@/services/note-service";
import type { SimpleBook } from "@/types/simple-book";
import { useQuery } from "@tanstack/react-query";
import {
  type BookNoteOwner,
  type UnifiedNoteItem,
  type UnifiedNoteType,
  createUnifiedNoteFromBookNote,
  createUnifiedNoteFromStandaloneNote,
  filterUnifiedNotesByType,
} from "./unified-note-model";

export type { UnifiedNoteItem, UnifiedNoteType } from "./unified-note-model";

interface UnifiedNotesOptions {
  bookId?: string;
  type?: UnifiedNoteType | "all";
}

function toBookNoteOwner(book: SimpleBook | null, fallbackBookId: string): BookNoteOwner {
  return {
    id: book?.id ?? fallbackBookId,
    title: book?.title ?? "未知书籍",
    author: book?.author,
  };
}

async function getUnifiedBookNotes(bookId?: string): Promise<UnifiedNoteItem[]> {
  if (bookId) {
    const [book, bookNotes] = await Promise.all([getBookById(bookId), getBookNotes(bookId)]);
    const owner = toBookNoteOwner(book, bookId);
    return bookNotes.map((note) => createUnifiedNoteFromBookNote(note, owner));
  }

  const books = await getBooks({ sortBy: "updatedAt", sortOrder: "desc" });
  const noteGroups = await Promise.all(
    books.map(async (book) => {
      const bookNotes = await getBookNotes(book.id);
      return bookNotes.map((note) => createUnifiedNoteFromBookNote(note, book));
    }),
  );

  return noteGroups.flat();
}

export function useUnifiedNotes({ bookId, type = "all" }: UnifiedNotesOptions = {}) {
  return useQuery({
    queryKey: ["mobile-unified-notes", bookId ?? "all", type],
    queryFn: async () => {
      const [notes, bookNotes] = await Promise.all([
        getNotes({ bookId, sortBy: "updated_at", sortOrder: "desc" }),
        getUnifiedBookNotes(bookId),
      ]);

      return filterUnifiedNotesByType([...notes.map(createUnifiedNoteFromStandaloneNote), ...bookNotes], type).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
    },
  });
}
