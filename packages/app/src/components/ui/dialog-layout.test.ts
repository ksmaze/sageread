import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXED_DIALOG_FOOTER_CLASS_NAME, SCROLLABLE_DIALOG_BODY_CLASS_NAME } from "./dialog-layout";

describe("dialog layout class contracts", () => {
  it("clips scrollable dialog body content before fixed footers", () => {
    assert.match(SCROLLABLE_DIALOG_BODY_CLASS_NAME, /\bmin-h-0\b/);
    assert.match(SCROLLABLE_DIALOG_BODY_CLASS_NAME, /\bflex-1\b/);
    assert.match(SCROLLABLE_DIALOG_BODY_CLASS_NAME, /\boverflow-y-auto\b/);
  });

  it("keeps fixed dialog footers opaque above scrollable content", () => {
    assert.match(FIXED_DIALOG_FOOTER_CLASS_NAME, /\bshrink-0\b/);
    assert.match(FIXED_DIALOG_FOOTER_CLASS_NAME, /\bbg-background\b/);
  });
});
