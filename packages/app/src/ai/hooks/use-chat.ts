import { type UIMessage, type UseChatOptions, useChat as useChatSDK } from "@ai-sdk/react";
import type { ChatInit, LanguageModel } from "ai";
import { useEffect, useRef } from "react";
import type { ChatContext } from "@/hooks/use-chat-state";
import { CustomChatTransport } from "../custom-chat-transport";
import type { NoteSourceResolver } from "../tools";

type CustomChatOptions = Omit<ChatInit<UIMessage>, "transport"> &
  Pick<UseChatOptions<UIMessage>, "experimental_throttle" | "resume"> & {
    chatContext?: ChatContext;
    resolveNoteSource?: NoteSourceResolver;
  };

export function useChat(model: LanguageModel, options?: CustomChatOptions) {
  const { chatContext, resolveNoteSource, ...restOptions } = options || {};
  const chatContextRef = useRef(chatContext);
  const resolveNoteSourceRef = useRef(resolveNoteSource);
  const transportRef = useRef<CustomChatTransport | null>(null);

  useEffect(() => {
    chatContextRef.current = chatContext;
  }, [chatContext]);

  useEffect(() => {
    resolveNoteSourceRef.current = resolveNoteSource;
  }, [resolveNoteSource]);

  if (!transportRef.current) {
    transportRef.current = new CustomChatTransport(model, {
      prepareSendMessagesRequest: ({ body }) => {
        const currentChatContext = chatContextRef.current;
        return {
          body: {
            ...body,
            chatContext: currentChatContext,
          },
        };
      },
      resolveNoteSource: (input, context) => {
        const resolver = resolveNoteSourceRef.current;
        if (!resolver) {
          return Promise.resolve({
            status: "unavailable",
            matches: [],
            error: "Reader source resolver is not available.",
            meta: {
              reasoning: input.reasoning,
              queryCount: 0,
              sectionIndex: context?.activeSectionIndex,
              sectionLabel: context?.activeSectionLabel,
            },
          });
        }
        return resolver(input, context);
      },
      isNoteSourceResolverAvailable: () => Boolean(resolveNoteSourceRef.current),
    });
  }

  useEffect(() => {
    if (transportRef.current) {
      transportRef.current.updateModel(model);
    }
  }, [model]);

  const chatResult = useChatSDK({
    transport: transportRef.current,
    ...restOptions,
  });

  return chatResult;
}
