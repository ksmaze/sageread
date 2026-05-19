import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Thread } from "@/types/thread";

interface ThreadState {
  currentThread: Thread | null;
  setCurrentThread: (thread: Thread | null) => void;
  clearCurrentThread: () => void;
}

export const useThreadStore = create<ThreadState>()(
  persist(
    (set) => ({
      currentThread: null,
      setCurrentThread: (thread) => set({ currentThread: thread }),
      clearCurrentThread: () => set({ currentThread: null }),
    }),
    {
      name: "thread-store",
      partialize: () => ({}),
    },
  ),
);
