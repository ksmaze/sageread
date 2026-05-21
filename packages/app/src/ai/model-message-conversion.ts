import type { UIMessage } from "@ai-sdk/react";
import { convertToModelMessages, type ModelMessage, type ToolSet } from "ai";
import { processQuoteMessages, selectValidMessages } from "./utils";

export async function prepareModelMessagesForStream(messages: UIMessage[], tools: ToolSet): Promise<ModelMessage[]> {
  const processedMessages = processQuoteMessages(messages);
  const selectedMessages = selectValidMessages(processedMessages, 8);

  return await convertToModelMessages(selectedMessages, {
    tools,
    ignoreIncompleteToolCalls: true,
  });
}
