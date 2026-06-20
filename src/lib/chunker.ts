// Shared deterministic chunker so chat retrieval, transformations,
// and citation-highlighting all agree on chunk boundaries.

export const CHUNK_CHARS = 1200;
export const CHUNK_OVERLAP = 150;

export function chunkText(
  text: string,
  size = CHUNK_CHARS,
  overlap = CHUNK_OVERLAP,
): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

/** Reconstruct the exact text that embedSource feeds into chunkText. */
export function sourceFullText(
  title: string | null,
  url: string | null,
  content_md: string | null,
): string {
  return [title, url, content_md ?? ""].filter(Boolean).join("\n\n");
}

/** Approximate start offset of `chunk_index` inside the (cleaned) full text. */
export function chunkStartOffset(
  chunk_index: number,
  size = CHUNK_CHARS,
  overlap = CHUNK_OVERLAP,
): number {
  return chunk_index * (size - overlap);
}

/** Get the chunk content for a deterministic source. */
export function getChunkAt(
  source: { title: string | null; url: string | null; content_md: string | null },
  chunk_index: number,
): string | null {
  const chunks = chunkText(sourceFullText(source.title, source.url, source.content_md));
  return chunks[chunk_index] ?? null;
}
