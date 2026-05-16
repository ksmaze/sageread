import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTINGS_NAVIGATION_ITEMS } from "./settings-navigation";

describe("settings navigation", () => {
  it("does not expose desktop-only font management in the Android settings dialog", () => {
    const keys = SETTINGS_NAVIGATION_ITEMS.map((item) => item.key);

    assert.deepEqual(keys, ["general", "llama", "tts", "model-providers"]);
  });
});
