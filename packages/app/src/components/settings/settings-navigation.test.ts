import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTINGS_NAVIGATION_ITEMS } from "./settings-navigation";

describe("settings navigation", () => {
  it("exposes vector models instead of the old llama section", () => {
    const keys = SETTINGS_NAVIGATION_ITEMS.map((item) => item.key);

    assert.deepEqual(keys, ["general", "vector-models", "tts", "model-providers"]);
  });
});
