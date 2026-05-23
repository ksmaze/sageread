import { BookOpen, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { Note, UpdateNoteData } from "@/types/note";
import { describeReaderNavigationTarget, readerNavigationInfo } from "@/utils/reader-navigation-debug";
import { runAfterDialogClose } from "./dialog-navigation";
import { getNoteEditorDialogTitle, getNoteSourceExcerpt } from "./note-utils";

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
          <DialogTitle className="text-base leading-6">{getNoteEditorDialogTitle()}</DialogTitle>
        </DialogHeader>
        <div className={SCROLLABLE_DIALOG_BODY_CLASS_NAME}>
          <div className="space-y-4 px-4 py-3 pb-4">
            {note.bookMeta || sourceExcerpt ? (
              <DialogDescription asChild>
                <div className="space-y-2 text-muted-foreground text-sm">
                  {note.bookMeta ? (
                    <div className="break-words">
                      {note.bookMeta.title}
                      {note.bookMeta.author ? ` · ${note.bookMeta.author}` : ""}
                    </div>
                  ) : null}
                  {sourceExcerpt ? (
                    <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-3 text-foreground leading-6">
                      {sourceExcerpt}
                    </blockquote>
                  ) : null}
                </div>
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">编辑笔记正文</DialogDescription>
            )}
            <Textarea
              aria-label="笔记正文"
              className="min-h-40 resize-none"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className={FIXED_DIALOG_FOOTER_CLASS_NAME}>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-2">
              {hasOriginalTarget ? (
                <Button
                  type="button"
                  className="h-11"
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
                <Button
                  type="button"
                  className="h-11"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" />
                  删除
                </Button>
              ) : null}
            </div>
            <Button type="button" className="ml-auto h-11" disabled={isSaving || isDeleting} onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
