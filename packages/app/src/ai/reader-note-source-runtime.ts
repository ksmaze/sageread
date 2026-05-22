import type { BookDoc } from "@/lib/document";
import type { BookProgress, BookSearchConfig } from "@/types/book";
import type { FoliateView } from "@/types/view";
import { createRejecttFilter } from "@/utils/node";
import { getProgressSectionIndex } from "@/utils/progress";
import {
  type ChapterStartLocation,
  type ResolveNoteSourceRuntime,
  resolveNoteSourceFromView,
  selectChapterStartLocation,
} from "./note-source-resolver";
import type { NoteSourceResolver } from "./tools";

export { getProgressSectionIndex };

export interface ReaderNoteSourceRuntimeInput {
  view?: FoliateView | null;
  progress?: BookProgress;
  bookDoc?: BookDoc | null;
  searchConfig?: Partial<BookSearchConfig>;
  primaryLanguage?: string;
}

type SearchableFoliateView = FoliateView & {
  book?: {
    sections?: Array<{
      createDocument?: () => Document | Promise<Document>;
    }>;
  };
};

function getSectionDocumentFromView(
  view: FoliateView,
  index: number,
): Document | Promise<Document | undefined> | undefined {
  const section = (view as SearchableFoliateView).book?.sections?.[index];
  return section?.createDocument?.();
}

function buildNoteSourceSearchConfig(input: ReaderNoteSourceRuntimeInput): Partial<BookSearchConfig> {
  const rejectRubyText = input.primaryLanguage?.startsWith("ja") ? ["rt"] : [];
  return {
    ...input.searchConfig,
    acceptNode:
      input.searchConfig?.acceptNode ??
      createRejecttFilter({
        tags: rejectRubyText,
      }),
  };
}

export function getReaderChapterStartLocation(input: ReaderNoteSourceRuntimeInput): ChapterStartLocation | undefined {
  const sectionIndex = getProgressSectionIndex(input.progress);

  return selectChapterStartLocation({
    toc: input.bookDoc?.toc,
    sectionHref: input.progress?.sectionHref,
    sectionIndex,
    sectionLabel: input.progress?.sectionLabel,
    getSectionStartCfi:
      input.view && typeof sectionIndex === "number" ? (index) => input.view?.getCFI(index, null) : undefined,
  });
}

export function createReaderNoteSourceResolver(input: ReaderNoteSourceRuntimeInput): NoteSourceResolver | undefined {
  if (!input.view || !input.progress) {
    return undefined;
  }

  const sectionIndex = getProgressSectionIndex(input.progress);
  const runtime: ResolveNoteSourceRuntime = {
    view: input.view,
    searchConfig: buildNoteSourceSearchConfig(input),
    toc: input.bookDoc?.toc,
    sectionHref: input.progress.sectionHref,
    sectionIndex,
    sectionLabel: input.progress.sectionLabel,
    getSectionDocument: (index) => (input.view ? getSectionDocumentFromView(input.view, index) : undefined),
  };

  return (resolverInput) => resolveNoteSourceFromView(resolverInput, runtime);
}
