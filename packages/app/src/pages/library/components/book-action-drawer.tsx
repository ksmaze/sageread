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
import type { BookTag } from "@/pages/library/hooks/use-tags-management";
import type { BookWithStatusAndUrls } from "@/types/simple-book";
import {
  BookOpen,
  BrainCircuit,
  Download,
  Edit,
  MoreHorizontal,
  Tags,
  Trash2,
} from "lucide-react";
import { useState } from "react";

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
  onVectorTest: () => void;
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
  onVectorTest,
  onManageTags,
  onAITags,
  vectorizeProgress,
}: BookActionDrawerProps) {
  const isUnread = !book.status || book.status.status === "unread";
  const vectorMeta = book.status?.metadata?.vectorization;
  const isVectorized = vectorMeta?.status === "success";

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="line-clamp-1">{book.title}</DrawerTitle>
          <DrawerDescription>
            {book.author || "Unknown Author"}
          </DrawerDescription>
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

            <div className="text-sm font-medium text-muted-foreground mb-2">
              标签与AI
            </div>

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

            <div className="text-sm font-medium text-muted-foreground mb-2">
              向量化 {isVectorized && "✓"}
            </div>

            {isVectorized && (
              <div className="grid grid-cols-2 gap-2 mb-2 text-xs text-muted-foreground">
                <div className="bg-muted/50 p-2 rounded">
                  模型: {vectorMeta?.model || "未知"}
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  维度: {vectorMeta?.dimension || 0}
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  分块: {vectorMeta?.chunkCount || 0}
                </div>
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

            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                onVectorTest();
                onOpenChange(false);
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
              向量化测试
            </Button>

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
