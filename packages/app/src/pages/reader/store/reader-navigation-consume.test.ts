import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeReaderNavigationTarget,
  getInitialReaderLocation,
  type ReaderNavigationTarget,
} from "./reader-navigation";

const target: ReaderNavigationTarget = {
  cfi: "epubcfi(/6/2)",
  requestedAt: 100,
  source: "unified-notes",
};

describe("consume reader navigation target", () => {
  it("clears the pending target only after goTo resolves", async () => {
    const events: string[] = [];

    await consumeReaderNavigationTarget({
      target,
      view: {
        async goTo(cfi: string) {
          events.push(`goTo:${cfi}`);
          return { index: 1 };
        },
      },
      clearTarget(completed) {
        events.push(`clear:${completed.cfi}`);
      },
    });

    assert.deepEqual(events, ["goTo:epubcfi(/6/2)", "clear:epubcfi(/6/2)"]);
  });

  it("leaves the pending target in place when goTo fails", async () => {
    let cleared = false;
    let reportedError: unknown;

    const consumed = await consumeReaderNavigationTarget({
      target,
      view: {
        async goTo() {
          throw new Error("navigation failed");
        },
      },
      clearTarget() {
        cleared = true;
      },
      onError(error) {
        reportedError = error;
      },
    });

    assert.equal(consumed, false);
    assert.equal(cleared, false);
    assert.ok(reportedError instanceof Error);
  });

  it("leaves the pending target in place when goTo reports no resolved destination", async () => {
    let cleared = false;
    let reportedError: unknown;

    const consumed = await consumeReaderNavigationTarget({
      target,
      view: {
        async goTo() {
          return undefined;
        },
      },
      clearTarget() {
        cleared = true;
      },
      onError(error) {
        reportedError = error;
      },
    });

    assert.equal(consumed, false);
    assert.equal(cleared, false);
    assert.ok(reportedError instanceof Error);
  });
});

describe("initial reader location", () => {
  it("uses a pending navigation target before the saved book location", () => {
    assert.equal(getInitialReaderLocation("epubcfi(/4/2)", target), "epubcfi(/6/2)");
  });

  it("falls back to the saved book location when there is no pending target", () => {
    assert.equal(getInitialReaderLocation("epubcfi(/4/2)", null), "epubcfi(/4/2)");
  });
});

describe("reader store seeding", () => {
  it("stores the initial navigation target when created", async () => {
    globalThis.localStorage ??= {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    globalThis.window ??= {} as typeof globalThis.window;
    globalThis.window.__TAURI_INTERNALS__ = {
      invoke: async (command: string) => {
        if (command === "plugin:path|resolve_directory") return "C:/tmp";
        if (command === "plugin:fs|exists") return false;
        if (command === "plugin:fs|mkdir") return undefined;
        if (command === "plugin:fs|read_text_file") return "";
        if (command === "plugin:fs|write_text_file") return undefined;
        return undefined;
      },
    } as typeof globalThis.window.__TAURI_INTERNALS__;
    const { createReaderStore } = await import("./create-reader-store");
    const store = createReaderStore("book-1", target);
    assert.deepEqual(store.getState().pendingNavigationTarget, target);
  });
});
