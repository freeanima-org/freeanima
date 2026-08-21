import { OBJECTIVE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { OBJECTIVE_COMPONENT };

import { z } from "zod";

export const objectiveStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
  "on_hold",
]);
export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>;

export const objectiveLinkKindSchema = z.enum([
  "project",
  "task_item",
  "task_list",
  "calendar_event",
]);
export type ObjectiveLinkKind = z.infer<typeof objectiveLinkKindSchema>;

export const objectiveLinkSchema = z.object({
  kind: objectiveLinkKindSchema,
  id: z.number().int().positive(),
});
export type ObjectiveLink = z.infer<typeof objectiveLinkSchema>;

export const objectivePomodoroFilterSchema = z.object({
  task_ids: z.array(z.number().int().positive()).optional(),
  count_by: z.enum(["sessions", "minutes"]),
});
export type ObjectivePomodoroFilter = z.infer<typeof objectivePomodoroFilterSchema>;

export const objectiveAutoSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tasks_completed"),
    task_ids: z.array(z.number().int().positive()),
  }),
  z.object({
    type: z.literal("projects_completed"),
    project_ids: z.array(z.number().int().positive()),
  }),
  z.object({
    type: z.literal("pomodoro"),
    filter: objectivePomodoroFilterSchema,
  }),
  z.object({
    type: z.literal("habit"),
    habit_id: z.number().int().positive(),
  }),
]);
export type ObjectiveAutoSource = z.infer<typeof objectiveAutoSourceSchema>;

export const objectiveCompletionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("qualitative") }),
  z.object({
    kind: z.literal("metric_manual"),
    unit: z.string().min(1),
    target: z.number(),
    current: z.number(),
  }),
  z.object({
    kind: z.literal("metric_auto"),
    unit: z.string().min(1),
    target: z.number(),
    source: objectiveAutoSourceSchema,
  }),
]);
export type ObjectiveCompletion = z.infer<typeof objectiveCompletionSchema>;

export const objectiveBodySchema = z.object({
  parent_id: z.number().int().positive().nullable().optional(),
  status: objectiveStatusSchema.default("not_started"),
  start_at: z.string().nullable().default(null),
  end_at: z.string().nullable().default(null),
  completion: objectiveCompletionSchema.default({ kind: "qualitative" }),
  links: z.array(objectiveLinkSchema).default([]),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type ObjectiveBody = z.infer<typeof objectiveBodySchema>;
