import {
  attachToolReturns,
  toolError,
  toolResult,
  resolveToolCallerSubjectId,
} from "@freeanima/habitat/core/tool";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { coerceString } from "@freeanima/shared/coerce-string";

import type { HabitStatus } from "@freeanima/habitat/core/db/schema/entity";
import { checkInHabit, getHabit, getHabitStats, listHabits } from "./habit-store.ts";

async function resolveWorldId(): Promise<number | string> {
  try {
    const subjectId = resolveToolCallerSubjectId();
    if (subjectId == null || !Number.isInteger(subjectId) || subjectId <= 0) {
      return toolError("subject_id required");
    }
    return await resolvePrivateWorldId(subjectId);
  } catch (e) {
    return toolError(e instanceof Error ? e.message : String(e));
  }
}

function buildHabitToolDefs() {
  return attachToolReturns(
    [
      {
        name: "habit_list",
        description: "List active habits (optional archived)",
        exposeMcp: true,
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "archived"] },
            include_today: { type: "boolean" },
          },
          required: [],
        },
        handler: async (args) => {
          const worldId = await resolveWorldId();
          if (typeof worldId === "string") return worldId;
          const status: HabitStatus =
            args.status === "archived" || args.status === "active" ? args.status : "active";
          const items = await listHabits(worldId, {
            status,
            ...(args.include_today === true ? { include_today: true } : {}),
          });
          return toolResult({ ok: true, action: "list", items });
        },
      },
      {
        name: "habit_check_in",
        description: "Check in a habit for today or a given day (YYYY-MM-DD)",
        exposeMcp: true,
        parameters: {
          type: "object",
          properties: {
            habit_id: { type: "integer" },
            day: { type: "string" },
            amount_delta: { type: "number" },
            amount: { type: "number" },
            note: { type: "string" },
          },
          required: ["habit_id"],
        },
        handler: async (args) => {
          const worldId = await resolveWorldId();
          if (typeof worldId === "string") return worldId;
          const habit_id = Number(args.habit_id);
          if (!Number.isInteger(habit_id) || habit_id <= 0) return toolError("habit_id required");
          try {
            const result = await checkInHabit(
              worldId,
              omitUndefined({
                habit_id,
                day: coerceString(args.day) ?? undefined,
                amount_delta: typeof args.amount_delta === "number" ? args.amount_delta : undefined,
                amount: typeof args.amount === "number" ? args.amount : undefined,
                note: coerceString(args.note) ?? undefined,
              }),
            );
            return toolResult({ ok: true, action: "check_in", ...result });
          } catch (e) {
            return toolError(e instanceof Error ? e.message : String(e));
          }
        },
      },
      {
        name: "habit_stats",
        description: "Habit streak and monthly check-in cells",
        exposeMcp: true,
        parameters: {
          type: "object",
          properties: {
            habit_id: { type: "integer" },
            month: { type: "string", description: "YYYY-MM" },
          },
          required: ["habit_id"],
        },
        handler: async (args) => {
          const worldId = await resolveWorldId();
          if (typeof worldId === "string") return worldId;
          const habit_id = Number(args.habit_id);
          if (!Number.isInteger(habit_id) || habit_id <= 0) return toolError("habit_id required");
          const habit = await getHabit(worldId, habit_id);
          if (!habit) return toolError("NOT_FOUND");
          const stats = await getHabitStats(
            worldId,
            habit_id,
            coerceString(args.month) ?? undefined,
          );
          return toolResult({ ok: true, action: "stats", stats });
        },
      },
    ],
    {},
  );
}

export function registerHabitTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet("habit", "习惯打卡", buildHabitToolDefs());
}
