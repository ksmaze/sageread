import { tool } from "ai";
import { z } from "zod";
import type { ChatContext } from "@/hooks/use-chat-state";
import type { ResolvedNoteSource, ResolveNoteSourceInput } from "../note-source-resolver";

export type NoteSourceResolver = (
  input: ResolveNoteSourceInput,
  chatContext?: ChatContext,
) => Promise<ResolvedNoteSource>;

export function createResolveNoteSourceTool(resolveNoteSource: NoteSourceResolver, chatContext?: ChatContext) {
  return tool({
    description: `在当前阅读章节内定位学习笔记的原文位置，返回可保存到笔记的 CFI。

使用规则：
• 仅当需要把聊天/章节总结保存为书籍笔记时使用
• 输入 1-5 条短原文候选，候选必须是来自章节或检索结果的原文短句，不要输入自己改写的总结
• 工具会优先搜索当前章节；匹配失败时会返回当前章节首位置作为 fallback
• 返回 matched 时，保存笔记应使用 matches[0].cfi/sourceText/contextBefore/contextAfter
• 返回 chapter-start 时，保存笔记只使用 fallback.cfi，不要伪造 sourceText`,

    inputSchema: z.object({
      reasoning: z.string().min(1).describe("调用此工具的原因，例如：'需要为学习笔记确认原文 CFI'"),
      sourceCandidates: z
        .array(
          z.object({
            text: z.string().min(1).describe("章节中的短原文候选，优先 20-120 字"),
            reason: z.string().optional().describe("为什么选择这句原文作为定位依据"),
          }),
        )
        .min(1)
        .max(5)
        .describe("用于定位的原文候选，按最可能匹配的顺序排列"),
      maxMatches: z.number().int().min(1).max(10).default(5).describe("最多返回的匹配位置数量"),
    }),

    execute: async (input) => {
      return resolveNoteSource(input, chatContext);
    },
  });
}
