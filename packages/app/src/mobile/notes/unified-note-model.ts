import { getNoteDisplayBody, getNoteDisplayTitle } from "@/components/notepad/note-utils";
import type { BookNote, BookNoteType } from "@/types/book";
import type { Note } from "@/types/note";

export type UnifiedNoteType = "note" | BookNoteType;

export interface UnifiedNoteFilter {
  id: UnifiedNoteType | "all";
  label: string;
}

export interface BookNoteOwner {
  id: string;
  title: string;
  author?: string;
}

export interface UnifiedNoteItem {
  id: string;
  type: UnifiedNoteType;
  typeLabel: string;
  bookId?: string;
  bookTitle?: string;
  bookAuthor?: string;
  title: string;
  body: string;
  cfi?: string;
  createdAt?: number;
  updatedAt: number;
  source: Note | BookNote;
}

export interface UnifiedNoteReaderTarget {
  bookId: string;
  title: string;
  cfi?: string;
}

export const UNIFIED_NOTE_FILTERS: UnifiedNoteFilter[] = [
  { id: "all", label: "全部" },
  { id: "note", label: "笔记" },
  { id: "annotation", label: "标注" },
  { id: "excerpt", label: "摘录" },
  { id: "bookmark", label: "书签" },
];

export const UNIFIED_NOTE_TYPE_LABELS: Record<UnifiedNoteType, string> = {
  note: "笔记",
  annotation: "标注",
  excerpt: "摘录",
  bookmark: "书签",
};

function cleanText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export function createUnifiedNoteFromStandaloneNote(note: Note): UnifiedNoteItem {
  const title = getNoteDisplayTitle(note);
  const body = getNoteDisplayBody(note);

  return {
    id: note.id,
    type: "note",
    typeLabel: UNIFIED_NOTE_TYPE_LABELS.note,
    bookId: note.bookId,
    bookTitle: note.bookMeta?.title,
    bookAuthor: note.bookMeta?.author,
    title,
    body,
    cfi: note.cfi,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    source: note,
  };
}

export function createUnifiedNoteFromBookNote(note: BookNote, book: BookNoteOwner): UnifiedNoteItem {
  const label = UNIFIED_NOTE_TYPE_LABELS[note.type];
  const text = cleanText(note.text);
  const attachedNote = cleanText(note.note);
  const title = text || attachedNote || `${book.title} · ${label}`;
  const body = [text, attachedNote].filter(Boolean).join("\n\n") || label;

  return {
    id: note.id,
    type: note.type,
    typeLabel: label,
    bookId: book.id,
    bookTitle: book.title,
    bookAuthor: book.author,
    title,
    body,
    cfi: note.cfi,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    source: note,
  };
}

export function filterUnifiedNotesByType(items: UnifiedNoteItem[], type: UnifiedNoteType | "all"): UnifiedNoteItem[] {
  if (type === "all") {
    return items;
  }

  return items.filter((item) => item.type === type);
}

export function getUnifiedNoteReaderTarget(item: UnifiedNoteItem): UnifiedNoteReaderTarget | null {
  if (!item.bookId) return null;

  return {
    bookId: item.bookId,
    title: cleanText(item.bookTitle) || item.title,
    ...(item.cfi ? { cfi: item.cfi } : {}),
  };
}
