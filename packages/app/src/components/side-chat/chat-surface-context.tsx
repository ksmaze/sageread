import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type ChatSurface = "reader" | "standalone";

const ChatSurfaceContext = createContext<ChatSurface>("reader");

interface ChatSurfaceProviderProps {
  surface: ChatSurface;
  children: ReactNode;
}

export function ChatSurfaceProvider({ surface, children }: ChatSurfaceProviderProps) {
  return <ChatSurfaceContext.Provider value={surface}>{children}</ChatSurfaceContext.Provider>;
}

export function useIsStandaloneChatSurface(): boolean {
  return useContext(ChatSurfaceContext) === "standalone";
}
