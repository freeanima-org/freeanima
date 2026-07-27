import {
  companionBehaviorSchema,
  companionConfigSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
  type CompanionRuntimeConfig,
} from "@freeanima/host/core/config/schemas/companion.ts";

/**
 * @deprecated 伴侣配置已迁至 habitat_runtime_config.companion。
 * 组件 id 仅保留以便软删历史行；勿再 create。
 */
export const COMPANION_PROFILE_COMPONENT = "companion_profile" as const;

export const companionProfileBodySchema = companionConfigSchema;
export type CompanionProfileBody = CompanionRuntimeConfig;

export {
  companionBehaviorSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
};
