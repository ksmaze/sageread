import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAfterDialogClose } from "./dialog-navigation";

describe("dialog navigation", () => {
  it("closes the dialog before scheduling reader navigation", () => {
    const events: string[] = [];
    const scheduled: Array<() => void> = [];

    runAfterDialogClose(
      () => events.push("close"),
      () => events.push("navigate"),
      (callback) => scheduled.push(callback),
    );

    assert.deepEqual(events, ["close"]);
    assert.equal(scheduled.length, 1);

    scheduled[0]!();
    assert.deepEqual(events, ["close", "navigate"]);
  });
});
