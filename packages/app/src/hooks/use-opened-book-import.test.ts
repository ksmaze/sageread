import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const hookPath = fileURLToPath(new URL("./use-opened-book-import.ts", import.meta.url));

describe("opened book import hook", () => {
  it("reports open-with import issues through the mounted Sonner toaster", () => {
    const hookSource = readFileSync(hookPath, "utf8");

    assert.match(hookSource, /from "sonner"/);
    assert.match(hookSource, /toast\.error\(message\)/);
    assert.doesNotMatch(hookSource, /eventDispatcher/);
  });
});
