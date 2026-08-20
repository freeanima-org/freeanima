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

export const contactBodySchema = z.object({
  emails: z.array(contactChannelEntrySchema).default([]),
  phones: z.array(contactChannelEntrySchema).default([]),
  addresses: z.array(contactAddressEntrySchema).default([]),
  wechats: z.array(contactChannelEntrySchema).default([]),
  /** 可选挂本机 user/agent subject */
  subject_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().optional(),
});

export type ContactBody = z.infer<typeof contactBodySchema>;

export type ContactChannelKind = "email" | "phone" | "wechat" | "address";

export function normalizeContactChannelValue(kind: ContactChannelKind, value: string): string {
  const trimmed = value.trim();
  if (kind === "email") return trimmed.toLowerCase();
  if (kind === "phone") return trimmed.replace(/\s+/g, "");
  return trimmed;
}
