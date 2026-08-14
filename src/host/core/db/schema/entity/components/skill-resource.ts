import { SKILL_RESOURCE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SKILL_RESOURCE_COMPONENT };

import { z } from "zod";

/** 技能配套文本资源（references / scripts）；二进制走 object_file */
export const skillResourceBodySchema = z.object({
  skill_id: z.number().int().positive(),
  path: z.string().min(1),
});

export type SkillResourceBody = z.infer<typeof skillResourceBodySchema>;
