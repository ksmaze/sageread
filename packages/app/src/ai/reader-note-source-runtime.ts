import type { BookDoc } from "@/lib/document";
import type { BookProgress } from "@/types/book";
import type { FoliateView } from "@/types/view";
import {
  type ChapterStartLocation,
  type ResolveNoteSourceRuntime,
  resolveNoteSourceFromView,
  selectChapterStartLocation,
} from "./note-source-resolver";
import type { NoteSourceResolver } from "./tools";

export interface ReaderNoteSourceRuntimeInput {
  view?: FoliateView | null;
  progress?: BookProgress;
  bookDoc?: BookDoc | null;
}

export function getReaderChapterStartLocation(input: ReaderNoteSourceRuntimeInput): ChapterStartLocation | undefined {
  return selectChapterStartLocation({
    toc: input.bookDoc?.toc,
    sectionHref: input.progress?.sectionHref,
    sectionIndex: input.progress?.section,
    sectionLabel: input.progress?.sectionLabel,
    getSectionStartCfi:
      input.view && typeof input.progress?.section === "number"
        ? (index) => input.view?.getCFI(index, null)
        : undefined,
  });
}

export function createReaderNoteSourceResolver(input: ReaderNoteSourceRuntimeInput): NoteSourceResolver | undefined {
  if (!input.view || !input.progress) {
    return undefined;
  }

  const runtime: ResolveNoteSourceRuntime = {
    view: input.view,
    toc: input.bookDoc?.toc,
    sectionHref: input.progress.sectionHref,
    sectionIndex: input.progress.section,
    sectionLabel: input.progress.sectionLabel,
  };

  return (resolverInput) => resolveNoteSourceFromView(resolverInput, runtime);
}
