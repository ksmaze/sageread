import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toNoteServiceErrorMessage } from "./note-service";

describe("note-service errors", () => {
  it("preserves string backend errors from Tauri commands", () => {
    assert.equal(
      toNoteServiceErrorMessage("更新笔记失败: near ',': syntax error"),
      "更新笔记失败: near ',': syntax error",
    );
  });

  it("uses Error.message for JavaScript errors", () => {
    assert.equal(toNoteServiceErrorMessage(new Error("database unavailable")), "database unavailable");
  });
});
