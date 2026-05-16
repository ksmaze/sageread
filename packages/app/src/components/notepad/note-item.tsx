import type { Note, UpdateNoteData } from "@/types/note";
import { Menu } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { NoteEditorDialog } from "./note-editor-dialog";
import { getNoteDisplayBody } from "./note-utils";

interface NoteItemProps {
  note: Note;
  onDelete: (noteId: string) => Promise<void>;
  onOpenOriginal?: (note: Note) => void;
  onSave: (data: UpdateNoteData) => Promise<Note>;
}

export const NoteItem = ({ note, onDelete, onOpenOriginal, onSave }: NoteItemProps) => {
  const [showDetail, setShowDetail] = useState(false);

  const handleNativeDelete = useCallback(async () => {
    try {
      const preview = getNoteDisplayBody(note);
      const confirmed = await ask(
        `确定要删除这条笔记吗？\n\n"${preview.length > 50 ? `${preview.substring(0, 50)}...` : preview}"\n\n此操作无法撤销。`,
        {
          title: "确认删除",
          kind: "warning",
        },
      );

      if (confirmed) {
        await onDelete(note.id);
      }
    } catch (error) {
      console.error("删除笔记失败:", error);
    }
  }, [note, onDelete]);

  const handleClick = useCallback(() => {
    setShowDetail(true);
  }, []);

  const handleMenuClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const menu = await Menu.new({
          items: [
            {
              id: "delete",
              text: "删除",
              action: () => {
                handleNativeDelete();
              },
            },
          ],
        });

        await menu.popup(new LogicalPosition(e.clientX, e.clientY));
      } catch (error) {
        console.error("显示菜单失败:", error);
      }
    },
    [handleNativeDelete],
  );

  return (
    <>
      <div
        className="group cursor-pointer rounded-lg bg-muted p-2"
        onClick={handleClick}
        onContextMenu={handleMenuClick}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 select-auto text-neutral-700 text-sm dark:text-neutral-200">
              {getNoteDisplayBody(note)}
            </p>

            <div className="mt-1 text-neutral-800 text-xs dark:text-neutral-500">
              {dayjs(note.createdAt).format("YYYY-MM-DD HH:mm:ss")}
            </div>
          </div>
        </div>
      </div>

      <NoteEditorDialog
        note={note}
        open={showDetail}
        onDelete={onDelete}
        onOpenChange={setShowDetail}
        onOpenOriginal={onOpenOriginal}
        onSave={onSave}
      />
    </>
  );
};
