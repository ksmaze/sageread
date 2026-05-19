import { tool } from "ai";
import { z } from "zod";
import { getNotes } from "@/services/note-service";
import type { Note } from "@/types/note";

interface FormattedNote {
  id: string;
  title: string | null;
  content: string | null;
  bookInfo: {
    id: string;
    title: string;
    author: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatNote(note: Note): FormattedNote {
  return {
    id: note.id,
    title: note.title ?? null,
    content: note.content ?? null,
    bookInfo: note.bookMeta
      ? {
          id: note.bookId ?? "",
          title: note.bookMeta.title,
          author: note.bookMeta.author ?? "",
        }
      : null,
    createdAt: formatTimestamp(note.createdAt),
    updatedAt: formatTimestamp(note.updatedAt),
  };
}

function filterNotesByTimeRange(notes: Note[], days?: number): Note[] {
  if (!days) return notes;

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return notes.filter((note) => note.createdAt >= cutoffTime);
}

function filterNotesByBookTitle(notes: Note[], bookTitle?: string): Note[] {
  if (!bookTitle) return notes;

  const searchTerm = bookTitle.toLowerCase().trim();
  return notes.filter((note) => {
    if (!note.bookMeta?.title) return false;
    return note.bookMeta.title.toLowerCase().includes(searchTerm);
  });
}

function getTimeRangeDescription(days?: number): string {
  if (!days) return "全部";
  if (days === 7) return "最近7天";
  if (days === 30) return "最近30天";
  if (days === 60) return "最近60天";
  if (days === 365) return "最近365天";
  return `最近${days}天`;
}

export const notesTool = tool({
  description: `获取用户创建的笔记，支持按时间和书籍筛选。

🎯 **常见用法**：
• "总结最近的笔记" → days=7
• "我这一周添加了什么笔记" → days=7
• "分析这个月的笔记" → days=30
• "分析这两个月的笔记" → days=60
• "分析今年的笔记" → days=365
• "总结《人类简史》相关的笔记" → bookTitle="人类简史"

📊 **返回内容**：
笔记列表，包含标题、完整内容、书籍信息、创建时间，适合AI分析和总结`,

  inputSchema: z.object({
    reasoning: z.string().min(1).describe("调用此工具的原因，例如：'用户想总结最近一周的笔记'"),
    days: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .optional()
      .describe("时间范围：最近几天的笔记。7=一周, 30=一个月, 60=两个月, 365=今年。不传则返回所有"),
    bookId: z.string().min(1).optional().describe("指定书籍ID，精确匹配"),
    bookTitle: z.string().min(1).optional().describe("按书名搜索，模糊匹配（如'人类'可匹配'人类简史'）"),
    limit: z.number().int().min(1).max(200).default(50).describe("最多返回条数，默认50"),
  }),

  execute: async ({
    reasoning,
    days,
    bookId,
    bookTitle,
    limit,
  }: {
    reasoning: string;
    days?: number;
    bookId?: string;
    bookTitle?: string;
    limit?: number;
  }) => {
    try {
      // 1. 从数据库获取笔记（可能按 bookId 过滤）
      const rawNotes = await getNotes({
        bookId: bookId?.trim() || undefined,
        sortBy: "created_at",
        sortOrder: "desc",
        limit: limit || 50,
      });

      // 2. 应用时间范围过滤
      let filteredNotes = filterNotesByTimeRange(rawNotes, days);

      // 3. 应用书名模糊搜索（如果提供了 bookTitle）
      filteredNotes = filterNotesByBookTitle(filteredNotes, bookTitle);

      // 4. 格式化数据
      const formattedNotes = filteredNotes.map(formatNote);

      // 5. 构建返回结果（统一使用 results 字段）
      return {
        results: formattedNotes,
        summary: {
          total: formattedNotes.length,
          timeRange: getTimeRangeDescription(days),
          bookFilter: bookTitle || (bookId ? "指定书籍" : null),
        },
        meta: {
          reasoning,
          filters: {
            days: days ?? null,
            bookId: bookId ?? null,
            bookTitle: bookTitle ?? null,
            limit: limit ?? 50,
          },
        },
      };
    } catch (error) {
      throw new Error(`获取笔记失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  },
});
