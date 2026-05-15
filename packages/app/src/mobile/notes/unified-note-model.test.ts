import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BookNote } from "@/types/book";
import type { Note } from "@/types/note";
import {
  UNIFIED_NOTE_FILTERS,
  createUnifiedNoteFromBookNote,
  createUnifiedNoteFromStandaloneNote,
  filterUnifiedNotesByType,
} from "./unified-note-model";

describe("unified note model", () => {
  it("maps standalone notes to complete display content", () => {
    const note: Note = {
      id: "note-1",
      bookId: "book-1",
      bookMeta: { title: "Effective Reading", author: "Ada" },
      content: "Remember the contrast between skimming and deep reading.",
      createdAt: 100,
      updatedAt: 200,
    };

    const item = createUnifiedNoteFromStandaloneNote(note);

    assert.equal(item.id, "note-1");
    assert.equal(item.type, "note");
    assert.equal(item.typeLabel, "笔记");
    assert.equal(item.title, "Effective Reading");
    assert.equal(item.body, "Remember the contrast between skimming and deep reading.");
    assert.equal(item.bookTitle, "Effective Reading");
    assert.equal(item.bookAuthor, "Ada");
    assert.equal(item.createdAt, 100);
    assert.equal(item.updatedAt, 200);
  });

  it("maps book annotations to complete display content", () => {
    const annotation: BookNote = {
      id: "annotation-1",
      type: "annotation",
      cfi: "epubcfi(/6/2)",
      text: "A useful highlighted passage",
      style: "highlight",
      color: "yellow",
      note: "This explains the main claim.",
      context: {
        before: "Before",
        after: "After",
      },
      createdAt: 300,
      updatedAt: 400,
    };

    const item = createUnifiedNoteFromBookNote(annotation, {
      id: "book-1",
      title: "Effective Reading",
      author: "Ada",
    });

    assert.equal(item.id, "annotation-1");
    assert.equal(item.type, "annotation");
    assert.equal(item.typeLabel, "标注");
    assert.equal(item.title, "A useful highlighted passage");
    assert.equal(item.body, "A useful highlighted passage\n\nThis explains the main claim.");
    assert.equal(item.bookId, "book-1");
    assert.equal(item.bookTitle, "Effective Reading");
    assert.equal(item.bookAuthor, "Ada");
    assert.equal(item.cfi, "epubcfi(/6/2)");
    assert.equal(item.createdAt, 300);
    assert.equal(item.updatedAt, 400);
  });

  it("filters all supported note types", () => {
    const items = UNIFIED_NOTE_FILTERS.filter((filter) => filter.id !== "all").map((filter, index) => ({
      id: `${filter.id}-${index}`,
      type: filter.id,
      typeLabel: filter.label,
      title: filter.label,
      body: filter.label,
      updatedAt: index,
      source: {} as Note | BookNote,
    }));

    assert.deepEqual(
      filterUnifiedNotesByType(items, "annotation").map((item) => item.type),
      ["annotation"],
    );
    assert.equal(filterUnifiedNotesByType(items, "all").length, 4);
  });
});
