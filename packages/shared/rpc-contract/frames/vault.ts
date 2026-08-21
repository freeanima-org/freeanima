import { z } from "zod";

import {
  vaultItemTypeSchema,
  type VaultItemType,
} from "@freeanima/shared/pg-shapes/entity/enums.ts";

export { vaultItemTypeSchema };
export type VaultItemTypePayload = VaultItemType;

export const vaultUriMatchSchema = z.enum([
  "domain",
  "host",
  "starts_with",
  "exact",
  "regex",
  "never",
]);
export type VaultUriMatch = z.infer<typeof vaultUriMatchSchema>;

export const vaultUriEntrySchema = z.object({
  uri: z.string().min(1),
  match: vaultUriMatchSchema.default("domain"),
});
export type VaultUriEntryPayload = z.infer<typeof vaultUriEntrySchema>;

export const vaultImportRefsSchema = z.object({
  bitwarden: z.string().min(1).optional(),
  /** Agent 根密钥 SSOT（固定值 `habitat`） */
  agent_root_key: z.string().min(1).optional(),
});
export type VaultImportRefsPayload = z.infer<typeof vaultImportRefsSchema>;

export const vaultItemMetaRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  item_type: vaultItemTypeSchema,
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  /** 最近一次自动填充（ISO）；用于同分匹配排序 */
  last_used_at: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()),
  custom_field_names: z.array(z.string()),
  import_refs: vaultImportRefsSchema.optional(),
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
  subject_id: z.number().int().positive(),
  tag_ids: z.array(z.number().int().positive()).optional(),
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
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  include_secrets: z.boolean().optional(),
});
export type VaultGetInput = z.infer<typeof vaultGetInputSchema>;
export const vaultGetOutputSchema = z.object({ item: vaultItemDetailRowSchema });
export type VaultGetOutput = z.infer<typeof vaultGetOutputSchema>;

export const vaultCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  custom_field_names: z.array(z.string()).optional(),
  import_refs: vaultImportRefsSchema.optional(),
});
export type VaultCreateInput = z.infer<typeof vaultCreateInputSchema>;
export const vaultCreateOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultCreateOutput = z.infer<typeof vaultCreateOutputSchema>;

export const vaultPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  secrets_enc: z.string().min(1).optional(),
  dek_wrapped: z.string().min(1).optional(),
  custom_field_names: z.array(z.string()).optional(),
  import_refs: vaultImportRefsSchema.optional(),
});
export type VaultPatchInput = z.infer<typeof vaultPatchInputSchema>;
export const vaultPatchOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultPatchOutput = z.infer<typeof vaultPatchOutputSchema>;

/** 自动填充成功后 bump last_used_at（skip revision） */
export const vaultTouchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type VaultTouchInput = z.infer<typeof vaultTouchInputSchema>;
export const vaultTouchOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultTouchOutput = z.infer<typeof vaultTouchOutputSchema>;

export const vaultDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type VaultDeleteInput = z.infer<typeof vaultDeleteInputSchema>;
export const vaultDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type VaultDeleteOutput = z.infer<typeof vaultDeleteOutputSchema>;

export const vaultSearchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  query: z.string().min(1),
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
});
export type VaultSearchInput = z.infer<typeof vaultSearchInputSchema>;
export const vaultSearchOutputSchema = z.object({
  items: z.array(vaultItemMetaRowSchema),
});
export type VaultSearchOutput = z.infer<typeof vaultSearchOutputSchema>;

export const vaultCryptoGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type VaultCryptoGetInput = z.infer<typeof vaultCryptoGetInputSchema>;
export const vaultCryptoGetOutputSchema = z.object({
  config: vaultConfigRowSchema.nullable(),
});
export type VaultCryptoGetOutput = z.infer<typeof vaultCryptoGetOutputSchema>;

export const vaultCryptoInitInputSchema = z.object({
  subject_id: z.number().int().positive(),
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
  subject_id: z.number().int().positive(),
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
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type VaultHistoryListInput = z.infer<typeof vaultHistoryListInputSchema>;

export const vaultHistoryChangedFieldSchema = z.enum([
  "title",
  "url",
  "uris",
  "username",
  "tag_ids",
  "content",
  "item_type",
  "custom_field_names",
  "import_refs",
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
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  revision_index: z.number().int().nonnegative(),
});
export type VaultHistoryRestoreInput = z.infer<typeof vaultHistoryRestoreInputSchema>;
export const vaultHistoryRestoreOutputSchema = z.object({ item: vaultItemMetaRowSchema });
export type VaultHistoryRestoreOutput = z.infer<typeof vaultHistoryRestoreOutputSchema>;

export const vaultEnsureAgentInputSchema = z.object({
  agent_subject_id: z.number().int().positive().optional(),
});
export type VaultEnsureAgentInput = z.infer<typeof vaultEnsureAgentInputSchema>;
export const vaultEnsureAgentOutputSchema = z.object({ config: vaultConfigRowSchema });
export type VaultEnsureAgentOutput = z.infer<typeof vaultEnsureAgentOutputSchema>;

export const vaultAgentKeyStatusInputSchema = z.object({});
export type VaultAgentKeyStatusInput = z.infer<typeof vaultAgentKeyStatusInputSchema>;
export const vaultAgentKeyStatusOutputSchema = z.object({
  unlocked: z.boolean(),
  custody: z.literal("user_vault"),
});
export type VaultAgentKeyStatusOutput = z.infer<typeof vaultAgentKeyStatusOutputSchema>;

export const vaultAgentKeyProvisionInputSchema = z.object({
  key_b64: z.string().min(1),
  agent_subject_id: z.number().int().positive().optional(),
});
export type VaultAgentKeyProvisionInput = z.infer<typeof vaultAgentKeyProvisionInputSchema>;
export const vaultAgentKeyProvisionOutputSchema = z.object({
  unlocked: z.literal(true),
});
export type VaultAgentKeyProvisionOutput = z.infer<typeof vaultAgentKeyProvisionOutputSchema>;

export const vaultAgentKeyLockInputSchema = z.object({});
export type VaultAgentKeyLockInput = z.infer<typeof vaultAgentKeyLockInputSchema>;
export const vaultAgentKeyLockOutputSchema = z.object({
  unlocked: z.literal(false),
});
export type VaultAgentKeyLockOutput = z.infer<typeof vaultAgentKeyLockOutputSchema>;

/** 迁移用：读取现有缓存 raw（无则 null）；不自动生成。 */
export const vaultAgentKeyPeekRawInputSchema = z.object({});
export type VaultAgentKeyPeekRawInput = z.infer<typeof vaultAgentKeyPeekRawInputSchema>;
export const vaultAgentKeyPeekRawOutputSchema = z.object({
  key_b64: z.string().nullable(),
});
export type VaultAgentKeyPeekRawOutput = z.infer<typeof vaultAgentKeyPeekRawOutputSchema>;

export const vaultCreatePlainInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  secrets: vaultSecretsViewSchema,
  import_refs: vaultImportRefsSchema.optional(),
});
export type VaultCreatePlainInput = z.infer<typeof vaultCreatePlainInputSchema>;

export const vaultPatchPlainInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  item_type: vaultItemTypeSchema.optional(),
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  secrets: vaultSecretsViewSchema.optional(),
  import_refs: vaultImportRefsSchema.optional(),
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
