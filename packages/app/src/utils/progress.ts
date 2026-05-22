import type { BookProgressSection } from "@/types/book";

interface ProgressWithSection {
  section?: BookProgressSection | null;
}

export function getProgressSectionIndex(progress: ProgressWithSection | null | undefined): number | undefined {
  const section = progress?.section;

  if (typeof section === "number") {
    return Number.isFinite(section) ? section : undefined;
  }

  if (section && typeof section.current === "number" && Number.isFinite(section.current)) {
    return section.current;
  }

  return undefined;
}
