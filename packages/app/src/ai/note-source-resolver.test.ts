import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSourceSearchQueries,
  findTocItemByHref,
  normalizeSearchText,
  selectChapterStartLocation,
} from "./note-source-resolver";

describe("note source resolver", () => {
  it("normalizes whitespace and builds shorter fallback search queries", () => {
    const sourceText =
      "The first important idea\n\ncontinues across lines and then gives a concrete reason for saving a note.";

    assert.equal(
      normalizeSearchText(sourceText),
      "The first important idea continues across lines and then gives a concrete reason for saving a note.",
    );

    const queries = buildSourceSearchQueries([{ text: sourceText }], { maxQueryLength: 56 });

    assert.equal(queries[0], "The first important idea continues across lines and then");
    assert.ok(queries.includes("The first important idea continues across lines"));
    assert.ok(queries.every((query) => !/\s{2,}/.test(query)));
  });

  it("finds nested TOC items by current href", () => {
    const toc = [
      {
        label: "Part 1",
        href: "part-1.xhtml",
        subitems: [{ label: "Chapter 2", href: "chapter-2.xhtml#start", cfi: "epubcfi(/6/4)" }],
      },
    ];

    assert.equal(findTocItemByHref(toc, "chapter-2.xhtml#start")?.cfi, "epubcfi(/6/4)");
    assert.equal(findTocItemByHref(toc, "chapter-2.xhtml")?.cfi, "epubcfi(/6/4)");
  });

  it("selects chapter-start CFI before omitting a location", () => {
    const toc = [
      {
        label: "Chapter 1",
        href: "chapter-1.xhtml",
        cfi: "epubcfi(/6/2)",
      },
    ];

    assert.deepEqual(
      selectChapterStartLocation({
        toc,
        sectionHref: "chapter-1.xhtml",
        sectionIndex: 3,
        sectionLabel: "Chapter 1",
        getSectionStartCfi: () => "epubcfi(/6/99)",
      }),
      {
        cfi: "epubcfi(/6/2)",
        label: "Chapter 1",
        source: "toc",
      },
    );

    assert.deepEqual(
      selectChapterStartLocation({
        toc: [],
        sectionIndex: 3,
        sectionLabel: "Chapter 3",
        getSectionStartCfi: (index) => `fake-cfi-${index}`,
      }),
      {
        cfi: "fake-cfi-3",
        label: "Chapter 3",
        source: "section",
      },
    );
  });
});
