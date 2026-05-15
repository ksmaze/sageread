import ReaderViewer from "@/pages/reader";
import { ReaderProvider } from "@/pages/reader/components/reader-provider";
import { createReaderStore } from "@/pages/reader/store/create-reader-store";
import { useMemo } from "react";
import { useMobileShellStore } from "../shell/mobile-shell-store";

export function MobileReader() {
  const activeBook = useMobileShellStore((state) => state.activeBook);
  const isReaderOpen = useMobileShellStore((state) => state.isReaderOpen);

  const readerStore = useMemo(() => {
    if (!activeBook || !isReaderOpen) return null;
    return createReaderStore(activeBook.id);
  }, [activeBook, isReaderOpen]);

  if (!activeBook || !isReaderOpen || !readerStore) return null;

  return (
    <ReaderProvider store={readerStore}>
      <div className="fixed inset-0 z-50 bg-[var(--mobile-paper-high)]">
        <ReaderViewer />
      </div>
    </ReaderProvider>
  );
}
