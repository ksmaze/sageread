import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canSubmitBookChatPrompt, PDF_SELECTED_TEXT_ONLY_MESSAGE, shouldAttachBookWideRagTools } from "./chat-context";

describe("chat context format rules", () => {
  it("attaches book-wide RAG tools for EPUB books independently of vector capability", () => {
    assert.equal(shouldAttachBookWideRagTools({ activeBookId: "epub-1", activeBookFormat: "EPUB" }), true);
    assert.equal(shouldAttachBookWideRagTools({ activeBookId: "legacy-epub" }), true);
    assert.equal(shouldAttachBookWideRagTools({ activeBookId: "pdf-1", activeBookFormat: "PDF" }), false);
    assert.equal(shouldAttachBookWideRagTools({ activeBookId: "mobi-1", activeBookFormat: "MOBI" }), false);
    assert.equal(shouldAttachBookWideRagTools({ activeBookFormat: "EPUB" }), false);
  });

  it("blocks PDF book chat when no selected text reference is present", () => {
    assert.deepEqual(canSubmitBookChatPrompt({ activeBookId: "pdf-1", activeBookFormat: "PDF" }, 0), {
      allowed: false,
      reason: PDF_SELECTED_TEXT_ONLY_MESSAGE,
    });
    assert.deepEqual(canSubmitBookChatPrompt({ activeBookId: "pdf-1", activeBookFormat: "PDF" }, 1), {
      allowed: true,
    });
    assert.deepEqual(canSubmitBookChatPrompt({ activeBookId: "epub-1", activeBookFormat: "EPUB" }, 0), {
      allowed: true,
    });
  });
});
