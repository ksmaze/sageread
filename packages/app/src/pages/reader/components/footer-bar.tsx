import { Button } from "@/components/ui/button";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useAutoHideControls } from "../hooks/use-auto-hide-controls";
import { viewPagination } from "../hooks/use-pagination";
import { useReaderStore, useReaderStoreApi } from "./reader-provider";

const FooterBar = () => {
  const store = useReaderStoreApi();
  const bookId = useReaderStore((state) => state.bookId);
  const progress = useReaderStore((state) => state.progress);
  const { settings } = useAppSettingsStore();
  const globalViewSettings = settings.globalViewSettings;
  const view = store.getState().view;
  const {
    isVisible: showControls,
    handleMouseEnter,
    handleMouseLeave,
    showControls: showControlsNow,
    scheduleHide,
  } = useAutoHideControls();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "iframe-single-click" && event.data?.bookId === bookId) {
        showControlsNow();
        scheduleHide();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [bookId, scheduleHide, showControlsNow]);

  const handleGoPrevPage = () => {
    const isScrolledMode = globalViewSettings?.scrolled;
    if (isScrolledMode) {
      if (view) {
        view.renderer.prevSection?.();
      }
    } else {
      if (view) {
        viewPagination(view, globalViewSettings, "left");
      }
    }
  };

  const handleGoNextPage = () => {
    const isScrolledMode = globalViewSettings?.scrolled;
    if (view) {
      if (isScrolledMode) {
        view?.renderer.nextSection?.();
      } else {
        viewPagination(view, globalViewSettings, "right");
      }
    }
  };

  const isVertical = globalViewSettings?.vertical;
  const isScrolledMode = globalViewSettings?.scrolled;
  const pageinfo = progress?.pageinfo;

  const pageInfo =
    pageinfo && pageinfo.current >= 0 && pageinfo.total > 0
      ? isVertical
        ? `${pageinfo.current + 1} · ${pageinfo.total}`
        : `第 ${pageinfo.current + 1} / ${pageinfo.total} 页`
      : "";

  return (
    <div
      className="footer-bar pointer-events-auto flex h-11 w-full items-center px-2 transition-all duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex w-full items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className={`size-11 rounded-full transition-opacity duration-300 ${
            showControls ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={handleGoPrevPage}
          title={isScrolledMode ? "上一章" : "上一页"}
        >
          <ChevronLeft className="size-5" />
        </Button>

        <div className="z-50 flex justify-center">
          <span className="text-center text-sm">{pageInfo}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={`size-11 rounded-full transition-opacity duration-300 ${
            showControls ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={handleGoNextPage}
          title={isScrolledMode ? "下一章" : "下一页"}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </div>
  );
};

export default FooterBar;
