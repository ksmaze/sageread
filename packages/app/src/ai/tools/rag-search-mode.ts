export type RagSearchMode = "vector" | "bm25" | "hybrid";

export function resolveEffectiveRagSearchMode(
  requestedMode: RagSearchMode | undefined,
  hasVectorConfig: boolean,
): RagSearchMode {
  const mode = requestedMode ?? "hybrid";
  return hasVectorConfig || mode === "bm25" ? mode : "bm25";
}
