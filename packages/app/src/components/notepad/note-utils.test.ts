import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Note } from "@/types/note";
import {
  getNoteDisplayBody,
  getNoteDisplayTitle,
  getNoteEditorDialogTitle,
  getNoteSourceExcerpt,
  isSourceBoundNote,
} from "./note-utils";

describe("note display helpers", () => {
  it("uses source excerpt as the display content for empty source-bound notes", () => {
    const note: Note = {
      id: "note-source-1",
      bookId: "book-1",
      bookMeta: { title: "Effective Reading" },
      title: "",
      content: "",
      cfi: "epubcfi(/6/8)",
      sourceText: "Selected source text",
      createdAt: 100,
      updatedAt: 200,
    };

    assert.equal(isSourceBoundNote(note), true);
    assert.equal(getNoteSourceExcerpt(note), "Selected source text");
    assert.equal(getNoteDisplayTitle(note), "Selected source text");
    assert.equal(getNoteDisplayBody(note), "Selected source text");
    assert.equal(getNoteEditorDialogTitle(), "编辑笔记");
  });

  it("falls back to note body and unnamed labels when no source excerpt exists", () => {
    const note: Note = {
      id: "note-loose-1",
      content: "Loose note body",
      createdAt: 100,
      updatedAt: 200,
    };

    assert.equal(isSourceBoundNote(note), false);
    assert.equal(getNoteSourceExcerpt(note), "");
    assert.equal(getNoteDisplayTitle(note), "Loose note body");
    assert.equal(getNoteDisplayBody(note), "Loose note body");
  });
});
