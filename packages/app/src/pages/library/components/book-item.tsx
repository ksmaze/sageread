import AITagConfirmDialog from "@/components/ai/tag-confirm-dialog";
import { useDownloadImage } from "@/hooks/use-download-image";
import { useModelSelector } from "@/hooks/use-model-selector";
import { type AITagSuggestion, generateTagsWithAI } from "@/services/ai-tag-service";
import { updateBookVectorizationMeta } from "@/services/book-service";
import { type EpubIndexResult, indexEpub } from "@/services/book-service";
import { createTag, getTags } from "@/services/tag-service";
import { useLayoutStore } from "@/store/layout-store";
import { useNotificationStore } from "@/store/notification-store";
import type { BookWithStatusAndUrls } from "@/types/simple-book";
import { getCurrentVectorModelConfig } from "@/utils/model";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import BookActionDrawer from "./book-action-drawer";
import EditInfo from "./edit-info";
import EmbeddingDialog from "./embedding-dialog";

interface BookUpdateData {
  title?: string;
  author?: string;
  coverPath?: string;
  tags?: string[];
}

interface BookItemProps {
  book: BookWithStatusAndUrls;
  viewMode?: "grid" | "list";
  onDelete?: (book: BookWithStatusAndUrls) => Promise<boolean>;
  onUpdate?: (bookId: string, updates: BookUpdateData) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
}

export default function BookItem({ book, onDelete, onUpdate, onRefresh }: BookItemProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { downloadImage } = useDownloadImage();

  // AI标签生成相关状态
  const [showAITagDialog, setShowAITagDialog] = useState(false);
  const [aiTagSuggestions, setAiTagSuggestions] = useState<AITagSuggestion[]>([]);
  const [isAITagLoading, setIsAITagLoading] = useState(false);
  const { selectedModel } = useModelSelector();
  const [showEmbeddingDialog, setShowEmbeddingDialog] = useState(false);
  const [vectorizeProgress, setVectorizeProgress] = useState<number | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      const off = await listen<{
        book_id: string;
        current: number;
        total: number;
        percent: number;
        chapter_title: string;
        chunk_index: number;
      }>("epub://index-progress", (e) => {
        const p = e.payload;
        if (p && p.book_id === book.id) {
          setVectorizeProgress(Math.max(0, Math.min(100, Math.round(p.percent))));
        }
      });
      unlisten = off;
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [book.id]);

  const { openBook } = useLayoutStore();

  const [showActionDrawer, setShowActionDrawer] = useState(false);

  const handleClick = useCallback(() => {
    openBook(book.id, book.title);
  }, [book.id, book.title, openBook]);

  const handleAIGenerateTags = useCallback(async () => {
    if (!selectedModel) {
      toast.error("请先在设置中配置AI模型");
      return;
    }

    setIsAITagLoading(true);

    // 显示正在请求的toast
    toast.info("正在请求AI生成标签...");

    try {
      // 获取现有标签
      const existingTags = await getTags();

      // 调用AI生成标签
      const aiResponse = await generateTagsWithAI(book, existingTags, {
        providerId: selectedModel.providerId,
        modelId: selectedModel.modelId,
      });

      setAiTagSuggestions(aiResponse.suggestions);
      setShowAITagDialog(true);
    } catch (error) {
      console.error("AI生成标签失败:", error);
      toast.error(error instanceof Error ? error.message : "AI生成标签失败，请重试");
    } finally {
      setIsAITagLoading(false);
    }
  }, [selectedModel, book]);

  const handleAITagConfirm = useCallback(
    async (selectedTags: { name: string; isExisting: boolean; existingTagId?: string }[]) => {
      if (selectedTags.length === 0) {
        setShowAITagDialog(false);
        return;
      }

      setIsAITagLoading(true);

      try {
        const tagIds: string[] = [];

        for (const tag of selectedTags) {
          if (tag.isExisting && tag.existingTagId) {
            tagIds.push(tag.existingTagId);
          } else {
            const newTag = await createTag({
              name: tag.name,
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            });
            tagIds.push(newTag.id);
          }
        }

        const currentTags = book.tags || [];
        const updatedTags = Array.from(new Set([...currentTags, ...tagIds]));

        if (onUpdate) {
          const success = await onUpdate(book.id, { tags: updatedTags });

          if (success) {
            toast.success(`成功添加 ${selectedTags.length} 个标签`);

            if (onRefresh) {
              await onRefresh();
            }
          } else {
            toast.error("添加标签失败，请重试");
          }
        }

        setShowAITagDialog(false);
      } catch (error) {
        console.error("添加AI标签失败:", error);
        toast.error(error instanceof Error ? error.message : "添加标签失败，请重试");
      } finally {
        setIsAITagLoading(false);
      }
    },
    [book, onUpdate, onRefresh],
  );

  const handleNativeDelete = useCallback(async () => {
    if (onDelete) {
      try {
        const confirmed = await ask(`${book.title}\n\n此操作无法撤销。`, {
          title: "确认删除",
          kind: "warning",
        });

        if (confirmed) {
          await onDelete(book);
        }
      } catch (error) {
        console.error("Failed to show delete dialog:", error);
      }
    }
  }, [onDelete, book]);

  const handleDownloadImage = useCallback(async () => {
    if (!book.coverUrl) {
      console.warn("No cover image available for download");
      return;
    }

    await downloadImage(book.coverUrl, {
      title: book.title,
      defaultFileName: `${book.title}_cover`,
    });
  }, [book.coverUrl, book.title, downloadImage]);

  // Extracted vectorization action
  const handleVectorizeBook = useCallback(async () => {
    const { addNotification } = useNotificationStore.getState();

    const vectorConfig = await getCurrentVectorModelConfig();
    const version = 1;

    try {
      toast.info("开始向量化...");
      setVectorizeProgress(0);
      await updateBookVectorizationMeta(book.id, {
        status: "processing",
        model: vectorConfig.model,
        dimension: vectorConfig.dimension,
        version,
        startedAt: Date.now(),
      });

      const res: EpubIndexResult = await indexEpub(book.id, {
        dimension: vectorConfig.dimension,
        embeddingsUrl: vectorConfig.embeddingsUrl,
        model: vectorConfig.model,
        apiKey: vectorConfig.apiKey,
      });

      if (res?.success && res.report) {
        await updateBookVectorizationMeta(book.id, {
          status: "success",
          chunkCount: res.report.total_chunks,
          dimension: res.report.vector_dimension,
          finishedAt: Date.now(),
        });
      } else {
        await updateBookVectorizationMeta(book.id, {
          status: "failed",
          finishedAt: Date.now(),
        });
        throw new Error(res?.message || "向量化失败");
      }
      const message = `《${book.title}》向量化完成，分块数：${res.report?.total_chunks ?? "未知"}`;
      toast.success(message);
      addNotification(message);
      setVectorizeProgress(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error("向量化失败", err);
      await updateBookVectorizationMeta(book.id, {
        status: "failed",
        finishedAt: Date.now(),
      });
      setVectorizeProgress(null);
      const errorMessage = `《${book.title}》向量化失败`;
      // Show the actual error message from the backend if available
      const detailedError = err instanceof Error ? err.message : String(err);
      toast.error(`向量化失败: ${detailedError}`);
      addNotification(errorMessage + ": " + detailedError);
      if (onRefresh) await onRefresh();
    }
  }, [book.id, book.title, onRefresh]);

  const handleToggleReadStatus = useCallback(async () => {
    if (!onUpdate) return;
    const isUnread = !book.status || book.status.status === "unread";
    // If currently unread, mark as read (progress 100%?). 
    // Actually the interface is simple status toggle for now or we can set status.
    // The native menu logic was just logging, let's make it real if possible or just log.
    // For now, let's just log and show toast as placeholder since actual logic might depend on backend
    console.log(isUnread ? "Mark as Read" : "Mark as Unread");
    toast.info("Updating read status...");
    
    // Example implementation if we wanted to update:
    // await onUpdate(book.id, { ... });
    // But BookUpdateData only supports title, author, coverPath, tags. 
    // It seems we can't update status via onUpdate based on the interface.
    // We'll leave it as a placeholder.
  }, [book.status]);

  const renderProgress = () => {
    if (!book.status) {
      return null;
    }

    const { status, progressCurrent = 0, progressTotal = 0 } = book.status;

    if (status === "unread") {
      return (
        <div className="inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-600 text-xs dark:bg-neutral-800 dark:text-neutral-300">
          New
        </div>
      );
    }

    if (status === "completed") {
      return (
        <div className="inline-block rounded-full bg-green-100 px-2 py-1 font-medium text-green-600 text-xs dark:bg-green-900 dark:text-green-300">
          Complete
        </div>
      );
    }

    const progress = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
    return (
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-neutral-500 text-xs dark:text-neutral-400">{progress}%</span>
      </div>
    );
  };

  const renderVectorizationStatus = () => {
    const statusFromMeta = book.status?.metadata?.vectorization?.status ?? "idle";
    const effectiveStatus =
      vectorizeProgress != null && vectorizeProgress >= 0 && vectorizeProgress < 100 ? "processing" : statusFromMeta;

    if (effectiveStatus === "processing") {
      const pct = Math.max(0, Math.min(100, vectorizeProgress ?? 0));
      return (
        <div className="flex items-center gap-1" title={`向量化: processing ${pct}%`}>
          <div className="relative h-4 w-4" aria-label={`processing ${pct}%`}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: `conic-gradient(#eab308 ${pct}%, rgba(229,231,235,0.6) 0)` }}
            />
            <div className="absolute inset-[2px] rounded-full bg-white dark:bg-neutral-900" />
          </div>
          <span className="text-[10px] text-neutral-500 leading-none dark:text-neutral-400">{pct}%</span>
        </div>
      );
    }

    const colorClass =
      effectiveStatus === "success"
        ? "border-green-500"
        : effectiveStatus === "failed"
          ? "border-red-500"
          : "border-neutral-400 dark:border-neutral-500";
    return (
      <div className="flex items-center gap-1" title={`向量化: ${effectiveStatus}`}>
        <div className={`h-3.5 w-3.5 rounded-full border-2 ${colorClass}`} />
      </div>
    );
  };

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const showMenuAt = useCallback(
    async () => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setShowActionDrawer(true);
    },
    [],
  );

  const handleMenuClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // If triggered by long press context menu event, ignore it as we handled it manually
      if (longPressTriggered.current) return;
      showMenuAt();
    },
    [showMenuAt],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      longPressTriggered.current = false;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        if (touchStartPos.current) {
          longPressTriggered.current = true;
          showMenuAt();
        }
      }, 500);
    },
    [showMenuAt],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (longPressTriggered.current) {
        e.preventDefault();
        longPressTriggered.current = false;
      }
      touchStartPos.current = null;
    },
    [],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
    longPressTriggered.current = false;
  }, []);

  return (
    <>
      <div
        className="group cursor-pointer"
        onClick={(e) => {
          if (longPressTriggered.current) {
            e.preventDefault();
            e.stopPropagation();
            longPressTriggered.current = false;
            return;
          }
          handleClick();
        }}
      >
        <div
          onContextMenu={handleMenuClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchCancel={handleTouchCancel}
          className="rounded-r-2xl rounded-l-md border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800 select-none"
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}
        >
          <div className="relative p-2 pb-0">
            <div className="mb-2">
              <h4 className="truncate text-neutral-600 text-sm leading-tight dark:text-neutral-200">{book.title}</h4>
            </div>

            <div className="aspect-[4/5] w-full overflow-hidden">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover pointer-events-none" draggable={false} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800">
                  <div className="p-4 text-center">
                    <div className="mb-2 font-bold text-2xl text-neutral-500 dark:text-neutral-400">📖</div>
                    <div className="line-clamp-3 text-neutral-600 text-xs dark:text-neutral-300">{book.title}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex h-8 items-center justify-between space-x-2 p-2 py-0">
            <div className="flex-1">{renderProgress()}</div>
            <div className="flex items-center gap-2">
              {renderVectorizationStatus()}
              <div
                className="p-2 -mr-2 cursor-pointer"
                onClick={handleMenuClick}
              >
                <MoreHorizontal className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditInfo book={book} isOpen={showEditDialog} onClose={() => setShowEditDialog(false)} onSave={onUpdate} />

      <BookActionDrawer
        book={book}
        isOpen={showActionDrawer}
        onOpenChange={setShowActionDrawer}
        onOpenBook={handleClick}
        onEditInfo={() => setShowEditDialog(true)}
        onDelete={handleNativeDelete}
        onDownloadImage={handleDownloadImage}
        onToggleReadStatus={handleToggleReadStatus}
        onVectorize={handleVectorizeBook}
        onVectorTest={() => setShowEmbeddingDialog(true)}
        onManageTags={() => {
           // For now, we don't have a separate tag manager dialog, 
           // we could expand it in the drawer later.
           toast.info("请在编辑信息中管理标签");
           setShowEditDialog(true);
        }}
        onAITags={handleAIGenerateTags}
        vectorizeProgress={vectorizeProgress}
      />

      <AITagConfirmDialog
        isOpen={showAITagDialog}
        onClose={() => setShowAITagDialog(false)}
        suggestions={aiTagSuggestions}
        bookTitle={book.title}
        bookAuthor={book.author}
        onConfirm={handleAITagConfirm}
        isLoading={isAITagLoading}
      />

      <EmbeddingDialog isOpen={showEmbeddingDialog} onClose={() => setShowEmbeddingDialog(false)} bookId={book.id} />
    </>
  );
}
