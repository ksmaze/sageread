import { useEffect, useRef } from "react";
import { transformContent } from "@/services/transform-service";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { eventDispatcher } from "@/utils/event";
import { getOSPlatform } from "@/utils/misc";
import { getTextFromRange, type TextSelection } from "@/utils/sel";
import { useReaderStore } from "../components/reader-provider";

export interface NativeTouchEventType {
  type: "touchstart" | "touchend" | "touchcancel";
  pointerId: number;
  x: number;
  y: number;
  pressure: number;
  pointerCount: number;
  timestamp: number;
}

export const listenToNativeTouchEvents = () => {
  window.onNativeTouch = (event: NativeTouchEventType) => {
    void eventDispatcher.dispatch("native-touch", event);
  };
};

export const useTextSelector = (
  bookId: string,
  setSelection: React.Dispatch<React.SetStateAction<TextSelection | null>>,
  handleDismissPopup: () => void,
) => {
  const { settings } = useAppSettingsStore();
  const globalViewSettings = settings.globalViewSettings;
  const view = useReaderStore((state) => state.view);
  const bookData = useReaderStore((state) => state.bookData);
  const primaryLang =
    typeof bookData?.bookDoc?.metadata.language === "string"
      ? bookData.bookDoc.metadata.language
      : bookData?.bookDoc?.metadata.language?.[0] || "en";
  const osPlatform = getOSPlatform();

  const isPopupVisible = useRef(false);
  const popupShowTime = useRef<number>(0);
  const lastPointerType = useRef<string | null>(null);
  const POPUP_DEBOUNCE_TIME = 300;

  const isValidSelection = (sel: Selection | null) => {
    return !!sel && sel.toString().trim().length > 0 && sel.rangeCount > 0;
  };

  const getAnnotationText = async (range: Range) => {
    const content = getTextFromRange(range, (primaryLang as string).startsWith("ja") ? ["rt"] : []);
    if (!globalViewSettings) {
      return content;
    }

    const transformCtx = {
      bookId,
      viewSettings: globalViewSettings,
      content,
      transformers: ["punctuation"],
      reversePunctuationTransform: true,
    };

    return await transformContent(transformCtx);
  };

  const makeSelection = async (sel: Selection, index: number) => {
    const range = sel.getRangeAt(0);
    const annotationText = await getAnnotationText(range);
    const selectionObject = { key: bookId, text: annotationText, range, index };
    setSelection(selectionObject);
  };

  const handleMouseUp = (doc: Document, index: number) => {
    const sel = doc.getSelection() as Selection;

    if (isValidSelection(sel)) {
      void makeSelection(sel, index);
    } else {
      handleDismissPopup();
    }
  };

  const handlePointerUp = (doc: Document, index: number) => {
    const sel = doc.getSelection() as Selection;
    if (isValidSelection(sel)) {
      void makeSelection(sel, index);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    lastPointerType.current = event.pointerType;
  };

  const handleTouchStart = () => {
    lastPointerType.current = "touch";
  };

  const handleTouchEnd = () => {
    lastPointerType.current = "touch";
  };

  const handleSelectionchange = (doc: Document, index: number) => {
    if (osPlatform !== "android") return;

    const sel = doc.getSelection() as Selection;
    if (isValidSelection(sel)) {
      void makeSelection(sel, index);
    }
  };

  const handleContextmenu = (event: Event) => {
    if (["android", "ios"].includes(osPlatform)) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    if (lastPointerType.current === "touch" || lastPointerType.current === "pen") {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    return;
  };

  const handleScroll = () => {
    handleDismissPopup();
  };

  const handleShowPopup = (showPopup: boolean) => {
    isPopupVisible.current = showPopup;
    if (showPopup) {
      popupShowTime.current = Date.now();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional existing hook behavior
  useEffect(() => {
    const handleSingleClick = (): boolean => {
      if (isPopupVisible.current) {
        const timeSincePopupShow = Date.now() - popupShowTime.current;
        if (timeSincePopupShow < POPUP_DEBOUNCE_TIME) {
          return true;
        }

        handleDismissPopup();
        view?.deselect();
        isPopupVisible.current = false;
        return true;
      }
      return false;
    };

    eventDispatcher.onSync("iframe-single-click", handleSingleClick);
    return () => {
      eventDispatcher.offSync("iframe-single-click", handleSingleClick);
    };
  }, []);

  return {
    handleContextmenu,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    handleSelectionchange,
    handleMouseUp,
    handleTouchEnd,
    handleTouchStart,
    handleShowPopup,
  };
};
