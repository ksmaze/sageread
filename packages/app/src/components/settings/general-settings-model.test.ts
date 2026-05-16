import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERAL_SETTINGS_SECTIONS } from "./general-settings-model";

describe("general settings model", () => {
  it("keeps Android settings focused on app metadata and appearance", () => {
    const settingIds = GENERAL_SETTINGS_SECTIONS.flatMap((section) => section.items.map((item) => item.id));

    assert.deepEqual(settingIds, ["app-version", "theme-mode", "auto-scroll"]);
    assert.equal(settingIds.includes("check-updates"), false);
    assert.equal(settingIds.includes("swap-sidebars"), false);
    assert.equal(settingIds.includes("data-folder"), false);
  });
});
