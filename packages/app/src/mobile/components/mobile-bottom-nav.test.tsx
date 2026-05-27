import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const mobileBottomNavPath = fileURLToPath(new URL("./mobile-bottom-nav.tsx", import.meta.url));

describe("MobileBottomNav responsive layout", () => {
  it("hides the bottom navigation at md and wider breakpoints", () => {
    const source = readFileSync(mobileBottomNavPath, "utf8");

    assert.match(source, /<nav\s+className="[^"]*\bmd:hidden\b/);
  });
});
