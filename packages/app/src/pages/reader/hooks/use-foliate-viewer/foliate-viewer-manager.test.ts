import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import type { BookDoc } from "@/lib/document";
import {
  DEFAULT_BOOK_FONT,
  DEFAULT_BOOK_LAYOUT,
  DEFAULT_BOOK_STYLE,
  DEFAULT_SCREEN_CONFIG,
  DEFAULT_TRANSLATOR_CONFIG,
  DEFAULT_TTS_CONFIG,
  DEFAULT_VIEW_CONFIG,
} from "@/services/constants";
import type { ViewSettings } from "@/types/book";
import type { FoliateView } from "@/types/view";
import { FoliateViewerManager } from "./foliate-viewer-manager";
import { StyleManager } from "./style-manager";

const baseViewSettings: ViewSettings = {
  ...DEFAULT_BOOK_LAYOUT,
  ...DEFAULT_BOOK_STYLE,
  ...DEFAULT_BOOK_FONT,
  ...DEFAULT_VIEW_CONFIG,
  ...DEFAULT_TTS_CONFIG,
  ...DEFAULT_TRANSLATOR_CONFIG,
  ...DEFAULT_SCREEN_CONFIG,
};

const systemFontSettings: ViewSettings = {
  ...baseViewSettings,
  defaultFont: "Sans-serif",
  serifFont: "system-ui",
  sansSerifFont: "system-ui",
  defaultCJKFont: "system-ui",
};

const sourceSerifSettings: ViewSettings = {
  ...baseViewSettings,
  defaultFont: "Serif",
  serifFont: "Literata, Georgia",
  sansSerifFont: "Source Sans 3, Helvetica",
  defaultCJKFont: "Noto Serif CJK SC, ChillHuoFangSong",
};

const createFakeDocument = () => {
  const elements = new Map<string, { id: string; textContent: string | null }>();
  const body = {
    dir: "",
    querySelectorAll: () => [],
  };
  const documentElement = {
    dir: "",
  };

  return {
    body,
    documentElement,
    fonts: {
      status: "loaded",
      load: async () => [{}],
      check: () => true,
      ready: Promise.resolve(),
    },
    location: { href: "blob:http://tauri.localhost/test-reader-document" },
    defaultView: {
      getComputedStyle: () => ({
        direction: "ltr",
        fontFamily: '"Noto Serif CJK SC", "Literata", serif',
        getPropertyValue: () => "",
        writingMode: "horizontal-tb",
      }),
    },
    getElementById: (id: string) => elements.get(id) ?? null,
    createElement: () => ({ id: "", textContent: null }),
    head: {
      appendChild: (element: { id: string; textContent: string | null }) => {
        elements.set(element.id, element);
        return element;
      },
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
  } as unknown as Document;
};

const createBookDoc = (): BookDoc =>
  ({
    metadata: { title: "Test", author: "", language: "zh-CN" },
    dir: "",
    rendition: { layout: "reflowable" },
  }) as BookDoc;

describe("FoliateViewerManager reader style sync", () => {
  it("uses the latest reader font settings when a new document load event arrives", async () => {
    const globalWithWindow = globalThis as typeof globalThis & {
      localStorage?: Storage;
      matchMedia?: Window["matchMedia"];
      window?: typeof globalThis;
    };
    const originalWindow = globalWithWindow.window;
    const originalLocalStorage = globalWithWindow.localStorage;
    const originalMatchMedia = globalWithWindow.matchMedia;
    globalWithWindow.window = globalThis;
    globalWithWindow.localStorage = {
      getItem: () => null,
    } as Storage;
    globalWithWindow.matchMedia = (() => ({ matches: false })) as Window["matchMedia"];
    const originalCreateObjectUrl = URL.createObjectURL;
    let blobIndex = 0;
    URL.createObjectURL = (() => {
      blobIndex += 1;
      return `blob:manager-font-${blobIndex}`;
    }) as typeof URL.createObjectURL;

    const cssWrites: string[] = [];
    const updatedViewSettings: ViewSettings[] = [];
    const fakeView = {
      renderer: {
        setStyles: (css: string) => {
          cssWrites.push(css);
        },
        getContents: () => [{ doc: createFakeDocument() }],
        setAttribute: () => {},
        removeAttribute: () => {},
      },
    } as unknown as FoliateView;

    try {
      mockIPC((cmd) => {
        if (cmd === "plugin:fs|read_file") {
          return [0x77, 0x4f, 0x46, 0x32];
        }
        if (cmd === "log_reader_font_diagnostics") {
          return null;
        }
        throw new Error(`Unexpected IPC command: ${cmd}`);
      });

      const manager = new FoliateViewerManager({
        bookId: "book-1",
        bookDoc: createBookDoc(),
        config: { location: "" } as never,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        container: { getBoundingClientRect: () => ({ width: 400, height: 800 }) } as HTMLElement,
        globalViewSettings: systemFontSettings,
      });

      (manager as unknown as { view: FoliateView }).view = fakeView;
      (manager as unknown as { styleManager: StyleManager }).styleManager = new StyleManager(
        fakeView,
        systemFontSettings,
      );
      manager.setViewSettingsCallback((settings) => {
        updatedViewSettings.push(settings);
      });

      manager.updateViewSettings(sourceSerifSettings);
      cssWrites.length = 0;
      (manager as unknown as { handleLoad: (event: CustomEvent) => void }).handleLoad(
        new CustomEvent("load", { detail: { doc: createFakeDocument() } }),
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.equal(updatedViewSettings.at(-1)?.serifFont, sourceSerifSettings.serifFont);
      assert.equal(updatedViewSettings.at(-1)?.defaultCJKFont, sourceSerifSettings.defaultCJKFont);
      const latestCss = cssWrites.at(-1) ?? "";
      assert.match(latestCss, /"Noto Serif CJK SC", "ChillHuoFangSong", "Literata", "Georgia", serif/);
      assert.doesNotMatch(latestCss, /font-family: system-ui !important;/);
    } finally {
      clearMocks();
      URL.createObjectURL = originalCreateObjectUrl;
      if (originalWindow) {
        globalWithWindow.window = originalWindow;
      } else {
        delete globalWithWindow.window;
      }
      if (originalLocalStorage) {
        globalWithWindow.localStorage = originalLocalStorage;
      } else {
        delete globalWithWindow.localStorage;
      }
      if (originalMatchMedia) {
        globalWithWindow.matchMedia = originalMatchMedia;
      } else {
        delete globalWithWindow.matchMedia;
      }
    }
  });
});
