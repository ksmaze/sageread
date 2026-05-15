import { cn } from "@/lib/utils";
import { useState } from "react";
import type { UnifiedNoteType } from "./unified-note-model";
import { UnifiedNotesList, type UnifiedNotesListVariant } from "./unified-notes-list";

interface UnifiedNotesPageProps {
  className?: string;
  variant?: UnifiedNotesListVariant;
}

const PAGE_STYLES: Record<
  UnifiedNotesListVariant,
  {
    description: string;
    title: string;
  }
> = {
  mobile: {
    description: "text-[var(--mobile-ink-muted)]",
    title: "text-[var(--mobile-ink)]",
  },
  desktop: {
    description: "text-muted-foreground",
    title: "text-foreground",
  },
};

export function UnifiedNotesPage({ className, variant = "mobile" }: UnifiedNotesPageProps) {
  const [activeType, setActiveType] = useState<UnifiedNoteType | "all">("all");
  const styles = PAGE_STYLES[variant];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <header className="space-y-1">
        <h1 className={cn("font-semibold text-2xl", styles.title)}>笔记</h1>
        <p className={cn("text-sm", styles.description)}>跨书籍回顾笔记、标注、摘录和书签</p>
      </header>
      <UnifiedNotesList activeType={activeType} onTypeChange={setActiveType} variant={variant} />
    </div>
  );
}
