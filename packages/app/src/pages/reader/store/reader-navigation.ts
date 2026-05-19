import {
  describeReaderNavigationError,
  describeReaderNavigationResult,
  describeReaderNavigationTarget,
  readerNavigationError,
  readerNavigationInfo,
  readerNavigationWarn,
} from "@/utils/reader-navigation-debug";

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
  readerNavigationInfo("reader-navigation.consume.start", {
    target: describeReaderNavigationTarget(target),
  });

  try {
    const resolved = await view.goTo(target.cfi);
    const resultDetails = describeReaderNavigationResult(resolved);
    if (resolved === undefined || resolved === null) {
      const error = new Error(`Navigation target did not resolve: ${target.cfi}`);
      readerNavigationWarn("reader-navigation.consume.unresolved", {
        result: resultDetails,
        target: describeReaderNavigationTarget(target),
      });
      throw error;
    }
    readerNavigationInfo("reader-navigation.consume.success", {
      result: resultDetails,
      target: describeReaderNavigationTarget(target),
    });
    clearTarget(target);
    return true;
  } catch (error) {
    readerNavigationError("reader-navigation.consume.error", {
      error: describeReaderNavigationError(error),
      target: describeReaderNavigationTarget(target),
    });
    onError?.(error);
    return false;
  }
}
