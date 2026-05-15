import { useState } from "react";
import { MobileSurface } from "../components/mobile-surface";
import { UnifiedNotesList } from "../notes/unified-notes-list";
import type { UnifiedNoteType } from "../notes/use-unified-notes";

export function NotesDestination() {
  const [activeType, setActiveType] = useState<UnifiedNoteType | "all">("all");

  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header>
          <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">笔记</h1>
          <p className="text-sm text-[var(--mobile-ink-muted)]">跨书籍回顾笔记、标注、摘录和书签</p>
        </header>
        <UnifiedNotesList activeType={activeType} onTypeChange={setActiveType} />
      </div>
    </MobileSurface>
  );
}
