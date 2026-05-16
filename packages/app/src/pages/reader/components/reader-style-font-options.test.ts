import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURATED_FONTS } from "@/services/constants";
import { getReaderStyleFontOptions } from "./reader-style-font-options";

describe("reader style font options", () => {
  it("uses only curated built-in font choices after custom font management is removed", () => {
    const options = getReaderStyleFontOptions();

    assert.deepEqual(
      options.map((font) => font.id),
      CURATED_FONTS.map((font) => font.id),
    );
  });
});
