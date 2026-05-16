import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowShellSettingsEntry } from "./app-shell-settings";

describe("mobile shell settings entry", () => {
  it("hides the shell settings shortcut on the AI destination only", () => {
    assert.equal(shouldShowShellSettingsEntry("library"), true);
    assert.equal(shouldShowShellSettingsEntry("notes"), true);
    assert.equal(shouldShowShellSettingsEntry("ai"), false);
    assert.equal(shouldShowShellSettingsEntry("stats"), true);
  });
});
