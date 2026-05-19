import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { createReaderStore } from "@/pages/reader/store/create-reader-store";
import type { ReaderNavigationTarget } from "@/pages/reader/store/create-reader-store";
import { describeReaderNavigationTarget, readerNavigationInfo } from "@/utils/reader-navigation-debug";
import { useEffect, useMemo } from "react";
import { ReaderToolDock } from "../components/reader-tool-dock";
import { useMobileShellStore } from "../shell/mobile-shell-store";
import { handleMobileReaderBack } from "./reader-back-handlers";
import { ReaderSheetHost } from "./reader-sheet-host";

export function MobileReader() {
  const activeBook = useMobileShellStore((state) => state.activeBook);
  const isReaderOpen = useMobileShellStore((state) => state.isReaderOpen);
  const isReaderChromeVisible = useMobileShellStore((state) => state.isReaderChromeVisible);
  const pendingReaderNavigationTarget = useMobileShellStore((state) => state.pendingReaderNavigationTarget);
  const clearPendingReaderNavigationTarget = useMobileShellStore((state) => state.clearPendingReaderNavigationTarget);
  const toggleReaderChrome = useMobileShellStore((state) => state.toggleReaderChrome);
  const openReaderSheet = useMobileShellStore((state) => state.openReaderSheet);
  const activeBookId = activeBook?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: pending navigation is sampled only when the store is created; later targets are handled by the effect below.
  const readerStore = useMemo(() => {
    if (!activeBookId || !isReaderOpen) return null;
    const initialNavigationTarget: ReaderNavigationTarget | undefined =
      pendingReaderNavigationTarget?.bookId === activeBookId
        ? {
            cfi: pendingReaderNavigationTarget.cfi,
            requestedAt: pendingReaderNavigationTarget.requestedAt,
            source: pendingReaderNavigationTarget.source,
          }
        : undefined;
    readerNavigationInfo("mobile-reader.create-reader-store", {
      activeBookId,
      activeBookTitle: activeBook?.title,
      initialTarget: describeReaderNavigationTarget(initialNavigationTarget),
      pendingShellTarget: describeReaderNavigationTarget(pendingReaderNavigationTarget),
    });
    return createReaderStore(activeBookId, initialNavigationTarget);
  }, [activeBookId, isReaderOpen]);

  useEffect(() => {
    if (!activeBookId || !isReaderOpen) return;

    const onPopState = () => {
      if (handleMobileReaderBack()) {
        window.history.pushState({ mobileReader: true }, "");
      }
    };

    window.history.pushState({ mobileReader: true }, "");
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [activeBookId, isReaderOpen]);

  useEffect(() => {
    if (!activeBookId || !isReaderOpen) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "iframe-single-click" && event.data?.bookId === activeBookId) {
        toggleReaderChrome();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeBookId, isReaderOpen, toggleReaderChrome]);

  useEffect(() => {
    if (!activeBookId || !readerStore || pendingReaderNavigationTarget?.bookId !== activeBookId) {
      if (pendingReaderNavigationTarget) {
        readerNavigationInfo("mobile-reader.pending-target.waiting-for-active-book", {
          activeBookId,
          hasReaderStore: Boolean(readerStore),
          pendingShellTarget: describeReaderNavigationTarget(pendingReaderNavigationTarget),
        });
      }
      return;
    }

    const target = {
      cfi: pendingReaderNavigationTarget.cfi,
      requestedAt: pendingReaderNavigationTarget.requestedAt,
      source: pendingReaderNavigationTarget.source,
    };
    readerNavigationInfo("mobile-reader.request-reader-navigation", {
      activeBookId,
      target: describeReaderNavigationTarget({ ...target, bookId: activeBookId, title: activeBook?.title }),
    });
    readerStore.getState().requestNavigation(target);
    clearPendingReaderNavigationTarget(activeBookId);
    readerNavigationInfo("mobile-reader.clear-shell-target.requested", {
      activeBookId,
      target: describeReaderNavigationTarget({ ...target, bookId: activeBookId, title: activeBook?.title }),
    });
  }, [activeBook?.title, activeBookId, clearPendingReaderNavigationTarget, pendingReaderNavigationTarget, readerStore]);

  if (!activeBook || !isReaderOpen || !readerStore) return null;

  return (
    <ReaderProvider store={readerStore}>
      <div className="fixed inset-0 z-50 bg-[var(--mobile-paper-high)]">
        <ReaderViewer mobileChrome />
        <ReaderToolDock visible={isReaderChromeVisible} onOpenSheet={openReaderSheet} />
        <ReaderSheetHost />
      </div>
    </ReaderProvider>
  );
}
