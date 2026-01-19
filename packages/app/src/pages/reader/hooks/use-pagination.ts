import { useAppSettingsStore } from "@/store/app-settings-store";
import type { ViewSettings } from "@/types/book";
import type { FoliateView } from "@/types/view";
import { eventDispatcher } from "@/utils/event";
import { useRef } from "react";
import { useReaderStoreApi } from "../components/reader-provider";

export type ScrollSource = "touch" | "mouse";

export const viewPagination = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
  side: "left" | "right",
) => {
  if (!view || !viewSettings) return;
  const renderer = view.renderer;
  if (renderer.scrolled) {
    if (view.book.dir === "rtl") {
      side = side === "left" ? "right" : "left";
    }
    const { size } = renderer;
    const showHeader = viewSettings.showHeader && viewSettings.showBarsOnScroll;
    const showFooter = viewSettings.showFooter && viewSettings.showBarsOnScroll;
    const scrollingOverlap = viewSettings.scrollingOverlap;
    const distance = size - scrollingOverlap - (showHeader ? 44 : 0) - (showFooter ? 44 : 0);
    return side === "left" ? view.prev(distance) : view.next(distance);
  }
  return side === "left" ? view.goLeft() : view.goRight();
};

export const usePagination = (bookId: string, containerRef: React.RefObject<HTMLDivElement>) => {
  const { settings } = useAppSettingsStore();
  const store = useReaderStoreApi();
  const globalViewSettings = settings.globalViewSettings!;

  const view = store.getState().view;

  const touchStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startAt: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startAt: 0,
  });

  const handlePageFlip = async (msg: MessageEvent | CustomEvent | React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookId === bookId) {
        if (msg.data.type === "iframe-touchstart") {
          const touch = msg.data.targetTouches?.[0];
          if (!touch) return;
          touchStateRef.current = {
            active: true,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startAt: Date.now(),
          };
          return;
        }

        if (msg.data.type === "iframe-touchmove") {
          const touch = msg.data.targetTouches?.[0];
          if (!touch || !touchStateRef.current.active) return;
          touchStateRef.current.lastX = touch.clientX;
          touchStateRef.current.lastY = touch.clientY;
          return;
        }

        if (msg.data.type === "iframe-touchend") {
          if (!touchStateRef.current.active) return;

          const { startX, startY, lastX, lastY, startAt } = touchStateRef.current;
          touchStateRef.current.active = false;

          const dx = lastX - startX;
          const dy = lastY - startY;
          const dt = Date.now() - startAt;

          const minSwipeDistancePx = 60;
          const maxSwipeDurationMs = 700;
          const isHorizontalSwipe = Math.abs(dx) >= minSwipeDistancePx && Math.abs(dx) > Math.abs(dy) * 1.5;

          if (!isHorizontalSwipe || dt > maxSwipeDurationMs) {
            return;
          }

          const isSwipeLeft = dx < 0;
          const swap = Boolean(globalViewSettings.swapClickArea);

          if (globalViewSettings.scrolled) {
            if (!view) return;
            if (isSwipeLeft) {
              (swap ? view.renderer.prevSection : view.renderer.nextSection)?.();
            } else {
              (swap ? view.renderer.nextSection : view.renderer.prevSection)?.();
            }
            return;
          }

          if (isSwipeLeft) {
            viewPagination(view, globalViewSettings, swap ? "left" : "right");
          } else {
            viewPagination(view, globalViewSettings, swap ? "right" : "left");
          }
          return;
        }

        if (msg.data.type === "iframe-single-click") {
          const viewElement = containerRef.current;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            const windowStartX = window.screenX;
            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;
            const consumed = eventDispatcher.dispatchSync("iframe-single-click");
            if (!consumed) {
              const centerStartX = viewStartX + viewRect.width * 0.375;
              const centerEndX = viewStartX + viewRect.width * 0.625;
              if (globalViewSettings.disableClick! || (screenX >= centerStartX && screenX <= centerEndX)) {
                // Center area - no action needed
              } else {
                if (!globalViewSettings.disableClick! && screenX >= viewCenterX) {
                  if (globalViewSettings.swapClickArea) {
                    viewPagination(view, globalViewSettings, "left");
                  } else {
                    viewPagination(view, globalViewSettings, "right");
                  }
                } else if (!globalViewSettings.disableClick! && screenX < viewCenterX) {
                  if (globalViewSettings.swapClickArea) {
                    viewPagination(view, globalViewSettings, "right");
                  } else {
                    viewPagination(view, globalViewSettings, "left");
                  }
                }
              }
            }
          }
        } else if (msg.data.type === "iframe-wheel" && !globalViewSettings.scrolled) {
          // The wheel event is handled by the iframe itself in scrolled mode.
          const { deltaY } = msg.data;
          if (deltaY > 0) {
            view?.next(1);
          } else if (deltaY < 0) {
            view?.prev(1);
          }
        } else if (msg.data.type === "iframe-mouseup") {
          if (msg.data.button === 3) {
            view?.history.back();
          } else if (msg.data.button === 4) {
            view?.history.forward();
          }
        }
      }
    } else if (msg instanceof CustomEvent) {
      const { keyName } = msg.detail;
      if (globalViewSettings?.volumeKeysToFlip) {
        if (keyName === "VolumeUp") {
          viewPagination(view, globalViewSettings, "left");
        } else if (keyName === "VolumeDown") {
          viewPagination(view, globalViewSettings, "right");
        }
      }
    } else {
      if (msg.type === "click") {
        const { clientX } = msg;
        const width = window.innerWidth;
        const leftThreshold = width * 0.5;
        const rightThreshold = width * 0.5;
        if (clientX < leftThreshold) {
          viewPagination(view, globalViewSettings, "left");
        } else if (clientX > rightThreshold) {
          viewPagination(view, globalViewSettings, "right");
        }
      }
    }
  };

  const handleContinuousScroll = (mode: ScrollSource, scrollDelta: number, threshold: number) => {
    const renderer = view?.renderer;
    if (renderer && globalViewSettings.scrolled && globalViewSettings.continuousScroll) {
      const doScroll = () => {
        // may have overscroll where the start is greater than 0
        if (renderer.start <= scrollDelta && scrollDelta > threshold) {
          setTimeout(() => {
            view?.prev(renderer.start + 1);
          }, 100);
          // sometimes viewSize has subpixel value that the end never reaches
        } else if (Math.ceil(renderer.end) - scrollDelta >= renderer.viewSize && scrollDelta < -threshold) {
          setTimeout(() => {
            view?.next(renderer.viewSize - Math.floor(renderer.end) + 1);
          }, 100);
        }
      };
      if (mode === "mouse") {
        // we can always get mouse wheel events
        doScroll();
      } else if (mode === "touch") {
        // when the document height is less than the viewport height, we can't get the relocate event
        if (renderer.size >= renderer.viewSize) {
          doScroll();
        } else {
          // scroll after the relocate event
          renderer.addEventListener("relocate", () => doScroll(), { once: true });
        }
      }
    }
  };

  return {
    handlePageFlip,
    handleContinuousScroll,
  };
};
