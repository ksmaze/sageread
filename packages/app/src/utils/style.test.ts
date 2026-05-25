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

const forcedContentSelector = `section, aside, blockquote, article, nav, header, footer, main, figure,
    div, p, font, h1, h2, h3, h4, h5, h6, li, span`;

describe("reader background style policy", () => {
  it("renders comma-separated reader font settings as CSS font-family stacks", () => {
    const styles = getStyles({
      ...baseViewSettings,
      defaultFont: "Serif",
      serifFont: "Literata, Georgia",
      sansSerifFont: "Atkinson Hyperlegible, Arial",
      defaultCJKFont: "Source Han Serif SC, Noto Serif SC, Songti SC",
    });

    assert.match(styles, /--serif-font: "Literata", "Georgia", serif;/);
    assert.match(styles, /--sans-serif-font: "Atkinson Hyperlegible", "Arial", sans-serif;/);
    assert.match(
      styles,
      /--cjk-font: "SageRead CJK Source Han Serif SC", "SageRead CJK Noto Serif SC", "SageRead CJK Songti SC", sans-serif;/,
    );
    assert.match(
      styles,
      /font-family: "SageRead CJK Source Han Serif SC", "SageRead CJK Noto Serif SC", "SageRead CJK Songti SC", "Literata", "Georgia", serif !important;/,
    );
    assert.doesNotMatch(styles, /"Literata, Georgia"/);
    assert.doesNotMatch(styles, /"Source Han Serif SC, Noto Serif SC, Songti SC"/);
  });

  it("prioritizes the CJK stack before Latin fallback for reader body text", () => {
    const styles = getStyles({
      ...baseViewSettings,
      defaultFont: "Serif",
      serifFont: "Literata, Georgia",
      sansSerifFont: "Atkinson Hyperlegible, Arial",
      defaultCJKFont: "Source Han Serif SC, ChillHuoFangSong",
    });

    assert.match(
      styles,
      /font-family: "SageRead CJK Source Han Serif SC", "ChillHuoFangSong", "Literata", "Georgia", serif !important;/,
    );
    assert.match(styles, /@font-face \{[\s\S]*font-family: "SageRead CJK Source Han Serif SC";/);
    assert.match(styles, /@font-face \{[\s\S]*src: local\("Source Han Serif SC"\);/);
    assert.match(styles, /@font-face \{[\s\S]*unicode-range: [^;]*U\+4E00-9FFF/);
  });

  it("uses bundled CJK families directly before Latin fallback in reader body text", () => {
    const styles = getStyles({
      ...baseViewSettings,
      defaultFont: "Serif",
      serifFont: "Literata, Georgia",
      sansSerifFont: "Atkinson Hyperlegible, Arial",
      defaultCJKFont: "Noto Serif CJK SC, Source Han Serif SC, LXGW WenKai Lite, ChillHuoFangSong",
    });

    assert.match(
      styles,
      /font-family: "Noto Serif CJK SC", "SageRead CJK Source Han Serif SC", "LXGW WenKai Lite", "ChillHuoFangSong", "Literata", "Georgia", serif !important;/,
    );
    assert.doesNotMatch(styles, /font-family: "SageRead CJK Noto Serif CJK SC";/);
    assert.doesNotMatch(styles, /font-family: "SageRead CJK LXGW WenKai Lite";/);
  });

  it("forces reader descendants to inherit the selected font stack when font override is enabled", () => {
    const styles = getStyles({
      ...baseViewSettings,
      defaultFont: "Serif",
      serifFont: "Literata, Georgia",
      defaultCJKFont: "Source Han Serif SC, Noto Serif SC",
      overrideFont: true,
    });

    assert.match(styles, /body \* \{[\s\S]*font-family: inherit !important;/);
    assert.doesNotMatch(styles, /font-family: revert !important;/);
  });

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

  it("forces semantic reader content colors and borders for non-default light backgrounds", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "green",
      systemIsDarkMode: false,
      customThemes: [],
    });

    const styles = getStyles({ ...baseViewSettings, overrideColor: false }, themeCode);
    const contentColorBlock = getCssBlocks(styles, forcedContentSelector)[0];

    assert.ok(contentColorBlock);
    assert.match(contentColorBlock, /background-color: #d7dbbd !important;/);
    assert.match(contentColorBlock, /color: #232c16 !important;/);
    assert.match(contentColorBlock, /border-color: #232c16 !important;/);
  });

  it("adds Readest-inspired image and hardcoded black text handling under forced reader colors", () => {
    const themeCode = getThemeCodeFromOptions({
      themeMode: "light",
      readerBackground: "paper",
      systemIsDarkMode: false,
      customThemes: [],
    });

    const styles = getStyles({ ...baseViewSettings, overrideColor: false }, themeCode);

    assert.match(styles, /font\[color="#000000"\], font\[color="#000"\], font\[color="black"\]/);
    assert.match(styles, /svg, img \{[\s\S]*background-color: transparent !important;/);
    assert.match(styles, /\*:has\(> hr\.background-img\):not\(body\) \{[\s\S]*background-color: #f1e8d0;/);
    assert.match(styles, /p\[width\]\[height\] > img:only-child \{[\s\S]*mix-blend-mode: multiply;/);
    assert.match(styles, /\*:has\(> img\.has-text-siblings\):not\(body\) \{[\s\S]*background-color: #f1e8d0;/);
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
    const contentColorBlock = getCssBlocks(styles, forcedContentSelector)[0];

    assert.ok(contentColorBlock);
    assert.doesNotMatch(contentColorBlock, /background-color:/);
    assert.doesNotMatch(contentColorBlock, /color:/);
  });
});
