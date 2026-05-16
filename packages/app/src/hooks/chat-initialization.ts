import type { Thread } from "@/types/thread";
import type { UIMessage } from "ai";

interface CompleteThreadInitializationOptions {
  latestThread: Thread | null;
  setCurrentThread: (thread: Thread) => void;
  setMessages: (messages: UIMessage[]) => void;
  setActiveContext: (context: string | undefined) => void;
  getThreadContext: (thread: Thread) => string | null | undefined;
  markInitialized: () => void;
  forceUpdate: () => void;
}

export function completeThreadInitialization({
  latestThread,
  setCurrentThread,
  setMessages,
  setActiveContext,
  getThreadContext,
  markInitialized,
  forceUpdate,
}: CompleteThreadInitializationOptions) {
  if (latestThread) {
    setCurrentThread(latestThread);
    setMessages(latestThread.messages);
    setActiveContext(getThreadContext(latestThread) || undefined);
  }

  markInitialized();
  forceUpdate();
}
