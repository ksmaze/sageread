import { BookOpenText, Bot, ChevronLeft, ChevronRight, NotebookPen, Search, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatReaderPageProgress } from "@/mobile/reader/reader-chrome-progress";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import type { ReaderSheet } from "../types";

interface ReaderToolDockProps {
  visible: boolean;
  onOpenSheet: (sheet: Exclude<ReaderSheet, null>) => void;
}

const READER_TOOLS = [
  { id: "toc", label: "目录", icon: BookOpenText },
  { id: "search", label: "搜索", icon: Search },
  { id: "notes", label: "笔记", icon: NotebookPen },
  { id: "ai", label: "AI", icon: Bot },
  { id: "style", label: "样式", icon: Type },
] as const;

export function ReaderToolDock({ visible, onOpenSheet }: ReaderToolDockProps) {
  const view = useReaderStore((state) => state.view);
  const progress = useReaderStore((state) => state.progress);

  if (!visible) return null;

  const chapterTitle = progress?.sectionLabel?.trim() || "正在阅读";
  const pageProgress = formatReaderPageProgress(progress?.pageinfo);

  const handlePreviousChapter = () => {
    void view?.renderer.prevSection?.();
  };

  const handleNextChapter = () => {
    void view?.renderer.nextSection?.();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 px-safe pb-safe">
      <div className="pointer-events-auto flex w-full max-w-md flex-col rounded-[1.75rem] bg-[var(--mobile-control-fill)] p-2 text-[var(--mobile-on-control)] shadow-[0_16px_40px_rgba(20,29,35,0.18)]">
        <div className="grid min-h-14 grid-cols-[var(--mobile-touch-target)_minmax(0,1fr)_var(--mobile-touch-target)] items-center gap-2 border-white/10 border-b px-1 pb-2 dark:border-black/10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)] rounded-full text-[var(--mobile-on-control)] hover:bg-white/10 hover:text-[var(--mobile-on-control)] dark:hover:bg-black/10"
            title="上一章"
            aria-label="上一章"
            onClick={handlePreviousChapter}
          >
            <ChevronLeft className="size-5" />
          </Button>

          <div className="min-w-0 text-center">
            <div className="truncate font-medium text-sm" title={chapterTitle}>
              {chapterTitle}
            </div>
            {pageProgress ? <div className="mt-0.5 truncate text-xs opacity-75">{pageProgress}</div> : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)] rounded-full text-[var(--mobile-on-control)] hover:bg-white/10 hover:text-[var(--mobile-on-control)] dark:hover:bg-black/10"
            title="下一章"
            aria-label="下一章"
            onClick={handleNextChapter}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <div className="grid h-14 grid-cols-5 items-center px-1 pt-1">
          {READER_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Button
                key={tool.id}
                type="button"
                variant="ghost"
                className="h-full min-h-[var(--mobile-touch-target)] min-w-[var(--mobile-touch-target)] flex-col gap-0.5 rounded-full text-[var(--mobile-on-control)] text-xs hover:bg-white/10 hover:text-[var(--mobile-on-control)] dark:hover:bg-black/10"
                onClick={() => onOpenSheet(tool.id)}
              >
                <Icon className="size-4" />
                <span>{tool.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
