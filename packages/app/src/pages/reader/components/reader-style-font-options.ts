import { CURATED_FONTS } from "@/services/constants";

export type ReaderStyleFontOption = (typeof CURATED_FONTS)[number];

export function getReaderStyleFontOptions(): ReaderStyleFontOption[] {
  return CURATED_FONTS;
}
