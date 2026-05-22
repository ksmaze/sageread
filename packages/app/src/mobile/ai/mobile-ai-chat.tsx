import {
  Brain,
  History,
  Lightbulb,
  MessageCirclePlus,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  UserSearch,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LEARNING_NOTE_QUICK_ACTION_PROMPT } from "@/ai/learning-note-prompts";
import { createReaderNoteSourceResolver, getReaderChapterStartLocation } from "@/ai/reader-note-source-runtime";
import { ChatContainerRoot } from "@/components/prompt-kit/chat-container";
import { ScrollButton } from "@/components/prompt-kit/scroll-button";
import { ChatInputArea } from "@/components/side-chat/chat-input-area";
import { ChatMessages } from "@/components/side-chat/chat-messages";
import { ChatSurfaceProvider } from "@/components/side-chat/chat-surface-context";
import { ChatThreads } from "@/components/side-chat/chat-threads";
import ModelSelector from "@/components/side-chat/model-selector";
import { MindmapDialog } from "@/components/tools/mindmap-dialog";
import { Button } from "@/components/ui/button";
import { useChatState } from "@/hooks/use-chat-state";
import { cn } from "@/lib/utils";
import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { useAppSettingsStore } from "@/store/app-settings-store";
import { useChatReaderStore } from "@/store/chat-reader-store";
import { useLibraryStore } from "@/store/library-store";
import { useThemeStore } from "@/store/theme-store";
import type { Thread } from "@/types/thread";
import { getProgressSectionIndex } from "@/utils/progress";

interface MobileAiChatProps {
  bookId?: string;
  className?: string;
}

const promptSuggestions = [
  { text: "总结当前内容", icon: Sparkles },
  { text: "分析作者观点", icon: UserSearch },
  { text: "找出关键信息", icon: Search },
  { text: "解释这个概念", icon: Lightbulb },
  { text: "生成学习笔记", prompt: LEARNING_NOTE_QUICK_ACTION_PROMPT, icon: NotebookPen },
] as const;

function MobileChatLoadingState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-muted-foreground text-sm">
      正在载入对话...
    </div>
  );
}

function MobileChatEmptyState({
  onPrompt,
  selectedTextOnly,
}: {
  onPrompt: (prompt: string) => void;
  selectedTextOnly: boolean;
}) {
  return (
    <div className="mobile-scroll-area min-h-0 flex-1 overflow-y-auto px-1 py-4">
      <div className="flex min-h-full flex-col justify-end gap-5 pb-2">
        <div className="space-y-3 px-2">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Brain className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-semibold text-foreground text-lg">AI 阅读助手</h2>
            <p className="max-w-md text-muted-foreground text-sm leading-6">
              {selectedTextOnly
                ? "PDF 暂不支持整本书 AI。请在阅读器中选中文字后使用解释或询问 AI。"
                : "可以围绕当前书籍、最近阅读和已有笔记提问，也可以从下面的问题开始。"}
            </p>
          </div>
        </div>

        {!selectedTextOnly && (
          <div className="grid gap-2">
            {promptSuggestions.map((suggestion) => {
              const { text, icon: Icon } = suggestion;
              const prompt = "prompt" in suggestion ? suggestion.prompt : text;

              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => onPrompt(prompt)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-foreground text-sm transition-colors hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileAiChat({ bookId, className }: MobileAiChatProps) {
  const readerScoped = Boolean(bookId);
  const { toggleSettingsDialog } = useAppSettingsStore();
  const { autoScroll } = useThemeStore();
  const [toolDetail, setToolDetail] = useState<any>(null);
  const [showMindmapDialog, setShowMindmapDialog] = useState(false);

  const readerActiveContext = useReaderStore((state) => state.activeContext);
  const readerSetActiveContext = useReaderStore((state) => state.setActiveContext);
  const readerProgress = useReaderStore((state) => state.progress);
  const readerView = useReaderStore((state) => state.view);
  const readerBookData = useReaderStore((state) => state.bookData);
  const readerBookFormat = useReaderStore((state) => state.bookData?.book?.format);
  const readerCurrentThread = useReaderStore((state) => state.currentThread);
  const readerSetCurrentThread = useReaderStore((state) => state.setCurrentThread);

  const globalActiveBookId = useChatReaderStore((state) => state.activeBookId);
  const globalActiveContext = useChatReaderStore((state) => state.activeContext);
  const globalBookFormat = useChatReaderStore((state) => state.bookData?.book?.format);
  const globalSetActiveBookId = useChatReaderStore((state) => state.setActiveBookId);
  const globalSetActiveContext = useChatReaderStore((state) => state.setActiveContext);
  const globalCurrentThread = useChatReaderStore((state) => state.currentThread);
  const globalSetCurrentThread = useChatReaderStore((state) => state.setCurrentThread);
  const libraryBooks = useLibraryStore((state) => state.library);

  const activeBookId = readerScoped ? bookId : globalActiveBookId;
  const activeBookFormat = readerScoped
    ? readerBookFormat
    : (globalBookFormat ?? libraryBooks.find((book) => book.id === globalActiveBookId)?.format);
  const activeContext = readerScoped ? (readerActiveContext ?? undefined) : globalActiveContext;
  const currentThread = readerScoped ? (readerCurrentThread ?? null) : globalCurrentThread;
  const globalActiveBook = libraryBooks.find((book) => book.id === globalActiveBookId);
  const activeBookMeta = readerScoped
    ? readerBookData?.book
      ? { title: readerBookData.book.title, author: readerBookData.book.author }
      : undefined
    : globalActiveBook
      ? { title: globalActiveBook.title, author: globalActiveBook.author }
      : undefined;
  const chapterStartLocation = useMemo(
    () =>
      readerScoped
        ? getReaderChapterStartLocation({
            view: readerView,
            progress: readerProgress,
            bookDoc: readerBookData?.bookDoc,
          })
        : undefined,
    [readerBookData?.bookDoc, readerProgress, readerScoped, readerView],
  );
  const resolveNoteSource = useMemo(
    () =>
      readerScoped
        ? createReaderNoteSourceResolver({
            view: readerView,
            progress: readerProgress,
            bookDoc: readerBookData?.bookDoc,
            searchConfig: readerBookData?.config?.searchConfig,
            primaryLanguage: readerBookData?.book?.primaryLanguage,
          })
        : undefined,
    [
      readerBookData?.book?.primaryLanguage,
      readerBookData?.bookDoc,
      readerBookData?.config?.searchConfig,
      readerProgress,
      readerScoped,
      readerView,
    ],
  );
  const setActiveContext: (context: string | undefined) => void =
    readerScoped && readerSetActiveContext ? readerSetActiveContext : globalSetActiveContext;
  const setCurrentThread: (thread: Thread | null) => void =
    readerScoped && readerSetCurrentThread ? readerSetCurrentThread : globalSetCurrentThread;
  const setActiveBookId: (nextBookId: string) => void = readerScoped
    ? () => {}
    : (nextBookId) => globalSetActiveBookId(nextBookId);

  const {
    input,
    references,
    displayError,
    showThreads,
    threadsKey,
    isInit,
    messages,
    status,
    selectedModel,
    currentThread: resolvedCurrentThread,

    stop,
    setInput,
    setSelectedModel,
    handleAskSelection,
    handleRemoveReference,
    handleSubmit,
    handleRetry,
    handleNewThread,
    handleShowThreads,
    handleSelectThread,
    handleBackFromThreads,
    handleReasoningTimesUpdate,
  } = useChatState({
    chatContext: {
      activeBookId,
      activeBookFormat,
      activeBookMeta,
      activeContext,
      activeSectionLabel: readerScoped ? readerProgress?.sectionLabel : undefined,
      activeSectionHref: readerScoped ? readerProgress?.sectionHref : undefined,
      activeSectionIndex: readerScoped ? getProgressSectionIndex(readerProgress) : undefined,
      activeChapterStartCfi: chapterStartLocation?.cfi,
    },
    resolveNoteSource,
    setActiveBookId,
    setActiveContext,
    currentThread,
    setCurrentThread,
  });

  const handleViewToolDetail = (toolPart: any) => {
    setToolDetail(toolPart);
    setShowMindmapDialog(true);
  };

  const handlePrompt = (prompt: string) => {
    setInput(prompt);
    void handleSubmit(prompt);
  };

  const handleCreateThread = () => {
    handleNewThread();
    if (showThreads) {
      handleBackFromThreads();
    }
  };

  return (
    <ChatSurfaceProvider surface={readerScoped ? "reader" : "standalone"}>
      <main id="chat-sidebar" className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        <div className="shrink-0 pb-2">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ModelSelector
                selectedModel={selectedModel}
                onModelSelect={setSelectedModel}
                className="h-11 max-w-[calc(100vw-10rem)] rounded-full text-sm md:max-w-72"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="新对话"
                className="mobile-reader-control size-11 rounded-full hover:bg-muted"
                onClick={handleCreateThread}
              >
                <MessageCirclePlus className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="历史对话"
                className="mobile-reader-control size-11 rounded-full hover:bg-muted"
                onClick={handleShowThreads}
              >
                <History className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="设置"
                className="mobile-reader-control size-11 rounded-full hover:bg-muted"
                onClick={toggleSettingsDialog}
              >
                <Settings className="size-5" />
              </Button>
            </div>
          </div>
        </div>

        {showThreads ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ChatThreads
              key={`threads-${threadsKey}`}
              bookId={readerScoped ? bookId : undefined}
              onBack={handleBackFromThreads}
              onSelectThread={handleSelectThread}
            />
          </div>
        ) : !isInit.current ? (
          <MobileChatLoadingState />
        ) : messages.length === 0 ? (
          <MobileChatEmptyState onPrompt={handlePrompt} selectedTextOnly={activeBookFormat === "PDF"} />
        ) : (
          <ChatContainerRoot className="relative min-h-0 flex-1" autoScroll={autoScroll}>
            <ChatMessages
              messages={messages}
              status={status}
              error={displayError}
              autoScroll={autoScroll}
              scrollKey={resolvedCurrentThread?.id ?? (readerScoped ? `reader-${bookId}` : "__mobile_global__")}
              onReasoningTimesUpdate={handleReasoningTimesUpdate}
              onRetry={handleRetry}
              canRetry={status === "ready" && !!displayError}
              onAskSelection={handleAskSelection}
              onViewToolDetail={handleViewToolDetail}
            />
            <div className="pointer-events-none absolute bottom-4 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-end px-5">
              <div className="pointer-events-auto">
                <ScrollButton />
              </div>
            </div>
          </ChatContainerRoot>
        )}

        {!showThreads && (
          <ChatInputArea
            input={input}
            setInput={setInput}
            references={references}
            onRemoveReference={handleRemoveReference}
            onSubmit={handleSubmit}
            onStop={stop}
            status={status}
            activeBookId={activeBookId}
            selectedTextOnly={activeBookFormat === "PDF"}
            setActiveBookId={(nextBookId) => {
              if (nextBookId) {
                setActiveBookId(nextBookId);
              } else if (!readerScoped) {
                globalSetActiveBookId(undefined);
              }
            }}
            showContextPicker={!readerScoped}
          />
        )}

        <MindmapDialog open={showMindmapDialog} onOpenChange={setShowMindmapDialog} toolPart={toolDetail} />
      </main>
    </ChatSurfaceProvider>
  );
}
