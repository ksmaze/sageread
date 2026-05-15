import { getBookNotes } from "@/services/book-note-service";
import { getBookById, getBooks } from "@/services/book-service";
import { getNotes } from "@/services/note-service";
import type { BookNote, BookNoteType } from "@/types/book";
import type { Note } from "@/types/note";
import type { SimpleBook } from "@/types/simple-book";
import { useQuery } from "@tanstack/react-query";

export type UnifiedNoteType = "note" | BookNoteType;

export interface UnifiedNoteItem {
  id: string;
  type: UnifiedNoteType;
  bookId?: string;
  bookTitle?: string;
  title: string;
  body: string;
  updatedAt: number;
  source: Note | BookNote;
}

interface UnifiedNotesOptions {
  bookId?: string;
  type?: UnifiedNoteType | "all";
}

interface BookNoteOwner {
  id: string;
  title: string;
  author?: string;
}

function fromNote(note: Note): UnifiedNoteItem {
  const title = note.title?.trim() || note.bookMeta?.title || "未命名笔记";
  return {
    id: note.id,
    type: "note",
    bookId: note.bookId,
    bookTitle: note.bookMeta?.title,
    title,
    body: note.content?.trim() || "无正文",
    updatedAt: note.updatedAt,
    source: note,
  };
}

function getBookNoteLabel(type: BookNoteType): string {
  switch (type) {
    case "bookmark":
      return "书签";
    case "annotation":
      return "标注";
    case "excerpt":
      return "摘录";
  }
}

function fromBookNote(note: BookNote, book: BookNoteOwner): UnifiedNoteItem {
  const label = getBookNoteLabel(note.type);
  const title = note.text?.trim() || note.note?.trim() || `${book.title} · ${label}`;
  const body = [note.text, note.note].map((part) => part?.trim()).filter(Boolean).join("\n\n") || label;

  return {
    id: note.id,
    type: note.type,
    bookId: book.id,
    bookTitle: book.title,
    title,
    body,
    updatedAt: note.updatedAt,
    source: note,
  };
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
    return bookNotes.map((note) => fromBookNote(note, owner));
  }

  const books = await getBooks({ sortBy: "updatedAt", sortOrder: "desc" });
  const noteGroups = await Promise.all(
    books.map(async (book) => {
      const bookNotes = await getBookNotes(book.id);
      return bookNotes.map((note) => fromBookNote(note, book));
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

      return [...notes.map(fromNote), ...bookNotes]
        .filter((item) => type === "all" || item.type === type)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
  });
}
