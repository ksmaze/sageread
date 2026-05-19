import { ArrowUp, BookOpen, Brain, Notebook, Paperclip, Quote, X } from "lucide-react";
import { useRef } from "react";
import { PromptInput, PromptInputAction, PromptInputTextarea } from "@/components/prompt-kit/prompt-input";
import { Button } from "@/components/ui/button";
import type { ChatReference } from "@/types/message";
import { useIsStandaloneChatSurface } from "./chat-surface-context";
import { ContextPopover } from "./context-popover";

interface ChatInputAreaProps {
  references: ChatReference[];
  input: string;
  status: string;
  activeBookId: string | undefined;
  showToolDetail?: boolean;
  showContextPicker?: boolean;
  showQuickActions?: boolean;
  selectedTextOnly?: boolean;

  setInput: (value: string) => void;
  onRemoveReference: (id: string) => void;
  onSubmit: (promptOverride?: string) => Promise<void>;
  onStop: () => void;
  setActiveBookId: (bookId: string | undefined) => void;
}

const quickActions = [
  { label: "总结本章", icon: BookOpen, prompt: "请帮我总结本章的核心要点和结论。" },
  { label: "分析观点", icon: Brain, prompt: "请分析作者的观点，指出论据与可能的偏见。" },
  { label: "生成思维导图", icon: Notebook, prompt: "请基于当前内容生成思维导图。" },
] as const;

export function ChatInputArea({
  input,
  status,
  references,
  activeBookId,
  showToolDetail = false,
  showContextPicker,
  showQuickActions,
  selectedTextOnly = false,

  setActiveBookId,
  onRemoveReference,
  onSubmit,
  onStop,
  setInput,
}: ChatInputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStandaloneChat = useIsStandaloneChatSurface();
  const shouldShowContextPicker = showContextPicker ?? isStandaloneChat;
  const shouldShowQuickActions = showQuickActions ?? true;
  const isSelectedTextRequired = selectedTextOnly && references.length === 0 && status === "ready";
  const shouldShowQuickActionsAboveInput = shouldShowQuickActions && !isStandaloneChat && !selectedTextOnly;
  const shouldShowQuickActionsInInput = shouldShowQuickActions && isStandaloneChat && !selectedTextOnly;
  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    if (status === "ready") {
      void onSubmit(prompt);
    }
  };

  return (
    <div className="z-10 shrink-0 px-2 pr-0 pl-1.5">
      {selectedTextOnly && (
        <div className="px-2 py-1.5 text-muted-foreground text-xs">
          PDF 暂不支持整本书 AI，请先选中 PDF 文本后使用解释或询问 AI。
        </div>
      )}
      {shouldShowQuickActionsAboveInput && (
        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map(({ label, icon: Icon, prompt }) => (
              <PromptInputAction key={label} tooltip={label}>
                <Button
                  variant="soft"
                  className="h-7 cursor-pointer"
                  size="sm"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  <Icon className="size-4" />
                  {!showToolDetail && <span className="text-xs">{label}</span>}
                </Button>
              </PromptInputAction>
            ))}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <PromptInput
          isLoading={status !== "ready"}
          disabled={isSelectedTextRequired}
          value={input}
          onValueChange={setInput}
          onSubmit={() => {
            void onSubmit();
          }}
          className="relative z-10 w-full rounded-2xl border bg-background shadow-around dark:bg-neutral-800"
        >
          {(shouldShowContextPicker || shouldShowQuickActionsInInput) && (
            <div className="flex items-center justify-between gap-2 py-2">
              {shouldShowContextPicker ? (
                <ContextPopover activeBookId={activeBookId} setActiveBookId={setActiveBookId} />
              ) : (
                <div />
              )}
              {shouldShowQuickActionsInInput && (
                <div className="flex flex-wrap items-center gap-2">
                  {quickActions.map(({ label, icon: Icon, prompt }) => (
                    <PromptInputAction key={label} tooltip={label}>
                      <Button
                        variant="soft"
                        className="h-7 cursor-pointer"
                        size="sm"
                        onClick={() => handleQuickPrompt(prompt)}
                      >
                        <Icon className="size-4" />
                        {!showToolDetail && <span className="text-xs">{label}</span>}
                      </Button>
                    </PromptInputAction>
                  ))}
                </div>
              )}
            </div>
          )}
          {references.length > 0 && (
            <div className="my-1 flex flex-col">
              {references.map((reference) => (
                <div
                  key={reference.id}
                  className="group flex w-full items-start gap-2 rounded-xl border border-neutral-200 bg-muted/70 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-700/70"
                >
                  <Quote className="mt-[1px] size-3.5 text-neutral-600 dark:text-neutral-100" />
                  <span className="flex-1 whitespace-pre-wrap break-words text-left text-neutral-700 dark:text-neutral-100">
                    {reference.text}
                  </span>
                  <button
                    type="button"
                    className="mt-0.5 text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-300 dark:hover:text-neutral-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveReference(reference.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <PromptInputTextarea
            placeholder={isSelectedTextRequired ? "选中 PDF 文本后可询问 AI" : "问我任何问题..."}
            className="flex-1 py-2 pl-2 text-sm leading-[1.3] placeholder:font-light dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" />
            <PromptInputAction tooltip="上传文件">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="size-8 rounded-full dark:border-neutral-600 dark:hover:bg-neutral-700"
              >
                <Paperclip className="size-4" />
              </Button>
            </PromptInputAction>

            <Button
              type="submit"
              size="icon"
              disabled={
                isSelectedTextRequired ||
                (status === "ready" ? !input.trim() : status !== "submitted" && status !== "streaming")
              }
              onClick={() => {
                if (status === "ready") {
                  void onSubmit();
                } else {
                  onStop();
                }
              }}
              className="size-8 rounded-full"
            >
              {status === "ready" ? (
                <ArrowUp size={18} />
              ) : (
                <span className="size-2 rounded-xs bg-white dark:bg-neutral-900" />
              )}
            </Button>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}
