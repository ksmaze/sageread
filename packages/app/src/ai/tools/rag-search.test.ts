import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveRagSearchMode } from "./rag-search-mode";

describe("resolveEffectiveRagSearchMode", () => {
  it("falls back to BM25 when vector config is unavailable", () => {
    assert.equal(resolveEffectiveRagSearchMode(undefined, false), "bm25");
    assert.equal(resolveEffectiveRagSearchMode("hybrid", false), "bm25");
    assert.equal(resolveEffectiveRagSearchMode("vector", false), "bm25");
    assert.equal(resolveEffectiveRagSearchMode("bm25", false), "bm25");
  });

  it("keeps the requested mode when vector config is available", () => {
    assert.equal(resolveEffectiveRagSearchMode(undefined, true), "hybrid");
    assert.equal(resolveEffectiveRagSearchMode("hybrid", true), "hybrid");
    assert.equal(resolveEffectiveRagSearchMode("vector", true), "vector");
    assert.equal(resolveEffectiveRagSearchMode("bm25", true), "bm25");
  });
});
