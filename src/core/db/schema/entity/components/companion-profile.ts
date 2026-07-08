import { z } from "zod";

export const COMPANION_PROFILE_COMPONENT = "companion_profile" as const;

export const companionModelEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  path: z.string(),
  content_hash: z.string().optional(),
});

export const companionMotionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  file: z.string(),
  content_hash: z.string().optional(),
});

export const companionBehaviorSchema = z.object({
  patrol_enabled: z.boolean(),
  idle_patrol_delay_sec: z.number(),
  patrol_pause_sec: z.number(),
  patrol_speed_px: z.number(),
  double_click_patrol: z.boolean(),
  startup_walk_enabled: z.boolean(),
});

export const companionMotionSlotsSchema = z.object({
  idle: z.array(z.string()),
  rest: z.array(z.string()),
  walk: z.array(z.string()),
  climb: z.array(z.string()),
  in_place: z.array(z.string()),
});

export const companionProfileBodySchema = z.object({
  active_model_id: z.string(),
  models: z.array(companionModelEntrySchema),
  motion_library: z.array(companionMotionEntrySchema),
  motion_slots: companionMotionSlotsSchema,
  behavior: companionBehaviorSchema,
});

export type CompanionProfileBody = z.infer<typeof companionProfileBodySchema>;
