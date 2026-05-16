import { NoteEditorDialog } from "@/components/notepad/note-editor-dialog";
import { HIGHLIGHT_COLOR_HEX } from "@/services/constants";
import { useAppSettingsStore } from "@/store/app-settings-store";
import type { BookNote } from "@/types/book";
import type { ReaderNoteMarker } from "@/types/view";
import { eventDispatcher } from "@/utils/event";
import { getOSPlatform } from "@/utils/misc";
import { Overlayer } from "foliate-js/overlayer.js";
import { NotebookPen } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { FiCopy, FiHelpCircle, FiMessageCircle } from "react-icons/fi";
import { PiHighlighterFill } from "react-icons/pi";
import { RiDeleteBinLine } from "react-icons/ri";
import { useAnnotator } from "../../hooks/use-annotator";
import { useFoliateEvents } from "../../hooks/use-foliate-events";
import { type NativeTouchEventType, listenToNativeTouchEvents, useTextSelector } from "../../hooks/use-text-selector";
import { useReaderStore, useReaderStoreApi } from "../reader-provider";
import AnnotationPopup from "./annotation-popup";
import AskAIPopup from "./ask-ai-popup";

const Annotator: React.FC = () => {
  const { settings } = useAppSettingsStore();
  const store = useReaderStoreApi();

  const bookId = useReaderStore((state) => state.bookId)!;
  const view = useReaderStore((state) => state.view);
  const globalViewSettings = settings.globalViewSettings;
  const osPlatform = getOSPlatform();
  const loadedDocsRef = useRef<Array<{ doc: Document; index: number }>>([]);

  // 使用 use-annotator hook
  const {
    selection,
    setSelection,
    showAnnotPopup,
    showAskAIPopup,
    trianglePosition,
    annotPopupPosition,
    askAIPopupPosition,
    highlightOptionsVisible,
    selectedStyle,
    setSelectedStyle,
    selectedColor,
    setSelectedColor,
    annotPopupWidth,
    annotPopupHeight,
    handleDismissPopup,
    handleCopy,
    handleHighlight,
    addNote,
    handleExplain,
    handleAskAI,
    handleCloseAskAI,
    handleSendAIQuery,
    activeNote,
    setActiveNote,
    handleDeleteNote,
    handleUpdateNote,
    openSourceBoundNote,
  } = useAnnotator({ bookId });

  const {
    handleContextmenu,
    handleMouseUp,
    handlePointerDown,
    handlePointerUp,
    handleScroll,
    handleSelectionchange,
    handleShowPopup,
    handleTouchEnd,
    handleTouchStart,
  } = useTextSelector(bookId, setSelection, handleDismissPopup);

  const onLoad = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;

    loadedDocsRef.current = [...loadedDocsRef.current.filter((entry) => entry.doc !== doc), { doc, index }];

    view?.renderer?.addEventListener("scroll", handleScroll);

    if (detail.doc) {
      detail.doc.addEventListener("contextmenu", handleContextmenu);
      detail.doc.addEventListener("mouseup", () => {
        handleMouseUp(doc, index);
      });
      detail.doc.addEventListener("pointerdown", (pointerEvent: PointerEvent) => {
        handlePointerDown(pointerEvent);
      });
      detail.doc.addEventListener("selectionchange", () => {
        handleSelectionchange(doc, index);
      });
      detail.doc.addEventListener("touchstart", () => {
        handleTouchStart();
      });
      detail.doc.addEventListener("touchend", () => {
        handleTouchEnd();
        handlePointerUp(doc, index);
      });
    }
  };

  const onDrawAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { draw, annotation, doc, range } = detail;
    if ((annotation as ReaderNoteMarker).markerType === "note") {
      draw(Overlayer.noteMarker, { color: "#2563eb", hitElementOnly: true });
      return;
    }

    const { style, color } = annotation as BookNote;
    const hexColor = color ? HIGHLIGHT_COLOR_HEX[color] : color;
    if (style === "highlight") {
      draw(Overlayer.highlight, { color: hexColor });
    } else if (["underline", "squiggly"].includes(style as string)) {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode, lineHeight, fontSize } = defaultView.getComputedStyle(el);
      const lineHeightValue =
        Number.parseFloat(lineHeight) || globalViewSettings?.lineHeight! * globalViewSettings?.defaultFontSize!;
      const fontSizeValue = Number.parseFloat(fontSize) || globalViewSettings?.defaultFontSize;
      const strokeWidth = 2;
      const padding = globalViewSettings?.vertical ? (lineHeightValue - fontSizeValue! - strokeWidth) / 2 : strokeWidth;
      draw(Overlayer[style as keyof typeof Overlayer], { writingMode, color: hexColor, padding });
    }
  };

  const onShowAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { value: cfi, index, range } = detail;
    const value = String(cfi);
    if (value.startsWith("note:")) {
      const noteId = value.slice("note:".length);
      void openSourceBoundNote(noteId);
      return;
    }

    const currentConfig = store.getState().config;

    const { booknotes = [] } = currentConfig!;
    const annotations = booknotes.filter((booknote) => booknote.type === "annotation" && !booknote.deletedAt);
    const annotation = annotations.find((annotation) => annotation.cfi === cfi);

    if (!annotation) return;

    const newSelection = { key: bookId, annotated: true, text: annotation.text ?? "", range, index };

    setSelectedStyle(annotation.style!);
    setSelectedColor(annotation.color!);
    setSelection(newSelection);
  };

  useFoliateEvents(view, { onLoad, onDrawAnnotation, onShowAnnotation });

  useEffect(() => {
    if (osPlatform !== "android") {
      return;
    }

    listenToNativeTouchEvents();

    const handleNativeTouch = (event: CustomEvent) => {
      const nativeEvent = event.detail as NativeTouchEventType;

      if (nativeEvent.type === "touchstart") {
        handleTouchStart();
        return;
      }

      if (nativeEvent.type === "touchend") {
        handleTouchEnd();
        for (const { doc, index } of loadedDocsRef.current) {
          handlePointerUp(doc, index);
        }
      }
    };

    eventDispatcher.on("native-touch", handleNativeTouch);

    return () => {
      eventDispatcher.off("native-touch", handleNativeTouch);
      window.onNativeTouch = undefined;
    };
  }, [handlePointerUp, handleTouchEnd, handleTouchStart, osPlatform]);

  // 同步 popup 显示状态到 text selector
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    handleShowPopup(showAnnotPopup || showAskAIPopup);
  }, [showAnnotPopup, showAskAIPopup]);

  const selectionAnnotated = selection?.annotated;
  const buttons = [
    { label: "复制", Icon: FiCopy, onClick: handleCopy },
    { label: "解释", Icon: FiHelpCircle, onClick: handleExplain },
    { label: "询问AI", Icon: FiMessageCircle, onClick: handleAskAI },
    {
      label: undefined,
      Icon: selectionAnnotated ? RiDeleteBinLine : PiHighlighterFill,
      onClick: handleHighlight,
    },
    { label: undefined, Icon: NotebookPen, onClick: addNote },
  ];

  return (
    <div>
      {showAnnotPopup && !showAskAIPopup && trianglePosition && annotPopupPosition && (
        <AnnotationPopup
          dir={globalViewSettings?.rtl ? "rtl" : "ltr"}
          isVertical={globalViewSettings?.vertical ?? false}
          buttons={buttons}
          position={annotPopupPosition}
          trianglePosition={trianglePosition}
          highlightOptionsVisible={highlightOptionsVisible}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          popupWidth={annotPopupWidth}
          popupHeight={annotPopupHeight}
          onHighlight={handleHighlight}
        />
      )}
      {showAskAIPopup && askAIPopupPosition && selection && (
        <AskAIPopup
          style={{
            left: `${askAIPopupPosition.point.x}px`,
            top: `${askAIPopupPosition.point.y + 15}px`,
            width: "320px",
          }}
          selectedText={selection.text}
          onClose={handleCloseAskAI}
          onSendQuery={handleSendAIQuery}
        />
      )}
      <NoteEditorDialog
        note={activeNote}
        open={activeNote !== null}
        onDelete={async (noteId) => {
          const note = activeNote;
          await handleDeleteNote(noteId);
          if (note?.cfi) {
            view?.addAnnotation(
              {
                id: note.id,
                cfi: note.cfi,
                value: note.cfi,
                overlayKey: `note:${note.id}`,
                markerType: "note",
                noteId: note.id,
              },
              true,
            );
          }
        }}
        onOpenChange={(open) => {
          if (!open) setActiveNote(null);
        }}
        onOpenOriginal={(note) => {
          if (note.cfi) view?.goTo(note.cfi);
        }}
        onSave={handleUpdateNote}
      />
    </div>
  );
};

export default Annotator;
