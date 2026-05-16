import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Note } from "@/types/note";
import { findSourceBoundNote, mergeUpdatedActiveNote } from "./reader-note-state";

function makeNote(id: string, content = ""): Note {
  return {
    id,
    bookId: "book-1",
    bookMeta: { title: "Book", author: "Author" },
    title: "Selected text",
    content,
    cfi: "epubcfi(/6/8)",
    sourceText: "Selected text",
    createdAt: 100,
    updatedAt: 200,
  };
}

describe("reader note state", () => {
  it("replaces the active note with the saved note returned by the backend", () => {
    const activeNote = makeNote("note-1", "before");
    const updatedNote = { ...activeNote, content: "after", updatedAt: 300 };

    assert.deepEqual(mergeUpdatedActiveNote(activeNote, updatedNote), updatedNote);
  });

  it("keeps a different active note unchanged after saving another note", () => {
    const activeNote = makeNote("note-1", "before");
    const updatedNote = makeNote("note-2", "after");

    assert.equal(mergeUpdatedActiveNote(activeNote, updatedNote), activeNote);
  });

  it("opens a marker note from the current source-bound list without fetching", async () => {
    const note = makeNote("note-1");
    let fetchCount = 0;

    const result = await findSourceBoundNote("note-1", [note], async () => {
      fetchCount += 1;
      return makeNote("note-1", "fetched");
    });

    assert.equal(result, note);
    assert.equal(fetchCount, 0);
  });

  it("fetches by id when a marker note is not in the current source-bound list", async () => {
    const fetchedNote = makeNote("note-2", "fetched");

    const result = await findSourceBoundNote("note-2", [makeNote("note-1")], async (id) => {
      assert.equal(id, "note-2");
      return fetchedNote;
    });

    assert.equal(result, fetchedNote);
  });
});
