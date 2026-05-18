import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BookDoc } from "@/lib/document";
import { updateToc } from "./toc";

describe("updateToc", () => {
  it("resolves async PDF outline destinations without generating fallback page-list entries", async () => {
    const bookDoc = {
      metadata: { title: "PDF", author: "Unknown", language: "en" },
      dir: "ltr",
      toc: [{ id: 0, label: "Chapter 1", href: "[\"page-ref\"]" }],
      sections: [{ id: 0, cfi: "epubcfi(/6/2)", size: 1000, linear: "yes" }],
      splitTOCHref: async () => [0, null],
      getCover: async () => null,
    } satisfies BookDoc;

    await updateToc(bookDoc, false);

    assert.equal(bookDoc.toc?.length, 1);
    assert.equal(bookDoc.toc?.[0]?.cfi, "epubcfi(/6/2)");
  });
});
