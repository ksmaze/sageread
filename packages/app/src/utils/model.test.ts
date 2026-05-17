import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getCurrentVectorModelConfig } from "./model";
import { useVectorModelStore, type VectorModelConfig } from "../store/vector-model-store";

const externalModel: VectorModelConfig = {
  id: "external-embedding",
  name: "External Embedding",
  url: "https://embeddings.example.com/v1/embeddings/",
  modelId: "text-embedding-3-small",
  apiKey: "",
  dimension: 1536,
};

describe("getCurrentVectorModelConfig", () => {
  beforeEach(() => {
    useVectorModelStore.setState({
      vectorModelEnabled: false,
      vectorModels: [],
      selectedVectorModelId: null,
      testText: "Hello, world!",
    });
  });

  it("does not fall back to a local embeddings server when no external model is selected", async () => {
    const config = await getCurrentVectorModelConfig();

    assert.equal(config, null);
  });

  it("returns the selected external embeddings model config", async () => {
    useVectorModelStore.setState({
      vectorModelEnabled: true,
      vectorModels: [externalModel],
      selectedVectorModelId: externalModel.id,
    });

    const config = await getCurrentVectorModelConfig();

    assert.deepEqual(config, {
      embeddingsUrl: "https://embeddings.example.com/v1/embeddings",
      model: "text-embedding-3-small",
      apiKey: null,
      dimension: 1536,
      source: "external",
    });
  });
});
