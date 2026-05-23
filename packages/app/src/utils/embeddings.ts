export function normalizeEmbeddingsUrl(url: string): string {
  return url.replace(/\/$/, "");
}
