import { SKILL_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { SKILL_COMPONENT };

import { z } from "zod";

export const skillOriginSchema = z.enum(["builtin", "user", "imported", "evolved"]);
export type SkillOrigin = z.infer<typeof skillOriginSchema>;

export const skillStatusSchema = z.enum(["draft", "active", "discarded"]);
export type SkillStatus = z.infer<typeof skillStatusSchema>;

export const skillResourceRefSchema = z.object({
  path: z.string().min(1),
  entity_id: z.number().int().positive(),
  kind: z.enum(["text", "object_file"]).default("text"),
});
export type SkillResourceRef = z.infer<typeof skillResourceRefSchema>;

/**
 * skill body：name→entities.title，description→summary，instruction→content。
 * 对齐 agentskills.io frontmatter，并扩展 FreeAnima 字段。
 */
export const skillBodySchema = z.object({
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  allowed_tools: z.array(z.string()).default([]),
  denied_tools: z.array(z.string()).default([]),
  origin: skillOriginSchema.default("user"),
  status: skillStatusSchema.default("active"),
  resources: z.array(skillResourceRefSchema).default([]),
});

export type SkillBody = z.infer<typeof skillBodySchema>;

/** agentskills name：小写字母数字与连字符，≤64 */
export const SKILL_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_RE.test(name);
}
