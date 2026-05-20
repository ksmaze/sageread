import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatOpenedBookImportIssueMessages, importOpenedBookUrls } from "./opened-book-import-service";

describe("opened book import service", () => {
  it("reads EPUB and PDF URLs as File objects and imports them", async () => {
    const importedFiles: File[][] = [];
    const readPaths: Array<string | URL> = [];

    const result = await importOpenedBookUrls(
      ["file:///storage/emulated/0/Download/My%20Book.epub", "content://downloads/document/Research%20Paper.pdf"],
      {
        readFile: async (path) => {
          readPaths.push(path);
          return new Uint8Array([1, 2, 3]);
        },
        importFiles: async (files) => {
          importedFiles.push(files);
        },
      },
    );

    assert.equal(result.importedCount, 2);
    assert.deepEqual(result.skippedUrls, []);
    assert.deepEqual(result.failedUrls, []);
    assert.equal(importedFiles.length, 1);
    assert.deepEqual(
      importedFiles[0]?.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      [
        { name: "My Book.epub", type: "application/epub+zip", size: 3 },
        { name: "Research Paper.pdf", type: "application/pdf", size: 3 },
      ],
    );
    assert.ok(readPaths[0] instanceof URL);
    assert.equal(readPaths[1], "content://downloads/document/Research%20Paper.pdf");
  });

  it("skips unsupported opened URLs without reading or importing them", async () => {
    let readCount = 0;
    let importCount = 0;

    const result = await importOpenedBookUrls(["file:///storage/emulated/0/Download/notes.txt"], {
      readFile: async () => {
        readCount += 1;
        return new Uint8Array([1]);
      },
      importFiles: async () => {
        importCount += 1;
      },
    });

    assert.equal(result.importedCount, 0);
    assert.deepEqual(result.skippedUrls, ["file:///storage/emulated/0/Download/notes.txt"]);
    assert.deepEqual(result.failedUrls, []);
    assert.equal(readCount, 0);
    assert.equal(importCount, 0);
  });

  it("reports failed URL reads and still imports readable supported files", async () => {
    const importedFiles: File[][] = [];

    const result = await importOpenedBookUrls(
      ["file:///storage/emulated/0/Download/broken.epub", "file:///storage/emulated/0/Download/ok.pdf"],
      {
        readFile: async (path) => {
          if (String(path).includes("broken.epub")) {
            throw new Error("permission denied");
          }
          return new Uint8Array([4, 5]);
        },
        importFiles: async (files) => {
          importedFiles.push(files);
        },
      },
    );

    assert.equal(result.importedCount, 1);
    assert.deepEqual(result.failedUrls, ["file:///storage/emulated/0/Download/broken.epub"]);
    assert.deepEqual(result.skippedUrls, []);
    assert.deepEqual(
      importedFiles[0]?.map((file) => file.name),
      ["ok.pdf"],
    );
  });

  it("reports Android app-private file paths as failed without reading them", async () => {
    let readCount = 0;

    const result = await importOpenedBookUrls(["file:///data/user/0/com.other.app/cache/private.epub"], {
      readFile: async () => {
        readCount += 1;
        return new Uint8Array([1]);
      },
      importFiles: async () => {},
    });

    assert.equal(result.importedCount, 0);
    assert.deepEqual(result.skippedUrls, []);
    assert.deepEqual(result.failedUrls, ["file:///data/user/0/com.other.app/cache/private.epub"]);
    assert.equal(readCount, 0);
  });

  it("formats failed open-with imports as an unable-access toast", () => {
    assert.deepEqual(
      formatOpenedBookImportIssueMessages({
        importedCount: 0,
        skippedUrls: [],
        failedUrls: ["file:///data/user/0/com.other.app/cache/private.epub"],
      }),
      ["无法访问文件：private.epub。请将文件移动到下载目录后再试。"],
    );
  });
});
