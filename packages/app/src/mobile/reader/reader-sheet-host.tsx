import { MobileSheet } from "../components/mobile-sheet";
import { useMobileShellStore } from "../shell/mobile-shell-store";

const titleBySheet = {
  toc: "目录",
  search: "搜索",
  notes: "笔记",
  ai: "AI 助手",
  style: "阅读样式",
} as const;

export function ReaderSheetHost() {
  const activeReaderSheet = useMobileShellStore((state) => state.activeReaderSheet);
  const closeReaderSheet = useMobileShellStore((state) => state.closeReaderSheet);
  const activeBook = useMobileShellStore((state) => state.activeBook);

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
      <div className="text-sm text-[var(--mobile-ink-muted)]">
        {activeBook ? `${activeBook.title} · ${activeReaderSheet ?? ""}` : activeReaderSheet}
      </div>
    </MobileSheet>
  );
}
