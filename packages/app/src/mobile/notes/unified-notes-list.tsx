import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useState } from "react";
import { UNIFIED_NOTE_FILTERS } from "./unified-note-model";
import type { UnifiedNoteItem, UnifiedNoteType } from "./use-unified-notes";
import { useUnifiedNotes } from "./use-unified-notes";

export type UnifiedNotesListVariant = "mobile" | "desktop";

interface UnifiedNotesListProps {
  bookId?: string;
  activeType: UnifiedNoteType | "all";
  onTypeChange: (type: UnifiedNoteType | "all") => void;
  variant?: UnifiedNotesListVariant;
}

const LIST_STYLES: Record<
  UnifiedNotesListVariant,
  {
    card: string;
    emptyText: string;
    errorText: string;
    metaText: string;
    selectedFilter: string;
    titleText: string;
    typeBadge: string;
  }
> = {
  mobile: {
    card: "bg-[var(--mobile-paper-high)] text-left mobile-tonal-border",
    emptyText: "text-[var(--mobile-ink-muted)]",
    errorText: "text-[var(--mobile-danger)]",
    metaText: "text-[var(--mobile-ink-muted)]",
    selectedFilter:
      "bg-[var(--mobile-control-fill)] text-[var(--mobile-on-control)] hover:bg-[var(--mobile-control-fill)] hover:text-[var(--mobile-on-control)]",
    titleText: "text-[var(--mobile-ink)]",
    typeBadge: "bg-[var(--mobile-paper-low)] text-[var(--mobile-ink-muted)]",
  },
  desktop: {
    card: "bg-background text-left shadow-xs hover:bg-muted/60",
    emptyText: "text-muted-foreground",
    errorText: "text-destructive",
    metaText: "text-muted-foreground",
    selectedFilter: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
    titleText: "text-foreground",
    typeBadge: "bg-muted text-muted-foreground",
  },
};

function formatTime(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  return dayjs(timestamp).format("YYYY-MM-DD HH:mm");
}

function getSourceText(item: UnifiedNoteItem): string | null {
  return [item.bookTitle, item.bookAuthor].filter(Boolean).join(" · ") || null;
}

function UnifiedNoteCard({
  item,
  onOpen,
  variant,
}: {
  item: UnifiedNoteItem;
  onOpen: (item: UnifiedNoteItem) => void;
  variant: UnifiedNotesListVariant;
}) {
  const styles = LIST_STYLES[variant];
  const sourceText = getSourceText(item);
  const updatedAt = formatTime(item.updatedAt);

  return (
    <button
      className={cn("w-full rounded-lg border p-3 transition-colors", styles.card)}
      type="button"
      onClick={() => onOpen(item)}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className={cn("min-w-0 flex-1 truncate font-medium", styles.titleText)}>{item.title}</h3>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs", styles.typeBadge)}>{item.typeLabel}</span>
      </div>
      {sourceText ? <p className={cn("mb-2 truncate text-xs", styles.metaText)}>{sourceText}</p> : null}
      <p className={cn("line-clamp-4 whitespace-pre-line text-sm leading-6", styles.metaText)}>{item.body}</p>
      {updatedAt ? <p className={cn("mt-2 text-xs", styles.metaText)}>更新于 {updatedAt}</p> : null}
    </button>
  );
}

function UnifiedNoteDetailDialog({
  item,
  onOpenChange,
  open,
}: {
  item: UnifiedNoteItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  if (!item) return null;

  const sourceText = getSourceText(item);
  const createdAt = formatTime(item.createdAt);
  const updatedAt = formatTime(item.updatedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DialogTitle className="min-w-0 truncate">{item.title}</DialogTitle>
            <Badge variant="secondary">{item.typeLabel}</Badge>
          </div>
        </DialogHeader>
        <DialogDescription className="space-y-1 py-3">
          {sourceText ? <div>{sourceText}</div> : null}
          {createdAt ? <div>创建于 {createdAt}</div> : null}
          {updatedAt ? <div>更新于 {updatedAt}</div> : null}
          {item.cfi ? <div className="break-all">位置: {item.cfi}</div> : null}
        </DialogDescription>
        <ScrollArea className="max-h-[60dvh] min-h-40 px-4 pb-4">
          <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-7">{item.body}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function UnifiedNotesList({ activeType, bookId, onTypeChange, variant = "mobile" }: UnifiedNotesListProps) {
  const { data = [], isLoading, error } = useUnifiedNotes({ bookId, type: activeType });
  const [selectedItem, setSelectedItem] = useState<UnifiedNoteItem | null>(null);
  const styles = LIST_STYLES[variant];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {UNIFIED_NOTE_FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant="ghost"
            className={cn(
              "mobile-tonal-border h-8 shrink-0 rounded-full border px-3 text-sm",
              activeType === filter.id && styles.selectedFilter,
            )}
            onClick={() => onTypeChange(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? <p className={cn("py-8 text-center text-sm", styles.emptyText)}>正在加载笔记...</p> : null}
      {error ? <p className={cn("py-8 text-center text-sm", styles.errorText)}>笔记加载失败</p> : null}
      {!isLoading && !error && data.length === 0 ? (
        <p className={cn("py-8 text-center text-sm", styles.emptyText)}>暂无笔记</p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {data.map((item) => (
          <UnifiedNoteCard
            key={`${item.type}-${item.bookId ?? "standalone"}-${item.id}`}
            item={item}
            variant={variant}
            onOpen={setSelectedItem}
          />
        ))}
      </div>

      <UnifiedNoteDetailDialog
        item={selectedItem}
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
    </div>
  );
}
