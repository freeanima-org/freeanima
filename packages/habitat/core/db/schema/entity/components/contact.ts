import { CONTACT_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { CONTACT_COMPONENT };

import { z } from "zod";

/** 通用通道条目（邮箱 / 电话 / 微信等）。 */
export const contactChannelEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().optional(),
  /** 可确认身份；为 true 时该通道值须在 Commons 内全局唯一 */
  identity_key: z.boolean().default(false),
});

export type ContactChannelEntry = z.infer<typeof contactChannelEntrySchema>;

/** 物理地址不具备全局唯一前提，禁止标为身份键。 */
export const contactAddressEntrySchema = z
  .object({
    value: z.string().min(1),
    label: z.string().optional(),
    identity_key: z.boolean().default(false),
  })
  .superRefine((entry, ctx) => {
    if (entry.identity_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "addresses cannot be identity_key",
        path: ["identity_key"],
      });
    }
  });

export type ContactAddressEntry = z.infer<typeof contactAddressEntrySchema>;

/** Anima 身份通道：与微信/邮箱同级；内部分本机 / 外部实例。 */
export const contactAnimaLocalSchema = z.object({
  kind: z.literal("local"),
  public_id: z.string().min(1),
  public_key: z.string().min(1).optional(),
  subject_id: z.number().int().positive(),
});

export const contactAnimaExternalSchema = z.object({
  kind: z.literal("external"),
  public_id: z.string().min(1),
  public_key: z.string().min(1).optional(),
  habitat_instance_id: z.string().min(1),
  habitat_public_key: z.string().min(1).optional(),
});

export const contactAnimaEntrySchema = z.discriminatedUnion("kind", [
  contactAnimaLocalSchema,
  contactAnimaExternalSchema,
]);

export type ContactAnimaEntry = z.infer<typeof contactAnimaEntrySchema>;
export type ContactAnimaLocal = z.infer<typeof contactAnimaLocalSchema>;
export type ContactAnimaExternal = z.infer<typeof contactAnimaExternalSchema>;

export const contactBodySchema = z.object({
  emails: z.array(contactChannelEntrySchema).default([]),
  phones: z.array(contactChannelEntrySchema).default([]),
  addresses: z.array(contactAddressEntrySchema).default([]),
  wechats: z.array(contactChannelEntrySchema).default([]),
  /** Anima 身份通道（可多条） */
  animas: z.array(contactAnimaEntrySchema).default([]),
  /**
   * @deprecated 收敛到 animas[].kind=local；读路径仍兼容，写路径应同步 animas。
   */
  subject_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().optional(),
});

export type ContactBody = z.infer<typeof contactBodySchema>;

export type ContactChannelKind = "email" | "phone" | "wechat" | "address";

/** 从 body 取主本地 subject_id（优先 animas local，回退遗留字段）。 */
export function contactPrimaryLocalSubjectId(body: ContactBody): number | null {
  for (const a of body.animas ?? []) {
    if (a.kind === "local") return a.subject_id;
  }
  return body.subject_id ?? null;
}

/** 按 public_id 查找 anima 条目。 */
export function findContactAnimaByPublicId(
  body: ContactBody,
  publicId: string,
): ContactAnimaEntry | undefined {
  const id = publicId.trim();
  if (!id) return undefined;
  return (body.animas ?? []).find((a) => a.public_id === id);
}

export function normalizeContactChannelValue(kind: ContactChannelKind, value: string): string {
  const trimmed = value.trim();
  if (kind === "email") return trimmed.toLowerCase();
  if (kind === "phone") return trimmed.replace(/\s+/g, "");
  return trimmed;
}
