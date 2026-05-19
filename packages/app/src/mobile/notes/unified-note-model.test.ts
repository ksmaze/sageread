import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BookNote } from "@/types/book";
import type { Note } from "@/types/note";
import {
  createUnifiedNoteFromBookNote,
  createUnifiedNoteFromStandaloneNote,
  filterUnifiedNotesByType,
  getUnifiedNoteReaderTarget,
  UNIFIED_NOTE_FILTERS,
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

  it("maps source-bound notes to source excerpt display and reader target", () => {
    const note: Note = {
      id: "note-source-1",
      bookId: "book-1",
      bookMeta: { title: "Effective Reading", author: "Ada" },
      title: "",
      content: "",
      cfi: "epubcfi(/6/8)",
      sourceText: "Selected source text",
      contextBefore: "Before",
      contextAfter: "After",
      createdAt: 100,
      updatedAt: 200,
    };

    const item = createUnifiedNoteFromStandaloneNote(note);

    assert.equal(item.title, "Selected source text");
    assert.equal(item.body, "Selected source text");
    assert.equal(item.cfi, "epubcfi(/6/8)");
    assert.deepEqual(getUnifiedNoteReaderTarget(item), {
      bookId: "book-1",
      title: "Effective Reading",
      cfi: "epubcfi(/6/8)",
    });
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

  it("builds reader targets only for book-linked notes", () => {
    const standalone = createUnifiedNoteFromStandaloneNote({
      id: "note-1",
      title: "Loose note",
      content: "Not tied to a book",
      createdAt: 100,
      updatedAt: 200,
    });
    const bookNote = createUnifiedNoteFromBookNote(
      {
        id: "bookmark-1",
        type: "bookmark",
        cfi: "epubcfi(/6/4)",
        text: "",
        createdAt: 300,
        updatedAt: 400,
      },
      { id: "book-1", title: "The Culture Map", author: "Erin Meyer" },
    );

    assert.equal(getUnifiedNoteReaderTarget(standalone), null);
    assert.deepEqual(getUnifiedNoteReaderTarget(bookNote), {
      bookId: "book-1",
      title: "The Culture Map",
      cfi: "epubcfi(/6/4)",
    });
  });
});
