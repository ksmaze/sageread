import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as CFI from "foliate-js/epubcfi.js";
import { isAnnotationVisibleAtProgress } from "./reader-annotation-visibility";

const makePdfAnnotationCfi = (pageIndex: number) =>
  CFI.joinIndir(CFI.fake.fromIndex(pageIndex), "epubcfi(/4/2,/1:0,/1:5)");

const fakePdfView = {
  resolveCFI(cfi: string) {
    const parts = CFI.parse(cfi);
    const index = CFI.fake.toIndex((parts.parent ?? parts).shift());
    return { index, anchor: () => ({}) };
  },
};

describe("reader annotation visibility", () => {
  it("matches PDF page-internal annotations when progress reports a page-level CFI", () => {
    const pageLocation = CFI.fake.fromIndex(0);
    const annotationCfi = makePdfAnnotationCfi(0);

    assert.equal(
      isAnnotationVisibleAtProgress(annotationCfi, { location: pageLocation, range: null }, fakePdfView),
      true,
    );
  });

  it("does not match PDF annotations from another page", () => {
    const pageLocation = CFI.fake.fromIndex(0);
    const annotationCfi = makePdfAnnotationCfi(1);

    assert.equal(
      isAnnotationVisibleAtProgress(annotationCfi, { location: pageLocation, range: null }, fakePdfView),
      false,
    );
  });
});
