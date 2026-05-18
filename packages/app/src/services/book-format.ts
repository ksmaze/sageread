import type { BookFormat } from "@/types/simple-book";

const FORMAT_BY_EXTENSION: Record<string, BookFormat> = {
  epub: "EPUB",
  pdf: "PDF",
  mobi: "MOBI",
  cbz: "CBZ",
  fb2: "FB2",
  fbz: "FBZ",
};

const EXTENSION_BY_FORMAT: Record<BookFormat, string> = {
  EPUB: "epub",
  PDF: "pdf",
  MOBI: "mobi",
  CBZ: "cbz",
  FB2: "fb2",
  FBZ: "fbz",
};

const MIME_BY_FORMAT: Record<BookFormat, string> = {
  EPUB: "application/epub+zip",
  PDF: "application/pdf",
  MOBI: "application/x-mobipocket-ebook",
  CBZ: "application/vnd.comicbook+zip",
  FB2: "application/x-fictionbook+xml",
  FBZ: "application/x-zip-compressed-fb2",
};

export function getBookFormat(fileName: string): BookFormat | null {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension ? FORMAT_BY_EXTENSION[extension] ?? null : null;
}

export function getBookMimeType(format: BookFormat): string {
  return MIME_BY_FORMAT[format];
}

export function getFileMimeType(fileName: string): string {
  const format = getBookFormat(fileName);
  return format ? getBookMimeType(format) : "application/octet-stream";
}

export function getBookFileName(filePath: string | null | undefined, format: BookFormat): string {
  const filename = filePath?.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  return filename || `book.${EXTENSION_BY_FORMAT[format]}`;
}

export function isSemanticIndexingSupported(format: BookFormat | null | undefined): boolean {
  return format === "EPUB";
}
