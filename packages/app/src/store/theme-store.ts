import { create } from "zustand";
import {
  type CustomTheme,
  getReaderBackgroundFromThemeColor,
  isReaderBackground,
  type Palette,
  type ReaderBackground,
  type ThemeMode,
} from "@/styles/themes";
import type { SystemSettings } from "@/types/settings";
import { getThemeCode, getThemeCodeFromOptions, type ThemeCode } from "@/utils/style";

interface ThemeState {
  themeMode: ThemeMode;
  readerBackground: ReaderBackground;
  systemIsDarkMode: boolean;
  themeCode: ThemeCode;
  isDarkMode: boolean;
  systemUIVisible: boolean;
  statusBarHeight: number;
  systemUIAlwaysHidden: boolean;
  autoScroll: boolean;
  setSystemUIAlwaysHidden: (hidden: boolean) => void;
  setStatusBarHeight: (height: number) => void;
  showSystemUI: () => void;
  dismissSystemUI: () => void;
  getIsDarkMode: () => boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setReaderBackground: (background: ReaderBackground) => void;
  setAutoScroll: (enabled: boolean) => void;
  updateAppTheme: (color: keyof Palette) => void;
  saveCustomTheme: (settings: SystemSettings, theme: CustomTheme, isDelete?: boolean) => void;
}

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window !== "undefined" && localStorage) {
    return (localStorage.getItem("themeMode") as ThemeMode) || "auto";
  }
  return "auto";
};

const getInitialReaderBackground = (): ReaderBackground => {
  if (typeof window !== "undefined" && localStorage) {
    const stored = localStorage.getItem("readerBackground");
    if (isReaderBackground(stored)) return stored;
    const legacyBackground = getReaderBackgroundFromThemeColor(localStorage.getItem("themeColor"));
    if (legacyBackground) return legacyBackground;
  }
  return "default";
};

const getInitialAutoScroll = (): boolean => {
  if (typeof window !== "undefined" && localStorage) {
    const stored = localStorage.getItem("autoScroll");
    return stored !== null ? stored === "true" : true; // 默认启用自动滚动
  }
  return true;
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialThemeMode = getInitialThemeMode();
  const initialReaderBackground = getInitialReaderBackground();
  const initialAutoScroll = getInitialAutoScroll();

  console.log("initialThemeMode", initialThemeMode);
  console.log("initialAutoScroll", initialAutoScroll);

  const systemIsDarkMode = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDarkMode = initialThemeMode === "dark" || (initialThemeMode === "auto" && systemIsDarkMode);
  const themeCode = getThemeCode();

  if (typeof window !== "undefined") {
    document.documentElement.className = document.documentElement.className
      .split(" ")
      .filter((cls) => cls !== "dark")
      .join(" ");

    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const mode = get().themeMode;
      const isDarkMode = mode === "dark" || (mode === "auto" && mediaQuery.matches);
      set({ systemIsDarkMode: mediaQuery.matches, isDarkMode, themeCode: getThemeCode() });
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
  }

  return {
    themeMode: initialThemeMode,
    readerBackground: initialReaderBackground,
    systemIsDarkMode,
    isDarkMode,
    themeCode,
    systemUIVisible: false,
    statusBarHeight: 24,
    systemUIAlwaysHidden: false,
    autoScroll: initialAutoScroll,
    showSystemUI: () => set({ systemUIVisible: true }),
    dismissSystemUI: () => set({ systemUIVisible: false }),
    setStatusBarHeight: (height: number) => set({ statusBarHeight: height }),
    setSystemUIAlwaysHidden: (hidden: boolean) => set({ systemUIAlwaysHidden: hidden }),
    getIsDarkMode: () => get().isDarkMode,
    setThemeMode: (mode) => {
      if (typeof window !== "undefined" && localStorage) {
        localStorage.setItem("themeMode", mode);
      }
      const isDarkMode = mode === "dark" || (mode === "auto" && get().systemIsDarkMode);

      // Apply theme classes to document element
      document.documentElement.className = document.documentElement.className
        .split(" ")
        .filter((cls) => cls !== "dark")
        .join(" ");

      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      }

      set({ themeMode: mode, isDarkMode });
      set({ themeCode: getThemeCode() });
    },

    setReaderBackground: (background) => {
      if (typeof window !== "undefined" && localStorage) {
        localStorage.setItem("readerBackground", background);
      }
      set({ readerBackground: background, themeCode: getThemeCode() });
    },

    setAutoScroll: (enabled) => {
      if (typeof window !== "undefined" && localStorage) {
        localStorage.setItem("autoScroll", enabled.toString());
      }
      set({ autoScroll: enabled });
    },
    updateAppTheme: (color) => {
      const { themeMode, systemIsDarkMode } = get();
      const { palette } = getThemeCodeFromOptions({
        themeMode,
        readerBackground: "default",
        systemIsDarkMode,
      });
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette[color]);
    },
    saveCustomTheme: async (settings, theme, isDelete) => {
      const customThemes = settings.globalReadSettings.customThemes || [];
      const index = customThemes.findIndex((t) => t.name === theme.name);
      if (isDelete) {
        if (index > -1) {
          customThemes.splice(index, 1);
        }
      } else {
        if (index > -1) {
          customThemes[index] = theme;
        } else {
          customThemes.push(theme);
        }
      }
      settings.globalReadSettings.customThemes = customThemes;
      localStorage.setItem("customThemes", JSON.stringify(customThemes));
    },
  };
});
