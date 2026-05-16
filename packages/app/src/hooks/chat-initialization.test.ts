import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Thread } from "@/types/thread";
import { completeThreadInitialization } from "./chat-initialization";

describe("chat thread initialization", () => {
  it("forces a render when a book has no existing thread", () => {
    let initialized = false;
    let renderCount = 0;
    let currentThread: Thread | null = null;

    completeThreadInitialization({
      latestThread: null,
      setCurrentThread: (thread) => {
        currentThread = thread;
      },
      setMessages: () => {
        throw new Error("messages should not be set without a thread");
      },
      setActiveContext: () => {
        throw new Error("context should not be set without a thread");
      },
      getThreadContext: () => undefined,
      markInitialized: () => {
        initialized = true;
      },
      forceUpdate: () => {
        renderCount += 1;
      },
    });

    assert.equal(initialized, true);
    assert.equal(renderCount, 1);
    assert.equal(currentThread, null);
  });
});
