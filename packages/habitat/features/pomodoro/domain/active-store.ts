import {
  POMODORO_ACTIVE_COMPONENT,
  asPomodoroActive,
  type PomodoroActiveBody,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  createEntity,
  deleteEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import type { PomodoroStoreContext } from "./types.ts";

export type PomodoroActiveRow = PomodoroActiveBody & { id: number };

async function findPomodoroActiveEntity(ctx: PomodoroStoreContext) {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: POMODORO_ACTIVE_COMPONENT,
    limit: 1,
    mode: "filter_only",
  });
  return result.results[0] ?? null;
}

export async function getPomodoroActive(
  ctx: PomodoroStoreContext,
): Promise<PomodoroActiveRow | null> {
  const existing = await findPomodoroActiveEntity(ctx);
  if (!existing) return null;
  const parsed = asPomodoroActive(existing);
  if (!parsed) return null;
  const { id: _id, ...body } = parsed;
  return { id: parsed.id, ...body };
}

export async function putPomodoroActive(
  ctx: PomodoroStoreContext,
  body: PomodoroActiveBody,
): Promise<PomodoroActiveRow | null> {
  const existing = await findPomodoroActiveEntity(ctx);
  if (existing) {
    const current = asPomodoroActive(existing);
    if (current && body.updated_at_ms < current.updated_at_ms) {
      const { id: _id, ...stored } = current;
      return { id: current.id, ...stored };
    }
    const updated = await updateEntity({ id: existing.id, body });
    if (!updated) throw new Error("failed to update pomodoro active");
    const parsed = asPomodoroActive(updated);
    if (!parsed) throw new Error("invalid pomodoro active after update");
    const { id: _id, ...next } = parsed;
    return { id: parsed.id, ...next };
  }

  const created = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    primary_component: POMODORO_ACTIVE_COMPONENT,
    components: [POMODORO_ACTIVE_COMPONENT],
    title: "番茄钟活跃",
    body,
  });
  const parsed = asPomodoroActive(created);
  if (!parsed) throw new Error("failed to create pomodoro active");
  const { id: _id, ...next } = parsed;
  return { id: parsed.id, ...next };
}

export async function clearPomodoroActive(ctx: PomodoroStoreContext): Promise<void> {
  const existing = await findPomodoroActiveEntity(ctx);
  if (!existing) return;
  await deleteEntity(existing.id);
}
