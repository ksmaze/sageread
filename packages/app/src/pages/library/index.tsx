import SettingsDialog from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { useBookUpload } from "@/hooks/use-book-upload";
import { useSafeAreaInsets } from "@/hooks/use-safe-areaInsets";
import { useTheme } from "@/hooks/use-theme";
import { useUICSS } from "@/hooks/use-ui-css";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLibraryStore } from "@/store/library-store";
import clsx from "clsx";
import { Plus, Upload as UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import BookItem from "./components/book-item";
import CreateTagDialog from "./components/create-tag-dialog";
import EditTagDialog from "./components/edit-tag-dialog";
import Upload from "./components/upload";
import { useBooksFilter } from "./hooks/use-books-filter";
import { useBooksOperations } from "./hooks/use-books-operations";
import { useLibraryUI } from "./hooks/use-library-ui";
import { useTagsManagement } from "./hooks/use-tags-management";
import { useTagsOperations } from "./hooks/use-tags-operations";

export default function NewLibraryPage() {
  const { searchQuery, booksWithStatus, isLoading, refreshBooks } = useLibraryStore();
  const { isSettingsDialogOpen, toggleSettingsDialog } = useAppSettingsStore();
  const insets = useSafeAreaInsets();
  const { isDragOver, isUploading, handleDragOver, handleDragLeave, handleDrop, triggerFileSelect } = useBookUpload();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isInitiating = useRef(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [selectedTagsForDelete, setSelectedTagsForDelete] = useState<string[]>([]);

  // 从URL获取选中的标签
  const selectedTagFromUrl = searchParams.get("tag") || "all";
  const { tags, filteredBooksByTag } = useTagsManagement(booksWithStatus, selectedTagFromUrl);
  const { filteredBooks } = useBooksFilter(filteredBooksByTag, searchQuery);
  const { viewMode, showNewTagDialog, handleCloseNewTagDialog } = useLibraryUI();
  const { handleBookDelete, handleBookUpdate } = useBooksOperations(refreshBooks);

  useTheme({ systemUIVisible: true, appThemeColor: "base-200" });
  useUICSS();

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const initLibrary = async () => {
      try {
        await refreshBooks();
        setLibraryLoaded(true);
      } catch (error) {
        console.error("Error initializing library:", error);
        setLibraryLoaded(true);
      }
    };

    initLibrary();
    return () => {
      isInitiating.current = false;
    };
  }, [refreshBooks]);

  const clearSelectedTags = useCallback(() => {
    setSelectedTagsForDelete([]);
  }, []);

  const { handleEditTagCancel, editingTag } = useTagsOperations({
    booksWithStatus,
    handleBookUpdate,
    refreshBooks,
    selectedTag: selectedTagFromUrl,
    handleTagSelect: (tagId: string) => {
      if (tagId === "all") {
        navigate("/");
      } else {
        navigate(`/?tag=${tagId}`);
      }
    },
    selectedTagsForDelete,
    tags,
    clearSelectedTags,
  });

  const visibleBooks = filteredBooks;
  const hasBooks = libraryLoaded && visibleBooks.length > 0;
  const hasLibraryBooks = libraryLoaded && booksWithStatus.length > 0;

  if (!insets || !libraryLoaded) {
    return null;
  }

  return (
    <div
      className={clsx(
        "flex h-dvh w-full bg-transparent transition-all duration-200",
        isDragOver && "bg-neutral-50 dark:bg-neutral-900/20",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50/80 backdrop-blur-sm dark:bg-neutral-900/40">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-neutral-400 border-dashed bg-white/90 px-30 py-16 shadow-lg dark:border-neutral-500 dark:bg-neutral-800/90">
            <UploadIcon className="h-12 w-12 text-neutral-600 dark:text-neutral-400" />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">拖放文件以上传</h3>
              <p className="text-neutral-600 text-sm dark:text-neutral-400">松开以上传您的书籍</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 h-[calc(100vh-60px)] flex-1 flex-col">
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 px-2 pt-2 sm:px-3 sm:pt-3">
          <h3 className="min-w-0 truncate font-bold text-xl sm:text-2xl md:text-3xl dark:border-neutral-700">
            {selectedTagFromUrl === "all"
              ? "我的图书"
              : tags.find((t) => t.id === selectedTagFromUrl)?.name || "我的图书"}
          </h3>
          <Button onClick={triggerFileSelect} disabled={isUploading} variant="soft" size="sm">
            {isUploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white" />
                上传中...
              </>
            ) : (
              <>
                <Plus size={16} />
                添加书籍
              </>
            )}
          </Button>
        </div>

        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <Spinner loading />
          </div>
        )}

        {hasBooks ? (
          <div className="flex-1 overflow-y-auto p-2 pb-8 sm:p-3">
            <div className="mx-auto">
              {searchQuery.trim() && (
                <div className="mb-4 text-base-content/70 text-sm">
                  找到 {visibleBooks.length} 本书籍，搜索词：'{searchQuery}'
                </div>
              )}

              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 sm:grid-cols-4 sm:gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8">
                  {visibleBooks.map((book) => (
                    <BookItem
                      key={book.id}
                      book={book}
                      viewMode={viewMode}
                      onDelete={handleBookDelete}
                      onUpdate={handleBookUpdate}
                      onRefresh={refreshBooks}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleBooks.map((book) => (
                    <BookItem
                      key={book.id}
                      book={book}
                      viewMode={viewMode}
                      onDelete={handleBookDelete}
                      onUpdate={handleBookUpdate}
                      onRefresh={refreshBooks}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : hasLibraryBooks && searchQuery.trim() ? (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center p-4 px-2 text-center sm:p-8">
            <div className="text-base-content/50 text-lg">没有找到 '{searchQuery}' 相关的书籍</div>
            <div className="mt-2 text-base-content/40 text-sm">尝试使用不同的关键词搜索</div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 px-2">
            <Upload />
          </div>
        )}
      </div>

      <CreateTagDialog
        isOpen={showNewTagDialog}
        onClose={handleCloseNewTagDialog}
        books={booksWithStatus}
        selectedTag={selectedTagFromUrl}
        filteredBooksByTag={filteredBooksByTag}
        onBookUpdate={handleBookUpdate}
        onRefreshBooks={refreshBooks}
      />

      <EditTagDialog
        isOpen={!!editingTag}
        onClose={handleEditTagCancel}
        tag={editingTag}
        books={booksWithStatus}
        onBookUpdate={handleBookUpdate}
        onRefreshBooks={refreshBooks}
      />

      <SettingsDialog open={isSettingsDialogOpen} onOpenChange={toggleSettingsDialog} />
    </div>
  );
}
