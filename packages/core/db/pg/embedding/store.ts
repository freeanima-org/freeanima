import {
  clearSearchDocumentEmbedding,
  setSearchDocumentEmbedding,
} from "../search/pg-search-index/backend.ts";

/** content kept for call-site symmetry; row is keyed by id only (avoids JS trim vs PG btrim mismatch). */
export async function setSemanticMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
}

export async function setMessageEmbedding(
  id: string,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  return setSearchDocumentEmbedding("message", id, embedding);
}

export async function setLimbicMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
}

export async function setAutobiographicalMemoryEmbedding(
  id: string,
  content: string,
  embedding: number[],
): Promise<boolean> {
  return setEntityEmbedding(Number(id), content, embedding);
}

export async function clearSemanticMemoryEmbedding(id: string): Promise<void> {
  await clearEntityEmbedding(Number(id));
}

export async function setEntityEmbedding(
  id: number,
  _content: string,
  embedding: number[],
): Promise<boolean> {
  return setSearchDocumentEmbedding("entity", id, embedding);
}

export async function clearEntityEmbedding(id: number): Promise<void> {
  await clearSearchDocumentEmbedding("entity", id);
}

export { clearSearchDocumentEmbedding, setSearchDocumentEmbedding };
