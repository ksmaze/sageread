import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { brotliDecompressSync } from "node:zlib";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  buildBuiltInFontFaceCss,
  getBuiltInFontFaceDefinitions,
  mountAdditionalFonts,
  toBuiltInFontAssetUrl,
  upsertBuiltInFontFaceStyle,
} from "./font";

const createFakeDocument = () => {
  const appended: Array<{ id: string; textContent: string | null }> = [];
  const elements = new Map<string, { id: string; textContent: string | null }>();
  const fakeDocument = {
    getElementById: (id: string) => elements.get(id) ?? null,
    createElement: () => ({ id: "", textContent: null }),
    head: {
      appendChild: (element: { id: string; textContent: string | null }) => {
        elements.set(element.id, element);
        appended.push(element);
        return element;
      },
    },
  } as unknown as Document;

  return { appended, elements, fakeDocument };
};

const WOFF2_KNOWN_TAGS = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];

const readUIntBase128 = (buffer: Buffer, offset: number) => {
  let result = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = buffer.readUInt8(offset + i);
    if (i === 0 && byte === 0x80) {
      throw new Error("Invalid UIntBase128 leading byte");
    }
    if (result & 0xfe000000) {
      throw new Error("UIntBase128 overflow");
    }
    result = (result << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      return { value: result, nextOffset: offset + i + 1 };
    }
  }
  throw new Error("Unterminated UIntBase128");
};

const readWoff2NameIds = (buffer: Buffer): Set<number> => {
  let offset = 0;
  const readTag = () => {
    const value = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    return value;
  };
  const readUInt8 = () => {
    const value = buffer.readUInt8(offset);
    offset += 1;
    return value;
  };
  const readUInt16 = () => {
    const value = buffer.readUInt16BE(offset);
    offset += 2;
    return value;
  };
  const readUInt32 = () => {
    const value = buffer.readUInt32BE(offset);
    offset += 4;
    return value;
  };

  assert.equal(readTag(), "wOF2");
  readTag();
  readUInt32();
  const numTables = readUInt16();
  readUInt16();
  readUInt32();
  const totalCompressedSize = readUInt32();
  offset += 24;

  const entries: Array<{ tag: string; offset: number; transformLength: number }> = [];
  let transformedOffset = 0;
  for (let i = 0; i < numTables; i += 1) {
    const flags = readUInt8();
    const tagIndex = flags & 0x3f;
    const transformVersion = flags >> 6;
    const tag = tagIndex === 63 ? readTag() : WOFF2_KNOWN_TAGS[tagIndex];
    assert.ok(tag, `Unknown WOFF2 table tag index ${tagIndex}`);
    const originalLength = readUIntBase128(buffer, offset);
    offset = originalLength.nextOffset;
    const transformed = tag === "glyf" || tag === "loca" ? transformVersion !== 3 : transformVersion !== 0;
    let transformLength = originalLength.value;
    if (transformed) {
      const transformedLength = readUIntBase128(buffer, offset);
      offset = transformedLength.nextOffset;
      transformLength = transformedLength.value;
    }
    entries.push({ tag, offset: transformedOffset, transformLength });
    transformedOffset += transformLength;
  }

  const transformedData = brotliDecompressSync(buffer.subarray(offset, offset + totalCompressedSize));
  const nameEntry = entries.find((entry) => entry.tag === "name");
  assert.ok(nameEntry);
  const nameTable = transformedData.subarray(nameEntry.offset, nameEntry.offset + nameEntry.transformLength);
  const count = nameTable.readUInt16BE(2);
  const nameIds = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    nameIds.add(nameTable.readUInt16BE(6 + i * 12 + 6));
  }
  return nameIds;
};

describe("built-in reader font registry", () => {
  it("keeps reading fonts as registry entries", () => {
    const definitions = getBuiltInFontFaceDefinitions();

    assert.deepEqual(
      definitions.map((definition) => definition.family),
      [
        "ChillHuoFangSong",
        "Noto Serif CJK SC",
        "Noto Sans CJK SC",
        "LXGW WenKai Lite",
        "Literata",
        "Merriweather",
        "Source Sans 3",
        "Atkinson Hyperlegible",
      ],
    );
    assert.equal(definitions[0]?.fileName, "ChillHuoFangSong_Regular.woff2");
    assert.deepEqual(definitions[0]?.localNames, ["ChillHuoFangSong", "寒蝉活宋体"]);
    assert.equal(definitions[1]?.fileName, "NotoSerifCJKsc_Regular.woff2");
    assert.deepEqual(definitions[1]?.localNames, ["Noto Serif CJK SC"]);
    assert.equal(definitions[2]?.fileName, "NotoSansCJKsc_Regular.woff2");
    assert.deepEqual(definitions[2]?.localNames, ["Noto Sans CJK SC"]);
    assert.equal(definitions[3]?.fileName, "LXGWWenKaiLite_Regular.woff2");
    assert.deepEqual(definitions[3]?.localNames, ["LXGW WenKai Lite", "霞鹜文楷 轻便版"]);
    assert.equal(definitions[4]?.fileName, "Literata_Regular.woff2");
    assert.deepEqual(definitions[4]?.localNames, ["Literata"]);
    assert.equal(definitions[5]?.fileName, "Merriweather_Regular.woff2");
    assert.deepEqual(definitions[5]?.localNames, ["Merriweather"]);
    assert.equal(definitions[6]?.fileName, "SourceSans3_Regular.woff2");
    assert.deepEqual(definitions[6]?.localNames, ["Source Sans 3", "Source Sans Pro"]);
    assert.equal(definitions[7]?.fileName, "AtkinsonHyperlegible_Regular.woff2");
    assert.deepEqual(definitions[7]?.localNames, ["Atkinson Hyperlegible"]);
  });

  it("builds font-face CSS from registry definitions", () => {
    const css = buildBuiltInFontFaceCss([
      {
        family: "Test Serif",
        fileName: "TestSerif.woff2",
        localNames: ["Test Serif"],
        weight: 400,
        style: "normal",
      },
    ]);

    assert.match(css, /font-family: "Test Serif";/);
    assert.match(css, /local\("Test Serif"\), url\("asset:\/\/localhost\/TestSerif\.woff2"\) format\("woff2"\);/);
    assert.match(css, /font-weight: 400;/);
    assert.match(css, /font-style: normal;/);
  });

  it("limits bundled CJK fonts to CJK codepoints so Latin text can keep the selected Latin family", () => {
    const css = buildBuiltInFontFaceCss(getBuiltInFontFaceDefinitions(), (fileName) => `blob:${fileName}`);
    const fontFaceBlocks = Array.from(css.matchAll(/@font-face \{[\s\S]*?\n  \}/g)).map((match) => match[0]);
    const bundledCjkFamilies = ["ChillHuoFangSong", "Noto Serif CJK SC", "Noto Sans CJK SC", "LXGW WenKai Lite"];
    const bundledLatinFamilies = ["Literata", "Merriweather", "Source Sans 3", "Atkinson Hyperlegible"];

    for (const family of bundledCjkFamilies) {
      const block = fontFaceBlocks.find((fontBlock) => fontBlock.includes(`font-family: "${family}";`)) ?? "";
      assert.match(block, /unicode-range: [^;]*U\+4E00-9FFF/, `${family} must be constrained to CJK`);
    }
    for (const family of bundledLatinFamilies) {
      const block = fontFaceBlocks.find((fontBlock) => fontBlock.includes(`font-family: "${family}";`)) ?? "";
      assert.doesNotMatch(block, /unicode-range:/, `${family} must not be constrained to CJK`);
    }
  });

  it("does not pass Android asset resource URIs through convertFileSrc again", () => {
    let convertCalls = 0;
    const url = toBuiltInFontAssetUrl("asset://localhost/resources/fonts/TestSerif.woff2", (path) => {
      convertCalls += 1;
      return `converted:${path}`;
    });

    assert.equal(url, "asset://localhost/resources/fonts/TestSerif.woff2");
    assert.equal(convertCalls, 0);
  });

  it("converts desktop resource paths into asset URLs", () => {
    const url = toBuiltInFontAssetUrl(
      "C:\\Program Files\\SageRead\\resources\\fonts\\TestSerif.woff2",
      (path) => `asset://localhost/${encodeURIComponent(path)}`,
    );

    assert.equal(url, "asset://localhost/C%3A%5CProgram%20Files%5CSageRead%5Cresources%5Cfonts%5CTestSerif.woff2");
  });

  it("upserts built-in font CSS into a reader document without language gating", () => {
    const { appended, elements, fakeDocument } = createFakeDocument();

    upsertBuiltInFontFaceStyle(fakeDocument, "@font-face { font-family: Test; }", "test-built-in-fonts");
    upsertBuiltInFontFaceStyle(fakeDocument, "@font-face { font-family: Test2; }", "test-built-in-fonts");

    assert.equal(appended.length, 1);
    assert.equal(elements.get("test-built-in-fonts")?.textContent, "@font-face { font-family: Test2; }");
  });

  it("mounts bundled reader fonts from resource bytes as blob URLs", async () => {
    const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis };
    const originalWindow = globalWithWindow.window;
    globalWithWindow.window = globalThis;
    const originalCreateObjectUrl = URL.createObjectURL;
    const createdBlobSizes: number[] = [];
    URL.createObjectURL = ((blob: Blob) => {
      createdBlobSizes.push(blob.size);
      return `blob:test-font-${createdBlobSizes.length}`;
    }) as typeof URL.createObjectURL;

    try {
      mockIPC((cmd, args) => {
        if (cmd === "log_reader_font_diagnostics") {
          return null;
        }
        assert.equal(cmd, "plugin:fs|read_file");
        const { path, options } = args as { path?: string; options?: { baseDir?: number } };
        assert.match(path ?? "", /^resources\/fonts\/.+\.woff2$/);
        assert.equal(options?.baseDir, 11);
        return [0x77, 0x4f, 0x46, 0x32];
      });

      const { elements, fakeDocument } = createFakeDocument();
      await mountAdditionalFonts(fakeDocument);

      const styleText = elements.get("builtin-reader-fonts")?.textContent ?? "";
      for (let i = 1; i <= getBuiltInFontFaceDefinitions().length; i += 1) {
        assert.match(styleText, new RegExp(`url\\("blob:test-font-${i}"\\) format\\("woff2"\\)`));
      }
      assert.deepEqual(
        createdBlobSizes,
        getBuiltInFontFaceDefinitions().map(() => 4),
      );
    } finally {
      clearMocks();
      URL.createObjectURL = originalCreateObjectUrl;
      if (originalWindow) {
        globalWithWindow.window = originalWindow;
      } else {
        delete globalWithWindow.window;
      }
    }
  });

  it("sends per-font runtime diagnostics to the native logcat bridge", async () => {
    const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis };
    const originalWindow = globalWithWindow.window;
    globalWithWindow.window = globalThis;
    const originalCreateObjectUrl = URL.createObjectURL;
    const createdBlobSizes: number[] = [];
    URL.createObjectURL = ((blob: Blob) => {
      createdBlobSizes.push(blob.size);
      return `blob:diagnostic-font-${createdBlobSizes.length}`;
    }) as typeof URL.createObjectURL;

    const diagnostics: unknown[] = [];
    const loadedFontFamilies: string[] = [];
    const checkedFontFamilies: string[] = [];

    try {
      mockIPC((cmd, args) => {
        if (cmd === "plugin:fs|read_file") {
          return [0x77, 0x4f, 0x46, 0x32];
        }
        if (cmd === "log_reader_font_diagnostics") {
          diagnostics.push((args as { payload?: unknown }).payload);
          return null;
        }
        throw new Error(`Unexpected IPC command: ${cmd}`);
      });

      const { fakeDocument } = createFakeDocument();
      const documentWithFonts = fakeDocument as Document & {
        fonts: {
          status: string;
          load: (font: string, text?: string) => Promise<unknown[]>;
          check: (font: string, text?: string) => boolean;
        };
        body: HTMLElement;
        documentElement: HTMLElement;
        defaultView: { getComputedStyle: (element: Element) => { fontFamily: string } };
      };
      documentWithFonts.fonts = {
        status: "loaded",
        load: async (font) => {
          const family = font.match(/"([^"]+)"/)?.[1] ?? font;
          loadedFontFamilies.push(family);
          return [{}];
        },
        check: (font) => {
          const family = font.match(/"([^"]+)"/)?.[1] ?? font;
          checkedFontFamilies.push(family);
          return true;
        },
      };
      documentWithFonts.body = {} as HTMLElement;
      documentWithFonts.documentElement = {} as HTMLElement;
      documentWithFonts.defaultView = {
        getComputedStyle: () => ({
          fontFamily:
            '"Noto Serif CJK SC", "Noto Sans CJK SC", "LXGW WenKai Lite", "ChillHuoFangSong", "Literata", "Merriweather", "Source Sans 3", "Atkinson Hyperlegible", serif',
        }),
      };

      await mountAdditionalFonts(documentWithFonts);

      assert.equal(diagnostics.length, 1);
      const payload = diagnostics[0] as {
        scope: string;
        fonts: Array<{
          family: string;
          fileName: string;
          resourceReadOk: boolean;
          resourceByteLength: number;
          fontUrlKind: string;
          cssMounted: boolean;
          fontFaceLoadStatus: string;
          fontFaceLoadedCount: number;
          fontFaceCheck: boolean;
          computedBodyContainsFamily: boolean;
        }>;
      };
      assert.equal(payload.scope, "reader-document");
      assert.equal(payload.fonts.length, getBuiltInFontFaceDefinitions().length);
      assert.deepEqual(
        payload.fonts.map((font) => font.family),
        getBuiltInFontFaceDefinitions().map((definition) => definition.family),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.resourceReadOk),
        getBuiltInFontFaceDefinitions().map(() => true),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.resourceByteLength),
        getBuiltInFontFaceDefinitions().map(() => 4),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.fontUrlKind),
        getBuiltInFontFaceDefinitions().map(() => "blob"),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.cssMounted),
        getBuiltInFontFaceDefinitions().map(() => true),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.fontFaceLoadStatus),
        getBuiltInFontFaceDefinitions().map(() => "loaded"),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.fontFaceLoadedCount),
        getBuiltInFontFaceDefinitions().map(() => 1),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.fontFaceCheck),
        getBuiltInFontFaceDefinitions().map(() => true),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.computedBodyContainsFamily),
        getBuiltInFontFaceDefinitions().map(() => true),
      );
      assert.deepEqual(
        loadedFontFamilies,
        getBuiltInFontFaceDefinitions().map((definition) => definition.family),
      );
      assert.deepEqual(
        checkedFontFamilies,
        getBuiltInFontFaceDefinitions().map((definition) => definition.family),
      );
    } finally {
      clearMocks();
      URL.createObjectURL = originalCreateObjectUrl;
      if (originalWindow) {
        globalWithWindow.window = originalWindow;
      } else {
        delete globalWithWindow.window;
      }
    }
  });

  it("materializes Android APK font assets through native bridge when Tauri resource reads fail", async () => {
    const globalWithWindow = globalThis as typeof globalThis & { window?: typeof globalThis };
    const originalWindow = globalWithWindow.window;
    globalWithWindow.window = globalThis;

    const diagnostics: unknown[] = [];
    const materializedPaths: string[] = [];
    const originalConsoleError = console.error;
    const unexpectedConsoleErrors: unknown[][] = [];

    try {
      console.error = ((...args: unknown[]) => {
        unexpectedConsoleErrors.push(args);
      }) as typeof console.error;

      mockIPC((cmd, args) => {
        if (cmd === "plugin:fs|read_file") {
          throw new Error(
            "failed to open file at path: asset://localhost/resources/fonts/Test.woff2 with error: No such file or directory",
          );
        }
        if (cmd === "prepare_reader_font_asset") {
          const { resourcePath } = args as { resourcePath?: string };
          assert.match(resourcePath ?? "", /^resources\/fonts\/.+\.woff2$/);
          materializedPaths.push(resourcePath ?? "");
          return {
            filePath: `/data/user/0/com.xincmm.sageread/cache/reader-fonts/${resourcePath?.split("/").at(-1)}`,
            byteLength: 1234,
          };
        }
        if (cmd === "log_reader_font_diagnostics") {
          diagnostics.push((args as { payload?: unknown }).payload);
          return null;
        }
        throw new Error(`Unexpected IPC command: ${cmd}`);
      });

      const { elements, fakeDocument } = createFakeDocument();
      const documentWithFonts = fakeDocument as Document & {
        fonts: {
          status: string;
          load: () => Promise<unknown[]>;
          check: () => boolean;
        };
        body: HTMLElement;
        documentElement: HTMLElement;
        defaultView: { getComputedStyle: (element: Element) => { fontFamily: string } };
      };
      documentWithFonts.fonts = {
        status: "loaded",
        load: async () => [{}],
        check: () => true,
      };
      documentWithFonts.body = {} as HTMLElement;
      documentWithFonts.documentElement = {} as HTMLElement;
      documentWithFonts.defaultView = {
        getComputedStyle: () => ({ fontFamily: '"ChillHuoFangSong", serif' }),
      };

      await mountAdditionalFonts(documentWithFonts);

      assert.equal(unexpectedConsoleErrors.length, 0);
      assert.equal(materializedPaths.length, getBuiltInFontFaceDefinitions().length);
      const styleText = elements.get("builtin-reader-fonts")?.textContent ?? "";
      assert.doesNotMatch(styleText, /asset:\/\/localhost\/resources\/fonts\//);
      assert.match(styleText, /reader-fonts/);
      assert.equal(diagnostics.length, 1);
      const payload = diagnostics[0] as {
        fonts: Array<{
          resourceReadOk: boolean;
          nativeAssetPreparedOk: boolean;
          nativeAssetByteLength: number;
          fontUrlKind: string;
        }>;
      };
      assert.deepEqual(
        payload.fonts.map((font) => font.resourceReadOk),
        getBuiltInFontFaceDefinitions().map(() => false),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.nativeAssetPreparedOk),
        getBuiltInFontFaceDefinitions().map(() => true),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.nativeAssetByteLength),
        getBuiltInFontFaceDefinitions().map(() => 1234),
      );
      assert.deepEqual(
        payload.fonts.map((font) => font.fontUrlKind),
        getBuiltInFontFaceDefinitions().map(() => "asset"),
      );
    } finally {
      clearMocks();
      console.error = originalConsoleError;
      if (originalWindow) {
        globalWithWindow.window = originalWindow;
      } else {
        delete globalWithWindow.window;
      }
    }
  });

  it("ships bundled WOFF2 fonts with standard OpenType name records", () => {
    for (const definition of getBuiltInFontFaceDefinitions()) {
      const fontBytes = readFileSync(
        new URL(`../../src-tauri/resources/fonts/${definition.fileName}`, import.meta.url),
      );
      const nameIds = readWoff2NameIds(fontBytes);

      assert.ok(nameIds.has(1), `${definition.fileName}: font family name record is required`);
      assert.ok(nameIds.has(2), `${definition.fileName}: font subfamily name record is required`);
      assert.ok(nameIds.has(4), `${definition.fileName}: full font name record is required`);
      assert.ok(nameIds.has(6), `${definition.fileName}: PostScript name record is required`);
    }
  });

  it("ships every bundled reader font to source resources and generated Android assets", () => {
    for (const definition of getBuiltInFontFaceDefinitions()) {
      const sourceFontBytes = readFileSync(
        new URL(`../../src-tauri/resources/fonts/${definition.fileName}`, import.meta.url),
      );
      const androidFontBytes = readFileSync(
        new URL(
          `../../src-tauri/gen/android/app/src/main/assets/resources/fonts/${definition.fileName}`,
          import.meta.url,
        ),
      );

      assert.deepEqual(androidFontBytes, sourceFontBytes, `${definition.fileName}: Android asset must match source`);
    }
  });
});
