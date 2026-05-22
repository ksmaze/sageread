import type { TOCItem } from "@/lib/document";
import type { BookSearchConfig, BookSearchMatch, BookSearchResult, SearchExcerpt } from "@/types/book";
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
  getSectionDocument?: (index: number) => Document | Promise<Document | undefined> | undefined;
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

const DEFAULT_MAX_QUERIES = 25;
const DEFAULT_MAX_QUERY_LENGTH = 120;
const DEFAULT_MIN_QUERY_LENGTH = 10;
const DEFAULT_WINDOW_QUERY_LENGTH = 80;
const LOOSE_CONTEXT_LENGTH = 50;
const NODE_ELEMENT = 1;
const NODE_TEXT = 3;
const NODE_CDATA_SECTION = 4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;
const FILTER_SKIP = 3;

export interface LooseTextPosition {
  chunkIndex: number;
  offset: number;
}

export interface LooseTextMatch {
  start: LooseTextPosition;
  end: LooseTextPosition;
  sourceText: string;
  contextBefore?: string;
  contextAfter?: string;
  query: string;
}

interface RawTextChar {
  char: string;
  chunkIndex: number;
  offset: number;
  rawIndex: number;
}

interface ComparableTextChar {
  char: string;
  rawCharIndex: number;
}

export function normalizeSearchText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

export function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(/\s+/g, "");
}

function cleanLooseText(text: string): string {
  return normalizeSearchText(
    text.replace(/\u00ad/g, "").replace(/([\p{L}\p{N}])[-\u2010\u2011]\s+([\p{L}\p{N}])/gu, "$1$2"),
  );
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function isFormatChar(char: string): boolean {
  return /\p{Format}/u.test(char);
}

function isLetterOrNumber(char: string | undefined): boolean {
  return Boolean(char && /[\p{L}\p{N}]/u.test(char));
}

function isHyphenationChar(char: string): boolean {
  return char === "-" || char === "\u2010" || char === "\u2011";
}

function previousNonWhitespace(rawChars: RawTextChar[], index: number): string | undefined {
  for (let current = index - 1; current >= 0; current--) {
    const char = rawChars[current]?.char;
    if (char && !isWhitespace(char)) {
      return char;
    }
  }
  return undefined;
}

function nextNonWhitespace(rawChars: RawTextChar[], index: number): string | undefined {
  for (let current = index + 1; current < rawChars.length; current++) {
    const char = rawChars[current]?.char;
    if (char && !isWhitespace(char)) {
      return char;
    }
  }
  return undefined;
}

function shouldSkipHyphenation(rawChars: RawTextChar[], index: number): boolean {
  const char = rawChars[index]?.char;
  const next = rawChars[index + 1]?.char;
  if (!char || !isHyphenationChar(char) || !next || !isWhitespace(next)) {
    return false;
  }
  return (
    isLetterOrNumber(previousNonWhitespace(rawChars, index)) && isLetterOrNumber(nextNonWhitespace(rawChars, index))
  );
}

function buildRawTextIndex(chunks: string[]) {
  const rawChars: RawTextChar[] = [];
  let rawIndex = 0;

  chunks.forEach((chunk, chunkIndex) => {
    for (let offset = 0; offset < chunk.length; ) {
      const codePoint = chunk.codePointAt(offset);
      if (codePoint === undefined) {
        break;
      }
      const char = String.fromCodePoint(codePoint);
      rawChars.push({
        char,
        chunkIndex,
        offset,
        rawIndex,
      });
      offset += char.length;
      rawIndex += char.length;
    }
  });

  return {
    rawText: chunks.join(""),
    rawChars,
  };
}

function buildComparableTextIndex(chunks: string[]) {
  const { rawText, rawChars } = buildRawTextIndex(chunks);
  const comparableChars: ComparableTextChar[] = [];

  rawChars.forEach(({ char }, rawCharIndex) => {
    if (
      char === "\u00ad" ||
      isFormatChar(char) ||
      isWhitespace(char) ||
      shouldSkipHyphenation(rawChars, rawCharIndex)
    ) {
      return;
    }
    comparableChars.push({
      char: char.toLocaleLowerCase(),
      rawCharIndex,
    });
  });

  return {
    rawText,
    rawChars,
    comparableChars,
    comparableText: comparableChars.map(({ char }) => char).join(""),
  };
}

function toLooseComparableText(text: string): string {
  return buildComparableTextIndex([text]).comparableText;
}

export function findLooseTextMatches(chunks: string[], queries: string[], maxMatches: number): LooseTextMatch[] {
  const { rawText, rawChars, comparableChars, comparableText } = buildComparableTextIndex(chunks);
  if (!rawChars.length || !comparableChars.length || !comparableText) {
    return [];
  }

  const matches: LooseTextMatch[] = [];
  const seenSpans = new Set<string>();

  for (const query of queries) {
    const comparableQuery = toLooseComparableText(query);
    if (!comparableQuery) {
      continue;
    }

    let searchStart = 0;
    while (matches.length < maxMatches) {
      const matchIndex = comparableText.indexOf(comparableQuery, searchStart);
      if (matchIndex < 0) {
        break;
      }

      const startComparable = comparableChars[matchIndex];
      const endComparable = comparableChars[matchIndex + comparableQuery.length - 1];
      if (!startComparable || !endComparable) {
        break;
      }

      const startRawChar = rawChars[startComparable.rawCharIndex];
      const endRawChar = rawChars[endComparable.rawCharIndex];
      if (!startRawChar || !endRawChar) {
        break;
      }

      const endRawIndex = endRawChar.rawIndex + endRawChar.char.length;
      const spanKey = `${startRawChar.rawIndex}:${endRawIndex}`;
      if (!seenSpans.has(spanKey)) {
        seenSpans.add(spanKey);
        matches.push({
          start: {
            chunkIndex: startRawChar.chunkIndex,
            offset: startRawChar.offset,
          },
          end: {
            chunkIndex: endRawChar.chunkIndex,
            offset: endRawChar.offset + endRawChar.char.length,
          },
          sourceText: cleanLooseText(rawText.slice(startRawChar.rawIndex, endRawIndex)),
          contextBefore:
            cleanLooseText(
              rawText.slice(Math.max(0, startRawChar.rawIndex - LOOSE_CONTEXT_LENGTH), startRawChar.rawIndex),
            ) || undefined,
          contextAfter: cleanLooseText(rawText.slice(endRawIndex, endRawIndex + LOOSE_CONTEXT_LENGTH)) || undefined,
          query,
        });
      }

      searchStart = matchIndex + 1;
    }

    if (matches.length >= maxMatches) {
      break;
    }
  }

  return matches;
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

function takeCharWindow(text: string, start: number, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const boundedStart = Math.max(0, Math.min(start, text.length - maxLength));
  return text.slice(boundedStart, boundedStart + maxLength).trim();
}

function pushBalancedWindows(values: string[], text: string, maxLength: number, minLength: number): void {
  const windowLength = Math.min(maxLength, DEFAULT_WINDOW_QUERY_LENGTH);
  if (text.length <= windowLength) {
    return;
  }

  pushUnique(values, takeCharWindow(text, 0, windowLength), minLength);
  pushUnique(values, takeCharWindow(text, Math.floor((text.length - windowLength) / 2), windowLength), minLength);
  pushUnique(values, takeCharWindow(text, text.length - windowLength, windowLength), minLength);
}

function buildSingleCandidateQueries(
  candidate: NoteSourceCandidateInput,
  maxQueryLength: number,
  minQueryLength: number,
): string[] {
  const normalized = normalizeSearchText(candidate.text);
  if (!normalized) {
    return [];
  }

  const queries: string[] = [];
  const compacted = compactSearchText(normalized);

  pushUnique(queries, takeByWordsOrChars(normalized, maxQueryLength), minQueryLength);
  pushUnique(queries, takeByWordsOrChars(compacted, maxQueryLength), minQueryLength);

  const sentences = splitSentences(normalized);
  for (const sentence of sentences.slice(0, 3)) {
    pushUnique(queries, takeByWordsOrChars(sentence, Math.min(maxQueryLength, 80)), minQueryLength);
    pushUnique(queries, takeByWordsOrChars(compactSearchText(sentence), Math.min(maxQueryLength, 80)), minQueryLength);
  }

  pushUnique(queries, takeByWordsOrChars(normalized, Math.min(maxQueryLength, 80)), minQueryLength);
  pushUnique(queries, takeByWordsOrChars(normalized, Math.min(maxQueryLength, 48)), minQueryLength);
  pushBalancedWindows(queries, normalized, maxQueryLength, minQueryLength);
  pushBalancedWindows(queries, compacted, maxQueryLength, minQueryLength);

  return queries;
}

export function buildSourceSearchQueries(
  candidates: NoteSourceCandidateInput[],
  options: BuildSourceSearchQueriesOptions = {},
): string[] {
  const maxQueries = options.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxQueryLength = options.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;
  const minQueryLength = options.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  const perCandidateQueries = candidates
    .map((candidate) => buildSingleCandidateQueries(candidate, maxQueryLength, minQueryLength))
    .filter((queries) => queries.length > 0);
  const queries: string[] = [];

  for (let queryIndex = 0; queries.length < maxQueries; queryIndex++) {
    let added = false;

    for (const candidateQueries of perCandidateQueries) {
      const query = candidateQueries[queryIndex];
      if (!query) {
        continue;
      }
      pushUnique(queries, query, minQueryLength);
      added = true;
      if (queries.length >= maxQueries) {
        break;
      }
    }

    if (!added) {
      break;
    }
  }

  return queries;
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

    if (isBookSearchMatch(result)) {
      matches.push(result);
      continue;
    }

    if (!isBookSearchResult(result)) {
      continue;
    }

    for (const match of result.subitems) {
      matches.push({ ...match, label: result.label });
    }
  }

  return matches;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchExcerpt(value: unknown): value is SearchExcerpt {
  return (
    isRecord(value) &&
    typeof value.pre === "string" &&
    typeof value.match === "string" &&
    typeof value.post === "string"
  );
}

function isBookSearchMatch(value: unknown): value is BookSearchMatch {
  return isRecord(value) && typeof value.cfi === "string" && isSearchExcerpt(value.excerpt);
}

function isBookSearchResult(value: unknown): value is BookSearchResult {
  return isRecord(value) && Array.isArray(value.subitems);
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

function defaultAcceptSectionNode(node: Node): number {
  if (node.nodeType === NODE_ELEMENT) {
    const tagName = (node as Element).tagName?.toLowerCase();
    if (tagName === "script" || tagName === "style") {
      return FILTER_REJECT;
    }
    return FILTER_SKIP;
  }
  return FILTER_ACCEPT;
}

function getChildNodes(node: Node): Node[] {
  const childNodes = (node as Node & { childNodes?: ArrayLike<Node> }).childNodes;
  return childNodes ? Array.from(childNodes) : [];
}

function collectAcceptedTextNodes(node: Node, acceptNode: (node: Node) => number, nodes: Text[] = []): Text[] {
  const decision = acceptNode(node);
  if (decision === FILTER_REJECT) {
    return nodes;
  }

  if (node.nodeType === NODE_TEXT || node.nodeType === NODE_CDATA_SECTION) {
    if (decision === FILTER_ACCEPT) {
      nodes.push(node as Text);
    }
    return nodes;
  }

  for (const child of getChildNodes(node)) {
    collectAcceptedTextNodes(child, acceptNode, nodes);
  }

  return nodes;
}

function getSectionTextNodes(doc: Document, acceptNode?: (node: Node) => number): Text[] {
  const root = (doc.body ?? doc.documentElement ?? doc) as Node;
  return collectAcceptedTextNodes(root, acceptNode ?? defaultAcceptSectionNode);
}

function createRangeFromLooseMatch(doc: Document, nodes: Text[], match: LooseTextMatch): Range | undefined {
  const startNode = nodes[match.start.chunkIndex];
  const endNode = nodes[match.end.chunkIndex];
  if (!startNode || !endNode) {
    return undefined;
  }

  const range = doc.createRange();
  range.setStart(startNode, match.start.offset);
  range.setEnd(endNode, match.end.offset);
  return range;
}

async function collectLooseSectionMatches(
  runtime: ResolveNoteSourceRuntime,
  searchConfig: Omit<BookSearchConfig, "query">,
  queries: string[],
  maxMatches: number,
  seenCfis: Set<string>,
): Promise<ResolvedNoteSourceMatch[]> {
  if (!runtime.view || typeof runtime.sectionIndex !== "number" || !runtime.getSectionDocument) {
    return [];
  }

  const doc = await runtime.getSectionDocument(runtime.sectionIndex);
  if (!doc) {
    return [];
  }

  const textNodes = getSectionTextNodes(doc, searchConfig.acceptNode);
  const looseMatches = findLooseTextMatches(
    textNodes.map((node) => node.nodeValue ?? ""),
    queries,
    maxMatches,
  );
  const resolvedMatches: ResolvedNoteSourceMatch[] = [];

  for (const match of looseMatches) {
    const range = createRangeFromLooseMatch(doc, textNodes, match);
    if (!range) {
      continue;
    }

    const cfi = runtime.view.getCFI(runtime.sectionIndex, range);
    if (!cfi || seenCfis.has(cfi)) {
      continue;
    }

    seenCfis.add(cfi);
    resolvedMatches.push({
      cfi,
      sourceText: match.sourceText || normalizeSearchText(match.query),
      contextBefore: match.contextBefore,
      contextAfter: match.contextAfter,
      query: match.query,
      label: runtime.sectionLabel,
      excerpt: {
        pre: match.contextBefore ?? "",
        match: match.sourceText || normalizeSearchText(match.query),
        post: match.contextAfter ?? "",
      },
    });

    if (resolvedMatches.length >= maxMatches) {
      break;
    }
  }

  return resolvedMatches;
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

  const resolvedMatches: ResolvedNoteSourceMatch[] = [];
  const seenCfis = new Set<string>();

  for (const query of queries) {
    const matches = await collectSearchMatches(runtime.view, {
      ...baseConfig,
      query,
    });

    for (const match of matches) {
      if (seenCfis.has(match.cfi)) {
        continue;
      }
      seenCfis.add(match.cfi);
      resolvedMatches.push(toResolvedMatch(match, query));
      if (resolvedMatches.length >= maxMatches) {
        break;
      }
    }

    if (resolvedMatches.length >= maxMatches) {
      break;
    }
  }

  if (resolvedMatches.length < maxMatches) {
    const looseMatches = await collectLooseSectionMatches(
      runtime,
      baseConfig,
      queries,
      maxMatches - resolvedMatches.length,
      seenCfis,
    );
    resolvedMatches.push(...looseMatches);
  }

  if (resolvedMatches.length > 0) {
    return {
      status: "matched",
      matches: resolvedMatches,
      fallback,
      meta,
    };
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
