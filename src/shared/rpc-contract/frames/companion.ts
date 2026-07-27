import { z } from "zod";
import {
  companionBehaviorSchema,
  companionConfigSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
} from "@freeanima/host/core/config/schemas/companion.ts";

export {
  companionBehaviorSchema,
  companionConfigSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
};

export type CompanionModelEntryPayload = z.infer<typeof companionModelEntrySchema>;
export type CompanionMotionEntryPayload = z.infer<typeof companionMotionEntrySchema>;
export type CompanionBehaviorPayload = z.infer<typeof companionBehaviorSchema>;
export type CompanionMotionSlotsPayload = z.infer<typeof companionMotionSlotsSchema>;
export type CompanionConfigPayload = z.infer<typeof companionConfigSchema>;

export const companionClientConfigSchema = companionConfigSchema.extend({
  habitat_url: z.string().optional(),
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
  active_object_file_id: z.number().int().positive().nullable().optional(),
});
export type CompanionConfigUpdateInput = z.infer<typeof companionConfigUpdateInputSchema>;
export const companionConfigUpdateOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionConfigUpdateOutput = z.infer<typeof companionConfigUpdateOutputSchema>;

export const companionModelSetActiveInputSchema = z.object({
  object_file_id: z.number().int().positive(),
});
export type CompanionModelSetActiveInput = z.infer<typeof companionModelSetActiveInputSchema>;
export const companionModelSetActiveOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelSetActiveOutput = z.infer<typeof companionModelSetActiveOutputSchema>;

export const companionModelRenameInputSchema = z.object({
  object_file_id: z.number().int().positive(),
  name: z.string().min(1),
});
export type CompanionModelRenameInput = z.infer<typeof companionModelRenameInputSchema>;
export const companionModelRenameOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelRenameOutput = z.infer<typeof companionModelRenameOutputSchema>;

export const companionModelDeleteInputSchema = z.object({
  object_file_id: z.number().int().positive(),
});
export type CompanionModelDeleteInput = z.infer<typeof companionModelDeleteInputSchema>;
export const companionModelDeleteOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelDeleteOutput = z.infer<typeof companionModelDeleteOutputSchema>;

export const companionModelReorderInputSchema = z.object({
  object_file_ids: z.array(z.number().int().positive()),
});
export type CompanionModelReorderInput = z.infer<typeof companionModelReorderInputSchema>;
export const companionModelReorderOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionModelReorderOutput = z.infer<typeof companionModelReorderOutputSchema>;

export const companionMotionSetSlotInputSchema = z.object({
  slot: z.enum(["idle", "rest", "walk", "climb", "in_place"]),
  object_file_ids: z.array(z.number().int().positive()),
});
export type CompanionMotionSetSlotInput = z.infer<typeof companionMotionSetSlotInputSchema>;
export const companionMotionSetSlotOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionSetSlotOutput = z.infer<typeof companionMotionSetSlotOutputSchema>;

export const companionMotionRenameInputSchema = z.object({
  object_file_id: z.number().int().positive(),
  name: z.string().min(1),
});
export type CompanionMotionRenameInput = z.infer<typeof companionMotionRenameInputSchema>;
export const companionMotionRenameOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionRenameOutput = z.infer<typeof companionMotionRenameOutputSchema>;

export const companionMotionDeleteInputSchema = z.object({
  object_file_id: z.number().int().positive(),
});
export type CompanionMotionDeleteInput = z.infer<typeof companionMotionDeleteInputSchema>;
export const companionMotionDeleteOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionDeleteOutput = z.infer<typeof companionMotionDeleteOutputSchema>;

export const companionMotionReorderInputSchema = z.object({
  object_file_ids: z.array(z.number().int().positive()),
});
export type CompanionMotionReorderInput = z.infer<typeof companionMotionReorderInputSchema>;
export const companionMotionReorderOutputSchema = z.object({
  config: companionClientConfigSchema,
});
export type CompanionMotionReorderOutput = z.infer<typeof companionMotionReorderOutputSchema>;

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
export const companionSyncAssetSchema = z.object({
  kind: z.enum(["models", "motions"]),
  file_name: z.string().min(1),
  object_file_id: z.number().int().positive(),
});
export const companionSyncPullOutputSchema = z.object({
  config: companionClientConfigSchema,
  assets: z.array(companionSyncAssetSchema),
});
export type CompanionSyncPullOutput = z.infer<typeof companionSyncPullOutputSchema>;
