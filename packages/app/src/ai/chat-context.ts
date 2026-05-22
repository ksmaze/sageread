import { isSemanticIndexingSupported } from "@/services/book-format";
import type { BookFormat } from "@/types/simple-book";

export const PDF_SELECTED_TEXT_ONLY_MESSAGE = "PDF 暂不支持整本书 AI。请先选中 PDF 文本后使用解释或询问 AI。";

export interface BookChatContext {
  activeBookId?: string;
  activeBookFormat?: BookFormat;
}

export function isBookWideRagSupported(format: BookFormat | undefined): boolean {
  return format == null || isSemanticIndexingSupported(format);
}

export function shouldAttachBookWideRagTools(chatContext: BookChatContext | undefined): boolean {
  if (!chatContext?.activeBookId) {
    return false;
  }

  return isBookWideRagSupported(chatContext.activeBookFormat);
}

export function canUseBookWideContext(chatContext: BookChatContext | undefined): boolean {
  return chatContext?.activeBookFormat !== "PDF";
}

export function canSubmitBookChatPrompt(
  chatContext: BookChatContext | undefined,
  selectedTextReferenceCount: number,
): { allowed: true } | { allowed: false; reason: string } {
  if (chatContext?.activeBookId && chatContext.activeBookFormat === "PDF" && selectedTextReferenceCount === 0) {
    return { allowed: false, reason: PDF_SELECTED_TEXT_ONLY_MESSAGE };
  }

  return { allowed: true };
}
