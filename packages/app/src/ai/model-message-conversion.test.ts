import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UIMessage } from "@ai-sdk/react";
import { prepareModelMessagesForStream } from "./model-message-conversion";

describe("prepareModelMessagesForStream", () => {
  it("awaits AI SDK UI-message conversion for quick-action prompts", async () => {
    const messages: UIMessage[] = [
      {
        id: "quick-action-1",
        role: "user",
        parts: [{ type: "text", text: "请根据最近聊天记录和当前章节生成一条学习笔记。" }],
      },
    ];

    const modelMessages = await prepareModelMessagesForStream(messages, {});

    assert.equal(Array.isArray(modelMessages), true);
    assert.equal(modelMessages[0]?.role, "user");
    assert.deepEqual(modelMessages[0]?.content, [
      {
        type: "text",
        text: "请根据最近聊天记录和当前章节生成一条学习笔记。",
      },
    ]);
  });
});
