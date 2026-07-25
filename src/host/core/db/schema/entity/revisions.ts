import { z } from "zod";

import { CONTENT_BLOCK_COMPONENT } from "./components/content-block.ts";
import { DIARY_ENTRY_COMPONENT } from "./components/diary-entry.ts";
import { PROJECT_COMPONENT } from "./components/project.ts";
import { SMART_LIST_COMPONENT } from "./components/smart-list.ts";
import { TASK_ITEM_COMPONENT } from "./components/task-item.ts";
import { TASK_LIST_COMPONENT } from "./components/task-list.ts";
import { VAULT_ITEM_COMPONENT } from "./components/vault-item.ts";

/** 自动归档上限（count）；见 docs/aspects/entity-revisions.md */
export const DEFAULT_ENTITY_REVISION_LIMIT = 10;

/**
 * updateEntity 自动写入 entities.revisions 的 primary_component 白名单。
 * 非白名单组件不归档；加入新组件须同步切面文档。
 */
export const ENTITY_REVISION_PRIMARY_COMPONENTS = [
  VAULT_ITEM_COMPONENT,
  CONTENT_BLOCK_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
  SMART_LIST_COMPONENT,
  TASK_ITEM_COMPONENT,
] as const;

export type EntityRevisionPrimaryComponent = (typeof ENTITY_REVISION_PRIMARY_COMPONENTS)[number];

const revisionAllowlist = new Set<string>(ENTITY_REVISION_PRIMARY_COMPONENTS);

export function isEntityRevisionPrimaryComponent(primary: string | null | undefined): boolean {
  if (primary == null) return false;
  return revisionAllowlist.has(primary);
}

export const entityRevisionSchema = z.object({
  captured_at: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  body: z.record(z.string(), z.unknown()),
  tag_ids: z.array(z.number().int()),
  pinned: z.boolean(),
});

export type EntityRevision = z.infer<typeof entityRevisionSchema>;

export const entityRevisionsSchema = z
  .array(entityRevisionSchema)
  .max(DEFAULT_ENTITY_REVISION_LIMIT);

export function parseEntityRevisions(raw: unknown): EntityRevision[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: EntityRevision[] = [];
  for (const item of raw) {
    const parsed = entityRevisionSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(0, DEFAULT_ENTITY_REVISION_LIMIT);
}

export type EntityRevisionSnapshotSource = {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  tag_ids: number[];
  pinned: boolean;
  updated_at: Date;
};

export function snapshotEntityRevision(source: EntityRevisionSnapshotSource): EntityRevision {
  return {
    captured_at: source.updated_at.toISOString(),
    title: source.title,
    summary: source.summary,
    content: source.content,
    body: structuredClone(source.body),
    tag_ids: [...source.tag_ids],
    pinned: source.pinned,
  };
}

export function pushEntityRevision(
  existing: EntityRevision[],
  snapshot: EntityRevision,
  limit: number = DEFAULT_ENTITY_REVISION_LIMIT,
): EntityRevision[] {
  return [snapshot, ...existing].slice(0, Math.max(1, limit));
}

/**
 * 是否应在本次 update 前归档。
 * 调用方已保证 primary 在白名单且未设 skip_revision。
 */
export function shouldRecordEntityRevision(input: {
  title?: string;
  summary?: string;
  content?: string;
  body?: Record<string, unknown>;
  tag_ids?: number[];
  pinned?: boolean;
  world_id?: number;
  components?: string[];
  reference_count?: number;
}): boolean {
  return (
    input.title !== undefined ||
    input.summary !== undefined ||
    input.content !== undefined ||
    input.body !== undefined ||
    input.tag_ids !== undefined ||
    input.pinned !== undefined
  );
}
