import { Button } from "@/components/ui/button";
import { BookOpenText, Bot, NotebookPen, Search, Type } from "lucide-react";
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
  if (!visible) return null;

  return (
    <div className="px-safe pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3">
      <div className="pointer-events-auto grid h-14 w-full max-w-md grid-cols-5 rounded-full bg-[var(--mobile-control-fill)] px-2 text-[var(--mobile-on-control)] shadow-[0_16px_40px_rgba(20,29,35,0.18)]">
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
  );
}
