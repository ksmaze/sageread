import { Markdown } from "@/components/prompt-kit/markdown";
import { useIsStandaloneChatSurface } from "@/components/side-chat/chat-surface-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { useChatReaderStore } from "@/store/chat-reader-store";
import { Loader, SquareArrowOutUpRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAnnotationSearch } from "./hooks/use-annotation-search";

const annotationPopoverMaxHeight = "max-h-[min(24rem,var(--radix-popover-content-available-height))]";
const annotationPopoverWidth = "w-[min(20rem,calc(100vw-2rem))]";

export function AnnotationPopover({ chunkId, children }: { chunkId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isStandaloneChat = useIsStandaloneChatSurface();

  const chatActiveBookId = useChatReaderStore((state) => state.activeBookId);
  const readerBookId = useReaderStore((state) => state.bookId);
  const activeBookId = isStandaloneChat ? chatActiveBookId : readerBookId;

  const { loading, chunkData, error, searching, fetchChunkData, searchAndNavigate, resetError } = useAnnotationSearch();

  const handleSearchInReader = useCallback(async () => {
    const success = await searchAndNavigate();
    if (success) {
      setOpen(false);
    }
  }, [searchAndNavigate]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      resetError();
      if (!chunkData && !loading) {
        fetchChunkData(chunkId);
      }
    }
  };

  useEffect(() => {
    if (!open || !activeBookId) return;

    const handleIframeClick = (event: MessageEvent) => {
      if (event.data?.type === "iframe-single-click" && event.data?.bookId === activeBookId) {
        setOpen(false);
      }
    };

    window.addEventListener("message", handleIframeClick);

    return () => {
      window.removeEventListener("message", handleIframeClick);
    };
  }, [open, activeBookId]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span className="cursor-pointer text-primary hover:underline">
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        className={`${annotationPopoverMaxHeight} ${annotationPopoverWidth} overflow-hidden p-0`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="text-muted-foreground text-sm">加载中...</div>
          </div>
        ) : error ? (
          <div className="p-3 text-red-600 text-sm dark:text-red-400">错误: {error}</div>
        ) : chunkData ? (
          <div className={`flex ${annotationPopoverMaxHeight} flex-col overflow-hidden bg-muted/80`}>
            <div className="border-b px-3 py-1 pr-2">
              <div className="flex items-center justify-between">
                <div
                  title={chunkData.related_chapter_titles}
                  className="mr-2 flex-1 truncate font-medium text-foreground"
                >
                  {chunkData.related_chapter_titles}
                </div>
                {!isStandaloneChat && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSearchInReader}
                    disabled={searching}
                    className="size-7 flex-shrink-0 rounded-full px-2 text-xs"
                    title="查看原文"
                  >
                    {searching ? (
                      <>
                        <Loader className="h-3 w-3 animate-spin" />
                      </>
                    ) : (
                      <>
                        <SquareArrowOutUpRight className="h-3 w-3" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 pt-0">
              <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground text-sm leading-relaxed">
                <Markdown>{chunkData.chunk_text}</Markdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 text-muted-foreground text-sm">点击查看原文内容</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
