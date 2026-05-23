import dayjs from "dayjs";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { runAfterDialogClose } from "@/components/notepad/dialog-navigation";
import { useNotepad } from "@/components/notepad/hooks";
import { NoteEditorDialog } from "@/components/notepad/note-editor-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FIXED_DIALOG_FOOTER_CLASS_NAME, SCROLLABLE_DIALOG_BODY_CLASS_NAME } from "@/components/ui/dialog-layout";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/note";
import {
  describeReaderNavigationTarget,
  readerNavigationInfo,
  readerNavigationWarn,
} from "@/utils/reader-navigation-debug";
import { getUnifiedAnnotationTextStyle } from "./unified-note-annotation-display";
import {
  getUnifiedNoteBadgeLabel,
  getUnifiedNoteReaderTarget,
  UNIFIED_NOTE_FILTERS,
  type UnifiedAnnotationMark,
  type UnifiedNoteReaderTarget,
} from "./unified-note-model";
import type { UnifiedNoteItem, UnifiedNoteType } from "./use-unified-notes";
import { useUnifiedNotes } from "./use-unified-notes";

export type UnifiedNotesListVariant = "mobile" | "desktop";

interface UnifiedNotesListProps {
  bookId?: string;
  activeType: UnifiedNoteType | "all";
  onOpenReaderTarget?: (target: UnifiedNoteReaderTarget) => void;
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

function UnifiedAnnotationText({
  contextClassName,
  includeContext = false,
  mark,
  textClassName,
}: {
  contextClassName?: string;
  includeContext?: boolean;
  mark: UnifiedAnnotationMark;
  textClassName?: string;
}) {
  const showContext = includeContext && (mark.contextBefore || mark.contextAfter);

  return (
    <>
      {showContext && mark.contextBefore ? <span className={contextClassName}>...{mark.contextBefore}</span> : null}
      {mark.text ? (
        <span className={cn("font-medium", textClassName)} style={getUnifiedAnnotationTextStyle(mark)}>
          {mark.text}
        </span>
      ) : null}
      {showContext && mark.contextAfter ? <span className={contextClassName}>{mark.contextAfter}...</span> : null}
    </>
  );
}

function UnifiedAnnotationPreview({
  item,
  variant,
}: {
  item: UnifiedNoteItem;
  variant: UnifiedNotesListVariant;
}) {
  const mark = item.annotationMark;
  const styles = LIST_STYLES[variant];

  if (!mark) {
    return <p className={cn("line-clamp-4 whitespace-pre-line text-sm leading-6", styles.metaText)}>{item.body}</p>;
  }

  if (!mark.text && !mark.note) {
    return <p className={cn("line-clamp-4 whitespace-pre-line text-sm leading-6", styles.metaText)}>{item.body}</p>;
  }

  return (
    <div className="space-y-2 text-sm leading-6">
      {mark.text ? (
        <p className={cn("line-clamp-4 whitespace-pre-wrap break-words", styles.metaText)}>
          <UnifiedAnnotationText
            includeContext
            contextClassName={styles.metaText}
            mark={mark}
            textClassName={styles.titleText}
          />
        </p>
      ) : null}
      {mark.note ? (
        <p className={cn("line-clamp-3 whitespace-pre-line break-words", styles.metaText)}>{mark.note}</p>
      ) : null}
    </div>
  );
}

function UnifiedAnnotationDetailBody({ item }: { item: UnifiedNoteItem }) {
  const mark = item.annotationMark;

  if (!mark || (!mark.text && !mark.note)) {
    return <div className="whitespace-pre-wrap break-words text-foreground text-sm leading-7">{item.body}</div>;
  }

  return (
    <div className="space-y-3 text-sm leading-7">
      {mark.text ? (
        <div className="whitespace-pre-wrap break-words">
          <UnifiedAnnotationText
            includeContext
            contextClassName="text-muted-foreground"
            mark={mark}
            textClassName="text-foreground"
          />
        </div>
      ) : null}
      {mark.note ? <div className="whitespace-pre-wrap break-words text-foreground">{mark.note}</div> : null}
    </div>
  );
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
        <h3 className={cn("min-w-0 flex-1 truncate font-medium", styles.titleText)}>
          {item.annotationMark?.text ? (
            <UnifiedAnnotationText mark={item.annotationMark} textClassName={styles.titleText} />
          ) : (
            item.title
          )}
        </h3>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs", styles.typeBadge)}>
          {getUnifiedNoteBadgeLabel(item)}
        </span>
      </div>
      {sourceText ? <p className={cn("mb-2 truncate text-xs", styles.metaText)}>{sourceText}</p> : null}
      <UnifiedAnnotationPreview item={item} variant={variant} />
      {updatedAt ? <p className={cn("mt-2 text-xs", styles.metaText)}>更新于 {updatedAt}</p> : null}
    </button>
  );
}

function UnifiedNoteDetailDialog({
  item,
  onOpenReaderTarget,
  onOpenChange,
  open,
}: {
  item: UnifiedNoteItem | null;
  onOpenReaderTarget?: (target: UnifiedNoteReaderTarget) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  if (!item) return null;

  const sourceText = getSourceText(item);
  const createdAt = formatTime(item.createdAt);
  const updatedAt = formatTime(item.updatedAt);
  const readerTarget = getUnifiedNoteReaderTarget(item);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0">
          <div className="min-w-0 space-y-2 pr-2">
            <DialogTitle className="line-clamp-2 whitespace-normal break-words text-base leading-6 sm:text-lg">
              {item.title}
            </DialogTitle>
            <Badge variant="secondary">{getUnifiedNoteBadgeLabel(item)}</Badge>
          </div>
        </DialogHeader>
        <div className={SCROLLABLE_DIALOG_BODY_CLASS_NAME}>
          <div className="space-y-4 px-4 py-3 pb-4">
            <DialogDescription asChild>
              <div className="space-y-1 text-muted-foreground text-sm">
                {sourceText ? <div className="break-words">{sourceText}</div> : null}
                {createdAt ? <div>创建于 {createdAt}</div> : null}
                {updatedAt ? <div>更新于 {updatedAt}</div> : null}
                {item.cfi ? <div className="break-all">位置: {item.cfi}</div> : null}
              </div>
            </DialogDescription>
            <UnifiedAnnotationDetailBody item={item} />
          </div>
        </div>
        {readerTarget && onOpenReaderTarget ? (
          <DialogFooter className={FIXED_DIALOG_FOOTER_CLASS_NAME}>
            <Button
              type="button"
              className="h-11 w-full sm:w-auto"
              onClick={() => {
                const target = describeReaderNavigationTarget({
                  bookId: readerTarget.bookId,
                  cfi: readerTarget.cfi,
                  id: item.id,
                  source: "unified-notes-detail",
                  title: readerTarget.title,
                  type: item.type,
                });
                readerNavigationInfo("unified-notes.detail.open-reader-target.click", { target });
                runAfterDialogClose(
                  () => onOpenChange(false),
                  () => {
                    readerNavigationInfo("unified-notes.detail.open-reader-target.dispatch", { target });
                    onOpenReaderTarget(readerTarget);
                  },
                );
              }}
            >
              <BookOpen className="size-4" />
              {readerTarget.cfi ? "打开原文" : "打开书籍"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function UnifiedNotesList({
  activeType,
  bookId,
  onOpenReaderTarget,
  onTypeChange,
  variant = "mobile",
}: UnifiedNotesListProps) {
  const { data = [], isLoading, error } = useUnifiedNotes({ bookId, type: activeType });
  const { handleDeleteNote, handleUpdateNote } = useNotepad({ bookId });
  const [selectedItem, setSelectedItem] = useState<UnifiedNoteItem | null>(null);
  const styles = LIST_STYLES[variant];
  const selectedNote = selectedItem?.type === "note" ? (selectedItem.source as Note) : null;

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

      {selectedNote ? (
        <NoteEditorDialog
          note={selectedNote}
          open={selectedItem !== null}
          onDelete={async (noteId) => {
            await handleDeleteNote(noteId);
          }}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          onOpenOriginal={(note) => {
            const noteTarget = describeReaderNavigationTarget({
              bookId: note.bookId,
              cfi: note.cfi,
              id: note.id,
              source: "unified-notes-note-editor",
              title: note.bookMeta?.title,
            });
            readerNavigationInfo("unified-notes.note-editor.open-original.received", { target: noteTarget });

            if (!selectedItem) {
              readerNavigationWarn("unified-notes.note-editor.open-original.missing-selected-item", {
                target: noteTarget,
              });
              return;
            }

            const target = getUnifiedNoteReaderTarget({
              ...selectedItem,
              cfi: note.cfi,
            });
            if (!target) {
              readerNavigationWarn("unified-notes.note-editor.open-original.missing-reader-target", {
                item: {
                  bookId: selectedItem.bookId,
                  id: selectedItem.id,
                  type: selectedItem.type,
                },
                target: noteTarget,
              });
              return;
            }

            const readerTarget = describeReaderNavigationTarget({
              bookId: target.bookId,
              cfi: target.cfi,
              id: selectedItem.id,
              source: "unified-notes-note-editor",
              title: target.title,
              type: selectedItem.type,
            });
            if (!onOpenReaderTarget) {
              readerNavigationWarn("unified-notes.note-editor.open-original.missing-handler", {
                target: readerTarget,
              });
              return;
            }

            runAfterDialogClose(
              () => setSelectedItem(null),
              () => {
                readerNavigationInfo("unified-notes.note-editor.open-original.dispatch", { target: readerTarget });
                onOpenReaderTarget(target);
              },
            );
          }}
          onSave={handleUpdateNote}
        />
      ) : (
        <UnifiedNoteDetailDialog
          item={selectedItem}
          onOpenReaderTarget={onOpenReaderTarget}
          open={selectedItem !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
