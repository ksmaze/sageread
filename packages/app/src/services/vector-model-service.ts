import { invoke } from "@tauri-apps/api/core";
import { normalizeEmbeddingsUrl } from "@/utils/embeddings";

export type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface DetectVectorModelDimensionInput {
  url: string;
  modelId: string;
  apiKey: string;
  testText: string;
}

export async function detectVectorModelDimension(
  input: DetectVectorModelDimensionInput,
  nativeInvoke: NativeInvoke = invoke,
): Promise<number> {
  const apiKey = input.apiKey.trim();

  return nativeInvoke<number>("plugin:epub|detect_embedding_dimension", {
    embeddingsUrl: normalizeEmbeddingsUrl(input.url),
    model: input.modelId,
    apiKey: apiKey || null,
    testText: input.testText,
  });
}
