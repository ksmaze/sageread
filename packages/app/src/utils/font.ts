import { convertFileSrc } from "@tauri-apps/api/core";
import { resourceDir } from "@tauri-apps/api/path";
import { isCJKEnv } from "./misc";

let cachedBuiltInFontUrl: string | null = null;

const getBuiltInFontUrl = async (): Promise<string> => {
  if (cachedBuiltInFontUrl) {
    return cachedBuiltInFontUrl;
  }

  try {
    const resDir = await resourceDir();
    console.log("[Font] resourceDir:", resDir);

    const fontPath = `${resDir}/resources/fonts/ChillHuoFangSong_Regular.woff2`;
    console.log("[Font] fontPath:", fontPath);

    const fontUrl = convertFileSrc(fontPath);
    console.log("[Font] fontUrl:", fontUrl);

    cachedBuiltInFontUrl = fontUrl;
    return fontUrl;
  } catch (error) {
    console.error("[Font] Failed to get built-in font URL:", error);
    return "";
  }
};

const getBuiltInFontFaces = async (): Promise<string> => {
  const fontUrl = await getBuiltInFontUrl();
  console.log("fontUrl", fontUrl);
  return `
  @font-face {
    font-family: "ChillHuoFangSong";
    font-display: swap;
    src: local("ChillHuoFangSong"), local("寒蝉活宋体"), url("${fontUrl}") format("woff2");
    font-weight: 400;
    font-style: normal;
  }
`;
};

export const mountAdditionalFonts = async (document: Document, isCJK = false) => {
  const mountCJKFonts = isCJK || isCJKEnv();

  if (mountCJKFonts) {
    const builtInFontFaces = await getBuiltInFontFaces();
    const style = document.createElement("style");
    style.textContent = builtInFontFaces;
    document.head.appendChild(style);
  }
};

export const mountFontsToMainApp = async () => {
  try {
    const isCJK = isCJKEnv();

    if (isCJK) {
      const builtInFontFaces = await getBuiltInFontFaces();
      const style = document.createElement("style");
      style.id = "builtin-fonts-main-app";
      style.textContent = builtInFontFaces;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error("[Font] Failed to load fonts to main app:", error);
  }
};
