import { tool } from "ai";
import { z } from "zod";
import type { ChatContext } from "@/hooks/use-chat-state";
import type { ResolvedNoteSource, ResolveNoteSourceInput } from "../note-source-resolver";

export type NoteSourceResolver = (
  input: ResolveNoteSourceInput,
  chatContext?: ChatContext,
) => Promise<ResolvedNoteSource>;

export const RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION = `在当前阅读章节内定位学习笔记或批注的原文位置，返回可保存到笔记的 CFI。

使用规则：
• 仅用于确认同一个目标原文段落/概念的 reader CFI，不负责选择学习笔记主题
• sourceCandidates 必须是同一个目标的 1-5 条短原文候选，候选来自引用/选中文本、RAG 原文片段或章节原文
• 引用/选中文本已经是真实原文时，优先作为候选；不要先改写成总结再定位
• 不要把多个无关段落塞进一次调用；生成多条学习笔记时，应逐条调用本工具并逐条保存
• 工具会优先搜索当前章节；匹配失败时会返回当前章节首位置作为 fallback
• 返回 matched 时，保存笔记应使用 matches[0].cfi/sourceText/contextBefore/contextAfter
• 返回 chapter-start 时，保存笔记只使用 fallback.cfi，不要伪造 sourceText，并在最终反馈中标明章首 fallback`;

export function createResolveNoteSourceTool(resolveNoteSource: NoteSourceResolver, chatContext?: ChatContext) {
  return tool({
    description: RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION,

    inputSchema: z.object({
      reasoning: z.string().min(1).describe("调用此工具的原因，例如：'需要为学习笔记确认原文 CFI'"),
      sourceCandidates: z
        .array(
          z.object({
            text: z.string().min(1).describe("同一个目标的章节短原文候选，优先 20-120 字"),
            reason: z.string().optional().describe("为什么选择这段原文作为定位依据"),
          }),
        )
        .min(1)
        .max(5)
        .describe("用于定位同一个目标的原文候选，按最可能匹配的顺序排列"),
      maxMatches: z.number().int().min(1).max(10).default(5).describe("最多返回的匹配位置数量"),
    }),

    execute: async (input) => {
      return resolveNoteSource(input, chatContext);
    },
  });
}
