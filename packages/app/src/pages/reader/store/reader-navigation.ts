export interface ReaderNavigationTarget {
  cfi: string;
  requestedAt: number;
  source?: "unified-notes";
}

function isSameReaderNavigationTarget(
  current: ReaderNavigationTarget | null,
  completed: ReaderNavigationTarget,
): boolean {
  return current?.cfi === completed.cfi && current.requestedAt === completed.requestedAt;
}

export function clearReaderNavigationTarget(
  current: ReaderNavigationTarget | null,
  completed: ReaderNavigationTarget,
): ReaderNavigationTarget | null {
  return isSameReaderNavigationTarget(current, completed) ? null : current;
}
