export type MobileDestination = "library" | "notes" | "ai" | "stats";

export type ReaderSheet = "toc" | "search" | "notes" | "ai" | "style" | null;

export interface ActiveBookRef {
  id: string;
  title: string;
}

export interface ReaderContextRef {
  bookId: string;
  sectionLabel?: string;
  selectedText?: string;
}

export interface MobileDestinationDefinition {
  id: MobileDestination;
  label: string;
  ariaLabel: string;
}
