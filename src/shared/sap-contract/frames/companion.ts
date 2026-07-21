import { z } from "zod";

export const companionModelEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  path: z.string(),
  content_hash: z.string().optional(),
});

export type CompanionModelEntryPayload = z.infer<typeof companionModelEntrySchema>;

export const companionMotionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  file: z.string(),
  content_hash: z.string().optional(),
});

export type CompanionMotionEntryPayload = z.infer<typeof companionMotionEntrySchema>;

export const companionBehaviorSchema = z.object({
  patrol_enabled: z.boolean(),
  idle_patrol_delay_sec: z.number(),
  patrol_pause_sec: z.number(),
  patrol_speed_px: z.number(),
  double_click_patrol: z.boolean(),
  startup_walk_enabled: z.boolean(),
});

export type CompanionBehaviorPayload = z.infer<typeof companionBehaviorSchema>;

export const companionMotionSlotsSchema = z.object({
  idle: z.array(z.string()),
  rest: z.array(z.string()),
  walk: z.array(z.string()),
  climb: z.array(z.string()),
  in_place: z.array(z.string()),
});

export type CompanionMotionSlotsPayload = z.infer<typeof companionMotionSlotsSchema>;

export const companionConfigSchema = z.object({
  active_model_id: z.string(),
  models: z.array(companionModelEntrySchema),
  motion_library: z.array(companionMotionEntrySchema),
  motion_slots: companionMotionSlotsSchema,
  behavior: companionBehaviorSchema,
});

export type CompanionConfigPayload = z.infer<typeof companionConfigSchema>;

export const companionClientConfigSchema = companionConfigSchema.extend({
  habitat_url: z.string().optional(),
  hub_url: z.string().optional(),
  model_path: z.string(),
  model_available: z.boolean(),
  fbx_import_available: z.boolean(),
});

export type CompanionClientConfigPayload = z.infer<typeof companionClientConfigSchema>;

export const companionConfigGetInputSchema = z.object({}).passthrough();
export type CompanionConfigGetInput = z.infer<typeof companionConfigGetInputSchema>;
export const companionConfigGetOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionConfigGetOutput = z.infer<typeof companionConfigGetOutputSchema>;

export const companionConfigUpdateInputSchema = z.object({
  behavior: companionBehaviorSchema.partial().optional(),
  motion_slots: companionMotionSlotsSchema.partial().optional(),
  active_model_id: z.string().optional(),
});
export type CompanionConfigUpdateInput = z.infer<typeof companionConfigUpdateInputSchema>;
export const companionConfigUpdateOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionConfigUpdateOutput = z.infer<typeof companionConfigUpdateOutputSchema>;

export const companionModelSetActiveInputSchema = z.object({
  id: z.string().min(1),
});
export type CompanionModelSetActiveInput = z.infer<typeof companionModelSetActiveInputSchema>;
export const companionModelSetActiveOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelSetActiveOutput = z.infer<typeof companionModelSetActiveOutputSchema>;

export const companionModelRenameInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type CompanionModelRenameInput = z.infer<typeof companionModelRenameInputSchema>;
export const companionModelRenameOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelRenameOutput = z.infer<typeof companionModelRenameOutputSchema>;

export const companionModelDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type CompanionModelDeleteInput = z.infer<typeof companionModelDeleteInputSchema>;
export const companionModelDeleteOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelDeleteOutput = z.infer<typeof companionModelDeleteOutputSchema>;

export const companionMotionSetSlotInputSchema = z.object({
  slot: z.enum(["idle", "rest", "walk", "climb", "in_place"]),
  motion_ids: z.array(z.string()),
});
export type CompanionMotionSetSlotInput = z.infer<typeof companionMotionSetSlotInputSchema>;
export const companionMotionSetSlotOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionSetSlotOutput = z.infer<typeof companionMotionSetSlotOutputSchema>;

export const companionMotionRenameInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type CompanionMotionRenameInput = z.infer<typeof companionMotionRenameInputSchema>;
export const companionMotionRenameOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionRenameOutput = z.infer<typeof companionMotionRenameOutputSchema>;

export const companionMotionDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type CompanionMotionDeleteInput = z.infer<typeof companionMotionDeleteInputSchema>;
export const companionMotionDeleteOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionDeleteOutput = z.infer<typeof companionMotionDeleteOutputSchema>;

export const companionMigrateFromLocalInputSchema = z.object({
  source_dir: z.string().optional(),
});
export type CompanionMigrateFromLocalInput = z.infer<typeof companionMigrateFromLocalInputSchema>;
export const companionMigrateFromLocalOutputSchema = z.object({
  config: companionClientConfigSchema,
  imported_models: z.number().int().nonnegative(),
  imported_motions: z.number().int().nonnegative(),
});
export type CompanionMigrateFromLocalOutput = z.infer<typeof companionMigrateFromLocalOutputSchema>;

export const companionSyncPullInputSchema = z.object({}).passthrough();
export type CompanionSyncPullInput = z.infer<typeof companionSyncPullInputSchema>;
export const companionSyncPullOutputSchema = z.object({
  config: companionClientConfigSchema,
  asset_urls: z.array(z.string()),
});
export type CompanionSyncPullOutput = z.infer<typeof companionSyncPullOutputSchema>;
