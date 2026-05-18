import { useNotepad } from "@/components/notepad/hooks";
import { createBookNote, deleteBookNote, updateBookNote } from "@/services/book-note-service";
import { iframeService } from "@/services/iframe-service";
import { getNoteByBookLocation, getNoteById } from "@/services/note-service";
import { useAppSettingsStore } from "@/store/app-settings-store";
import type { HighlightColor, HighlightStyle } from "@/types/book";
import type { BookMeta, Note, UpdateNoteData } from "@/types/note";
import type { ReaderNoteMarker } from "@/types/view";
import { type Position, type TextSelection, getPopupPosition, getPosition } from "@/utils/sel";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useReaderStore, useReaderStoreApi } from "../components/reader-provider";
import { findSourceBoundNote, mergeUpdatedActiveNote } from "./reader-note-state";
import { isAnnotationVisibleAtProgress } from "./reader-annotation-visibility";

function getContextByRange(range: Range, win = 30) {
  const container = range.commonAncestorContainer;
  const el =
    (container.nodeType === Node.ELEMENT_NODE ? (container as Element) : (container.parentElement as Element)).closest(
      "p,li,div,section,article,blockquote,td",
    ) || document.body;

  const blockText = el.textContent || "";
  const highlight = range.toString();
  const i = blockText.indexOf(highlight);
  if (i < 0) return { before: "", highlight, after: "" };

  const s = Math.max(0, i - win);
  const e = Math.min(blockText.length, i + highlight.length + win);
  const squash = (s: string) => s.replace(/\s+/g, " ");
  return {
    before: squash(blockText.slice(s, i)),
    highlight,
    after: squash(blockText.slice(i + highlight.length, e)),
  };
}

interface UseAnnotatorProps {
  bookId: string;
}

function toReaderNoteMarker(note: Note): ReaderNoteMarker | null {
  if (!note.cfi) return null;

  return {
    id: note.id,
    cfi: note.cfi,
    value: note.cfi,
    overlayKey: `note:${note.id}`,
    markerType: "note",
    noteId: note.id,
  };
}

export const useAnnotator = ({ bookId }: UseAnnotatorProps) => {
  const { settings } = useAppSettingsStore();
  const config = useReaderStore((state) => state.config)!;
  const progress = useReaderStore((state) => state.progress)!;
  const view = useReaderStore((state) => state.view);
  const bookData = useReaderStore((state) => state.bookData);
  const store = useReaderStoreApi();
  const { handleCreateNote, handleDeleteNote, handleUpdateNote: updateNote, notesData } = useNotepad({ bookId });
  const queryClient = useQueryClient();
  const globalViewSettings = settings.globalViewSettings;
  const currentNoteMarkersRef = useRef<ReaderNoteMarker[]>([]);

  // 状态管理
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showAnnotPopup, setShowAnnotPopup] = useState(false);
  const [showAskAIPopup, setShowAskAIPopup] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [annotPopupPosition, setAnnotPopupPosition] = useState<Position>();
  const [askAIPopupPosition, setAskAIPopupPosition] = useState<Position>();
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  const [selectedStyle, setSelectedStyle] = useState<HighlightStyle>(settings.globalReadSettings.highlightStyle);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(
    settings.globalReadSettings.highlightStyles[selectedStyle],
  );

  const popupPadding = 10;
  const annotPopupWidth = Math.min(globalViewSettings?.vertical ? 320 : 280, window.innerWidth - 2 * popupPadding);
  const annotPopupHeight = 36;
  const sourceBoundNotes = useMemo(
    () => notesData?.pages.flatMap((page) => page.data).filter((note) => Boolean(note.cfi)) ?? [],
    [notesData],
  );

  // Popup 相关函数
  const handleDismissPopup = useCallback(() => {
    setSelection(null);
    setShowAnnotPopup(false);
    setShowAskAIPopup(false);
  }, []);

  const handleDismissPopupAndSelection = useCallback(() => {
    handleDismissPopup();
    view?.deselect();
  }, [handleDismissPopup, view]);

  // 业务逻辑函数
  const handleCopy = useCallback(() => {
    if (!selection || !selection.text) return;
    if (selection) navigator.clipboard?.writeText(selection.text);
    toast.success("Copy success!");
    handleDismissPopupAndSelection();
  }, [selection, handleDismissPopupAndSelection]);

  const handleHighlight = useCallback(
    async (update = false) => {
      if (!selection || !selection.text) return;
      setHighlightOptionsVisible(true);
      const { booknotes: annotations = [] } = config;
      const cfi = view?.getCFI(selection.index, selection.range);
      if (!cfi) return;

      const style = settings.globalReadSettings.highlightStyle;
      const color = settings.globalReadSettings.highlightStyles[style];

      const existingAnnotation = annotations.find(
        (annotation) => annotation.cfi === cfi && annotation.type === "annotation" && !annotation.deletedAt,
      );

      try {
        if (existingAnnotation) {
          if (update) {
            const updatedAnnotation = await updateBookNote(existingAnnotation.id, {
              style,
              color,
              text: selection.text,
              note: existingAnnotation.note,
            });

            const updatedAnnotations = annotations.map((ann) =>
              ann.id === existingAnnotation.id ? updatedAnnotation : ann,
            );
            const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);
            void view?.addAnnotation(updatedAnnotation, true)?.catch((error) => {
              console.warn("[useAnnotator] Failed to remove updated highlight before redraw:", {
                bookId,
                cfi: updatedAnnotation.cfi,
                error,
              });
            });
            void view?.addAnnotation(updatedAnnotation)?.catch((error) => {
              console.warn("[useAnnotator] Failed to redraw updated highlight:", {
                bookId,
                cfi: updatedAnnotation.cfi,
                error,
              });
            });

            if (updatedConfig) {
              await store.getState().saveConfig(updatedConfig);
            }
            queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
          } else {
            await deleteBookNote(existingAnnotation.id);
            const updatedAnnotations = annotations.filter((ann) => ann.id !== existingAnnotation.id);
            const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);

            void view?.addAnnotation(existingAnnotation, true)?.catch((error) => {
              console.warn("[useAnnotator] Failed to remove deleted highlight:", {
                bookId,
                cfi: existingAnnotation.cfi,
                error,
              });
            });

            setShowAnnotPopup(false);

            if (updatedConfig) {
              await store.getState().saveConfig(updatedConfig);
            }

            queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
          }
        } else {
          const ctx = getContextByRange(selection.range, 50);
          const newAnnotation = await createBookNote({
            bookId,
            type: "annotation",
            cfi,
            style,
            color,
            text: selection.text,
            note: "",
            context: {
              before: ctx.before,
              after: ctx.after,
            },
          });

          const updatedAnnotations = [...annotations, newAnnotation];
          const updatedConfig = store.getState().updateBooknotes(updatedAnnotations);

          void view?.addAnnotation(newAnnotation)?.catch((error) => {
            console.warn("[useAnnotator] Failed to draw new highlight:", {
              bookId,
              cfi: newAnnotation.cfi,
              error,
            });
          });
          setSelection({ ...selection, annotated: true });

          if (updatedConfig) {
            await store.getState().saveConfig(updatedConfig);
          }

          queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
        }
      } catch (error) {
        console.error("Failed to handle highlight:", error);
        toast.error("Failed to save annotation");
      }
    },
    [selection, config, view, settings, bookId, store, queryClient],
  );

  const addNote = useCallback(async () => {
    if (!selection || !selection.text) return;

    try {
      if (!bookData?.book) {
        toast.error("无法获取书籍信息");
        return;
      }

      const cfi = view?.getCFI(selection.index, selection.range);
      if (!cfi) {
        toast.error("无法定位笔记位置");
        return;
      }

      const existingNote = await getNoteByBookLocation(bookId, cfi);
      if (existingNote) {
        handleDismissPopupAndSelection();
        setActiveNote(existingNote);
        toast.info("已打开现有笔记");
        return;
      }

      const ctx = getContextByRange(selection.range, 50);
      const sourceText = selection.text.trim();

      const bookMeta: BookMeta = {
        title: bookData.book.title,
        author: bookData.book.author,
      };

      const newNote = await handleCreateNote({
        bookId,
        bookMeta,
        title: sourceText,
        content: "",
        cfi,
        sourceText,
        contextBefore: ctx.before,
        contextAfter: ctx.after,
      });

      const marker = toReaderNoteMarker(newNote);
      if (marker) {
        void view?.addAnnotation(marker)?.catch((error) => {
          console.warn("[useAnnotator] Failed to draw new note marker:", {
            bookId,
            cfi: marker.cfi,
            error,
          });
        });
      }
      handleDismissPopupAndSelection();
    } catch (error) {
      toast.error("创建笔记失败");
    }
  }, [selection, bookData, view, bookId, handleCreateNote, handleDismissPopupAndSelection]);

  const handleExplain = useCallback(() => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    iframeService.sendExplainTextRequest(selection.text, "explain", bookId);
  }, [selection, bookId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleAskAI = useCallback(() => {
    if (!selection || !selection.text) return;

    setShowAnnotPopup(false);
    setShowAskAIPopup(false);

    // Calculate position for AskAI popup
    const gridFrame = document.querySelector(`#gridcell-${bookId}`);
    if (!gridFrame) return;
    const rect = gridFrame.getBoundingClientRect();
    const triangPos = getPosition(selection.range, rect, popupPadding, globalViewSettings?.vertical);

    // Calculate AskAI popup position
    const askAIPopupWidth = 320;
    const askAIPopupHeight = 120;
    const askAIPopupPos = getPopupPosition(
      triangPos,
      rect,
      globalViewSettings?.vertical ? askAIPopupHeight : askAIPopupWidth,
      globalViewSettings?.vertical ? askAIPopupWidth : askAIPopupHeight,
      popupPadding,
    );

    if (triangPos.point.x === 0 || triangPos.point.y === 0) return;
    setAskAIPopupPosition(askAIPopupPos);

    setTimeout(() => {
      setShowAskAIPopup(true);
    }, 0);
  }, [selection, bookId, globalViewSettings, popupPadding]);

  const handleCloseAskAI = useCallback(() => {
    setShowAskAIPopup(false);
    view?.deselect();
  }, [view]);

  const handleUpdateNote = useCallback(
    async (data: UpdateNoteData) => {
      const updatedNote = await updateNote(data);
      setActiveNote((current) => mergeUpdatedActiveNote(current, updatedNote));
      return updatedNote;
    },
    [updateNote],
  );

  const openSourceBoundNote = useCallback(
    async (noteId: string) => {
      try {
        const note = await findSourceBoundNote(noteId, sourceBoundNotes, getNoteById);
        if (note) {
          setActiveNote(note);
        } else {
          toast.error("笔记不存在");
        }
      } catch (error) {
        console.error("Failed to open reader note:", error);
        toast.error("打开笔记失败");
      }
    },
    [sourceBoundNotes],
  );

  const handleSendAIQuery = useCallback(
    (query: string, selectedText: string) => {
      iframeService.sendAskAIRequest(selectedText, query, bookId);
      handleDismissPopupAndSelection();
    },
    [handleDismissPopupAndSelection, bookId],
  );

  // Popup 位置计算
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    setHighlightOptionsVisible(!!selection?.annotated);
    if (selection && selection.text.trim().length > 0 && !showAskAIPopup) {
      const gridFrame = document.querySelector(`#gridcell-${bookId}`);

      if (!gridFrame) {
        return;
      }

      const rect = gridFrame.getBoundingClientRect();
      const triangPos = getPosition(selection.range, rect, popupPadding, globalViewSettings?.vertical);
      const annotPopupPos = getPopupPosition(
        triangPos,
        rect,
        globalViewSettings?.vertical ? annotPopupHeight : annotPopupWidth,
        globalViewSettings?.vertical ? annotPopupWidth : annotPopupHeight,
        popupPadding,
      );

      if (triangPos.point.x === 0 || triangPos.point.y === 0) {
        return;
      }

      setAnnotPopupPosition(annotPopupPos);
      setTrianglePosition(triangPos);
      setShowAnnotPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, bookId, showAskAIPopup]);

  // 加载当前页面的标注
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!progress || !view) return;
    const { booknotes = [] } = config;
    const annotations = booknotes.filter(
      (item) =>
        !item.deletedAt &&
        item.type === "annotation" &&
        item.style &&
        isAnnotationVisibleAtProgress(item.cfi, progress, view),
    );
    for (const annotation of annotations) {
      void view.addAnnotation(annotation).catch((error) => {
        console.warn("[useAnnotator] Failed to restore highlight annotation:", {
          bookId,
          cfi: annotation.cfi,
          error,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, config, view]);

  useEffect(() => {
    for (const marker of currentNoteMarkersRef.current) {
      void view?.addAnnotation(marker, true)?.catch((error) => {
        console.warn("[useAnnotator] Failed to remove previous note marker:", {
          bookId,
          cfi: marker.cfi,
          error,
        });
      });
    }
    currentNoteMarkersRef.current = [];

    if (!progress || !view) return;

    const visibleMarkers = sourceBoundNotes
      .filter((note) => note.cfi && isAnnotationVisibleAtProgress(note.cfi, progress, view))
      .map(toReaderNoteMarker)
      .filter((marker): marker is ReaderNoteMarker => marker !== null);

    currentNoteMarkersRef.current = visibleMarkers;
    for (const marker of visibleMarkers) {
      void view.addAnnotation(marker).catch((error) => {
        console.warn("[useAnnotator] Failed to restore note marker:", {
          bookId,
          cfi: marker.cfi,
          error,
        });
      });
    }
  }, [bookId, progress, sourceBoundNotes, view]);

  return {
    // 状态
    selection,
    setSelection,
    showAnnotPopup,
    showAskAIPopup,
    trianglePosition,
    annotPopupPosition,
    askAIPopupPosition,
    highlightOptionsVisible,
    activeNote,
    setActiveNote,
    sourceBoundNotes,
    selectedStyle,
    setSelectedStyle,
    selectedColor,
    setSelectedColor,
    annotPopupWidth,
    annotPopupHeight,

    // 函数
    handleDismissPopup,
    handleDismissPopupAndSelection,
    handleCopy,
    handleHighlight,
    handleDeleteNote,
    handleUpdateNote,
    openSourceBoundNote,
    addNote,
    handleExplain,
    handleAskAI,
    handleCloseAskAI,
    handleSendAIQuery,
  };
};
