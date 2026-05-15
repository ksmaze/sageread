import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type ReaderNavigationTarget, clearReaderNavigationTarget } from "./reader-navigation";

describe("reader navigation targets", () => {
  it("clears the pending target only when the completed target still matches", () => {
    const olderTarget: ReaderNavigationTarget = {
      cfi: "epubcfi(/6/4)",
      requestedAt: 100,
      source: "unified-notes",
    };
    const newerTarget: ReaderNavigationTarget = {
      cfi: "epubcfi(/6/8)",
      requestedAt: 200,
      source: "unified-notes",
    };

    assert.equal(clearReaderNavigationTarget(olderTarget, olderTarget), null);
    assert.deepEqual(clearReaderNavigationTarget(newerTarget, olderTarget), newerTarget);
  });
});
