import type { BookDoc } from "@/lib/document";
import type { BookNote, BookSearchConfig, BookSearchResult } from "@/types/book";

export interface ReaderNoteMarker {
  id: string;
  cfi: string;
  value: string;
  overlayKey: string;
  markerType: "note";
  noteId: string;
}

export interface FoliateView extends HTMLElement {
  open: (book: BookDoc) => Promise<void>;
  close: () => void;
  init: (options: { lastLocation: string }) => Promise<void>;
  goTo: (href: string) => Promise<unknown>;
  goToFraction: (fraction: number) => Promise<void>;
  prev: (distance?: number) => Promise<void>;
  next: (distance?: number) => Promise<void>;
  goLeft: () => Promise<void>;
  goRight: () => Promise<void>;
  getCFI: (index: number, range: Range) => string;
  resolveCFI: (cfi: string) => { index: number; anchor: (doc: Document) => Range };
  addAnnotation: (
    note: BookNote | ReaderNoteMarker,
    remove?: boolean,
  ) => Promise<{ index: number; label: string } | undefined>;
  search: (config: BookSearchConfig) => AsyncGenerator<BookSearchResult | string, void, void>;
  clearSearch: () => void;
  setSearchIndicator: (type: string, options: any) => void;
  select: (target: string | number | { fraction: number }) => void;
  deselect: () => void;
  book: BookDoc;
  language: {
    locale?: string;
    isCJK?: boolean;
  };
  history: {
    canGoBack: boolean;
    canGoForward: boolean;
    back: () => void;
    forward: () => void;
    clear: () => void;
  };
  renderer: {
    scrolled?: boolean;
    size: number; // current page height
    viewSize: number; // whole document view height
    start: number;
    end: number;
    page: number;
    pages: number;
    containerPosition: number;
    sideProp: "width" | "height";
    setAttribute: (name: string, value: string | number) => void;
    removeAttribute: (name: string) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    nextSection?: () => Promise<void>;
    prevSection?: () => Promise<void>;
    goTo?: (params: { index: number; anchor: number }) => void;
    setStyles?: (css: string) => void;
    getContents: () => { doc: Document; index?: number; overlayer?: unknown }[];
    scrollToAnchor: (anchor: number | Range) => void;
    addEventListener: (type: string, listener: EventListener, option?: AddEventListenerOptions) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  };
}

export const wrappedFoliateView = (originalView: FoliateView): FoliateView => {
  const originalAddAnnotation = originalView.addAnnotation.bind(originalView);
  originalView.addAnnotation = (note: BookNote | ReaderNoteMarker, remove = false) => {
    const annotation = {
      value: note.cfi,
      ...note,
    };
    return originalAddAnnotation(annotation, remove);
  };

  const originalSetSearchIndicator = (originalView as any).setSearchIndicator?.bind(originalView);
  if (originalSetSearchIndicator) {
    originalView.setSearchIndicator = (type: string, options: any) => {
      originalSetSearchIndicator(type, options);
    };
  } else {
    originalView.setSearchIndicator = () => {
      console.warn("setSearchIndicator method not available in underlying view");
    };
  }

  return originalView;
};
