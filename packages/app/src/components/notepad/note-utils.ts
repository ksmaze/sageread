import type { Note } from "@/types/note";

export function cleanNoteText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function isSourceBoundNote(note: Note): boolean {
  return Boolean(note.bookId && note.cfi);
}

export function getNoteSourceExcerpt(note: Note): string {
  if (!isSourceBoundNote(note)) return "";
  return cleanNoteText(note.sourceText) || cleanNoteText(note.title) || cleanNoteText(note.content);
}

export function getNoteDisplayTitle(note: Note): string {
  return (
    getNoteSourceExcerpt(note) ||
    cleanNoteText(note.title) ||
    cleanNoteText(note.bookMeta?.title) ||
    cleanNoteText(note.content) ||
    "未命名笔记"
  );
}

export function getNoteDisplayBody(note: Note): string {
  return cleanNoteText(note.content) || getNoteSourceExcerpt(note) || "无正文";
}
