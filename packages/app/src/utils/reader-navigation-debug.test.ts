import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  describeReaderNavigationResult,
  describeReaderNavigationTarget,
  readerNavigationInfo,
  traceReaderGoTo,
} from "./reader-navigation-debug";

describe("reader navigation debug helpers", () => {
  it("keeps the full cfi while adding compact metadata", () => {
    const cfi = "epubcfi(/6/2[page]!/4/2/12,/1:0,/1:12)";

    assert.deepEqual(
      describeReaderNavigationTarget({
        bookId: "book-1",
        cfi,
        requestedAt: 123,
        source: "unified-notes",
        title: "Source Book",
      }),
      {
        bookId: "book-1",
        cfi,
        cfiEnd: undefined,
        cfiLength: cfi.length,
        cfiStart: cfi,
        hasCfi: true,
        requestedAt: 123,
        source: "unified-notes",
        title: "Source Book",
      },
    );
  });

  it("marks missing targets without throwing", () => {
    assert.deepEqual(describeReaderNavigationTarget(null), {
      cfiLength: 0,
      hasCfi: false,
    });
  });

  it("identifies unresolved foliate navigation results", () => {
    assert.deepEqual(describeReaderNavigationResult(undefined), {
      resolved: false,
      valueType: "undefined",
    });
  });

  it("writes logcat-readable JSON details as one string", () => {
    const info = mock.method(console, "info", () => undefined);

    try {
      readerNavigationInfo("test.event", {
        target: describeReaderNavigationTarget({
          bookId: "book-1",
          cfi: "epubcfi(/6/2)",
          requestedAt: 123,
          source: "unified-notes",
        }),
      });

      assert.equal(info.mock.calls.length, 1);
      assert.equal(info.mock.calls[0]?.arguments.length, 1);
      assert.match(String(info.mock.calls[0]?.arguments[0]), /^\[SageRead:ReaderNav\] test\.event \{/);
      assert.match(String(info.mock.calls[0]?.arguments[0]), /"cfi":"epubcfi\(\/6\/2\)"/);
    } finally {
      mock.restoreAll();
    }
  });

  it("reports direct goTo success and unresolved results", async () => {
    mock.method(console, "info", () => undefined);
    mock.method(console, "warn", () => undefined);

    try {
      assert.equal(
        await traceReaderGoTo({
          event: "test.direct",
          target: { cfi: "epubcfi(/6/2)" },
          view: {
            async goTo() {
              return { index: 1 };
            },
          },
        }),
        true,
      );

      assert.equal(
        await traceReaderGoTo({
          event: "test.direct",
          target: { cfi: "epubcfi(/8/2)" },
          view: {
            async goTo() {
              return undefined;
            },
          },
        }),
        false,
      );
    } finally {
      mock.restoreAll();
    }
  });
});
