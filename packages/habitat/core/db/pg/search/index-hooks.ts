import { tryGetSearchBackend } from "./runtime.ts";
import { entityToSearchDoc, messageToSearchDoc } from "./docs-from-business.ts";
import { searchDocKey } from "./doc-key.ts";
import { scheduleEntityEmbedding, scheduleMessageEmbedding } from "../embedding/schedule.ts";
import { clearSearchDocumentEmbedding } from "./pg-search-index/backend.ts";

export async function indexEntitySearchDoc(input: {
  id: number;
  world_id: number;
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  deleted_at?: Date | null;
  indexText: string;
  scheduleEmbedding?: boolean;
  clearEmbeddingFirst?: boolean;
}): Promise<void> {
  const backend = tryGetSearchBackend();
  if (backend) {
    if (input.clearEmbeddingFirst) {
      await clearSearchDocumentEmbedding("entity", input.id);
    }
    await backend.upsert([
      entityToSearchDoc({
        id: input.id,
        world_id: input.world_id,
        primary_component: input.primary_component,
        title: input.title,
        summary: input.summary,
        content: input.content,
        deleted_at: input.deleted_at ?? null,
      }),
    ]);
  }
  if (input.scheduleEmbedding !== false && input.indexText.trim()) {
    scheduleEntityEmbedding(input.id, input.indexText);
  }
}

export async function removeEntitySearchDoc(id: number): Promise<void> {
  const backend = tryGetSearchBackend();
  if (!backend) return;
  await backend.delete([searchDocKey("entity", id)]);
}

export async function indexMessageSearchDoc(input: {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  scheduleEmbedding?: boolean;
}): Promise<void> {
  const backend = tryGetSearchBackend();
  if (backend) {
    await backend.upsert([
      messageToSearchDoc({
        id: input.id,
        conversation_id: input.conversation_id,
        role: input.role,
        content: input.content,
      }),
    ]);
  }
  if (
    input.scheduleEmbedding !== false &&
    (input.role === "user" || input.role === "assistant") &&
    input.content.trim()
  ) {
    scheduleMessageEmbedding(input.id, input.content.trim());
  }
}

export async function removeMessageSearchDoc(id: string): Promise<void> {
  const backend = tryGetSearchBackend();
  if (!backend) return;
  await backend.delete([searchDocKey("message", id)]);
}
