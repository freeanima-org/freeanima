import { WORLD_CONFIG_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { WORLD_CONFIG_COMPONENT };

import { z } from "zod";

export const worldGrantPermissionSchema = z.enum(["read", "write"]);
export type WorldGrantPermission = z.infer<typeof worldGrantPermissionSchema>;

export const worldGrantSchema = z.object({
  subject_id: z.number().int().positive(),
  permission: worldGrantPermissionSchema,
});
export type WorldGrant = z.infer<typeof worldGrantSchema>;

/** 展示字段在 entities.title / summary / content；可见性、所有者与 subject 授权在此 body 中表达 */
export const worldConfigBodySchema = z
  .object({
    private: z.boolean().default(false),
    /** 唯一公共 Commons world；强制 public */
    common: z.boolean().default(false),
    owner_subject_id: z.number().int().positive().optional(),
    default_private: z.boolean().default(false),
    grants: z.array(worldGrantSchema).default([]),
    /**
     * 跨机逻辑身份（如 `git:github.com/org/foo`）；勿称 repo_key。
     * 非空时全局唯一（见 migration partial unique index）。
     */
    stable_key: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .regex(/^[a-z][a-z0-9_]*:.+$/i, "stable_key must look like prefix:value")
      .optional(),
  })
  .superRefine((b, ctx) => {
    if (b.common) {
      if (b.private) {
        ctx.addIssue({
          code: "custom",
          message: "common world must be public",
        });
      }
      if (b.owner_subject_id != null) {
        ctx.addIssue({
          code: "custom",
          message: "common world must not have owner_subject_id",
        });
      }
      if (b.default_private) {
        ctx.addIssue({
          code: "custom",
          message: "common world cannot be default_private",
        });
      }
    }
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
    const seen = new Set<number>();
    b.grants.forEach((g, i) => {
      if (seen.has(g.subject_id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate grant subject_id ${g.subject_id}`,
          path: ["grants", i, "subject_id"],
        });
      }
      seen.add(g.subject_id);
      if (b.owner_subject_id != null && g.subject_id === b.owner_subject_id) {
        ctx.addIssue({
          code: "custom",
          message: "grant subject_id must not equal owner_subject_id",
          path: ["grants", i, "subject_id"],
        });
      }
    });
  });

export type WorldConfigBody = z.infer<typeof worldConfigBodySchema>;

/** 规范化 grants：去重（后者覆盖前者）、剔除 owner */
export function normalizeWorldGrants(
  grants: WorldGrant[] | undefined,
  ownerSubjectId: number | undefined,
): WorldGrant[] {
  if (!grants?.length) return [];
  const bySubject = new Map<number, WorldGrantPermission>();
  for (const g of grants) {
    if (ownerSubjectId != null && g.subject_id === ownerSubjectId) continue;
    bySubject.set(g.subject_id, g.permission);
  }
  return [...bySubject.entries()]
    .map(([subject_id, permission]) => ({ subject_id, permission }))
    .toSorted((a, b) => a.subject_id - b.subject_id);
}
