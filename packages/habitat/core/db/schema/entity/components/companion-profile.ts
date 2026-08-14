import { COMPANION_PROFILE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { COMPANION_PROFILE_COMPONENT };

import {
  companionBehaviorSchema,
  companionConfigSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
  type CompanionRuntimeConfig,
} from "@freeanima/habitat/core/config/schemas/companion.ts";

/**
 * @deprecated 伴侣配置已迁至 habitat_runtime_config.companion。
 * 组件 id 仅保留以便软删历史行；勿再 create。
 */

export const companionProfileBodySchema = companionConfigSchema;
export type CompanionProfileBody = CompanionRuntimeConfig;

export {
  companionBehaviorSchema,
  companionModelEntrySchema,
  companionMotionEntrySchema,
  companionMotionSlotsSchema,
};
