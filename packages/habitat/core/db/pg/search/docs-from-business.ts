import type { SearchDoc } from "./types.ts";
import { searchDocKey } from "./doc-key.ts";

export function entityToSearchDoc(input: {
  id: number;
  world_id: number;
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  deleted_at?: Date | null;
  fts_segmented?: string | null;
}): SearchDoc {
  return {
    doc_key: searchDocKey("entity", input.id),
    resource: "entity",
    source_id: String(input.id),
    world_id: input.world_id,
    primary_component: input.primary_component,
    deleted_at: input.deleted_at ?? null,
    title: input.title,
    summary: input.summary,
    content: input.content,
    ...(input.fts_segmented !== undefined ? { fts_segmented: input.fts_segmented } : {}),
    indexable: true,
  };
}

export function messageToSearchDoc(input: {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  fts_segmented?: string | null;
}): SearchDoc {
  const role = input.role;
  const content = input.content.trim();
  const indexable = (role === "user" || role === "assistant") && content.length > 0;
  return {
    doc_key: searchDocKey("message", input.id),
    resource: "message",
    source_id: input.id,
    conversation_id: input.conversation_id,
    message_role: role,
    title: "",
    summary: "",
    content,
    ...(input.fts_segmented !== undefined ? { fts_segmented: input.fts_segmented } : {}),
    indexable,
  };
}
