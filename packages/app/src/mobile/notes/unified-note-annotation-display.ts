import type { CSSProperties } from "react";
import { HIGHLIGHT_COLOR_HEX, HIGHLIGHT_COLOR_RGBA } from "@/services/constants";
import type { HighlightColor, HighlightStyle } from "@/types/book";

export interface UnifiedAnnotationTextStyleInput {
  color: HighlightColor;
  style: HighlightStyle;
}

export function getUnifiedAnnotationTextStyle({
  color,
  style,
}: UnifiedAnnotationTextStyleInput): CSSProperties {
  return {
    backgroundColor: style === "highlight" ? HIGHLIGHT_COLOR_RGBA[color] : "transparent",
    textDecoration: style === "underline" || style === "squiggly" ? "underline" : "none",
    textDecorationColor: style !== "highlight" ? HIGHLIGHT_COLOR_HEX[color] : undefined,
    textDecorationStyle: style === "squiggly" ? "wavy" : "solid",
    textDecorationThickness: "2px",
  };
}
