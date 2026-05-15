import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnifiedNoteItem, UnifiedNoteType } from "./use-unified-notes";
import { useUnifiedNotes } from "./use-unified-notes";

const FILTERS: Array<{ id: UnifiedNoteType | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "note", label: "笔记" },
  { id: "annotation", label: "标注" },
  { id: "excerpt", label: "摘录" },
  { id: "bookmark", label: "书签" },
];

const TYPE_LABELS: Record<UnifiedNoteType, string> = {
  note: "笔记",
  annotation: "标注",
  excerpt: "摘录",
  bookmark: "书签",
};

interface UnifiedNotesListProps {
  bookId?: string;
  activeType: UnifiedNoteType | "all";
  onTypeChange: (type: UnifiedNoteType | "all") => void;
}

function UnifiedNoteCard({ item }: { item: UnifiedNoteItem }) {
  return (
    <article className="rounded-lg border bg-[var(--mobile-paper-high)] p-3 mobile-tonal-border">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate font-medium text-[var(--mobile-ink)]">{item.title}</h3>
        <span className="shrink-0 rounded-full bg-[var(--mobile-paper-low)] px-2 py-1 text-[var(--mobile-ink-muted)] text-xs">
          {TYPE_LABELS[item.type]}
        </span>
      </div>
      {item.bookTitle ? <p className="mb-2 truncate text-[var(--mobile-ink-muted)] text-xs">{item.bookTitle}</p> : null}
      <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[var(--mobile-ink-muted)]">{item.body}</p>
    </article>
  );
}

export function UnifiedNotesList({ bookId, activeType, onTypeChange }: UnifiedNotesListProps) {
  const { data = [], isLoading, error } = useUnifiedNotes({ bookId, type: activeType });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            variant="ghost"
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm mobile-tonal-border",
              activeType === filter.id &&
                "bg-[var(--mobile-control-fill)] text-[var(--mobile-on-control)] hover:bg-[var(--mobile-control-fill)] hover:text-[var(--mobile-on-control)]",
            )}
            onClick={() => onTypeChange(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">正在加载笔记...</p> : null}
      {error ? <p className="py-8 text-center text-sm text-[var(--mobile-danger)]">笔记加载失败</p> : null}
      {!isLoading && !error && data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--mobile-ink-muted)]">暂无笔记</p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {data.map((item) => (
          <UnifiedNoteCard key={`${item.type}-${item.bookId ?? "standalone"}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}
