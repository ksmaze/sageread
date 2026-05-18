import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const assetsDir = path.join(appRoot, "dist", "assets");

function readBuiltPdfAdapter(): string {
  assert.ok(existsSync(assetsDir), "Run `pnpm --filter app build` before this regression test.");

  const pdfAdapterFile = readdirSync(assetsDir).find((fileName) => {
    if (!/^pdf-.+\.js$/.test(fileName)) return false;
    return readFileSync(path.join(assetsDir, fileName), "utf8").includes("makePDF");
  });

  assert.ok(pdfAdapterFile, "Built PDF adapter chunk was not found.");
  return readFileSync(path.join(assetsDir, pdfAdapterFile), "utf8");
}

describe("built PDF.js assets", () => {
  it("keeps PDF.js directory asset URLs resolvable after Vite build", () => {
    const pdfAdapter = readBuiltPdfAdapter();

    assert.match(pdfAdapter, /new URL\(\w+,import\.meta\.url\)\.toString\(\)/);
    assert.match(pdfAdapter, /\.\/vendor\/pdfjs\/\$\{\w+\}/);
    assert.match(pdfAdapter, /cMapUrl:\w+\(`cmaps\/`\)/);
    assert.match(pdfAdapter, /standardFontDataUrl:\w+\(`standard_fonts\/`\)/);
    assert.ok(existsSync(path.join(assetsDir, "vendor", "pdfjs", "cmaps")));
    assert.ok(existsSync(path.join(assetsDir, "vendor", "pdfjs", "standard_fonts")));
    assert.ok(readdirSync(path.join(assetsDir, "vendor", "pdfjs", "cmaps")).length > 0);
    assert.ok(readdirSync(path.join(assetsDir, "vendor", "pdfjs", "standard_fonts")).length > 0);
  });
});
