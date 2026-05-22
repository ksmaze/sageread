import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReaderNoteSourceResolver, getProgressSectionIndex } from "./reader-note-source-runtime";

describe("reader note source runtime", () => {
  it("derives the section index from Foliate section progress", () => {
    assert.equal(getProgressSectionIndex({ section: { current: 7, total: 42 } } as any), 7);
    assert.equal(getProgressSectionIndex({ section: 3 } as any), 3);
    assert.equal(getProgressSectionIndex({ section: null } as any), undefined);
  });

  it("passes section.current to source search instead of the section progress object", async () => {
    const searchedIndexes: unknown[] = [];
    const resolver = createReaderNoteSourceResolver({
      progress: {
        location: "epubcfi(/6/2)",
        section: { current: 7, total: 42 },
        sectionId: 1,
        sectionHref: "chapter.xhtml",
        sectionLabel: "Chapter",
        pageinfo: { current: 118, total: 300 },
        timeinfo: { section: 1, total: 2 },
        range: null,
      } as any,
      view: {
        search: async function* (config: any) {
          searchedIndexes.push(config.index);
          yield {
            cfi: "epubcfi(/6/14!/4/2[source])",
            excerpt: { pre: "", match: "target source", post: "" },
          };
          yield "done";
        },
        getCFI: (index: number) => `epubcfi(/6/${index})`,
      } as any,
    });

    assert.ok(resolver);
    const result = await resolver({
      reasoning: "confirm source location",
      sourceCandidates: [{ text: "target source" }],
    });

    assert.equal(result.status, "matched");
    assert.ok(searchedIndexes.length > 0);
    assert.deepEqual([...new Set(searchedIndexes)], [7]);
  });
});
