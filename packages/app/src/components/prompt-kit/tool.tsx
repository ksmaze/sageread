import { CheckCircle, ChevronDown, Eye, Loader2, MapPin, Settings, XCircle } from "lucide-react";
import { useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TOOL_NAME_MAP } from "../side-chat/chat-messages";

export type ToolPart = {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
  onViewDetail?: (toolPart: ToolPart) => void;
  isStandaloneChat?: boolean;
};

type SavedNoteOutput = {
  title?: string | null;
  bookTitle?: string | null;
  cfi?: string | null;
  sourceText?: string | null;
};

const Tool = ({ toolPart, defaultOpen = false, className, onViewDetail, isStandaloneChat = false }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { state, input, output, type } = toolPart;
  const { stopScroll } = useStickToBottomContext();
  const isMindmap = type === TOOL_NAME_MAP.mindmap;
  const isRagTool =
    type === TOOL_NAME_MAP.ragSearch || type === TOOL_NAME_MAP.ragContext || type === TOOL_NAME_MAP.ragToc;
  const isGetSkillsTool = type === TOOL_NAME_MAP.getSkills;
  const isCreateNoteTool = type === TOOL_NAME_MAP.createNote;
  const isResolveNoteSourceTool = type === TOOL_NAME_MAP.resolveNoteSource;
  const savedNote = isCreateNoteTool ? (output?.note as SavedNoteOutput | undefined) : undefined;
  const sourceResolutionStatus = isResolveNoteSourceTool ? String(output?.status ?? "") : "";

  const handleOpenChange = (open: boolean) => {
    stopScroll();
    setIsOpen(open);
  };

  const getStateIcon = () => {
    switch (state) {
      case "input-streaming":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "input-available":
        return <Settings className="h-4 w-4 text-orange-500" />;
      case "output-available":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "output-error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStateBadge = () => {
    const baseClasses = "px-1 py-0.5 rounded-full text-xs font-medium";
    switch (state) {
      case "input-streaming":
        return (
          <span className={cn(baseClasses, "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400")}>
            Processing
          </span>
        );
      case "input-available":
        return (
          <span className={cn(baseClasses, "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400")}>
            Ready
          </span>
        );
      case "output-available":
        return (
          <span className={cn(baseClasses, "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>
            Completed
          </span>
        );
      case "output-error":
        return (
          <span className={cn(baseClasses, "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>Error</span>
        );
      default:
        return (
          <span className={cn(baseClasses, "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400")}>
            Pending
          </span>
        );
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className={className} data-tool-id={toolPart.toolCallId}>
      {input && "reasoning" in input && (
        <div className="my-2 mb-4">
          <p className="border-neutral-300 border-l-2 pl-1 text-muted-foreground text-sm leading-4.5">
            {String(input.reasoning)}
          </p>
        </div>
      )}

      <div className="mb-2 overflow-hidden rounded-lg border border-border">
        <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
          <CollapsibleTrigger asChild>
            <div className="flex h-auto w-full cursor-pointer justify-between gap-2 rounded-b-none px-3 py-2 font-normal hover:bg-muted">
              <div className="flex flex-1 items-center gap-2 overflow-hidden">
                <div>{getStateIcon()}</div>
                <span className="flex-nowrap text-sm">{type}</span>
                {type === TOOL_NAME_MAP.ragSearch && input?.question && (
                  <span className="flex-1 overflow-hidden truncate font-medium font-mono text-sm">
                    {String(input?.question)}
                  </span>
                )}
                {isMindmap && (output?.results as any)?.title && (
                  <span
                    title={(output?.results as any)?.title}
                    className="flex-1 overflow-hidden truncate font-medium text-sm"
                  >
                    {String((output?.results as any)?.title)}
                  </span>
                )}
                {isCreateNoteTool && savedNote?.title && (
                  <span title={String(savedNote.title)} className="flex-1 overflow-hidden truncate font-medium text-sm">
                    {String(savedNote.title)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isMindmap && state === "output-available" && onViewDetail && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      stopScroll();
                      onViewDetail(toolPart);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                )}
                {isRagTool && isStandaloneChat && state === "output-available" && onViewDetail && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      stopScroll();
                      onViewDetail(toolPart);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                )}
                {isCreateNoteTool && state === "output-available" && (
                  <span className="text-muted-foreground text-sm">已保存</span>
                )}
                {isResolveNoteSourceTool && state === "output-available" && (
                  <span className="text-muted-foreground text-sm">
                    {sourceResolutionStatus === "matched"
                      ? `${String((output?.matches as unknown[] | undefined)?.length || 0)} 处`
                      : sourceResolutionStatus === "chapter-start"
                        ? "章节首"
                        : "未定位"}
                  </span>
                )}
                {!isMindmap &&
                  !isRagTool &&
                  !isGetSkillsTool &&
                  !isCreateNoteTool &&
                  !isResolveNoteSourceTool &&
                  state === "output-available" && (
                    <span className="text-muted-foreground text-sm">
                      {String((output?.results as unknown[] | undefined)?.length || 0)} results
                    </span>
                  )}
                {isRagTool && state === "output-available" && (
                  <span className="text-muted-foreground text-sm">
                    {String((output?.results as unknown[] | undefined)?.length || 0)} results
                  </span>
                )}
                {state !== "output-available" && getStateBadge()}
                <ChevronDown className={cn("h-4 w-4", isOpen && "rotate-180")} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              "border-border border-t",
              "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
            )}
          >
            <div className="space-y-3 bg-background p-3">
              {input && Object.keys(input).length > 0 && (
                <div>
                  <h4 className="mb-2 font-medium text-muted-foreground text-sm">Input</h4>
                  <div className="rounded border bg-background p-2 font-mono text-sm">
                    {Object.entries(input)
                      .filter(([key]) => key !== "reasoning")
                      .map(([key, value]) => (
                        <div key={key} className="mb-1">
                          <span className="text-muted-foreground">{key}:</span> <span>{formatValue(value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {output && (
                <div>
                  <h4 className="mb-2 font-medium text-muted-foreground text-sm">Output</h4>
                  {isCreateNoteTool && savedNote && (
                    <div className="mb-3 rounded-md border bg-muted/40 p-3 text-sm">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <CheckCircle className="size-4 text-green-600" />
                        <span>已保存笔记</span>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{String(savedNote.title ?? "未命名笔记")}</div>
                        {savedNote.bookTitle && (
                          <div className="text-muted-foreground text-xs">{String(savedNote.bookTitle)}</div>
                        )}
                        {savedNote.cfi && (
                          <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <MapPin className="size-3" />
                            <span>{savedNote.sourceText ? "原文位置" : "章节首位置"}</span>
                          </div>
                        )}
                        {savedNote.sourceText && (
                          <div className="mt-2 line-clamp-3 border-l-2 pl-2 text-muted-foreground text-xs">
                            {String(savedNote.sourceText)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="max-h-60 overflow-auto rounded border bg-background p-2 font-mono text-sm">
                    <pre className="whitespace-pre-wrap">{formatValue(output)}</pre>
                  </div>
                </div>
              )}

              {state === "output-error" && toolPart.errorText && (
                <div>
                  <h4 className="mb-2 font-medium text-red-500 text-sm">Error</h4>
                  <div className="rounded border border-red-200 bg-background p-2 text-sm dark:border-red-950 dark:bg-red-900/20">
                    {toolPart.errorText}
                  </div>
                </div>
              )}

              {state === "input-streaming" && (
                <div className="text-muted-foreground text-sm">Processing tool call...</div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export { Tool };
