import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Note, UpdateNoteData } from "@/types/note";
import { describeReaderNavigationTarget, readerNavigationInfo } from "@/utils/reader-navigation-debug";
import { BookOpen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { runAfterDialogClose } from "./dialog-navigation";
import { getNoteDisplayTitle, getNoteSourceExcerpt } from "./note-utils";

interface NoteEditorDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UpdateNoteData) => Promise<Note>;
  onDelete?: (noteId: string) => Promise<void>;
  onOpenOriginal?: (note: Note) => void;
}

export function NoteEditorDialog({
  note,
  open,
  onOpenChange,
  onDelete,
  onOpenOriginal,
  onSave,
}: NoteEditorDialogProps) {
  const [content, setContent] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(note?.content ?? "");
  }, [note]);

  if (!note) return null;

  const sourceExcerpt = getNoteSourceExcerpt(note);
  const hasOriginalTarget = Boolean(note.bookId && note.cfi && onOpenOriginal);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ id: note.id, content });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(note.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="whitespace-normal break-words text-base leading-6">
            {getNoteDisplayTitle(note)}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="shrink-0 space-y-2 px-4 py-3 text-muted-foreground text-sm">
            {note.bookMeta ? (
              <div className="break-words">
                {note.bookMeta.title}
                {note.bookMeta.author ? ` · ${note.bookMeta.author}` : ""}
              </div>
            ) : null}
            {sourceExcerpt ? (
              <blockquote className="border-l-2 pl-3 text-foreground leading-6">{sourceExcerpt}</blockquote>
            ) : null}
          </div>
        </DialogDescription>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <Textarea
            aria-label="笔记正文"
            className="min-h-40 resize-none"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </ScrollArea>
        <DialogFooter className="shrink-0 border-t p-3 pt-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {hasOriginalTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const target = describeReaderNavigationTarget({
                      bookId: note.bookId,
                      cfi: note.cfi,
                      id: note.id,
                      source: "note-editor-dialog",
                      title: note.bookMeta?.title,
                    });
                    readerNavigationInfo("note-editor-dialog.open-original.click", {
                      hasHandler: Boolean(onOpenOriginal),
                      target,
                    });
                    runAfterDialogClose(
                      () => onOpenChange(false),
                      () => {
                        readerNavigationInfo("note-editor-dialog.open-original.dispatch", { target });
                        onOpenOriginal?.(note);
                      },
                    );
                  }}
                >
                  <BookOpen className="size-4" />
                  打开原文
                </Button>
              ) : null}
              {onDelete ? (
                <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                  <Trash2 className="size-4" />
                  删除
                </Button>
              ) : null}
            </div>
            <Button type="button" disabled={isSaving || isDeleting} onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
