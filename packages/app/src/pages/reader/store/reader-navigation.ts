export interface ReaderNavigationTarget {
  cfi: string;
  requestedAt: number;
  source?: "unified-notes";
}

interface ReaderNavigationView {
  goTo: (target: string) => Promise<unknown> | unknown;
}

interface ConsumeReaderNavigationTargetOptions {
  target: ReaderNavigationTarget;
  view: ReaderNavigationView;
  clearTarget: (target: ReaderNavigationTarget) => void;
  onError?: (error: unknown) => void;
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

export function getInitialReaderLocation(
  savedLocation: string | undefined,
  pendingTarget: ReaderNavigationTarget | null | undefined,
): string | undefined {
  return pendingTarget?.cfi ?? savedLocation;
}

export async function consumeReaderNavigationTarget({
  target,
  view,
  clearTarget,
  onError,
}: ConsumeReaderNavigationTargetOptions): Promise<boolean> {
  try {
    const resolved = await view.goTo(target.cfi);
    if (resolved === undefined || resolved === null) {
      throw new Error(`Navigation target did not resolve: ${target.cfi}`);
    }
    clearTarget(target);
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}
