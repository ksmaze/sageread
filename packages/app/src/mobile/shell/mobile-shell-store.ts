import { create } from "zustand";
import type { ActiveBookRef, MobileDestination, ReaderSheet } from "../types";

interface MobileShellState {
  activeDestination: MobileDestination;
  activeBook: ActiveBookRef | null;
  isReaderOpen: boolean;
  isReaderChromeVisible: boolean;
  activeReaderSheet: ReaderSheet;
  setDestination: (destination: MobileDestination) => void;
  openBook: (book: ActiveBookRef) => void;
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
  isReaderOpen: false,
  isReaderChromeVisible: false,
  activeReaderSheet: null,
  setDestination: (destination) =>
    set({
      activeDestination: destination,
      isReaderOpen: false,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  openBook: (book) =>
    set({
      activeBook: book,
      isReaderOpen: true,
      activeReaderSheet: null,
      isReaderChromeVisible: false,
    }),
  closeReader: () =>
    set({
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
