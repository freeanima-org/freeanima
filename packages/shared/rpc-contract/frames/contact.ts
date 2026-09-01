import { z } from "zod";

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

export type ContactAnimaEntryPayload = z.infer<typeof contactAnimaEntrySchema>;

export const contactRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  emails: z.array(contactChannelEntrySchema),
  phones: z.array(contactChannelEntrySchema),
  addresses: z.array(contactAddressEntrySchema),
  wechats: z.array(contactChannelEntrySchema),
  animas: z.array(contactAnimaEntrySchema).default([]),
  subject_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ContactRowPayload = z.infer<typeof contactRowSchema>;

export const contactListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  limit: z.number().int().positive().max(5000).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ContactListInput = z.infer<typeof contactListInputSchema>;
export const contactListOutputSchema = z.object({
  items: z.array(contactRowSchema),
});
export type ContactListOutput = z.infer<typeof contactListOutputSchema>;

export const contactGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ContactGetInput = z.infer<typeof contactGetInputSchema>;
export const contactGetOutputSchema = z.object({ item: contactRowSchema });
export type ContactGetOutput = z.infer<typeof contactGetOutputSchema>;

export const contactSearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
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
  /** 联系人关联的 subject 实体（非 world 归属） */
  linked_subject_id: z.number().int().positive().nullable().optional(),
};

export const contactCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().optional(),
  ...contactChannelsInput,
  client_op_id: z.string().min(1).optional(),
});
export type ContactCreateInput = z.infer<typeof contactCreateInputSchema>;
export const contactCreateOutputSchema = z.object({ item: contactRowSchema });
export type ContactCreateOutput = z.infer<typeof contactCreateOutputSchema>;

export const contactPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  ...contactChannelsInput,
});
export type ContactPatchInput = z.infer<typeof contactPatchInputSchema>;
export const contactPatchOutputSchema = z.object({ item: contactRowSchema });
export type ContactPatchOutput = z.infer<typeof contactPatchOutputSchema>;

export const contactDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ContactDeleteInput = z.infer<typeof contactDeleteInputSchema>;
export const contactDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type ContactDeleteOutput = z.infer<typeof contactDeleteOutputSchema>;

export const contactResolveByAddressInputSchema = z.object({
  subject_id: z.number().int().positive(),
  address: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});
export type ContactResolveByAddressInput = z.infer<typeof contactResolveByAddressInputSchema>;
export const contactResolveByAddressOutputSchema = z.object({
  items: z.array(contactRowSchema),
});
export type ContactResolveByAddressOutput = z.infer<typeof contactResolveByAddressOutputSchema>;

export const contactResolveByPublicIdInputSchema = z.object({
  subject_id: z.number().int().positive(),
  public_id: z.string().min(1),
});
export type ContactResolveByPublicIdInput = z.infer<typeof contactResolveByPublicIdInputSchema>;
export const contactResolveByPublicIdOutputSchema = z.object({
  item: contactRowSchema.nullable(),
});
export type ContactResolveByPublicIdOutput = z.infer<typeof contactResolveByPublicIdOutputSchema>;

export const contactAttachAddressInputSchema = z.object({
  subject_id: z.number().int().positive(),
  contact_id: z.number().int().positive(),
  address: z.string().min(1),
  label: z.string().optional(),
  identity_key: z.boolean().optional(),
});
export type ContactAttachAddressInput = z.infer<typeof contactAttachAddressInputSchema>;
export const contactAttachAddressOutputSchema = z.object({ item: contactRowSchema });
export type ContactAttachAddressOutput = z.infer<typeof contactAttachAddressOutputSchema>;

export const contactCreateFromAddressInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  address: z.string().min(1),
  label: z.string().optional(),
  identity_key: z.boolean().optional(),
  summary: z.string().optional(),
});
export type ContactCreateFromAddressInput = z.infer<typeof contactCreateFromAddressInputSchema>;
export const contactCreateFromAddressOutputSchema = z.object({
  item: contactRowSchema,
});
export type ContactCreateFromAddressOutput = z.infer<typeof contactCreateFromAddressOutputSchema>;
