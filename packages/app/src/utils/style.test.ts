import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_BOOK_FONT,
  DEFAULT_BOOK_LAYOUT,
  DEFAULT_BOOK_STYLE,
  DEFAULT_SCREEN_CONFIG,
  DEFAULT_TRANSLATOR_CONFIG,
  DEFAULT_TTS_CONFIG,
  DEFAULT_VIEW_CONFIG,
} from "@/services/constants";
import type { ViewSettings } from "@/types/book";
import { getStyles, getThemeCodeFromOptions } from "./style";

const baseViewSettings: ViewSettings = {
  ...DEFAULT_BOOK_LAYOUT,
  ...DEFAULT_BOOK_STYLE,
  ...DEFAULT_BOOK_FONT,
  ...DEFAULT_VIEW_CONFIG,
  ...DEFAULT_TTS_CONFIG,
  ...DEFAULT_TRANSLATOR_CONFIG,
  ...DEFAULT_SCREEN_CONFIG,
};

const getCssBlocks = (styles: string, selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(styles.matchAll(new RegExp(`${escapedSelector} \\{(?<block>[\\s\\S]*?)\\n {4}\\}`, "g"))).map(
    (match) => match.groups?.block ?? "",
  );
};

describe("reader background style policy", () => {
  it("maps paper and green reader backgrounds to light-mode palettes", () => {
    const paper = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "paper",
      systemIsDarkMode: false,
      customThemes: [],
    });
    const green = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "green",
      systemIsDarkMode: false,
      customThemes: [],
    });

    assert.equal(paper.bg, "#f1e8d0");
    assert.equal(paper.fg, "#5b4636");
    assert.equal(green.bg, "#d7dbbd");
    assert.equal(green.fg, "#232c16");
  });

  it("uses the default dark reader background even when a comfort background is selected", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "dark",
      readerBackground: "paper",
      systemIsDarkMode: false,
      customThemes: [],
    });

    assert.equal(themeCode.bg, "#222222");
    assert.equal(themeCode.fg, "#e0e0e0");
    assert.equal(themeCode.isDarkMode, true);
  });

  it("forces content colors for non-default light reader backgrounds", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "paper",
      systemIsDarkMode: false,
      customThemes: [],
    });

    const styles = getStyles({ ...baseViewSettings, overrideColor: false }, themeCode);

    assert.match(styles, /background-color: #f1e8d0 !important;/);
    assert.match(styles, /color: #5b4636 !important;/);
  });

  it("sets the reader document background for non-default light reader backgrounds", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "green",
      systemIsDarkMode: false,
      customThemes: [],
    });

    const styles = getStyles({ ...baseViewSettings, overrideColor: false }, themeCode);
    const documentBlocks = getCssBlocks(styles, "html, body");

    assert.ok(
      documentBlocks.some((block) => /background: var\(--background-set, var\(--theme-bg-color\)\);/.test(block)),
    );
  });

  it("keeps default light background from forcing book content colors", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "default",
      systemIsDarkMode: false,
      customThemes: [],
    });

    const styles = getStyles({ ...baseViewSettings, overrideColor: false }, themeCode);
    const contentColorBlock = getCssBlocks(styles, "div, p, h1, h2, h3, h4, h5, h6")[0];

    assert.ok(contentColorBlock);
    assert.doesNotMatch(contentColorBlock, /background-color:/);
    assert.doesNotMatch(contentColorBlock, /color:/);
  });
});
