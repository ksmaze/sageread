import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const tauriConfigPath = fileURLToPath(new URL("../../src-tauri/tauri.conf.json", import.meta.url));
const mainActivityPath = fileURLToPath(
  new URL("../../src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/MainActivity.kt", import.meta.url),
);
const androidSystemPluginPath = fileURLToPath(
  new URL("../../src-tauri/gen/android/app/src/main/java/com/xincmm/sageread/AndroidSystemPlugin.kt", import.meta.url),
);

describe("Tauri file associations", () => {
  it("registers EPUB and PDF as openable book files", () => {
    const config = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
      bundle?: {
        fileAssociations?: Array<{
          ext?: string[];
          mimeType?: string;
          role?: string;
          androidIntentActionFilters?: string[];
        }>;
      };
    };

    const associations = config.bundle?.fileAssociations ?? [];
    assert.ok(
      associations.some(
        (association) =>
          association.role === "Viewer" &&
          association.mimeType === "application/epub+zip" &&
          association.ext?.includes("epub") &&
          association.androidIntentActionFilters?.includes("view"),
      ),
    );
    assert.ok(
      associations.some(
        (association) =>
          association.role === "Viewer" &&
          association.mimeType === "application/pdf" &&
          association.ext?.includes("pdf") &&
          association.androidIntentActionFilters?.includes("view"),
      ),
    );
  });

  it("captures the Android launch intent for open-with imports", () => {
    const mainActivity = readFileSync(mainActivityPath, "utf8");
    const androidSystemPlugin = readFileSync(androidSystemPluginPath, "utf8");

    assert.match(mainActivity, /override fun onNewIntent\(intent: Intent\)/);
    assert.match(mainActivity, /setIntent\(intent\)/);
    assert.match(androidSystemPlugin, /fun takeOpenedBookUrls\(invoke: Invoke\)/);
    assert.match(androidSystemPlugin, /activity\.intent/);
  });
});
