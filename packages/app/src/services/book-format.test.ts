import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBookFileName, getBookFormat, getFileMimeType, isSemanticIndexingSupported } from "./book-format";

describe("book format helpers", () => {
  it("detects EPUB and PDF filenames without defaulting unsupported files to EPUB", () => {
    assert.equal(getBookFormat("Novel.EPUB"), "EPUB");
    assert.equal(getBookFormat("Research Paper.PDF"), "PDF");
    assert.equal(getBookFormat("notes.txt"), null);
  });

  it("returns the correct file MIME type for EPUB and PDF books", () => {
    assert.equal(getFileMimeType("Novel.EPUB"), "application/epub+zip");
    assert.equal(getFileMimeType("Research Paper.PDF"), "application/pdf");
    assert.equal(getFileMimeType("notes.txt"), "application/octet-stream");
  });

  it("uses the stored format when reconstructing reader files", () => {
    assert.equal(getBookFileName("", "EPUB"), "book.epub");
    assert.equal(getBookFileName("", "PDF"), "book.pdf");
    assert.equal(getBookFileName("library/research.pdf", "EPUB"), "research.pdf");
  });

  it("keeps semantic indexing EPUB-only for this MVP", () => {
    assert.equal(isSemanticIndexingSupported("EPUB"), true);
    assert.equal(isSemanticIndexingSupported("PDF"), false);
  });
});
