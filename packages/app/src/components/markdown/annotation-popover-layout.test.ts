import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "annotation-popover.tsx");
const source = readFileSync(sourcePath, "utf8");

describe("annotation popover layout", () => {
  it("uses viewport-colliding vertical placement instead of desktop side placement", () => {
    assert.match(source, /side="bottom"/);
    assert.doesNotMatch(source, /side=\{shouldShowRight \? "right" : "left"\}/);
  });

  it("clamps content size to the viewport and Radix available space", () => {
    assert.match(source, /collisionPadding=\{16\}/);
    assert.match(source, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
    assert.match(source, /--radix-popover-content-available-height/);
  });
});
