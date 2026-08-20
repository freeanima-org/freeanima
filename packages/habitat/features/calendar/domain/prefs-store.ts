import {
  CALENDAR_UI_PREFS_COMPONENT,
  DEFAULT_CALENDAR_UI_PREFS,
  asCalendarUiPrefs,
  type CalendarUiPrefsBody,
  type CalendarViewDisplayPrefs,
  type CalendarViewMode,
} from "@freeanima/habitat/core/db/schema/entity";
import { createEntity, searchEntities, updateEntity } from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";

import type { CalendarStoreContext } from "./types.ts";

export type CalendarUiPrefsRow = CalendarUiPrefsBody;

function cloneDefaults(): CalendarUiPrefsBody {
  return structuredClone(DEFAULT_CALENDAR_UI_PREFS);
}

async function findCalendarUiPrefsEntity(ctx: CalendarStoreContext) {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: CALENDAR_UI_PREFS_COMPONENT,
    limit: 1,
    mode: "filter_only",
  });
  return result.results[0] ?? null;
}

export async function getCalendarUiPrefs(ctx: CalendarStoreContext): Promise<CalendarUiPrefsRow> {
  const existing = await findCalendarUiPrefsEntity(ctx);
  if (existing) {
    const parsed = asCalendarUiPrefs(existing);
    if (parsed) {
      const { id: _id, ...body } = parsed;
      return body;
    }
  }

  const body = cloneDefaults();
  const created = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    primary_component: CALENDAR_UI_PREFS_COMPONENT,
    components: [CALENDAR_UI_PREFS_COMPONENT],
    title: "日程显示偏好",
    body,
  });
  const parsed = asCalendarUiPrefs(created);
  if (!parsed) throw new Error("failed to create calendar ui prefs");
  const { id: _id, ...createdBody } = parsed;
  return createdBody;
}

export type CalendarUiPrefsPatch = {
  viewMode?: CalendarViewMode;
  byView?: Partial<Record<CalendarViewMode, Partial<CalendarViewDisplayPrefs>>>;
};

export async function updateCalendarUiPrefs(
  ctx: CalendarStoreContext,
  patch: CalendarUiPrefsPatch,
): Promise<CalendarUiPrefsRow> {
  const current = await getCalendarUiPrefs(ctx);
  const nextByView = { ...current.byView };
  if (patch.byView) {
    for (const mode of Object.keys(patch.byView) as CalendarViewMode[]) {
      const modePatch = patch.byView[mode];
      if (!modePatch) continue;
      nextByView[mode] = {
        ...nextByView[mode],
        ...omitUndefined(modePatch),
        ...(modePatch.kinds != null ? { kinds: [...modePatch.kinds] } : {}),
        ...(modePatch.builtinSources != null
          ? { builtinSources: [...modePatch.builtinSources] }
          : {}),
      };
    }
  }
  const next: CalendarUiPrefsBody = {
    viewMode: patch.viewMode ?? current.viewMode,
    byView: nextByView,
  };

  const existing = await findCalendarUiPrefsEntity(ctx);
  if (!existing) {
    await createEntity({
      type: "content",
      world_id: ctx.worldId,
      primary_component: CALENDAR_UI_PREFS_COMPONENT,
      components: [CALENDAR_UI_PREFS_COMPONENT],
      title: "日程显示偏好",
      body: next,
    });
    return next;
  }
  const updated = await updateEntity({ id: existing.id, body: next });
  if (!updated) throw new Error("invalid calendar ui prefs after update");
  const parsed = asCalendarUiPrefs(updated);
  if (!parsed) throw new Error("invalid calendar ui prefs after update");
  const { id: _id, ...body } = parsed;
  return body;
}
