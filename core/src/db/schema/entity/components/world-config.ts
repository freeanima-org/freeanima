import { z } from "zod";

export const WORLD_CONFIG_COMPONENT = "world_config" as const;

/** 展示字段在 entities.title / summary / content；可见性与所有者在此 body 中表达 */
export const worldConfigBodySchema = z
  .object({
    private: z.boolean().default(false),
    owner_subject_id: z.number().int().positive().optional(),
    default_private: z.boolean().default(false),
  })
  .superRefine((b, ctx) => {
    if (b.private && b.owner_subject_id == null) {
      ctx.addIssue({ code: "custom", message: "private world requires owner_subject_id" });
    }
    if (!b.private && b.owner_subject_id != null) {
      ctx.addIssue({ code: "custom", message: "public world must not have owner_subject_id" });
    }
    if (b.default_private) {
      if (!b.private) {
        ctx.addIssue({
          code: "custom",
          message: "default private world must be private",
        });
      }
      if (b.owner_subject_id == null) {
        ctx.addIssue({
          code: "custom",
          message: "default private world requires owner_subject_id",
        });
      }
    }
  });

export type WorldConfigBody = z.infer<typeof worldConfigBodySchema>;
