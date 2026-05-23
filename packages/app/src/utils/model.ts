import { useVectorModelStore } from "@/store/vector-model-store";
import { normalizeEmbeddingsUrl } from "./embeddings";

export { normalizeEmbeddingsUrl };

export interface VectorModelConfig {
  embeddingsUrl: string;
  model: string;
  apiKey: string | null;
  dimension: number;
  source: "external";
}

export async function getCurrentVectorModelConfig(): Promise<VectorModelConfig | null> {
  const { vectorModelEnabled, getSelectedVectorModel } = useVectorModelStore.getState();

  if (!vectorModelEnabled) {
    return null;
  }

  const selectedModel = getSelectedVectorModel();
  if (!selectedModel) {
    return null;
  }

  return {
    embeddingsUrl: normalizeEmbeddingsUrl(selectedModel.url),
    model: selectedModel.modelId,
    apiKey: selectedModel.apiKey || null,
    dimension: selectedModel.dimension || 1024,
    source: "external",
  };
}
