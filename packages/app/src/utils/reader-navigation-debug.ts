export const READER_NAVIGATION_LOG_PREFIX = "[SageRead:ReaderNav]";

export interface ReaderNavigationLogTarget {
  bookId?: string | null;
  cfi?: string | null;
  id?: string | null;
  noteId?: string | null;
  requestedAt?: number;
  source?: string | null;
  title?: string | null;
  type?: string | null;
}

interface ReaderNavigationView {
  goTo: (target: string) => Promise<unknown> | unknown;
}

interface TraceReaderGoToOptions {
  event: string;
  target: ReaderNavigationLogTarget;
  view: ReaderNavigationView | null | undefined;
  details?: Record<string, unknown>;
}

const CFI_EDGE_LENGTH = 120;

export function describeReaderNavigationTarget(target: ReaderNavigationLogTarget | null | undefined) {
  const cfi = typeof target?.cfi === "string" && target.cfi.length > 0 ? target.cfi : undefined;

  const description: Record<string, unknown> = {
    cfiLength: cfi?.length ?? 0,
    hasCfi: Boolean(cfi),
  };

  if (target?.bookId) description.bookId = target.bookId;
  if (target?.id) description.id = target.id;
  if (target?.noteId) description.noteId = target.noteId;
  if (target?.requestedAt !== undefined) description.requestedAt = target.requestedAt;
  if (target?.source) description.source = target.source;
  if (target?.title) description.title = target.title;
  if (target?.type) description.type = target.type;

  if (cfi) {
    description.cfi = cfi;
    description.cfiStart = cfi.slice(0, CFI_EDGE_LENGTH);
    description.cfiEnd = cfi.length > CFI_EDGE_LENGTH ? cfi.slice(-CFI_EDGE_LENGTH) : undefined;
  }

  return description;
}

export function describeReaderNavigationResult(result: unknown) {
  if (result === undefined || result === null) {
    return {
      resolved: false,
      valueType: result === undefined ? "undefined" : "null",
    };
  }

  if (typeof result === "object") {
    const record = result as Record<string, unknown>;
    return {
      cfi: record.cfi,
      href: record.href,
      index: record.index,
      keys: Object.keys(record).slice(0, 20),
      resolved: true,
      valueType: "object",
    };
  }

  if (typeof result === "string") {
    return {
      resolved: true,
      value: result,
      valueLength: result.length,
      valueType: "string",
    };
  }

  return {
    resolved: true,
    value: result,
    valueType: typeof result,
  };
}

export function describeReaderNavigationError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function serializeReaderNavigationDetails(details: Record<string, unknown> | undefined): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(details ?? {}, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Error) {
        return describeReaderNavigationError(value);
      }
      if (value && typeof value === "object") {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    });
  } catch (error) {
    return JSON.stringify({
      error: describeReaderNavigationError(error),
      serializationFailed: true,
    });
  }
}

function formatReaderNavigationLogMessage(event: string, details?: Record<string, unknown>): string {
  return `${READER_NAVIGATION_LOG_PREFIX} ${event} ${serializeReaderNavigationDetails(details)}`;
}

export function readerNavigationInfo(event: string, details?: Record<string, unknown>): void {
  console.info(formatReaderNavigationLogMessage(event, details));
}

export function readerNavigationWarn(event: string, details?: Record<string, unknown>): void {
  console.warn(formatReaderNavigationLogMessage(event, details));
}

export function readerNavigationError(event: string, details?: Record<string, unknown>): void {
  console.error(formatReaderNavigationLogMessage(event, details));
}

export async function traceReaderGoTo({ event, target, view, details }: TraceReaderGoToOptions): Promise<boolean> {
  const targetDetails = describeReaderNavigationTarget(target);
  if (!target.cfi) {
    readerNavigationWarn(`${event}.missing-cfi`, { ...details, target: targetDetails });
    return false;
  }

  if (!view) {
    readerNavigationWarn(`${event}.missing-view`, { ...details, target: targetDetails });
    return false;
  }

  readerNavigationInfo(`${event}.start`, { ...details, target: targetDetails });

  try {
    const result = await view.goTo(target.cfi);
    const resultDetails = describeReaderNavigationResult(result);

    if (!resultDetails.resolved) {
      readerNavigationWarn(`${event}.unresolved`, { ...details, result: resultDetails, target: targetDetails });
      return false;
    }

    readerNavigationInfo(`${event}.success`, { ...details, result: resultDetails, target: targetDetails });
    return true;
  } catch (error) {
    readerNavigationError(`${event}.error`, {
      ...details,
      error: describeReaderNavigationError(error),
      target: targetDetails,
    });
    return false;
  }
}
