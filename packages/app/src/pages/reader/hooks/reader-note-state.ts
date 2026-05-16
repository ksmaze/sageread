import type { Note } from "@/types/note";

export function mergeUpdatedActiveNote(activeNote: Note | null, updatedNote: Note): Note | null {
  return activeNote?.id === updatedNote.id ? updatedNote : activeNote;
}

export async function findSourceBoundNote(
  noteId: string,
  sourceBoundNotes: Note[],
  getNoteById: (id: string) => Promise<Note | null>,
): Promise<Note | null> {
  return sourceBoundNotes.find((note) => note.id === noteId) ?? getNoteById(noteId);
}
