import {
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
  NOTE_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
  SHELL_QUICK_ENTRY_COMPONENT,
  shellQuickEntryBodySchema,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  addEntityComponent,
  assertEntityInWorld,
  deleteEntityComponent,
  getEntity,
  searchEntities,
} from "@freeanima/habitat/core/db/pg/entity";
import {
  SHELL_QUICK_ALLOWED_PRIMARIES,
  type ShellQuickAllowedPrimary,
  type ShellQuickEntryRowPayload,
} from "@freeanima/shared/rpc-contract/frames/shell-quick";

export const SHELL_QUICK_MAX_ENTRIES = 20;

const ALLOWED = new Set<string>(SHELL_QUICK_ALLOWED_PRIMARIES);

export type ShellQuickStoreContext = { worldId: number };

function readQuickSortOrder(body: Record<string, unknown>): number {
  const parsed = shellQuickEntryBodySchema.safeParse(body);
  if (parsed.success) return parsed.data.quick_sort_order;
  const raw = body.quick_sort_order;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function toEntry(row: {
  id: number;
  title: string;
  primary_component: string | null;
  body: Record<string, unknown>;
}): ShellQuickEntryRowPayload | null {
  const primary = row.primary_component;
  if (primary == null || !ALLOWED.has(primary)) return null;
  return {
    id: row.id,
    primary_component: primary as ShellQuickAllowedPrimary,
    title: row.title,
    quick_sort_order: readQuickSortOrder(row.body),
  };
}

export async function listShellQuickEntries(
  ctx: ShellQuickStoreContext,
): Promise<ShellQuickEntryRowPayload[]> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    component: SHELL_QUICK_ENTRY_COMPONENT,
    limit: SHELL_QUICK_MAX_ENTRIES,
    mode: "filter_only",
    include_count: false,
    projection: "list",
  });
  const entries: ShellQuickEntryRowPayload[] = [];
  for (const row of result.results) {
    const entry = toEntry(row);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => a.quick_sort_order - b.quick_sort_order || a.id - b.id);
  return entries;
}

export async function attachShellQuickEntry(
  ctx: ShellQuickStoreContext,
  entityId: number,
): Promise<ShellQuickEntryRowPayload> {
  const existing = await getEntity(entityId);
  if (!existing || existing.deleted_at != null) {
    throw new Error("entity not found");
  }
  await assertEntityInWorld(entityId, ctx.worldId);

  const primary = existing.primary_component;
  if (primary == null || !ALLOWED.has(primary)) {
    throw new Error(`shell quick only allows primary: ${SHELL_QUICK_ALLOWED_PRIMARIES.join(", ")}`);
  }

  if (existing.components.includes(SHELL_QUICK_ENTRY_COMPONENT)) {
    const entry = toEntry(existing);
    if (!entry) throw new Error("invalid shell quick entry");
    return entry;
  }

  const current = await listShellQuickEntries(ctx);
  if (current.length >= SHELL_QUICK_MAX_ENTRIES) {
    throw new Error(`shell quick limit is ${SHELL_QUICK_MAX_ENTRIES}`);
  }
  const nextOrder = current.reduce((max, e) => Math.max(max, e.quick_sort_order), 0) + 1;

  const updated = await addEntityComponent({
    id: entityId,
    component: SHELL_QUICK_ENTRY_COMPONENT,
    body: { quick_sort_order: nextOrder },
  });
  if (!updated) throw new Error("entity not found");
  const entry = toEntry(updated);
  if (!entry) throw new Error("invalid shell quick entry after attach");
  return entry;
}

export async function detachShellQuickEntry(
  ctx: ShellQuickStoreContext,
  entityId: number,
): Promise<void> {
  const existing = await getEntity(entityId);
  if (!existing) return;
  await assertEntityInWorld(entityId, ctx.worldId);
  if (!existing.components.includes(SHELL_QUICK_ENTRY_COMPONENT)) return;
  await deleteEntityComponent(entityId, SHELL_QUICK_ENTRY_COMPONENT);
}

/** 供测试与文档引用 */
export const SHELL_QUICK_PRIMARY_COMPONENTS = [
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
  NOTE_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  EMAIL_ACCOUNT_COMPONENT,
] as const;
