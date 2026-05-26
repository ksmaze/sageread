import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";
import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import type { ViewSettings } from "@/types/book";
import { CJK_UNICODE_RANGE } from "./font-ranges";

export interface BuiltInFontFaceDefinition {
  family: string;
  fileName: string;
  localNames: string[];
  weight: number;
  style: "normal" | "italic";
  unicodeRange?: string;
}

const BUILT_IN_FONT_FACE_DEFINITIONS: BuiltInFontFaceDefinition[] = [
  {
    family: "ChillHuoFangSong",
    fileName: "ChillHuoFangSong_Regular.woff2",
    localNames: ["ChillHuoFangSong", "寒蝉活宋体"],
    weight: 400,
    style: "normal",
    unicodeRange: CJK_UNICODE_RANGE,
  },
  {
    family: "Noto Serif CJK SC",
    fileName: "NotoSerifCJKsc_Regular.woff2",
    localNames: ["Noto Serif CJK SC"],
    weight: 400,
    style: "normal",
    unicodeRange: CJK_UNICODE_RANGE,
  },
  {
    family: "Noto Sans CJK SC",
    fileName: "NotoSansCJKsc_Regular.woff2",
    localNames: ["Noto Sans CJK SC"],
    weight: 400,
    style: "normal",
    unicodeRange: CJK_UNICODE_RANGE,
  },
  {
    family: "LXGW WenKai Lite",
    fileName: "LXGWWenKaiLite_Regular.woff2",
    localNames: ["LXGW WenKai Lite", "霞鹜文楷 轻便版"],
    weight: 400,
    style: "normal",
    unicodeRange: CJK_UNICODE_RANGE,
  },
  {
    family: "Literata",
    fileName: "Literata_Regular.woff2",
    localNames: ["Literata"],
    weight: 400,
    style: "normal",
  },
  {
    family: "Merriweather",
    fileName: "Merriweather_Regular.woff2",
    localNames: ["Merriweather"],
    weight: 400,
    style: "normal",
  },
  {
    family: "Source Sans 3",
    fileName: "SourceSans3_Regular.woff2",
    localNames: ["Source Sans 3", "Source Sans Pro"],
    weight: 400,
    style: "normal",
  },
  {
    family: "Atkinson Hyperlegible",
    fileName: "AtkinsonHyperlegible_Regular.woff2",
    localNames: ["Atkinson Hyperlegible"],
    weight: 400,
    style: "normal",
  },
];

const BUILT_IN_FONT_RESOURCE_DIR = "resources/fonts";
const READER_BUILT_IN_FONT_STYLE_ID = "builtin-reader-fonts";
const MAIN_APP_BUILT_IN_FONT_STYLE_ID = "builtin-fonts-main-app";
const URL_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const WOFF2_MIME_TYPE = "font/woff2";
const FONT_DIAGNOSTIC_COMMAND = "log_reader_font_diagnostics";
const PREPARE_FONT_ASSET_COMMAND = "prepare_reader_font_asset";

type BuiltInFontUrlKind = "blob" | "asset" | "file" | "resource-path" | "empty" | "other";
type BuiltInFontDiagnosticScope = "reader-document" | "reader-document-style" | "main-app";
type ReaderFontSettings = Pick<ViewSettings, "serifFont" | "sansSerifFont" | "defaultCJKFont" | "defaultFont">;

interface PreparedReaderFontAsset {
  filePath: string;
  byteLength: number;
}

interface BuiltInFontResourceResult {
  definition: BuiltInFontFaceDefinition;
  resourcePath: string;
  fontUrl: string;
  fontUrlKind: BuiltInFontUrlKind;
  resourceReadOk: boolean;
  resourceByteLength: number;
  errorMessage?: string;
  nativeAssetPreparedOk: boolean;
  nativeAssetByteLength: number;
  nativeAssetFilePath?: string;
  nativeAssetErrorMessage?: string;
}

const mountedBuiltInFontResources = new WeakMap<Document, BuiltInFontResourceResult[]>();
const mountedBuiltInFontResourceKeys = new WeakMap<Document, string>();

const quoteCssString = (value: string) => JSON.stringify(value);
const convertFilePathToDefaultAssetUrl = (filePath: string): string => {
  try {
    return convertFileSrc(filePath);
  } catch {
    return `asset://localhost/${filePath.replace(/^\/+/, "")}`;
  }
};

export const getBuiltInFontFaceDefinitions = (): BuiltInFontFaceDefinition[] =>
  BUILT_IN_FONT_FACE_DEFINITIONS.map((definition) => ({
    ...definition,
    localNames: [...definition.localNames],
  }));

const parseFontFamilyList = (fontFamily: string | null | undefined): string[] => {
  if (!fontFamily) {
    return [];
  }

  const families = fontFamily
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  const seen = new Set<string>();
  return families.filter((family) => {
    const key = family.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const fontFamilyMatchesDefinition = (fontFamily: string, definition: BuiltInFontFaceDefinition): boolean => {
  const normalizedFamily = fontFamily.toLowerCase();
  return (
    definition.family.toLowerCase() === normalizedFamily ||
    definition.localNames.some((localName) => localName.toLowerCase() === normalizedFamily)
  );
};

export const getBuiltInFontFaceDefinitionsForFamilies = (fontFamilies: string[]): BuiltInFontFaceDefinition[] => {
  const definitions = getBuiltInFontFaceDefinitions();
  const selectedDefinitions: BuiltInFontFaceDefinition[] = [];
  const selectedFamilies = new Set<string>();

  for (const fontFamily of fontFamilies) {
    const definition = definitions.find((candidate) => fontFamilyMatchesDefinition(fontFamily, candidate));
    if (!definition || selectedFamilies.has(definition.family)) {
      continue;
    }
    selectedDefinitions.push(definition);
    selectedFamilies.add(definition.family);
  }

  return selectedDefinitions;
};

export const getBuiltInFontFaceDefinitionsForSettings = (
  settings: ReaderFontSettings,
): BuiltInFontFaceDefinition[] => {
  const defaultFontIsSerif = settings.defaultFont?.toLowerCase() === "serif";
  const activeLatinFamilies = parseFontFamilyList(defaultFontIsSerif ? settings.serifFont : settings.sansSerifFont);
  const activeCjkFamilies = parseFontFamilyList(settings.defaultCJKFont);

  return getBuiltInFontFaceDefinitionsForFamilies([...activeCjkFamilies, ...activeLatinFamilies]);
};

export const buildBuiltInFontFaceCss = (
  definitions: BuiltInFontFaceDefinition[],
  resolveFontUrl: (fileName: string) => string = toBuiltInFontAssetUrl,
): string =>
  definitions
    .map((definition) => {
      const localSources = definition.localNames.map((name) => `local(${quoteCssString(name)})`);
      const fontUrl = resolveFontUrl(definition.fileName);
      const urlSources = fontUrl ? [`url(${quoteCssString(fontUrl)}) format("woff2")`] : [];
      return `
  @font-face {
    font-family: ${quoteCssString(definition.family)};
    font-display: swap;
    src: ${[...localSources, ...urlSources].join(", ")};
    font-weight: ${definition.weight};
    font-style: ${definition.style};
    ${definition.unicodeRange ? `unicode-range: ${definition.unicodeRange};` : ""}
  }
`;
    })
    .join("\n");

export const toBuiltInFontAssetUrl = (
  resolvedResourcePath: string,
  convertFilePathToAssetUrl: (filePath: string) => string = convertFilePathToDefaultAssetUrl,
): string => {
  if (!resolvedResourcePath) {
    return "";
  }
  if (URL_PROTOCOL_PATTERN.test(resolvedResourcePath)) {
    return resolvedResourcePath;
  }
  return convertFilePathToAssetUrl(resolvedResourcePath);
};

const toBuiltInFontResourcePath = (fileName: string) => `${BUILT_IN_FONT_RESOURCE_DIR}/${fileName}`;

const createFontBlobUrl = (fontBytes: Uint8Array): string =>
  URL.createObjectURL(new Blob([fontBytes], { type: WOFF2_MIME_TYPE }));

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

const getBuiltInFontUrlKind = (fontUrl: string): BuiltInFontUrlKind => {
  if (!fontUrl) {
    return "empty";
  }
  if (fontUrl.startsWith("blob:")) {
    return "blob";
  }
  if (fontUrl.startsWith("asset://")) {
    return "asset";
  }
  if (fontUrl.startsWith("file://")) {
    return "file";
  }
  if (!URL_PROTOCOL_PATTERN.test(fontUrl)) {
    return "resource-path";
  }
  return "other";
};

const resolveBuiltInFontFallbackUrl = async (fileName: string): Promise<string> => {
  const resourcePath = toBuiltInFontResourcePath(fileName);
  try {
    const resolvedResourcePath = await resolveResource(resourcePath);
    return toBuiltInFontAssetUrl(resolvedResourcePath);
  } catch (error) {
    console.error(`[Font] Failed to resolve bundled font resource "${fileName}":`, error);
    return toBuiltInFontAssetUrl(resourcePath);
  }
};

const prepareNativeFontAsset = async (resourcePath: string): Promise<PreparedReaderFontAsset> =>
  invoke<PreparedReaderFontAsset>(PREPARE_FONT_ASSET_COMMAND, { resourcePath });

const resolveBuiltInFontResource = async (
  definition: BuiltInFontFaceDefinition,
): Promise<BuiltInFontResourceResult> => {
  const resourcePath = toBuiltInFontResourcePath(definition.fileName);
  try {
    const fontBytes = await readFile(resourcePath, { baseDir: BaseDirectory.Resource });
    const fontUrl = createFontBlobUrl(fontBytes);
    return {
      definition,
      resourcePath,
      fontUrl,
      fontUrlKind: getBuiltInFontUrlKind(fontUrl),
      resourceReadOk: true,
      resourceByteLength: fontBytes.byteLength,
      nativeAssetPreparedOk: false,
      nativeAssetByteLength: 0,
    };
  } catch (error) {
    const resourceErrorMessage = describeError(error);
    let nativeAssetErrorMessage: string | undefined;
    try {
      const preparedAsset = await prepareNativeFontAsset(resourcePath);
      const fontUrl = convertFilePathToDefaultAssetUrl(preparedAsset.filePath);
      return {
        definition,
        resourcePath,
        fontUrl,
        fontUrlKind: getBuiltInFontUrlKind(fontUrl),
        resourceReadOk: false,
        resourceByteLength: 0,
        errorMessage: resourceErrorMessage,
        nativeAssetPreparedOk: true,
        nativeAssetByteLength: preparedAsset.byteLength,
        nativeAssetFilePath: preparedAsset.filePath,
      };
    } catch (nativeError) {
      nativeAssetErrorMessage = describeError(nativeError);
      console.error(`[Font] Failed to prepare native bundled font asset "${definition.fileName}":`, nativeError);
    }

    const fontUrl = await resolveBuiltInFontFallbackUrl(definition.fileName);
    return {
      definition,
      resourcePath,
      fontUrl,
      fontUrlKind: getBuiltInFontUrlKind(fontUrl),
      resourceReadOk: false,
      resourceByteLength: 0,
      errorMessage: resourceErrorMessage,
      nativeAssetPreparedOk: false,
      nativeAssetByteLength: 0,
      nativeAssetErrorMessage,
    };
  }
};

const getBuiltInFontFaces = async (
  definitions: BuiltInFontFaceDefinition[] = getBuiltInFontFaceDefinitions(),
): Promise<{
  cssText: string;
  resources: BuiltInFontResourceResult[];
}> => {
  const resources = await Promise.all(definitions.map(resolveBuiltInFontResource));
  const fontUrls = new Map(resources.map((resource) => [resource.definition.fileName, resource.fontUrl]));

  return {
    cssText: buildBuiltInFontFaceCss(definitions, (fileName) => fontUrls.get(fileName) ?? ""),
    resources,
  };
};

const getBuiltInFontDefinitionKey = (definitions: BuiltInFontFaceDefinition[]): string =>
  definitions.map((definition) => definition.fileName).join("|");

export const upsertBuiltInFontFaceStyle = (
  document: Document,
  cssText: string,
  styleId = READER_BUILT_IN_FONT_STYLE_ID,
) => {
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!cssText.trim()) {
    if (style) {
      if (typeof style.remove === "function") {
        style.remove();
      } else {
        style.textContent = null;
      }
    }
    return;
  }

  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = cssText;
};

const getFontDiagnosticSampleText = (definition: BuiltInFontFaceDefinition): string =>
  definition.unicodeRange ? "读" : "SageRead";

const getFontFaceQuery = (definition: BuiltInFontFaceDefinition): string =>
  `${definition.style} ${definition.weight} 16px ${quoteCssString(definition.family)}`;

const getComputedFontFamily = (document: Document, element: Element | null | undefined): string => {
  if (!element) {
    return "";
  }
  try {
    return document.defaultView?.getComputedStyle(element).fontFamily ?? "";
  } catch {
    return "";
  }
};

const logBuiltInFontDiagnostics = async (
  document: Document,
  resources: BuiltInFontResourceResult[],
  scope: BuiltInFontDiagnosticScope,
  styleId: string,
) => {
  const styleText = document.getElementById(styleId)?.textContent ?? "";
  const computedBodyFontFamily = getComputedFontFamily(document, document.body);
  const computedDocumentElementFontFamily = getComputedFontFamily(document, document.documentElement);
  const fonts = [];

  for (const resource of resources) {
    const { definition } = resource;
    const sampleText = getFontDiagnosticSampleText(definition);
    const fontFaceQuery = getFontFaceQuery(definition);
    let fontFaceLoadStatus: "loaded" | "failed" | "unsupported" = "unsupported";
    let fontFaceLoadedCount = 0;
    let fontFaceCheck = false;
    let fontFaceErrorMessage: string | undefined;

    try {
      if (document.fonts?.load) {
        const loadedFaces = await document.fonts.load(fontFaceQuery, sampleText);
        fontFaceLoadStatus = "loaded";
        fontFaceLoadedCount = loadedFaces.length;
      }
      if (document.fonts?.check) {
        fontFaceCheck = document.fonts.check(fontFaceQuery, sampleText);
      }
    } catch (error) {
      fontFaceLoadStatus = "failed";
      fontFaceErrorMessage = describeError(error);
    }

    fonts.push({
      family: definition.family,
      fileName: definition.fileName,
      resourcePath: resource.resourcePath,
      localNames: definition.localNames,
      unicodeRange: definition.unicodeRange ?? null,
      sampleText,
      fontFaceQuery,
      resourceReadOk: resource.resourceReadOk,
      resourceByteLength: resource.resourceByteLength,
      resourceErrorMessage: resource.errorMessage ?? null,
      nativeAssetPreparedOk: resource.nativeAssetPreparedOk,
      nativeAssetByteLength: resource.nativeAssetByteLength,
      nativeAssetFilePath: resource.nativeAssetFilePath ?? null,
      nativeAssetErrorMessage: resource.nativeAssetErrorMessage ?? null,
      fontUrlKind: resource.fontUrlKind,
      cssMounted: styleText.includes(`font-family: ${quoteCssString(definition.family)};`),
      fontFaceSetStatus: document.fonts?.status ?? "unsupported",
      fontFaceLoadStatus,
      fontFaceLoadedCount,
      fontFaceCheck,
      fontFaceErrorMessage: fontFaceErrorMessage ?? null,
      computedBodyContainsFamily: computedBodyFontFamily.includes(definition.family),
      computedDocumentElementContainsFamily: computedDocumentElementFontFamily.includes(definition.family),
    });
  }

  try {
    await invoke(FONT_DIAGNOSTIC_COMMAND, {
      payload: {
        scope,
        documentUrl: document.location?.href ?? null,
        computedBodyFontFamily,
        computedDocumentElementFontFamily,
        fonts,
      },
    });
  } catch (error) {
    console.warn("[Font] Failed to send font diagnostics to native logcat bridge:", error);
  }
};

export const mountAdditionalFonts = async (
  document: Document,
  settings: ReaderFontSettings,
  scope: BuiltInFontDiagnosticScope = "reader-document",
) => {
  const definitions = getBuiltInFontFaceDefinitionsForSettings(settings);
  const definitionKey = getBuiltInFontDefinitionKey(definitions);
  const mountedResources = mountedBuiltInFontResources.get(document);
  if (mountedBuiltInFontResourceKeys.get(document) === definitionKey && mountedResources) {
    await logBuiltInFontDiagnostics(document, mountedResources, scope, READER_BUILT_IN_FONT_STYLE_ID);
    return;
  }

  const builtInFontFaces = await getBuiltInFontFaces(definitions);
  upsertBuiltInFontFaceStyle(document, builtInFontFaces.cssText);
  mountedBuiltInFontResources.set(document, builtInFontFaces.resources);
  mountedBuiltInFontResourceKeys.set(document, definitionKey);
  await logBuiltInFontDiagnostics(document, builtInFontFaces.resources, scope, READER_BUILT_IN_FONT_STYLE_ID);
};

export const logMountedBuiltInFontDiagnostics = async (
  document: Document,
  scope: BuiltInFontDiagnosticScope = "reader-document-style",
) => {
  const resources = mountedBuiltInFontResources.get(document);
  if (!resources) {
    return;
  }
  await logBuiltInFontDiagnostics(document, resources, scope, READER_BUILT_IN_FONT_STYLE_ID);
};

export const mountFontPreviewsToMainApp = async (): Promise<() => void> => {
  const builtInFontFaces = await getBuiltInFontFaces();
  upsertBuiltInFontFaceStyle(document, builtInFontFaces.cssText, MAIN_APP_BUILT_IN_FONT_STYLE_ID);
  await logBuiltInFontDiagnostics(document, builtInFontFaces.resources, "main-app", MAIN_APP_BUILT_IN_FONT_STYLE_ID);

  return () => {
    upsertBuiltInFontFaceStyle(document, "", MAIN_APP_BUILT_IN_FONT_STYLE_ID);
  };
};
