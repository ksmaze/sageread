import { NotepadContainer } from "@/components/notepad";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { ReaderSearchPanel } from "@/pages/reader/components/search-dropdown";
import { ReaderStylePanel } from "@/pages/reader/components/settings-dropdown";
import TOCView from "@/pages/reader/components/toc-view";
import { MobileAiChat } from "../ai/mobile-ai-chat";
import { MobileSheet } from "../components/mobile-sheet";
import { useMobileShellStore } from "../shell/mobile-shell-store";

const titleBySheet = {
  toc: "目录",
  search: "搜索",
  notes: "笔记",
  ai: "AI 助手",
  style: "阅读样式",
} as const;

function ReaderSheetContent() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);
  const activeBook = useMobileShellStore((state) => state.activeBook);
  const bookDoc = useReaderStore((state) => state.bookData?.bookDoc);

  if (!activeReaderSheet || !activeBook) return null;

  switch (activeReaderSheet) {
    case "toc":
      return bookDoc?.toc ? (
        <TOCView toc={bookDoc.toc} bookId={activeBook.id} autoExpand onItemSelect={closeReaderSheet} isVisible />
      ) : (
        <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">没有可用的目录</p>
      );
    case "search":
      return <ReaderSearchPanel onClose={closeReaderSheet} onResultSelect={closeReaderSheet} />;
    case "notes":
      return <NotepadContainer bookId={activeBook.id} />;
    case "ai":
      return <MobileAiChat bookId={activeBook.id} />;
    case "style":
      return <ReaderStylePanel />;
  }
}

export function ReaderSheetHost() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);

  const open = activeReaderSheet !== null;

  return (
    <MobileSheet
      open={open}
      title={activeReaderSheet ? titleBySheet[activeReaderSheet] : "阅读工具"}
      height={activeReaderSheet === "ai" || activeReaderSheet === "notes" ? "full" : "content"}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeReaderSheet();
      }}
    >
      <ReaderSheetContent />
    </MobileSheet>
  );
}
