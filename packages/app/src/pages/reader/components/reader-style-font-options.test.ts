import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURATED_FONTS } from "@/services/constants";
import { getBuiltInFontFaceDefinitions } from "@/utils/font";
import {
  applyReaderStyleFontOption,
  getReaderStyleFontOptionForSettings,
  getReaderStyleFontOptions,
  getReaderStyleFontPreviewFamily,
} from "./reader-style-font-options";

const getFirstFontFamily = (fontFamilyStack: string) =>
  fontFamilyStack
    .split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "");

describe("reader style font options", () => {
  it("uses only curated built-in font choices after custom font management is removed", () => {
    const options = getReaderStyleFontOptions();

    assert.deepEqual(
      options.map((font) => font.id),
      CURATED_FONTS.map((font) => font.id),
    );
  });

  it("hides legacy conceptual presets that are not actual bundled font choices", () => {
    const options = getReaderStyleFontOptions();

    assert.deepEqual(
      options.map((font) => font.id),
      ["system", "comfortable", "source-serif", "source-sans", "merriweather", "wenkai"],
    );
    assert.equal(
      options.some((font) => ["classic", "modern", "elegant"].includes(font.id)),
      false,
    );
  });

  it("exposes reading-focused Chinese and English presets", () => {
    const options = getReaderStyleFontOptions();

    const sourceSerif = options.find((font) => font.id === "source-serif");
    const sourceSans = options.find((font) => font.id === "source-sans");
    const wenkai = options.find((font) => font.id === "wenkai");
    const merriweather = options.find((font) => font.id === "merriweather");

    assert.ok(sourceSerif);
    assert.match(sourceSerif.serif, /Literata/);
    assert.match(sourceSerif.cjk, /Noto Serif CJK SC|Source Han Serif SC/);

    assert.ok(sourceSans);
    assert.match(sourceSans.sansSerif, /Source Sans 3/);
    assert.match(sourceSans.cjk, /Noto Sans CJK SC|Source Han Sans SC/);

    assert.ok(wenkai);
    assert.match(wenkai.cjk, /LXGW WenKai Lite/);

    assert.ok(merriweather);
    assert.match(merriweather.serif, /^Merriweather/);
    assert.match(merriweather.sansSerif, /Source Sans 3|Atkinson Hyperlegible/);
  });

  it("uses bundled English families first for release-stable English presets", () => {
    const bundledFamilies = new Set(getBuiltInFontFaceDefinitions().map((definition) => definition.family));
    const options = getReaderStyleFontOptions();

    for (const id of ["source-serif", "source-sans", "wenkai", "merriweather"]) {
      const font = options.find((option) => option.id === id);
      assert.ok(font);
      const activeLatinStack = font.defaultFont.toLowerCase() === "sans-serif" ? font.sansSerif : font.serif;
      const firstFamily = getFirstFontFamily(activeLatinStack);
      assert.ok(firstFamily);
      assert.ok(bundledFamilies.has(firstFamily), `${id} must start with bundled English family ${firstFamily}`);
    }
  });

  it("puts bundled CJK families first for release-stable presets", () => {
    const options = getReaderStyleFontOptions();

    const sourceSerif = options.find((font) => font.id === "source-serif");
    const sourceSans = options.find((font) => font.id === "source-sans");
    const wenkai = options.find((font) => font.id === "wenkai");

    assert.ok(sourceSerif);
    assert.ok(sourceSans);
    assert.ok(wenkai);
    assert.match(sourceSerif.cjk, /^Noto Serif CJK SC,/);
    assert.match(sourceSans.cjk, /^Noto Sans CJK SC,/);
    assert.match(wenkai.cjk, /^LXGW WenKai Lite,/);
  });

  it("keeps visible Chinese presets backed by bundled families on release builds", () => {
    const options = getReaderStyleFontOptions();
    const bundledFamilies = new Set(getBuiltInFontFaceDefinitions().map((definition) => definition.family));

    const expectedFirstCjkFamilies = new Map([
      ["comfortable", "ChillHuoFangSong"],
      ["source-serif", "Noto Serif CJK SC"],
      ["source-sans", "Noto Sans CJK SC"],
      ["merriweather", "Noto Serif CJK SC"],
      ["wenkai", "LXGW WenKai Lite"],
    ]);

    for (const [id, expectedFamily] of expectedFirstCjkFamilies) {
      const font = options.find((option) => option.id === id);
      assert.ok(font);
      const firstFamily = getFirstFontFamily(font.cjk);
      assert.equal(firstFamily, expectedFamily, `${id} must not fall back to another preset's CJK face first`);
      assert.ok(bundledFamilies.has(firstFamily), `${id} first CJK family must be bundled`);
    }
  });

  it("keeps a bundled CJK fallback in every non-system preset", () => {
    const options = getReaderStyleFontOptions();

    for (const font of options.filter((option) => option.id !== "system")) {
      assert.match(font.cjk, /ChillHuoFangSong/, `${font.id} must keep bundled CJK fallback`);
    }
  });

  it("applies each preset's intended serif or sans-serif axis", () => {
    const options = getReaderStyleFontOptions();
    const sourceSerif = options.find((font) => font.id === "source-serif");
    const sourceSans = options.find((font) => font.id === "source-sans");

    assert.ok(sourceSerif);
    assert.ok(sourceSans);

    const serifSettings = applyReaderStyleFontOption(
      {
        serifFont: "Georgia",
        sansSerifFont: "Helvetica",
        defaultCJKFont: "ChillHuoFangSong",
        defaultFont: "Sans-serif",
      },
      sourceSerif,
    );
    assert.equal(serifSettings.defaultFont, "Serif");
    assert.equal(getReaderStyleFontPreviewFamily(sourceSerif, false), sourceSerif.serif);

    const sansSettings = applyReaderStyleFontOption(
      {
        serifFont: "Georgia",
        sansSerifFont: "Helvetica",
        defaultCJKFont: "ChillHuoFangSong",
        defaultFont: "Serif",
      },
      sourceSans,
    );
    assert.equal(sansSettings.defaultFont, "Sans-serif");
    assert.equal(getReaderStyleFontPreviewFamily(sourceSans, false), sourceSans.sansSerif);
  });

  it("maps legacy persisted preset settings to visible bundled presets", () => {
    const options = getReaderStyleFontOptions();

    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Serif",
          serifFont: "Times New Roman",
          sansSerifFont: "Arial",
          defaultCJKFont: "SimSun, Songti SC, Noto Serif CJK, ChillHuoFangSong",
        },
        options,
      )?.id,
      "merriweather",
    );
    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Serif",
          serifFont: "Merriweather, Literata, Georgia",
          sansSerifFont: "Source Sans 3, Arial",
          defaultCJKFont: "Noto Serif CJK SC, SimSun, Songti SC, Noto Serif CJK, ChillHuoFangSong",
        },
        options,
      )?.id,
      "merriweather",
    );
    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Sans-serif",
          serifFont: "Helvetica",
          sansSerifFont: "Helvetica",
          defaultCJKFont: "PingFang SC, Noto Sans CJK, Noto Sans SC, Microsoft YaHei, SimHei, ChillHuoFangSong",
        },
        options,
      )?.id,
      "source-sans",
    );
    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Sans-serif",
          serifFont: "Literata, Georgia",
          sansSerifFont: "Source Sans 3, Atkinson Hyperlegible, Helvetica, Arial",
          defaultCJKFont:
            "Noto Sans CJK SC, PingFang SC, Noto Sans CJK, Noto Sans SC, Microsoft YaHei, SimHei, ChillHuoFangSong",
        },
        options,
      )?.id,
      "source-sans",
    );
    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Serif",
          serifFont: "Georgia",
          sansSerifFont: "Helvetica",
          defaultCJKFont: "STKaiti, KaiTi, ChillHuoFangSong",
        },
        options,
      )?.id,
      "wenkai",
    );
    assert.equal(
      getReaderStyleFontOptionForSettings(
        {
          defaultFont: "Serif",
          serifFont: "Literata, Georgia",
          sansSerifFont: "Atkinson Hyperlegible, Helvetica, Arial",
          defaultCJKFont: "LXGW WenKai Lite, STKaiti, KaiTi, ChillHuoFangSong",
        },
        options,
      )?.id,
      "wenkai",
    );
  });
});
