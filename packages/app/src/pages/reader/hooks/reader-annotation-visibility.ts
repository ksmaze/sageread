import type { BookProgress } from "@/types/book";
import type { FoliateView } from "@/types/view";
import * as CFI from "foliate-js/epubcfi.js";

type ProgressForVisibility = Pick<BookProgress, "location"> & {
  range?: Range | null;
};

type CfiResolver = Pick<FoliateView, "resolveCFI">;

function resolveIndex(view: CfiResolver | null | undefined, cfi: string): number | null {
  try {
    const resolved = view?.resolveCFI(cfi);
    return typeof resolved?.index === "number" ? resolved.index : null;
  } catch {
    return null;
  }
}

function isSamePageByPrefix(annotationCfi: string, pageCfi: string): boolean {
  const inner = pageCfi.match(/^epubcfi\((.*)\)$/)?.[1];
  if (!inner) return annotationCfi === pageCfi;
  return annotationCfi === pageCfi || annotationCfi.startsWith(`epubcfi(${inner}!`);
}

export function isAnnotationVisibleAtProgress(
  annotationCfi: string,
  progress: ProgressForVisibility | null | undefined,
  view?: CfiResolver | null,
): boolean {
  if (!annotationCfi || !progress?.location) return false;

  if (!progress.range) {
    const annotationIndex = resolveIndex(view, annotationCfi);
    const pageIndex = resolveIndex(view, progress.location);
    if (annotationIndex !== null && pageIndex !== null) {
      return annotationIndex === pageIndex;
    }

    return isSamePageByPrefix(annotationCfi, progress.location);
  }

  try {
    const start = CFI.collapse(progress.location);
    const end = CFI.collapse(progress.location, true);
    return CFI.compare(annotationCfi, start) >= 0 && CFI.compare(annotationCfi, end) <= 0;
  } catch {
    return false;
  }
}
