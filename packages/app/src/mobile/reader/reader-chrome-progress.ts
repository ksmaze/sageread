import type { PageInfo } from "@/types/book";

export function formatReaderPageProgress(pageinfo: Pick<PageInfo, "current" | "total"> | undefined): string {
  if (!pageinfo || pageinfo.current < 0 || pageinfo.total <= 0) {
    return "";
  }

  return `已读 ${pageinfo.current + 1} / ${pageinfo.total} 页`;
}
