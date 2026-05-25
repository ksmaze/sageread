import { CURATED_FONTS } from "@/services/constants";
import type { ViewSettings } from "@/types/book";

export type ReaderStyleFontOption = (typeof CURATED_FONTS)[number];
type ReaderStyleFontSettings = Pick<ViewSettings, "serifFont" | "sansSerifFont" | "defaultCJKFont" | "defaultFont">;

const LEGACY_READER_STYLE_FONT_OPTION_ALIASES: Record<string, ReaderStyleFontSettings[]> = {
  comfortable: [
    {
      defaultFont: "Serif",
      serifFont: "Georgia",
      sansSerifFont: "Helvetica",
      defaultCJKFont: "ChillHuoFangSong",
    },
  ],
  merriweather: [
    {
      defaultFont: "Serif",
      serifFont: "Times New Roman",
      sansSerifFont: "Arial",
      defaultCJKFont: "SimSun, Songti SC, Noto Serif CJK, ChillHuoFangSong",
    },
    {
      defaultFont: "Serif",
      serifFont: "Merriweather, Literata, Georgia",
      sansSerifFont: "Source Sans 3, Arial",
      defaultCJKFont: "Noto Serif CJK SC, SimSun, Songti SC, Noto Serif CJK, ChillHuoFangSong",
    },
  ],
  "source-sans": [
    {
      defaultFont: "Sans-serif",
      serifFont: "Helvetica",
      sansSerifFont: "Helvetica",
      defaultCJKFont: "PingFang SC, Noto Sans CJK, Noto Sans SC, Microsoft YaHei, SimHei, ChillHuoFangSong",
    },
    {
      defaultFont: "Sans-serif",
      serifFont: "Literata, Georgia",
      sansSerifFont: "Source Sans 3, Atkinson Hyperlegible, Helvetica, Arial",
      defaultCJKFont:
        "Noto Sans CJK SC, PingFang SC, Noto Sans CJK, Noto Sans SC, Microsoft YaHei, SimHei, ChillHuoFangSong",
    },
  ],
  wenkai: [
    {
      defaultFont: "Serif",
      serifFont: "Georgia",
      sansSerifFont: "Helvetica",
      defaultCJKFont: "STKaiti, KaiTi, ChillHuoFangSong",
    },
    {
      defaultFont: "Serif",
      serifFont: "Literata, Georgia",
      sansSerifFont: "Atkinson Hyperlegible, Helvetica, Arial",
      defaultCJKFont: "LXGW WenKai Lite, STKaiti, KaiTi, ChillHuoFangSong",
    },
  ],
};

export function getReaderStyleFontOptions(): ReaderStyleFontOption[] {
  return CURATED_FONTS;
}

export function readerStyleFontOptionMatchesSettings(
  settings: ReaderStyleFontSettings,
  font: ReaderStyleFontOption,
): boolean {
  return (
    font.serif === settings.serifFont &&
    font.sansSerif === settings.sansSerifFont &&
    font.cjk === settings.defaultCJKFont &&
    font.defaultFont === settings.defaultFont
  );
}

const settingsMatch = (settings: ReaderStyleFontSettings, match: ReaderStyleFontSettings): boolean =>
  settings.serifFont === match.serifFont &&
  settings.sansSerifFont === match.sansSerifFont &&
  settings.defaultCJKFont === match.defaultCJKFont &&
  settings.defaultFont === match.defaultFont;

export function getReaderStyleFontOptionForSettings(
  settings: ReaderStyleFontSettings,
  options: ReaderStyleFontOption[] = CURATED_FONTS,
): ReaderStyleFontOption | undefined {
  return (
    options.find((font) => readerStyleFontOptionMatchesSettings(settings, font)) ??
    options.find((font) =>
      LEGACY_READER_STYLE_FONT_OPTION_ALIASES[font.id]?.some((legacySettings) =>
        settingsMatch(settings, legacySettings),
      ),
    )
  );
}

export function applyReaderStyleFontOption<TSettings extends ReaderStyleFontSettings>(
  settings: TSettings,
  font: ReaderStyleFontOption,
): TSettings {
  return {
    ...settings,
    serifFont: font.serif,
    sansSerifFont: font.sansSerif,
    defaultCJKFont: font.cjk,
    defaultFont: font.defaultFont,
  };
}

export function getReaderStyleFontPreviewFamily(font: ReaderStyleFontOption, isCJK: boolean): string {
  if (isCJK) {
    return font.cjk;
  }
  return font.defaultFont.toLowerCase() === "sans-serif" ? font.sansSerif : font.serif;
}
