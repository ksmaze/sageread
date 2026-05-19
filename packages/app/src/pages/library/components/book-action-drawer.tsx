import { BookOpen, BrainCircuit, Download, Edit, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BookWithStatusAndUrls } from "@/types/simple-book";

interface BookActionDrawerProps {
  book: BookWithStatusAndUrls;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBook: () => void;
  onEditInfo: () => void;
  onDelete: () => void;
  onDownloadImage: () => void;
  onToggleReadStatus: () => void;
  onVectorize: () => void;
  onManageTags: () => void;
  onAITags: () => void;
  vectorizeProgress?: number | null;
}

export default function BookActionDrawer({
  book,
  isOpen,
  onOpenChange,
  onOpenBook,
  onEditInfo,
  onDelete,
  onDownloadImage,
  onToggleReadStatus,
  onVectorize,
  onManageTags,
  onAITags,
  vectorizeProgress,
}: BookActionDrawerProps) {
  const isUnread = !book.status || book.status.status === "unread";
  const vectorMeta = book.status?.metadata?.vectorization;
  const isVectorized = vectorMeta?.status === "success";
  const canVectorize = book.format === "EPUB";

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="line-clamp-1">{book.title}</DrawerTitle>
          <DrawerDescription>{book.author || "Unknown Author"}</DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="p-4 pt-0">
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onOpenBook();
                onOpenChange(false);
              }}
            >
              <BookOpen className="h-4 w-4" />
              打开
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onToggleReadStatus();
                onOpenChange(false);
              }}
            >
              {isUnread ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current" />
                  标记为已读
                </>
              ) : (
                <>
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current">
                    <div className="h-2 w-2 rounded-full bg-current" />
                  </div>
                  标记为未读
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onEditInfo();
                onOpenChange(false);
              }}
            >
              <Edit className="h-4 w-4" />
              编辑信息
            </Button>

            {book.coverUrl && (
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  onDownloadImage();
                  onOpenChange(false);
                }}
              >
                <Download className="h-4 w-4" />
                下载封面
              </Button>
            )}

            <div className="my-2 border-t" />

            <div className="mb-2 font-medium text-muted-foreground text-sm">标签与AI</div>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onManageTags();
                onOpenChange(false);
              }}
            >
              <Tags className="h-4 w-4" />
              管理标签 ({book.tags?.length || 0})
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onAITags();
                onOpenChange(false);
              }}
            >
              <BrainCircuit className="h-4 w-4" />
              AI 生成标签
            </Button>

            <div className="my-2 border-t" />

            <div className="mb-2 font-medium text-muted-foreground text-sm">向量化 {isVectorized && "✓"}</div>

            {canVectorize ? (
              <>
                {isVectorized && (
                  <div className="mb-2 grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                    <div className="rounded bg-muted/50 p-2">模型: {vectorMeta?.model || "未知"}</div>
                    <div className="rounded bg-muted/50 p-2">维度: {vectorMeta?.dimension || 0}</div>
                    <div className="rounded bg-muted/50 p-2">分块: {vectorMeta?.chunkCount || 0}</div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => {
                    onVectorize();
                    onOpenChange(false);
                  }}
                  disabled={vectorizeProgress !== null && vectorizeProgress !== undefined}
                >
                  <BrainCircuit className="h-4 w-4" />
                  {vectorizeProgress !== null && vectorizeProgress !== undefined
                    ? `向量化中 ${vectorizeProgress}%`
                    : isVectorized
                      ? "重新向量化"
                      : "开始向量化"}
                </Button>
              </>
            ) : (
              <div className="rounded-md bg-muted/50 p-2 text-muted-foreground text-xs">
                PDF 暂不支持整本书 AI 或向量化，可在阅读器中选中文字询问 AI。
              </div>
            )}

            <div className="my-2 border-t" />

            <Button
              variant="destructive"
              className="justify-start gap-2"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>
        </ScrollArea>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">关闭</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
