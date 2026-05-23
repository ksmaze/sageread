import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectVectorModelDimension, type NativeInvoke } from "./vector-model-service";

describe("detectVectorModelDimension", () => {
  it("uses the native EPUB embedding command with normalized settings payload", async () => {
    const calls: Array<{ command: string; args: unknown }> = [];
    const invoke: NativeInvoke = async (command, args) => {
      calls.push({ command, args });
      return 1536;
    };

    const dimension = await detectVectorModelDimension(
      {
        url: "http://192.168.2.57:8318/v1/embeddings/",
        modelId: "text-embedding-3-small",
        apiKey: "   ",
        testText: "Hello embeddings",
      },
      invoke,
    );

    assert.equal(dimension, 1536);
    assert.deepEqual(calls, [
      {
        command: "plugin:epub|detect_embedding_dimension",
        args: {
          embeddingsUrl: "http://192.168.2.57:8318/v1/embeddings",
          model: "text-embedding-3-small",
          apiKey: null,
          testText: "Hello embeddings",
        },
      },
    ]);
  });
});
