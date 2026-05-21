import { tool } from "ai";
import { z } from "zod";
import type { ChatContext } from "@/hooks/use-chat-state";
import { getBookWithStatusById } from "@/services/book-service";
import { createNote } from "@/services/note-service";
import type { BookMeta, CreateNoteData } from "@/types/note";

async function resolveBookMeta(bookId: string, chatContext?: ChatContext): Promise<BookMeta> {
  if (chatContext?.activeBookId === bookId && chatContext.activeBookMeta) {
    return chatContext.activeBookMeta;
  }

  const book = await getBookWithStatusById(bookId);
  if (!book) {
    throw new Error(`未找到书籍: ${bookId}`);
  }

  return {
    title: book.title,
    author: book.author,
  };
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function createCreateNoteTool(chatContext?: ChatContext) {
  return tool({
    description: `保存一条学习笔记到现有 notes 数据库。

使用规则：
• 用户明确要求“生成学习笔记”或要求保存笔记时使用
• 默认保存到当前书籍；不要让模型编造书籍元信息
• 如果 resolveNoteSource 返回 matched，必须带上 cfi、sourceText、contextBefore、contextAfter
• 如果 resolveNoteSource 返回 chapter-start，只带 fallback.cfi，不要伪造 sourceText
• title 要短，content 要精简但信息完整`,

    inputSchema: z.object({
      reasoning: z.string().min(1).describe("调用此工具的原因，例如：'用户明确要求生成并保存学习笔记'"),
      title: z.string().min(1).max(120).describe("笔记标题，短句即可"),
      content: z.string().min(1).describe("笔记正文，使用精简 Markdown，总结重要信息"),
      bookId: z.string().min(1).optional().describe("目标书籍 ID；不传时使用当前阅读书籍"),
      cfi: z.string().min(1).optional().describe("真实 Foliate CFI，必须来自 resolveNoteSource 或 reader selection"),
      sourceText: z.string().min(1).optional().describe("真实原文摘录；只有匹配到原文时填写"),
      contextBefore: z.string().optional().describe("原文前文上下文，来自 resolveNoteSource"),
      contextAfter: z.string().optional().describe("原文后文上下文，来自 resolveNoteSource"),
    }),

    execute: async (input) => {
      const bookId = cleanOptional(input.bookId) ?? chatContext?.activeBookId;
      if (!bookId) {
        throw new Error("保存书籍学习笔记需要当前书籍上下文。");
      }

      const cfi = cleanOptional(input.cfi);
      const sourceText = cleanOptional(input.sourceText);
      if (sourceText && !cfi) {
        throw new Error("sourceText 必须和真实 CFI 一起保存，不能保存无位置的原文摘录。");
      }

      const bookMeta = await resolveBookMeta(bookId, chatContext);
      const data: CreateNoteData = {
        bookId,
        bookMeta,
        title: input.title.trim(),
        content: input.content.trim(),
        cfi,
        sourceText,
        contextBefore: cleanOptional(input.contextBefore),
        contextAfter: cleanOptional(input.contextAfter),
      };

      const note = await createNote(data);

      return {
        success: true,
        note: {
          id: note.id,
          title: note.title ?? null,
          content: note.content ?? null,
          bookId: note.bookId ?? null,
          bookTitle: note.bookMeta?.title ?? bookMeta.title,
          cfi: note.cfi ?? null,
          sourceText: note.sourceText ?? null,
          createdAt: new Date(note.createdAt).toISOString(),
        },
        location: {
          type: sourceText ? "source-match" : cfi ? "chapter-start" : "none",
          cfi: cfi ?? null,
          sourceText: sourceText ?? null,
        },
        meta: {
          reasoning: input.reasoning,
          toolType: "createNote",
        },
      };
    },
  });
}
