import { getResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context.ts";
import { worldConfigBodySchema } from "@freeanima/habitat/core/db/schema";
import { getEntity } from "../entity/repos/entity-crud-repo.ts";
import { resolveDefaultPrivateWorldForSubject } from "../entity/tool-world-access.ts";
import { tryGetSearchBackend } from "./runtime.ts";
import { entityToSearchDoc, messageToSearchDoc } from "./docs-from-business.ts";
import { searchDocKey } from "./doc-key.ts";
import { scheduleEntityEmbedding, scheduleMessageEmbedding } from "../embedding/schedule.ts";
import { clearSearchDocumentEmbedding } from "./pg-search-index/backend.ts";

async function resolveWorldOwnerSubjectId(worldId: number): Promise<number | null> {
  const world = await getEntity(worldId);
  if (!world || world.type !== "world") return null;
  const parsed = worldConfigBodySchema.safeParse(world.body);
  if (!parsed.success) return null;
  return parsed.data.owner_subject_id ?? null;
}

export async function indexEntitySearchDoc(input: {
  id: number;
  world_id: number;
  subject_id?: number | null;
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
    let subject_id = input.subject_id ?? null;
    if (subject_id == null) {
      subject_id =
        (await resolveWorldOwnerSubjectId(input.world_id)) ??
        getResolvedWorldContext().agent_subject_id;
    }
    await backend.upsert([
      entityToSearchDoc({
        id: input.id,
        world_id: input.world_id,
        subject_id,
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
  subject_id: number;
  world_id?: number | null;
  scheduleEmbedding?: boolean;
}): Promise<void> {
  const backend = tryGetSearchBackend();
  if (backend) {
    let world_id = input.world_id ?? null;
    if (world_id == null) {
      try {
        world_id = await resolveDefaultPrivateWorldForSubject(input.subject_id);
      } catch {
        world_id = null;
      }
    }
    await backend.upsert([
      messageToSearchDoc({
        id: input.id,
        conversation_id: input.conversation_id,
        role: input.role,
        content: input.content,
        subject_id: input.subject_id,
        world_id,
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
