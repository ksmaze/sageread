import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTINGS_DIALOG_CONTENT_CLASS_NAME } from "./settings-dialog-layout";

describe("settings dialog layout", () => {
  it("keeps tablet dialog width constrained to the viewport", () => {
    assert.match(SETTINGS_DIALOG_CONTENT_CLASS_NAME, /sm:w-\[calc\(100vw-2rem\)\]/);
    assert.match(SETTINGS_DIALOG_CONTENT_CLASS_NAME, /sm:max-w-\[800px\]/);
    assert.doesNotMatch(SETTINGS_DIALOG_CONTENT_CLASS_NAME, /sm:min-w-\[800px\]/);
  });
});
