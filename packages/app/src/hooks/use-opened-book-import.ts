import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  formatOpenedBookImportIssueMessages,
  importOpenedBookUrls,
  OPEN_FILE_EVENT,
  OPENED_URLS_COMMAND,
  type OpenedBookImportResult,
} from "@/services/opened-book-import-service";
import { useBookUpload } from "./use-book-upload";

export function useOpenedBookImport() {
  const { handleDropedFiles } = useBookUpload();

  const importUrls = useCallback(
    async (urls: string[]) => {
      if (urls.length === 0) return;

      const result = await importOpenedBookUrls(urls, {
        importFiles: handleDropedFiles,
      });
      reportImportIssues(result);
    },
    [handleDropedFiles],
  );

  const importQueuedUrls = useCallback(
    async (fallbackUrls: string[] = [], isDisposed = () => false) => {
      try {
        const urls = normalizeOpenedUrls(await invoke<string[]>(OPENED_URLS_COMMAND));
        if (!isDisposed()) {
          await importUrls(urls.length > 0 ? urls : fallbackUrls);
        }
      } catch (error) {
        console.error("Failed to import queued opened book URLs:", error);
        if (!isDisposed()) {
          await importUrls(fallbackUrls);
        }
      }
    },
    [importUrls],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const isDisposed = () => disposed;

    void importQueuedUrls([], isDisposed);

    listen<string[]>(OPEN_FILE_EVENT, (event) => {
      void importQueuedUrls(normalizeOpenedUrls(event.payload), isDisposed);
    })
      .then((handler) => {
        if (disposed) {
          handler();
          return;
        }
        unlisten = handler;
      })
      .catch((error) => {
        console.error("Failed to listen for opened book URLs:", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [importQueuedUrls]);
}

function normalizeOpenedUrls(payload: unknown): string[] {
  return Array.isArray(payload) ? payload.filter((url): url is string => typeof url === "string") : [];
}

function reportImportIssues(result: OpenedBookImportResult) {
  for (const message of formatOpenedBookImportIssueMessages(result)) {
    toast.error(message);
  }
}
