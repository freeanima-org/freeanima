import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const contactSubjectKindSchema = notificationRecipientKindSchema;

export const contactChannelEntrySchema = z.object({
  value: z.string().min(1),
  label: z.string().optional(),
  identity_key: z.boolean().default(false),
});

export type ContactChannelEntryPayload = z.infer<typeof contactChannelEntrySchema>;

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

export type ContactAddressEntryPayload = z.infer<typeof contactAddressEntrySchema>;

export const contactRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  emails: z.array(contactChannelEntrySchema),
  phones: z.array(contactChannelEntrySchema),
  addresses: z.array(contactAddressEntrySchema),
  wechats: z.array(contactChannelEntrySchema),
  subject_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ContactRowPayload = z.infer<typeof contactRowSchema>;

export const contactListInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  limit: z.number().int().positive().max(5000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ContactListInput = z.infer<typeof contactListInputSchema>;
export const contactListOutputSchema = z.object({
  items: z.array(contactRowSchema),
});
export type ContactListOutput = z.infer<typeof contactListOutputSchema>;

export const contactGetInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  id: z.number().int().positive(),
});
export type ContactGetInput = z.infer<typeof contactGetInputSchema>;
export const contactGetOutputSchema = z.object({ item: contactRowSchema });
export type ContactGetOutput = z.infer<typeof contactGetOutputSchema>;

export const contactSearchInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ContactSearchInput = z.infer<typeof contactSearchInputSchema>;
export const contactSearchOutputSchema = z.object({
  items: z.array(contactRowSchema),
  count: z.number().int().nonnegative(),
});
export type ContactSearchOutput = z.infer<typeof contactSearchOutputSchema>;

const contactChannelsInput = {
  emails: z.array(contactChannelEntrySchema).optional(),
  phones: z.array(contactChannelEntrySchema).optional(),
  addresses: z.array(contactAddressEntrySchema).optional(),
  wechats: z.array(contactChannelEntrySchema).optional(),
  subject_id: z.number().int().positive().nullable().optional(),
};

export const contactCreateInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  title: z.string().min(1),
  summary: z.string().optional(),
  ...contactChannelsInput,
  client_op_id: z.string().min(1).optional(),
});
export type ContactCreateInput = z.infer<typeof contactCreateInputSchema>;
export const contactCreateOutputSchema = z.object({ item: contactRowSchema });
export type ContactCreateOutput = z.infer<typeof contactCreateOutputSchema>;

export const contactPatchInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  ...contactChannelsInput,
  client_op_id: z.string().min(1).optional(),
});
export type ContactPatchInput = z.infer<typeof contactPatchInputSchema>;
export const contactPatchOutputSchema = z.object({ item: contactRowSchema });
export type ContactPatchOutput = z.infer<typeof contactPatchOutputSchema>;

export const contactDeleteInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type ContactDeleteInput = z.infer<typeof contactDeleteInputSchema>;
export const contactDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type ContactDeleteOutput = z.infer<typeof contactDeleteOutputSchema>;

export const contactResolveByAddressInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  address: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});
export type ContactResolveByAddressInput = z.infer<typeof contactResolveByAddressInputSchema>;
export const contactResolveByAddressOutputSchema = z.object({
  items: z.array(contactRowSchema),
});
export type ContactResolveByAddressOutput = z.infer<typeof contactResolveByAddressOutputSchema>;

export const contactAttachAddressInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  contact_id: z.number().int().positive(),
  address: z.string().min(1),
  label: z.string().optional(),
  identity_key: z.boolean().optional(),
});
export type ContactAttachAddressInput = z.infer<typeof contactAttachAddressInputSchema>;
export const contactAttachAddressOutputSchema = z.object({ item: contactRowSchema });
export type ContactAttachAddressOutput = z.infer<typeof contactAttachAddressOutputSchema>;

export const contactCreateFromAddressInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  title: z.string().min(1),
  address: z.string().min(1),
  label: z.string().optional(),
  identity_key: z.boolean().optional(),
  summary: z.string().optional(),
  message_id: z.number().int().positive().optional(),
  link_role: z.enum(["from", "to"]).optional(),
});
export type ContactCreateFromAddressInput = z.infer<typeof contactCreateFromAddressInputSchema>;
export const contactCreateFromAddressOutputSchema = z.object({ item: contactRowSchema });
export type ContactCreateFromAddressOutput = z.infer<typeof contactCreateFromAddressOutputSchema>;

export const contactLinkMessageInputSchema = z.object({
  subject_kind: contactSubjectKindSchema,
  message_id: z.number().int().positive(),
  role: z.enum(["from", "to"]),
  contact_id: z.number().int().positive().nullable(),
  /** to 角色：替换整个 to_contact_ids；省略则按 contact_id 追加/清除单项语义由 contact_id 决定 */
  to_contact_ids: z.array(z.number().int().positive()).optional(),
});
export type ContactLinkMessageInput = z.infer<typeof contactLinkMessageInputSchema>;
export const contactLinkMessageOutputSchema = z.object({
  from_contact_id: z.number().int().positive().nullable(),
  to_contact_ids: z.array(z.number().int().positive()),
});
export type ContactLinkMessageOutput = z.infer<typeof contactLinkMessageOutputSchema>;
