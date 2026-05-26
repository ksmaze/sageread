import { useEffect, useRef, useState } from "react";
import { useUICSS } from "@/hooks/use-ui-css";
import type { BookDoc } from "@/lib/document";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useThemeStore } from "@/store/theme-store";
import type { BookConfig, ViewSettings } from "@/types/book";
import type { Insets } from "@/types/misc";
import type { FoliateView } from "@/types/view";
import { mountAdditionalFonts } from "@/utils/font";
import {
  describeReaderNavigationError,
  describeReaderNavigationTarget,
  readerNavigationError,
  readerNavigationInfo,
} from "@/utils/reader-navigation-debug";
import { applyFixedlayoutStyles, getStyles } from "@/utils/style";
import { useReaderStoreApi } from "../../components/reader-provider";
import { useMouseEvent } from "../use-iframe-events";
import { usePagination } from "../use-pagination";
import { useProgressAutoSave } from "../use-progress-auto-save";
import { FoliateViewerManager, type ProgressData } from "./foliate-viewer-manager";

export const useFoliateViewer = (bookId: string, bookDoc: BookDoc, config: BookConfig, insets: Insets) => {
  const store = useReaderStoreApi();
  const { themeCode, isDarkMode } = useThemeStore();
  const { settings, setSettings } = useAppSettingsStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<FoliateViewerManager | null>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const isInitialized = useRef(false);
  const [, forceUpdate] = useState({});

  useUICSS(bookId);
  useProgressAutoSave(bookId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional existing hook behavior
  useEffect(() => {
    if (isInitialized.current || !containerRef.current) {
      readerNavigationInfo("use-foliate-viewer.init.skip", {
        bookId,
        hasContainer: Boolean(containerRef.current),
        isInitialized: isInitialized.current,
      });
      return;
    }

    readerNavigationInfo("use-foliate-viewer.init.start", {
      bookId,
      initialLocation: describeReaderNavigationTarget({ bookId, cfi: config.location }),
    });
    isInitialized.current = true;
    store.getState().setViewerReady(false);
    store.getState().setView(null);
    store.getState().setError(null);

    const manager = new FoliateViewerManager({
      bookId,
      bookDoc,
      config,
      insets,
      container: containerRef.current,
      globalViewSettings: settings.globalViewSettings,
      onViewCreated: (view) => {
        readerNavigationInfo("use-foliate-viewer.view-created", {
          bookId,
          viewId: view.id,
        });
        store.getState().setView(view);
        viewRef.current = view;
      },
    });

    manager.setProgressCallback((progress: ProgressData) => {
      store.getState().setProgress(progress);
      store.getState().setLocation(progress.location);
    });

    manager.setViewSettingsCallback((updatedSettings: ViewSettings) => {
      const { settings: currentSettings } = useAppSettingsStore.getState();
      setSettings({
        ...currentSettings,
        globalViewSettings: updatedSettings,
      });
    });

    managerRef.current = manager;

    manager
      .initialize()
      .then(() => {
        readerNavigationInfo("use-foliate-viewer.init.success", { bookId });
        store.getState().setViewerReady(true);
        forceUpdate({});
      })
      .catch((error) => {
        console.error("Failed to initialize foliate viewer:", error);
        readerNavigationError("use-foliate-viewer.init.error", {
          bookId,
          error: describeReaderNavigationError(error),
        });
        if (managerRef.current === manager) {
          manager.destroy();
          managerRef.current = null;
          viewRef.current = null;
          isInitialized.current = false;
          store.getState().setView(null);
          store.getState().setViewerReady(false);
          store.getState().setError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      readerNavigationInfo("use-foliate-viewer.destroy", { bookId });
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      viewRef.current = null;
      store.getState().setView(null);
      store.getState().setViewerReady(false);
      isInitialized.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional existing hook behavior
  useEffect(() => {
    const manager = managerRef.current;
    manager?.updateViewSettings(settings.globalViewSettings);
    const view = manager?.getView();
    if (view?.renderer && isInitialized.current) {
      const styles = getStyles(settings.globalViewSettings, themeCode);
      view.renderer.setStyles?.(styles);
      const contents = view.renderer.getContents?.() ?? [];
      contents.forEach(({ doc }) => {
        mountAdditionalFonts(doc, settings.globalViewSettings, "reader-document-style").catch((error) => {
          console.warn("[FoliateViewer] Failed to update reader font faces for style diagnostics:", error);
        });
      });

      if (bookDoc.rendition?.layout === "pre-paginated") {
        const docs = view.renderer.getContents();
        docs.forEach(({ doc }) => {
          applyFixedlayoutStyles(doc, settings.globalViewSettings, themeCode);
        });
      }
    }
  }, [themeCode, isDarkMode, settings.globalViewSettings, bookDoc.rendition?.layout]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional existing hook behavior
  useEffect(() => {
    const view = managerRef.current?.getView();
    if (view?.renderer && isInitialized.current) {
      if (settings.globalViewSettings.scrolled) {
        view.renderer.setAttribute("flow", "scrolled");
      }
    }
  }, [insets.top, insets.right, insets.bottom, insets.left, settings.globalViewSettings]);

  const { handlePageFlip, handleContinuousScroll } = usePagination(
    bookId,
    containerRef as React.RefObject<HTMLDivElement>,
  );

  const mouseHandlers = useMouseEvent(bookId, handlePageFlip, handleContinuousScroll);

  const refresh = async () => {
    if (managerRef.current) {
      await managerRef.current.refresh();
    }
  };

  return {
    containerRef,
    mouseHandlers,
    refresh,
    getView: () => managerRef.current?.getView() || null,
  } as const;
};

export default useFoliateViewer;
