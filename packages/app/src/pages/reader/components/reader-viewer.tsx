import { useReadingSession } from "@/hooks/use-reading-session";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import type { BookDoc } from "@/lib/document";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLayoutStore } from "@/store/layout-store";
import { useLibraryStore } from "@/store/library-store";
import type { BookConfig } from "@/types/book";
import type { Insets } from "@/types/misc";
import {
  describeReaderNavigationError,
  describeReaderNavigationTarget,
  readerNavigationError,
  readerNavigationInfo,
} from "@/utils/reader-navigation-debug";
import { getInsetEdges } from "@/utils/grid";
import { getViewInsets } from "@/utils/insets";
import { useEffect, useMemo } from "react";
import useBookShortcuts from "../hooks/use-book-shortcuts";
import { useFoliateViewer } from "../hooks/use-foliate-viewer";
import { consumeReaderNavigationTarget, getInitialReaderLocation } from "../store/reader-navigation";
import Annotator from "./annotator";
import FooterBar from "./footer-bar";
import HeaderBar from "./header-bar";
import { useReaderStore, useReaderStoreApi } from "./reader-provider";

interface ReaderViewerSurfaceProps {
  bookId: string;
  bookDoc: BookDoc;
  config: BookConfig;
  contentInsets: Insets;
}

const ReaderViewerSurface: React.FC<ReaderViewerSurfaceProps> = ({ bookId, bookDoc, config, contentInsets }) => {
  const view = useReaderStore((state) => state.view);
  const isViewerReady = useReaderStore((state) => state.isViewerReady);
  const pendingNavigationTarget = useReaderStore((state) => state.pendingNavigationTarget);
  const store = useReaderStoreApi();

  const initialLocation = getInitialReaderLocation(config.location, pendingNavigationTarget);
  const viewerConfig = useMemo(
    () => (initialLocation === config.location ? config : { ...config, location: initialLocation }),
    [config, initialLocation],
  );

  const foliateViewer = useFoliateViewer(bookId, bookDoc, viewerConfig, contentInsets);

  useEffect(() => {
    readerNavigationInfo("reader-viewer.initial-location", {
      bookId,
      initialLocation,
      pendingTarget: describeReaderNavigationTarget(pendingNavigationTarget),
      savedLocation: config.location,
    });
  }, [bookId, config.location, initialLocation, pendingNavigationTarget]);

  useEffect(() => {
    if (!view || !isViewerReady || !pendingNavigationTarget) return;

    let cancelled = false;
    readerNavigationInfo("reader-viewer.consume-pending-target.start", {
      bookId,
      pendingTarget: describeReaderNavigationTarget(pendingNavigationTarget),
    });
    void consumeReaderNavigationTarget({
      target: pendingNavigationTarget,
      view,
      clearTarget: (target) => {
        if (!cancelled) store.getState().clearNavigationTarget(target);
      },
      onError: (error) => {
        readerNavigationError("reader-viewer.consume-pending-target.error", {
          bookId,
          error: describeReaderNavigationError(error),
          target: describeReaderNavigationTarget(pendingNavigationTarget),
        });
      },
    }).then((consumed) => {
      readerNavigationInfo("reader-viewer.consume-pending-target.done", {
        bookId,
        consumed,
        pendingTarget: describeReaderNavigationTarget(pendingNavigationTarget),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bookId, isViewerReady, pendingNavigationTarget, store, view]);

  return (
    <div ref={foliateViewer.containerRef} className="flex-1" data-book-id={bookId} {...foliateViewer.mouseHandlers} />
  );
};

const ReaderViewerContent: React.FC = () => {
  const bookId = useReaderStore((state) => state.bookId);
  const bookData = useReaderStore((state) => state.bookData);
  const config = useReaderStore((state) => state.config);
  const { settings } = useAppSettingsStore();

  const screenInsets = useSafeAreaInsets();
  const aspectRatio = window.innerWidth / window.innerHeight;
  const globalViewSettings = settings.globalViewSettings;

  const contentInsets = useMemo(() => {
    if (!screenInsets || !globalViewSettings) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const { top, right, bottom, left } = getInsetEdges(0, 1, aspectRatio);
    const gridInsets = {
      top: top ? screenInsets.top : 0,
      right: right ? screenInsets.right : 0,
      bottom: bottom ? screenInsets.bottom : 0,
      left: left ? screenInsets.left : 0,
    };

    const viewInsets = getViewInsets(globalViewSettings);

    return {
      top: gridInsets.top + viewInsets.top,
      right: gridInsets.right + viewInsets.right,
      bottom: gridInsets.bottom + viewInsets.bottom,
      left: gridInsets.left + viewInsets.left,
    };
  }, [screenInsets, globalViewSettings, aspectRatio]);

  if (!bookData?.bookDoc || !config || !contentInsets) {
    return null;
  }

  return <ReaderViewerSurface bookId={bookId} bookDoc={bookData.bookDoc} config={config} contentInsets={contentInsets} />;
};

interface ReaderViewerProps {
  mobileChrome?: boolean;
}

export default function ReaderViewer({ mobileChrome = false }: ReaderViewerProps) {
  const store = useReaderStoreApi();
  useBookShortcuts();

  const bookId = useReaderStore((state) => state.bookId);
  const bookData = useReaderStore((state) => state.bookData);
  const config = useReaderStore((state) => state.config);
  const isLoading = useReaderStore((state) => state.isLoading);
  const error = useReaderStore((state) => state.error);

  const { settings } = useAppSettingsStore();
  const { booksWithStatus } = useLibraryStore();

  // 判断当前 tab 是否可见（不在首页 && 当前激活的 tab）
  const { activeTabId, isHomeActive } = useLayoutStore();
  const tabId = `reader-${bookId}`;
  const isTabVisible = mobileChrome || (!isHomeActive && activeTabId === tabId);

  const { sessionStats, isInitialized: isSessionInitialized } = useReadingSession(bookId, {
    saveInterval: 5 * 1000,
    isVisible: isTabVisible,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const currentBookData = store.getState().bookData;
    if (!currentBookData) {
      store.getState().initBook();
    }
  }, [store, booksWithStatus, settings.globalViewSettings]);

  useEffect(() => {
    store.getState().setSessionStats(sessionStats);
    store.getState().setSessionInitialized(isSessionInitialized);
  }, [store, sessionStats, isSessionInitialized]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-neutral-500">loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!bookData || !config) {
    return null;
  }

  return (
    <div id={`gridcell-${bookId}`} className="relative flex h-full w-full flex-col rounded-md bg-background">
      {!mobileChrome && <HeaderBar />}
      <ReaderViewerContent />
      {!mobileChrome && <FooterBar />}
      <Annotator />
    </div>
  );
}
