import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { getPomodoroConfig, updatePomodoroConfig } from "./config-store.ts";
import { POMODORO_TOOL_RETURNS } from "./return-schemas.ts";
import {
  completePomodoroSession,
  getPomodoroStats,
  listPomodoroSessions,
  nowIso,
} from "./session-store.ts";
import { resolvePomodoroToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

async function storeContext(args: Record<string, unknown>) {
  const worldId = await resolvePomodoroToolWorld(args);
  if (typeof worldId === "string") return worldId;
  return { worldId };
}

export function registerPomodoroTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "pomodoro",
    "Pomodoro focus sessions and configuration (user private world).",
    attachToolReturns(
      [
        {
          name: "pomodoro_config_get",
          description: "Get pomodoro timer configuration for the subject world.",
          parameters: {
            type: "object",
            properties: {
              subject_id: { type: "integer", description: "Owning subject entity id" },
              world_id: WORLD_ID_OPTIONAL,
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const ctx = await storeContext(args);
            if (typeof ctx === "string") return ctx;
            const config = await getPomodoroConfig(ctx);
            return toolResult({ ok: true, config });
          },
        },
        {
          name: "pomodoro_config_update",
          description: "Update pomodoro timer configuration (partial fields).",
          parameters: {
            type: "object",
            properties: {
              subject_id: { type: "integer", description: "Owning subject entity id" },
              world_id: WORLD_ID_OPTIONAL,
              work_minutes: { type: "number" },
              short_break_minutes: { type: "number" },
              long_break_minutes: { type: "number" },
              cycles_before_long_break: { type: "number" },
              auto_start_break: { type: "boolean" },
              auto_start_work: { type: "boolean" },
              notify_on_phase_end: { type: "boolean" },
              sound_enabled: { type: "boolean" },
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const ctx = await storeContext(args);
            if (typeof ctx === "string") return ctx;
            const config = await updatePomodoroConfig(
              ctx,
              omitUndefined({
                work_minutes: args.work_minutes != null ? Number(args.work_minutes) : undefined,
                short_break_minutes:
                  args.short_break_minutes != null ? Number(args.short_break_minutes) : undefined,
                long_break_minutes:
                  args.long_break_minutes != null ? Number(args.long_break_minutes) : undefined,
                cycles_before_long_break:
                  args.cycles_before_long_break != null
                    ? Number(args.cycles_before_long_break)
                    : undefined,
                auto_start_break:
                  args.auto_start_break !== undefined ? Boolean(args.auto_start_break) : undefined,
                auto_start_work:
                  args.auto_start_work !== undefined ? Boolean(args.auto_start_work) : undefined,
                notify_on_phase_end:
                  args.notify_on_phase_end !== undefined
                    ? Boolean(args.notify_on_phase_end)
                    : undefined,
                sound_enabled:
                  args.sound_enabled !== undefined ? Boolean(args.sound_enabled) : undefined,
              }),
            );
            return toolResult({ ok: true, config });
          },
        },
        {
          name: "pomodoro_session_complete",
          description: "Record a completed pomodoro phase session.",
          parameters: {
            type: "object",
            properties: {
              subject_id: { type: "integer", description: "Owning subject entity id" },
              world_id: WORLD_ID_OPTIONAL,
              phase: { type: "string", enum: ["work", "short_break", "long_break"] },
              started_at: { type: "string" },
              finished_at: { type: "string" },
              planned_duration_ms: { type: "number" },
              actual_duration_ms: { type: "number" },
              task_item_id: { type: "number" },
              cycle_index: { type: "number" },
              title: { type: "string" },
            },
            required: [
              "subject_id",
              "phase",
              "started_at",
              "finished_at",
              "planned_duration_ms",
              "actual_duration_ms",
            ],
          },
          handler: async (args) => {
            const ctx = await storeContext(args);
            if (typeof ctx === "string") return ctx;
            const phaseRaw = coerceString(args.phase ?? "").trim();
            if (phaseRaw !== "work" && phaseRaw !== "short_break" && phaseRaw !== "long_break") {
              return toolError("invalid phase");
            }
            const phase: "work" | "short_break" | "long_break" = phaseRaw;
            const startedAt = coerceString(args.started_at ?? "").trim();
            const finishedAt = coerceString(args.finished_at ?? "").trim() || nowIso();
            const planned = Number(args.planned_duration_ms);
            const actual = Number(args.actual_duration_ms);
            if (!startedAt) return toolError("started_at is required");
            if (!Number.isFinite(planned) || planned <= 0) {
              return toolError("planned_duration_ms must be positive");
            }
            if (!Number.isFinite(actual) || actual < 0) {
              return toolError("actual_duration_ms must be non-negative");
            }
            const item = await completePomodoroSession(
              ctx,
              omitUndefined({
                phase,
                started_at: startedAt,
                finished_at: finishedAt,
                planned_duration_ms: planned,
                actual_duration_ms: actual,
                task_item_id:
                  args.task_item_id != null && args.task_item_id !== ""
                    ? Number(args.task_item_id)
                    : null,
                cycle_index: args.cycle_index != null ? Number(args.cycle_index) : 0,
                title: args.title != null ? coerceString(args.title) : undefined,
              }),
            );
            return toolResult({ ok: true, item });
          },
        },
        {
          name: "pomodoro_session_list",
          description: "List recent pomodoro sessions.",
          parameters: {
            type: "object",
            properties: {
              subject_id: { type: "integer", description: "Owning subject entity id" },
              world_id: WORLD_ID_OPTIONAL,
              limit: { type: "number" },
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const ctx = await storeContext(args);
            if (typeof ctx === "string") return ctx;
            const limit = args.limit != null ? Number(args.limit) : 20;
            const { items } = await listPomodoroSessions(ctx, { limit });
            return toolResult({ ok: true, items });
          },
        },
        {
          name: "pomodoro_stats",
          description: "Aggregate pomodoro stats for today or the past week.",
          parameters: {
            type: "object",
            properties: {
              subject_id: { type: "integer", description: "Owning subject entity id" },
              world_id: WORLD_ID_OPTIONAL,
              period: { type: "string", enum: ["today", "week"] },
            },
            required: ["subject_id"],
          },
          handler: async (args) => {
            const ctx = await storeContext(args);
            if (typeof ctx === "string") return ctx;
            const period = coerceString(args.period ?? "today");
            if (period !== "today" && period !== "week") return toolError("invalid period");
            const stats = await getPomodoroStats(ctx, period);
            return toolResult({ ok: true, ...stats });
          },
        },
      ],
      POMODORO_TOOL_RETURNS,
    ),
  );
}

export function resetPomodoroToolsForTests(): void {}
