import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processSelectedTextWithAndroid } from "./android-process-text-service";

describe("android process text service", () => {
  it("invokes the Android process text command with trimmed selected text", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];

    const result = await processSelectedTextWithAndroid("  hello world  ", {
      platform: "android",
      invokeCommand: async (command, args) => {
        calls.push({ command, args });
      },
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, [{ command: "process_text", args: { text: "hello world" } }]);
  });

  it("rejects blank selections before invoking native code", async () => {
    let invoked = false;

    const result = await processSelectedTextWithAndroid("   ", {
      platform: "android",
      invokeCommand: async () => {
        invoked = true;
      },
    });

    assert.deepEqual(result, { ok: false, reason: "empty-selection" });
    assert.equal(invoked, false);
  });

  it("does not invoke native code outside Android", async () => {
    let invoked = false;

    const result = await processSelectedTextWithAndroid("hello", {
      platform: "ios",
      invokeCommand: async () => {
        invoked = true;
      },
    });

    assert.deepEqual(result, { ok: false, reason: "unsupported-platform" });
    assert.equal(invoked, false);
  });

  it("preserves native failure messages", async () => {
    const result = await processSelectedTextWithAndroid("hello", {
      platform: "android",
      invokeCommand: async () => {
        throw "No apps can process selected text";
      },
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "native-error",
      message: "No apps can process selected text",
    });
  });
});
