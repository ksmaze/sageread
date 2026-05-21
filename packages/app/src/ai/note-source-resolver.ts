import type { TOCItem } from "@/lib/document";
import type { BookSearchConfig, BookSearchMatch, SearchExcerpt } from "@/types/book";
import type { FoliateView } from "@/types/view";

export interface NoteSourceCandidateInput {
  text: string;
  reason?: string;
}

export interface BuildSourceSearchQueriesOptions {
  maxQueries?: number;
  maxQueryLength?: number;
  minQueryLength?: number;
}

export interface ChapterStartLocation {
  cfi: string;
  label?: string;
  source: "explicit" | "toc" | "section";
}

export interface SelectChapterStartLocationInput {
  explicitCfi?: string;
  toc?: TOCItem[];
  sectionHref?: string;
  sectionIndex?: number;
  sectionLabel?: string;
  getSectionStartCfi?: (index: number) => string | undefined;
}

export interface ResolveNoteSourceInput {
  reasoning: string;
  sourceCandidates: NoteSourceCandidateInput[];
  maxMatches?: number;
}

export interface ResolveNoteSourceRuntime {
  view?: Pick<FoliateView, "search" | "getCFI"> | null;
  searchConfig?: Partial<BookSearchConfig>;
  toc?: TOCItem[];
  sectionIndex?: number;
  sectionHref?: string;
  sectionLabel?: string;
  chapterStartCfi?: string;
}

export interface ResolvedNoteSourceMatch {
  cfi: string;
  sourceText: string;
  contextBefore?: string;
  contextAfter?: string;
  query: string;
  label?: string;
  excerpt?: SearchExcerpt;
}

export type ResolvedNoteSource =
  | {
      status: "matched";
      matches: ResolvedNoteSourceMatch[];
      fallback?: ChapterStartLocation;
      meta: {
        reasoning: string;
        queryCount: number;
        sectionIndex?: number;
        sectionLabel?: string;
      };
    }
  | {
      status: "chapter-start";
      matches: [];
      fallback: ChapterStartLocation;
      meta: {
        reasoning: string;
        queryCount: number;
        sectionIndex?: number;
        sectionLabel?: string;
      };
    }
  | {
      status: "unavailable";
      matches: [];
      fallback?: ChapterStartLocation;
      error?: string;
      meta: {
        reasoning: string;
        queryCount: number;
        sectionIndex?: number;
        sectionLabel?: string;
      };
    };

const DEFAULT_MAX_QUERIES = 10;
const DEFAULT_MAX_QUERY_LENGTH = 120;
const DEFAULT_MIN_QUERY_LENGTH = 10;

export function normalizeSearchText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

function takeByWordsOrChars(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const selected: string[] = [];
    for (const word of words) {
      const next = [...selected, word].join(" ");
      if (next.length > maxLength) {
        break;
      }
      selected.push(word);
    }
    const result = selected.join(" ").trim();
    if (result.length > 0) {
      return result;
    }
  }

  return text.slice(0, maxLength).trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?。.!?])\s+|(?<=[。！？!?。.!?])/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pushUnique(values: string[], value: string, minLength: number): void {
  const normalized = normalizeSearchText(value);
  if (normalized.length < minLength) {
    return;
  }
  if (!values.includes(normalized)) {
    values.push(normalized);
  }
}

export function buildSourceSearchQueries(
  candidates: NoteSourceCandidateInput[],
  options: BuildSourceSearchQueriesOptions = {},
): string[] {
  const maxQueries = options.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxQueryLength = options.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;
  const minQueryLength = options.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  const queries: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeSearchText(candidate.text);
    if (!normalized) {
      continue;
    }

    pushUnique(queries, takeByWordsOrChars(normalized, maxQueryLength), minQueryLength);

    const sentences = splitSentences(normalized);
    for (const sentence of sentences.slice(0, 3)) {
      pushUnique(queries, takeByWordsOrChars(sentence, Math.min(maxQueryLength, 80)), minQueryLength);
    }

    pushUnique(queries, takeByWordsOrChars(normalized, Math.min(maxQueryLength, 80)), minQueryLength);
    pushUnique(queries, takeByWordsOrChars(normalized, Math.min(maxQueryLength, 48)), minQueryLength);

    if (queries.length >= maxQueries) {
      break;
    }
  }

  return queries.slice(0, maxQueries);
}

function stripFragment(href: string): string {
  return href.split("#")[0] ?? href;
}

function hrefMatches(itemHref: string, targetHref: string): boolean {
  return itemHref === targetHref || stripFragment(itemHref) === stripFragment(targetHref);
}

export function findTocItemByHref(toc: TOCItem[] | undefined, href: string | undefined): TOCItem | undefined {
  if (!toc?.length || !href) {
    return undefined;
  }

  for (const item of toc) {
    if (hrefMatches(item.href, href)) {
      return item;
    }
    const nested = findTocItemByHref(item.subitems, href);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

export function selectChapterStartLocation(input: SelectChapterStartLocationInput): ChapterStartLocation | undefined {
  if (input.explicitCfi?.trim()) {
    return {
      cfi: input.explicitCfi.trim(),
      label: input.sectionLabel,
      source: "explicit",
    };
  }

  const tocItem = findTocItemByHref(input.toc, input.sectionHref);
  if (tocItem?.cfi?.trim()) {
    return {
      cfi: tocItem.cfi.trim(),
      label: tocItem.label || input.sectionLabel,
      source: "toc",
    };
  }

  if (typeof input.sectionIndex === "number" && input.getSectionStartCfi) {
    const cfi = input.getSectionStartCfi(input.sectionIndex)?.trim();
    if (cfi) {
      return {
        cfi,
        label: input.sectionLabel,
        source: "section",
      };
    }
  }

  return undefined;
}

function buildMeta(input: ResolveNoteSourceInput, queryCount: number, runtime: ResolveNoteSourceRuntime) {
  return {
    reasoning: input.reasoning,
    queryCount,
    sectionIndex: runtime.sectionIndex,
    sectionLabel: runtime.sectionLabel,
  };
}

async function collectSearchMatches(
  view: Pick<FoliateView, "search">,
  searchConfig: BookSearchConfig,
): Promise<Array<BookSearchMatch & { label?: string }>> {
  const matches: Array<BookSearchMatch & { label?: string }> = [];

  for await (const result of view.search(searchConfig)) {
    if (typeof result === "string") {
      continue;
    }
    for (const match of result.subitems) {
      matches.push({ ...match, label: result.label });
    }
  }

  return matches;
}

function toResolvedMatch(match: BookSearchMatch & { label?: string }, query: string): ResolvedNoteSourceMatch {
  return {
    cfi: match.cfi,
    sourceText: normalizeSearchText(match.excerpt.match || query),
    contextBefore: normalizeSearchText(match.excerpt.pre || "") || undefined,
    contextAfter: normalizeSearchText(match.excerpt.post || "") || undefined,
    query,
    label: match.label,
    excerpt: match.excerpt,
  };
}

export async function resolveNoteSourceFromView(
  input: ResolveNoteSourceInput,
  runtime: ResolveNoteSourceRuntime,
): Promise<ResolvedNoteSource> {
  const queries = buildSourceSearchQueries(input.sourceCandidates);
  const fallback = selectChapterStartLocation({
    explicitCfi: runtime.chapterStartCfi,
    toc: runtime.toc,
    sectionHref: runtime.sectionHref,
    sectionIndex: runtime.sectionIndex,
    sectionLabel: runtime.sectionLabel,
    getSectionStartCfi:
      runtime.view && typeof runtime.sectionIndex === "number"
        ? (index) => runtime.view?.getCFI(index, null)
        : undefined,
  });
  const meta = buildMeta(input, queries.length, runtime);

  if (!runtime.view) {
    if (fallback) {
      return {
        status: "chapter-start",
        matches: [],
        fallback,
        meta,
      };
    }
    return {
      status: "unavailable",
      matches: [],
      error: "Reader view is not available.",
      meta,
    };
  }

  if (typeof runtime.sectionIndex !== "number") {
    if (fallback) {
      return {
        status: "chapter-start",
        matches: [],
        fallback,
        meta,
      };
    }
    return {
      status: "unavailable",
      matches: [],
      error: "Current reader section is not available.",
      meta,
    };
  }

  const maxMatches = Math.max(1, Math.min(input.maxMatches ?? 5, 10));
  const baseConfig: Omit<BookSearchConfig, "query"> = {
    scope: "section",
    matchCase: false,
    matchWholeWords: false,
    matchDiacritics: false,
    ...runtime.searchConfig,
    index: runtime.sectionIndex,
  };

  for (const query of queries) {
    const matches = await collectSearchMatches(runtime.view, {
      ...baseConfig,
      query,
    });

    if (matches.length > 0) {
      return {
        status: "matched",
        matches: matches.slice(0, maxMatches).map((match) => toResolvedMatch(match, query)),
        fallback,
        meta,
      };
    }
  }

  if (fallback) {
    return {
      status: "chapter-start",
      matches: [],
      fallback,
      meta,
    };
  }

  return {
    status: "unavailable",
    matches: [],
    error: "No matching source text found and no chapter-start CFI is available.",
    meta,
  };
}
