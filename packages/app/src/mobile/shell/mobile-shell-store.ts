import type { ReaderNavigationTarget } from "@/pages/reader/store/create-reader-store";
import { create } from "zustand";
import type { ActiveBookRef, MobileDestination, ReaderSheet } from "../types";

export interface MobileReaderNavigationTarget extends ReaderNavigationTarget {
  bookId: string;
}

interface MobileShellState {
  activeDestination: MobileDestination;
  activeBook: ActiveBookRef | null;
  pendingReaderNavigationTarget: MobileReaderNavigationTarget | null;
  isReaderOpen: boolean;
  isReaderChromeVisible: boolean;
  activeReaderSheet: ReaderSheet;
  setDestination: (destination: MobileDestination) => void;
  openBook: (book: ActiveBookRef, navigationTarget?: ReaderNavigationTarget) => void;
  clearPendingReaderNavigationTarget: (bookId: string) => void;
  closeReader: () => void;
  showReaderChrome: () => void;
  hideReaderChrome: () => void;
  toggleReaderChrome: () => void;
  openReaderSheet: (sheet: Exclude<ReaderSheet, null>) => void;
  closeReaderSheet: () => void;
}

export const useMobileShellStore = create<MobileShellState>((set, get) => ({
  activeDestination: "library",
  activeBook: null,
  pendingReaderNavigationTarget: null,
  isReaderOpen: false,
  isReaderChromeVisible: false,
  activeReaderSheet: null,
  setDestination: (destination) =>
    set({
      activeDestination: destination,
      pendingReaderNavigationTarget: null,
      isReaderOpen: false,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  openBook: (book, navigationTarget) =>
    set({
      activeBook: book,
      pendingReaderNavigationTarget: navigationTarget ? { ...navigationTarget, bookId: book.id } : null,
      isReaderOpen: true,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  clearPendingReaderNavigationTarget: (bookId) =>
    set((state) => ({
      pendingReaderNavigationTarget:
        state.pendingReaderNavigationTarget?.bookId === bookId ? null : state.pendingReaderNavigationTarget,
    })),
  closeReader: () =>
    set({
      pendingReaderNavigationTarget: null,
      isReaderOpen: false,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  showReaderChrome: () => set({ isReaderChromeVisible: true }),
  hideReaderChrome: () => set({ isReaderChromeVisible: false }),
  toggleReaderChrome: () => set({ isReaderChromeVisible: !get().isReaderChromeVisible }),
  openReaderSheet: (sheet) =>
    set({
      activeReaderSheet: sheet,
      isReaderChromeVisible: true,
    }),
  closeReaderSheet: () => set({ activeReaderSheet: null }),
}));
