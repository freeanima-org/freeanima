import {
  DEFAULT_POMODORO_CONFIG,
  POMODORO_CONFIG_COMPONENT,
  asPomodoroConfig,
  type PomodoroConfigBody,
} from "@freeanima/host/core/db/schema/entity";
import { createEntity, searchEntities, updateEntity } from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";

import type { PomodoroConfigRow, PomodoroStoreContext } from "./types.ts";

export async function getPomodoroConfig(ctx: PomodoroStoreContext): Promise<PomodoroConfigRow> {
  const existing = await findPomodoroConfigEntity(ctx);
  if (existing) {
    const parsed = asPomodoroConfig(existing);
    if (parsed) {
      const { id: _id, ...body } = parsed;
      return body;
    }
  }

  const created = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    primary_component: POMODORO_CONFIG_COMPONENT,
    components: [POMODORO_CONFIG_COMPONENT],
    title: "番茄钟设置",
    body: DEFAULT_POMODORO_CONFIG,
  });
  const parsed = asPomodoroConfig(created);
  if (!parsed) throw new Error("failed to create pomodoro config");
  const { id: _id, ...body } = parsed;
  return body;
}

async function findPomodoroConfigEntity(ctx: PomodoroStoreContext) {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: POMODORO_CONFIG_COMPONENT,
    limit: 1,
    mode: "filter_only",
  });
  return result.results[0] ?? null;
}

export async function updatePomodoroConfig(
  ctx: PomodoroStoreContext,
  patch: Partial<PomodoroConfigBody>,
): Promise<PomodoroConfigRow> {
  const current = await getPomodoroConfig(ctx);
  const next = { ...current, ...omitUndefined(patch) };
  const existing = await findPomodoroConfigEntity(ctx);
  if (!existing) {
    await createEntity({
      type: "content",
      world_id: ctx.worldId,
      primary_component: POMODORO_CONFIG_COMPONENT,
      components: [POMODORO_CONFIG_COMPONENT],
      title: "番茄钟设置",
      body: next,
    });
    return next;
  }
  const updated = await updateEntity({ id: existing.id, body: next });
  if (!updated) throw new Error("invalid pomodoro config after update");
  const parsed = asPomodoroConfig(updated);
  if (!parsed) throw new Error("invalid pomodoro config after update");
  const { id: _id, ...body } = parsed;
  return body;
}
