import { appDataDir } from "@tauri-apps/api/path";
import { createStore } from "zustand";
import type { BookDoc } from "@/lib/document";
import { DocumentLoader } from "@/lib/document";
import { loadBookConfig, saveBookConfig } from "@/services/app-service";
import { getBookFileName, getBookMimeType } from "@/services/book-format";
import { getBookWithStatusById } from "@/services/book-service";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useLibraryStore } from "@/store/library-store";
import type { Book, BookConfig, BookNote, BookProgress } from "@/types/book";
import type { SessionStats } from "@/types/reading-session";
import type { Thread } from "@/types/thread";
import type { FoliateView } from "@/types/view";
import {
  describeReaderNavigationError,
  describeReaderNavigationTarget,
  readerNavigationError,
  readerNavigationInfo,
} from "@/utils/reader-navigation-debug";
import { updateToc } from "@/utils/toc";
import { clearReaderNavigationTarget, type ReaderNavigationTarget } from "./reader-navigation";

export type { ReaderNavigationTarget } from "./reader-navigation";

export interface BookDataState {
  id: string;
  book: Book | null;
  file: File | null;
  config: BookConfig | null;
  bookDoc: BookDoc | null;
}

export type OpenDropdown = "toc" | "search" | "settings" | null;

export interface ReaderState {
  bookId: string;
  config: BookConfig | null;
  bookData: BookDataState | null;
  view: FoliateView | null;
  location: string | null;
  pendingNavigationTarget: ReaderNavigationTarget | null;
  isViewerReady: boolean;
  isLoading: boolean;
  error: string | null;
  progress: BookProgress | undefined;
  sessionStats: SessionStats | null;
  isSessionInitialized: boolean;
  activeContext: string | undefined;
  openDropdown: OpenDropdown;
  currentThread: Thread | null;

  initBook: () => Promise<void>;
  setConfig: (config: BookConfig) => void;
  setActiveContext: (context: string | undefined) => void;
  saveConfig: (config: BookConfig) => Promise<void>;
  updateBooknotes: (booknotes: BookNote[]) => BookConfig | undefined;
  setView: (view: FoliateView | null) => void;
  setViewerReady: (ready: boolean) => void;
  requestNavigation: (target: ReaderNavigationTarget) => void;
  clearNavigationTarget: (target: ReaderNavigationTarget) => void;
  setLocation: (location: string) => void;
  setProgress: (progress: BookProgress) => void;
  setSessionStats: (stats: SessionStats | null) => void;
  setSessionInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setOpenDropdown: (dropdown: OpenDropdown) => void;
  setCurrentThread: (thread: Thread | null) => void;
}

export const createReaderStore = (bookId: string, initialNavigationTarget?: ReaderNavigationTarget) => {
  readerNavigationInfo("reader-store.create", {
    bookId,
    initialTarget: describeReaderNavigationTarget(initialNavigationTarget),
  });

  return createStore<ReaderState>((set, get) => ({
    bookId,
    config: null,
    activeContext: undefined,
    bookData: null,
    view: null,
    location: null,
    pendingNavigationTarget: initialNavigationTarget ?? null,
    isViewerReady: false,
    isLoading: false,
    error: null,
    progress: undefined,
    sessionStats: null,
    isSessionInitialized: false,
    openDropdown: null,
    currentThread: null,

    initBook: async () => {
      try {
        readerNavigationInfo("reader-store.init-book.start", { bookId });
        set({ isLoading: true, error: null });

        const { settings } = useAppSettingsStore.getState();

        const simpleBook = await getBookWithStatusById(bookId);
        if (!simpleBook) throw new Error("Book not found");
        if (!simpleBook.filePath) throw new Error("Book file path is missing");

        const fileUrl = simpleBook.fileUrl;
        const baseDir = await appDataDir();

        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch book file: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const filename = getBookFileName(simpleBook.filePath, simpleBook.format);
        const file = new File([arrayBuffer], filename, {
          type: getBookMimeType(simpleBook.format),
        });

        const book = {
          id: simpleBook.id,
          filePath: simpleBook.filePath,
          format: simpleBook.format,
          title: simpleBook.title,
          author: simpleBook.author,
          createdAt: simpleBook.createdAt,
          updatedAt: simpleBook.updatedAt,
          fileSize: simpleBook.fileSize,
          language: simpleBook.language,
          baseDir: `${baseDir}/books/${bookId}`,
        };

        const config = await loadBookConfig(bookId, settings);
        const { book: bookDoc } = await new DocumentLoader(file).open();
        await updateToc(bookDoc, settings.globalViewSettings.sortedTOC);
        bookDoc.metadata.title ||= simpleBook.title;
        bookDoc.metadata.author ||= simpleBook.author;
        bookDoc.metadata.language ||= simpleBook.language || "en";

        const bookData: BookDataState = {
          id: bookId,
          book,
          file,
          config,
          bookDoc,
        };

        set({
          config,
          bookData,
          isLoading: false,
        });
        readerNavigationInfo("reader-store.init-book.success", {
          bookId,
          format: simpleBook.format,
          title: simpleBook.title,
        });
      } catch (err) {
        console.error("[ReaderStore] Error loading book:", err);
        readerNavigationError("reader-store.init-book.error", {
          bookId,
          error: describeReaderNavigationError(err),
        });
        set({
          error: err instanceof Error ? err.message : String(err),
          isLoading: false,
        });
      }
    },

    setConfig: (config) => set({ config }),
    saveConfig: async (config) => {
      const { bookId, bookData } = get();
      if (!bookData?.book) return;

      const { library, setLibrary } = useLibraryStore.getState();
      const bookIndex = library.findIndex((b) => b.id === bookId);
      if (bookIndex === -1) return;

      const book = library.splice(bookIndex, 1)[0]!;
      book.progress = config.progress;
      book.updatedAt = Date.now();
      library.unshift(book);
      setLibrary(library);

      config.updatedAt = Date.now();
      await saveBookConfig(bookData.book.id, config);
      set({ config });
    },
    updateBooknotes: (booknotes) => {
      const { config } = get();
      if (!config) return undefined;

      const updatedConfig = {
        ...config,
        updatedAt: Date.now(),
        booknotes: booknotes,
      } as BookConfig;

      set({ config: updatedConfig });
      return updatedConfig;
    },
    setView: (view) => set({ view }),
    setViewerReady: (ready) => set({ isViewerReady: ready }),
    requestNavigation: (target) => {
      readerNavigationInfo("reader-store.request-navigation", {
        bookId,
        target: describeReaderNavigationTarget({ ...target, bookId }),
      });
      set({ pendingNavigationTarget: target });
    },
    clearNavigationTarget: (target) =>
      set((state) => {
        const nextTarget = clearReaderNavigationTarget(state.pendingNavigationTarget, target);
        readerNavigationInfo("reader-store.clear-navigation-target", {
          bookId,
          cleared: nextTarget === null,
          completedTarget: describeReaderNavigationTarget({ ...target, bookId }),
          currentTarget: describeReaderNavigationTarget(state.pendingNavigationTarget),
        });
        return {
          pendingNavigationTarget: nextTarget,
        };
      }),
    setLocation: (location) => set({ location }),
    setProgress: (progress) => set({ progress }),
    setSessionStats: (stats) => set({ sessionStats: stats }),
    setSessionInitialized: (initialized) => set({ isSessionInitialized: initialized }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setActiveContext: (context) => set({ activeContext: context }),
    setOpenDropdown: (dropdown) => set({ openDropdown: dropdown }),
    setCurrentThread: (thread: Thread | null) => set({ currentThread: thread }),
  }));
};

export type ReaderStore = ReturnType<typeof createReaderStore>;
