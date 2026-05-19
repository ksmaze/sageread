import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OsPlatform } from "@/types/system";
import { getSelectionPopupButtons } from "./selection-actions";

const getLabels = (platform: OsPlatform) =>
  getSelectionPopupButtons({
    osPlatform: platform,
    onCopy: () => {},
    onTranslate: () => {},
    onExplain: () => {},
    onAskAi: () => {},
    onHighlight: () => {},
    onAddNote: () => {},
    selectionAnnotated: false,
  }).map((button) => button.label ?? "icon");

describe("selection popup actions", () => {
  it("shows translate between copy and explain on Android", () => {
    assert.deepEqual(getLabels("android"), ["复制", "翻译", "解释", "询问AI", "icon", "icon"]);
  });

  it("hides translate outside Android", () => {
    assert.deepEqual(getLabels("ios"), ["复制", "解释", "询问AI", "icon", "icon"]);
  });
});
