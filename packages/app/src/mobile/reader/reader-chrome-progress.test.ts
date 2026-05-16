import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReaderPageProgress } from "./reader-chrome-progress";

describe("reader chrome progress", () => {
  it("formats one-based page progress for the reader chrome", () => {
    assert.equal(formatReaderPageProgress({ current: 36, total: 212 }), "已读 37 / 212 页");
  });

  it("hides progress when the page data is not usable", () => {
    assert.equal(formatReaderPageProgress(undefined), "");
    assert.equal(formatReaderPageProgress({ current: -1, total: 212 }), "");
    assert.equal(formatReaderPageProgress({ current: 0, total: 0 }), "");
  });
});
