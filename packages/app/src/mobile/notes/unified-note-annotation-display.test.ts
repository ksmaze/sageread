import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HIGHLIGHT_COLOR_HEX, HIGHLIGHT_COLOR_RGBA } from "@/services/constants";
import { getUnifiedAnnotationTextStyle } from "./unified-note-annotation-display";

describe("unified note annotation display", () => {
  it("maps highlight marks to translucent backgrounds", () => {
    assert.deepEqual(
      getUnifiedAnnotationTextStyle({
        color: "yellow",
        style: "highlight",
      }),
      {
        backgroundColor: HIGHLIGHT_COLOR_RGBA.yellow,
        textDecoration: "none",
        textDecorationColor: undefined,
        textDecorationStyle: "solid",
        textDecorationThickness: "2px",
      },
    );
  });

  it("maps underline and squiggly marks to colored text decorations", () => {
    assert.deepEqual(
      getUnifiedAnnotationTextStyle({
        color: "green",
        style: "underline",
      }),
      {
        backgroundColor: "transparent",
        textDecoration: "underline",
        textDecorationColor: HIGHLIGHT_COLOR_HEX.green,
        textDecorationStyle: "solid",
        textDecorationThickness: "2px",
      },
    );

    assert.deepEqual(
      getUnifiedAnnotationTextStyle({
        color: "blue",
        style: "squiggly",
      }),
      {
        backgroundColor: "transparent",
        textDecoration: "underline",
        textDecorationColor: HIGHLIGHT_COLOR_HEX.blue,
        textDecorationStyle: "wavy",
        textDecorationThickness: "2px",
      },
    );
  });
});
