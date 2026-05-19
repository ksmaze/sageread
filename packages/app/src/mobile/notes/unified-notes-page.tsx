import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { ReaderNavigationTarget } from "@/pages/reader/store/create-reader-store";
import { useLayoutStore } from "@/store/layout-store";
import { describeReaderNavigationTarget, readerNavigationInfo } from "@/utils/reader-navigation-debug";
import { useMobileShellStore } from "../shell/mobile-shell-store";
import type { UnifiedNoteReaderTarget, UnifiedNoteType } from "./unified-note-model";
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
  const openMobileBook = useMobileShellStore((state) => state.openBook);
  const openDesktopBook = useLayoutStore((state) => state.openBook);
  const styles = PAGE_STYLES[variant];
  const handleOpenReaderTarget = useCallback(
    (target: UnifiedNoteReaderTarget) => {
      const requestedAt = Date.now();
      const navigationTarget: ReaderNavigationTarget | undefined = target.cfi
        ? {
            cfi: target.cfi,
            requestedAt,
            source: "unified-notes",
          }
        : undefined;

      readerNavigationInfo("unified-notes-page.open-reader-target", {
        navigationTarget: navigationTarget
          ? describeReaderNavigationTarget({
              bookId: target.bookId,
              cfi: navigationTarget.cfi,
              requestedAt: navigationTarget.requestedAt,
              source: navigationTarget.source,
              title: target.title,
            })
          : {
              bookId: target.bookId,
              hasCfi: false,
              title: target.title,
            },
        variant,
      });

      if (variant === "desktop") {
        readerNavigationInfo("unified-notes-page.open-reader-target.desktop", {
          bookId: target.bookId,
          title: target.title,
          target: navigationTarget ? describeReaderNavigationTarget(navigationTarget) : { hasCfi: false },
        });
        openDesktopBook(target.bookId, target.title, navigationTarget);
        return;
      }

      readerNavigationInfo("unified-notes-page.open-reader-target.mobile", {
        bookId: target.bookId,
        title: target.title,
        target: navigationTarget ? describeReaderNavigationTarget(navigationTarget) : { hasCfi: false },
      });
      openMobileBook({ id: target.bookId, title: target.title }, navigationTarget);
    },
    [openDesktopBook, openMobileBook, variant],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <header className="space-y-1">
        <h1 className={cn("font-semibold text-2xl", styles.title)}>笔记</h1>
        <p className={cn("text-sm", styles.description)}>跨书籍回顾笔记、标注、摘录和书签</p>
      </header>
      <UnifiedNotesList
        activeType={activeType}
        onOpenReaderTarget={handleOpenReaderTarget}
        onTypeChange={setActiveType}
        variant={variant}
      />
    </div>
  );
}
