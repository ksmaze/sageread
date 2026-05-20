import { readFile as readTauriFile } from "@tauri-apps/plugin-fs";
import { getFilename } from "@/utils/book";
import { getBookFormat, getFileMimeType } from "./book-format";
import { SUPPORTED_FILE_EXTS } from "./constants";

export const OPEN_FILE_EVENT = "open-file";
export const OPENED_URLS_COMMAND = "opened_urls";

export interface OpenedBookImportResult {
  importedCount: number;
  skippedUrls: string[];
  failedUrls: string[];
}

export interface OpenedBookImportDeps {
  readFile?: (path: string | URL) => Promise<Uint8Array>;
  importFiles: (files: File[]) => Promise<void> | void;
}

export async function importOpenedBookUrls(
  urls: string[],
  { readFile = readTauriFile, importFiles }: OpenedBookImportDeps,
): Promise<OpenedBookImportResult> {
  const files: File[] = [];
  const skippedUrls: string[] = [];
  const failedUrls: string[] = [];

  for (const url of urls) {
    const filename = getFilename(url);
    const format = getBookFormat(filename);

    if (!format || !SUPPORTED_FILE_EXTS.includes(format.toLowerCase())) {
      skippedUrls.push(url);
      continue;
    }

    if (isAndroidAppPrivateFilePath(url)) {
      failedUrls.push(url);
      continue;
    }

    try {
      const bytes = await readFile(toTauriReadPath(url));
      files.push(
        new File([bytes], filename, {
          type: getFileMimeType(filename),
        }),
      );
    } catch {
      failedUrls.push(url);
    }
  }

  if (files.length > 0) {
    await importFiles(files);
  }

  return {
    importedCount: files.length,
    skippedUrls,
    failedUrls,
  };
}

export function formatOpenedBookImportIssueMessages(result: OpenedBookImportResult): string[] {
  const messages: string[] = [];

  if (result.skippedUrls.length > 0) {
    messages.push(`不支持的文件：${formatOpenedUrlList(result.skippedUrls)}`);
  }

  if (result.failedUrls.length > 0) {
    messages.push(`无法访问文件：${formatOpenedUrlList(result.failedUrls)}。请将文件移动到下载目录后再试。`);
  }

  return messages;
}

function toTauriReadPath(url: string): string | URL {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "file:" ? parsedUrl : url;
  } catch {
    return url;
  }
}

function isAndroidAppPrivateFilePath(url: string): boolean {
  const path = getUrlPath(url).replace(/\\/g, "/");
  return path.startsWith("/data/user/0/") || path.startsWith("/data/data/");
}

function getUrlPath(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return safeDecodeUri(parsedUrl.protocol === "file:" ? parsedUrl.pathname : url);
  } catch {
    return safeDecodeUri(url);
  }
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function formatOpenedUrlList(urls: string[]): string {
  return new Intl.ListFormat("zh", { style: "long", type: "conjunction" }).format(urls.map(getFilename));
}
