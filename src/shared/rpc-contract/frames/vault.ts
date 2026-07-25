import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const vaultSubjectKindSchema = notificationRecipientKindSchema;

export const vaultItemTypeSchema = z.enum(["login", "secure_note", "card", "identity", "custom"]);

export const vaultItemMetaRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  item_type: vaultItemTypeSchema,
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()),
  custom_field_names: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type VaultItemMetaRowPayload = z.infer<typeof vaultItemMetaRowSchema>;

export const vaultItemRowSchema = vaultItemMetaRowSchema.extend({
  secrets_enc: z.string(),
  dek_wrapped: z.string(),
});

export type VaultItemRowPayload = z.infer<typeof vaultItemRowSchema>;

export const vaultSecretsViewSchema = z.record(z.string(), z.unknown());
export type VaultSecretsViewPayload = z.infer<typeof vaultSecretsViewSchema>;

export const vaultItemDetailRowSchema = vaultItemMetaRowSchema.extend({
  /** Agent 库：Habitat 解密后的明文（仅 Agent） */
  secrets: vaultSecretsViewSchema.optional(),
  /** User 库：密文，客户端用主密码解开 */
  secrets_enc: z.string().optional(),
  dek_wrapped: z.string().optional(),
  /** 改密 rewrap：与 entities.revisions 同序的历史 dek_wrapped */
  revision_deks: z.array(z.string()).optional(),
});

export type VaultItemDetailRowPayload = z.infer<typeof vaultItemDetailRowSchema>;

export const vaultConfigRowSchema = z.object({
  id: z.number().int().positive(),
  mode: z.enum(["master_password", "machine"]),
  kdf: z
    .object({
      name: z.string(),
      iterations: z.number().int().positive().optional(),
    })
    .optional(),
  salt: z.string().optional(),
  verifier: z.string().optional(),
  key_id: z.string().optional(),
});

export type VaultConfigRowPayload = z.infer<typeof vaultConfigRowSchema>;

export const vaultListInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  include_secrets: z.boolean().optional(),
});
export type VaultListInput = z.infer<typeof vaultListInputSchema>;
export const vaultListOutputSchema = z.object({
  // include_secrets 时 User 库行可带 secrets_enc/dek_wrapped（改密 rewrap 用）
  items: z.array(vaultItemDetailRowSchema),
});
export type VaultListOutput = z.infer<typeof vaultListOutputSchema>;
export const vaultGetInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  id: z.number().int().positive(),
  include_secrets: z.boolean().optional(),
});
export type VaultGetInput = z.infer<typeof vaultGetInputSchema>;
export const vaultGetOutputSchema = z.object({ item: vaultItemDetailRowSchema });
export type VaultGetOutput = z.infer<typeof vaultGetOutputSchema>;

export const vaultCreateInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()).optional(),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  custom_field_names: z.array(z.string()).optional(),
});
export type VaultCreateInput = z.infer<typeof vaultCreateInputSchema>;
export const vaultCreateOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultCreateOutput = z.infer<typeof vaultCreateOutputSchema>;

export const vaultPatchInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()).optional(),
  secrets_enc: z.string().min(1).optional(),
  dek_wrapped: z.string().min(1).optional(),
  custom_field_names: z.array(z.string()).optional(),
});
export type VaultPatchInput = z.infer<typeof vaultPatchInputSchema>;
export const vaultPatchOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultPatchOutput = z.infer<typeof vaultPatchOutputSchema>;

export const vaultDeleteInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  id: z.number().int().positive(),
});
export type VaultDeleteInput = z.infer<typeof vaultDeleteInputSchema>;
export const vaultDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type VaultDeleteOutput = z.infer<typeof vaultDeleteOutputSchema>;

export const vaultSearchInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});
export type VaultSearchInput = z.infer<typeof vaultSearchInputSchema>;
export const vaultSearchOutputSchema = z.object({
  items: z.array(vaultItemMetaRowSchema),
});
export type VaultSearchOutput = z.infer<typeof vaultSearchOutputSchema>;

export const vaultCryptoGetInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
});
export type VaultCryptoGetInput = z.infer<typeof vaultCryptoGetInputSchema>;
export const vaultCryptoGetOutputSchema = z.object({
  config: vaultConfigRowSchema.nullable(),
});
export type VaultCryptoGetOutput = z.infer<typeof vaultCryptoGetOutputSchema>;

export const vaultCryptoInitInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  salt: z.string().min(1),
  verifier: z.string().min(1),
  kdf: z
    .object({
      name: z.string(),
      iterations: z.number().int().positive().optional(),
    })
    .optional(),
});
export type VaultCryptoInitInput = z.infer<typeof vaultCryptoInitInputSchema>;
export const vaultCryptoInitOutputSchema = z.object({ config: vaultConfigRowSchema });
export type VaultCryptoInitOutput = z.infer<typeof vaultCryptoInitOutputSchema>;

export const vaultCryptoChangeInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  salt: z.string().min(1).optional(),
  verifier: z.string().min(1),
  rewrapped: z.array(
    z.object({
      id: z.number().int().positive(),
      dek_wrapped: z.string().min(1),
      /** 与 entities.revisions 同序的历史 dek_wrapped */
      revision_deks: z.array(z.string().min(1)).optional(),
    }),
  ),
});
export type VaultCryptoChangeInput = z.infer<typeof vaultCryptoChangeInputSchema>;
export const vaultCryptoChangeOutputSchema = z.object({ ok: z.literal(true) });
export type VaultCryptoChangeOutput = z.infer<typeof vaultCryptoChangeOutputSchema>;

export const vaultHistoryListInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  id: z.number().int().positive(),
});
export type VaultHistoryListInput = z.infer<typeof vaultHistoryListInputSchema>;

export const vaultHistoryChangedFieldSchema = z.enum([
  "title",
  "url",
  "username",
  "tags",
  "content",
  "item_type",
  "custom_field_names",
  "secrets",
]);

export const vaultHistoryRevisionMetaSchema = z.object({
  index: z.number().int().nonnegative(),
  captured_at: z.string(),
  title: z.string(),
  /** 相对更新一版（index0→当前；index i→revisions[i-1]）变动的字段 */
  changed_fields: z.array(vaultHistoryChangedFieldSchema),
});
export type VaultHistoryRevisionMetaPayload = z.infer<typeof vaultHistoryRevisionMetaSchema>;

export const vaultHistoryListOutputSchema = z.object({
  revisions: z.array(vaultHistoryRevisionMetaSchema),
});
export type VaultHistoryListOutput = z.infer<typeof vaultHistoryListOutputSchema>;

export const vaultHistoryRestoreInputSchema = z.object({
  subject_kind: vaultSubjectKindSchema.optional(),
  id: z.number().int().positive(),
  revision_index: z.number().int().nonnegative(),
});
export type VaultHistoryRestoreInput = z.infer<typeof vaultHistoryRestoreInputSchema>;
export const vaultHistoryRestoreOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultHistoryRestoreOutput = z.infer<typeof vaultHistoryRestoreOutputSchema>;

export const vaultEnsureAgentInputSchema = z.object({});
export type VaultEnsureAgentInput = z.infer<typeof vaultEnsureAgentInputSchema>;
export const vaultEnsureAgentOutputSchema = z.object({ config: vaultConfigRowSchema });
export type VaultEnsureAgentOutput = z.infer<typeof vaultEnsureAgentOutputSchema>;

export const vaultCreatePlainInputSchema = z.object({
  subject_kind: z.literal("agent").optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()).optional(),
  secrets: vaultSecretsViewSchema,
});
export type VaultCreatePlainInput = z.infer<typeof vaultCreatePlainInputSchema>;

export const vaultPatchPlainInputSchema = z.object({
  subject_kind: z.literal("agent").optional(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()).optional(),
  secrets: vaultSecretsViewSchema.optional(),
});
export type VaultPatchPlainInput = z.infer<typeof vaultPatchPlainInputSchema>;
export const vaultCreatePlainOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultCreatePlainOutput = z.infer<typeof vaultCreatePlainOutputSchema>;
export const vaultPatchPlainOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultPatchPlainOutput = z.infer<typeof vaultPatchPlainOutputSchema>;

/** Habitat → Shell RPC（非 SAP router 方法） */
export const vaultResolveSecretUserInputSchema = z.object({
  item_id: z.number().int().positive(),
  field: z.string().min(1),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  conversation_id: z.string().optional(),
});
export type VaultResolveSecretUserInput = z.infer<typeof vaultResolveSecretUserInputSchema>;
export const vaultResolveSecretUserOutputSchema = z.union([
  z.object({ value: z.string() }),
  z.object({
    error: z.enum(["vault_locked", "NOT_FOUND", "FIELD_NOT_FOUND", "vault_locked_user"]),
  }),
]);
export type VaultResolveSecretUserOutput = z.infer<typeof vaultResolveSecretUserOutputSchema>;
