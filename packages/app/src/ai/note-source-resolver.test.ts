import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSourceSearchQueries,
  findTocItemByHref,
  normalizeSearchText,
  resolveNoteSourceFromView,
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

  it("builds middle-window queries for long candidates", () => {
    const sourceText =
      "Opening context that is likely to differ before the useful source phrase middle target phrase appears here and then the candidate continues without punctuation.";

    const queries = buildSourceSearchQueries([{ text: sourceText }], {
      maxQueryLength: 40,
      maxQueries: 20,
    });

    assert.ok(
      queries.some((query) => query.includes("middle target phrase")),
      `expected a middle-window query, got: ${JSON.stringify(queries)}`,
    );
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

  it("accepts direct section-search matches from Foliate", async () => {
    const result = await resolveNoteSourceFromView(
      {
        reasoning: "confirm source location",
        sourceCandidates: [{ text: "Original source text" }],
      },
      {
        sectionIndex: 2,
        sectionLabel: "Chapter 2",
        chapterStartCfi: "epubcfi(/6/4)",
        view: {
          search: async function* () {
            yield {
              cfi: "epubcfi(/6/4!/4/2[match])",
              excerpt: {
                pre: "before",
                match: "Original source text",
                post: "after",
              },
            };
            yield "done";
          },
          getCFI: () => "epubcfi(/6/4)",
        } as any,
      },
    );

    assert.equal(result.status, "matched");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0]?.cfi, "epubcfi(/6/4!/4/2[match])");
    assert.equal(result.matches[0]?.sourceText, "Original source text");
  });

  it("aggregates unique matches across source candidates instead of stopping after the first hit", async () => {
    const searchedQueries: string[] = [];
    const result = await resolveNoteSourceFromView(
      {
        reasoning: "confirm source locations",
        sourceCandidates: [{ text: "first candidate source" }, { text: "second candidate source" }],
        maxMatches: 5,
      },
      {
        sectionIndex: 1,
        sectionLabel: "Chapter 1",
        chapterStartCfi: "epubcfi(/6/2)",
        view: {
          search: async function* (config: any) {
            searchedQueries.push(config.query);

            if (config.query === "first candidate source") {
              yield {
                label: "Chapter 1",
                subitems: [
                  {
                    cfi: "epubcfi(/6/2!/4/2[first])",
                    excerpt: { pre: "", match: "first candidate source", post: "" },
                  },
                ],
              };
            }

            if (config.query === "second candidate source") {
              yield {
                label: "Chapter 1",
                subitems: [
                  {
                    cfi: "epubcfi(/6/2!/4/4[second])",
                    excerpt: { pre: "", match: "second candidate source", post: "" },
                  },
                ],
              };
            }

            yield "done";
          },
          getCFI: () => "epubcfi(/6/2)",
        } as any,
      },
    );

    assert.equal(result.status, "matched");
    assert.deepEqual(
      result.matches.map((match) => match.cfi),
      ["epubcfi(/6/2!/4/2[first])", "epubcfi(/6/2!/4/4[second])"],
    );
    assert.ok(searchedQueries.includes("second candidate source"));
  });

  it("tries whitespace-compacted query variants before falling back to chapter start", async () => {
    const searchedQueries: string[] = [];
    const result = await resolveNoteSourceFromView(
      {
        reasoning: "confirm CJK source location",
        sourceCandidates: [{ text: "人工 智能 生成 学习 笔记" }],
      },
      {
        sectionIndex: 3,
        sectionLabel: "Chapter 3",
        chapterStartCfi: "epubcfi(/6/6)",
        view: {
          search: async function* (config: any) {
            searchedQueries.push(config.query);

            if (config.query === "人工智能生成学习笔记") {
              yield {
                cfi: "epubcfi(/6/6!/4/8[cjk])",
                excerpt: { pre: "", match: "人工智能生成学习笔记", post: "" },
              };
            }

            yield "done";
          },
          getCFI: () => "epubcfi(/6/6)",
        } as any,
      },
    );

    assert.equal(result.status, "matched");
    assert.equal(result.matches[0]?.cfi, "epubcfi(/6/6!/4/8[cjk])");
    assert.ok(searchedQueries.includes("人工智能生成学习笔记"));
  });

  it("keeps chapter-start fallback when no source candidate matches", async () => {
    const result = await resolveNoteSourceFromView(
      {
        reasoning: "confirm fallback",
        sourceCandidates: [{ text: "missing source text" }],
      },
      {
        sectionIndex: 4,
        sectionLabel: "Chapter 4",
        chapterStartCfi: "epubcfi(/6/8)",
        view: {
          search: async function* () {
            yield "done";
          },
          getCFI: () => "epubcfi(/6/8)",
        } as any,
      },
    );

    assert.equal(result.status, "chapter-start");
    assert.deepEqual(result.fallback, {
      cfi: "epubcfi(/6/8)",
      label: "Chapter 4",
      source: "explicit",
    });
  });
});
