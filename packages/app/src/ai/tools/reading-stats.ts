import { invoke } from "@tauri-apps/api/core";
import { tool } from "ai";
import { z } from "zod";
import type { ReadingSession } from "@/types/reading-session";

async function loadSessions(bookId: string, limit: number): Promise<ReadingSession[]> {
  if (limit <= 0) {
    return [];
  }

  return await invoke<ReadingSession[]>("get_reading_sessions_by_book", {
    bookId,
    limit,
  });
}

function summarizeSessions(sessions: ReadingSession[]) {
  if (!sessions.length) {
    return null;
  }

  const totalDurationSeconds = sessions.reduce((acc, session) => acc + session.durationSeconds, 0);
  const activeSessions = sessions.filter((session) => !session.endedAt).length;
  const lastSession = sessions[0];

  return {
    totalSessions: sessions.length,
    activeSessions,
    totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(1)),
    averageDurationMinutes: Number((totalDurationSeconds / sessions.length / 60).toFixed(1)),
    lastSession: {
      id: lastSession.id,
      startedAt: lastSession.startedAt,
      endedAt: lastSession.endedAt ?? null,
      durationMinutes: Number((lastSession.durationSeconds / 60).toFixed(1)),
      isActive: lastSession.endedAt == null,
    },
  };
}

export const getReadingStatsTool = tool({
  description: `获取指定书籍的阅读统计信息。

🎯 **核心功能**：
• 获取书籍的阅读会话列表
• 提供阅读时长、次数等统计摘要
• 分析阅读行为和习惯

📊 **返回内容**：
阅读会话列表和统计摘要，包含总时长、平均时长、最近会话等信息`,

  inputSchema: z.object({
    reasoning: z.string().min(1).describe("调用此工具的原因，例如：'用户想了解这本书的阅读统计'"),
    bookId: z.string().min(1).describe("书籍ID，必须指定"),
    sessionLimit: z.number().int().min(1).max(20).default(5).describe("返回的会话数量，默认5条"),
  }),

  execute: async ({
    reasoning,
    bookId,
    sessionLimit,
  }: {
    reasoning: string;
    bookId: string;
    sessionLimit?: number;
  }) => {
    try {
      // 1. 加载阅读会话
      const sessions = await loadSessions(bookId.trim(), sessionLimit || 5);

      // 2. 生成统计摘要
      const summary = summarizeSessions(sessions);

      // 3. 格式化会话列表（统一使用 results 字段）
      const results = sessions.map((session) => ({
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt ?? null,
        durationMinutes: Number((session.durationSeconds / 60).toFixed(1)),
        isActive: session.endedAt == null,
      }));

      return {
        results,
        summary: summary ?? {
          totalSessions: 0,
          activeSessions: 0,
          totalDurationMinutes: 0,
          averageDurationMinutes: 0,
          lastSession: null,
        },
        meta: {
          reasoning,
          bookId,
          sessionLimit: sessionLimit || 5,
        },
      };
    } catch (error) {
      throw new Error(`获取阅读统计失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  },
});
