import { z } from "zod";

export const VAULT_ITEM_COMPONENT = "vault_item" as const;

export const vaultItemTypeSchema = z.enum(["login", "secure_note", "card", "identity", "custom"]);
export type VaultItemType = z.infer<typeof vaultItemTypeSchema>;

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
export type VaultUriEntry = z.infer<typeof vaultUriEntrySchema>;

export const vaultImportRefsSchema = z.object({
  bitwarden: z.string().min(1).optional(),
  /** Agent 根密钥 SSOT（固定值 `habitat`） */
  agent_root_key: z.string().min(1).optional(),
});
export type VaultImportRefs = z.infer<typeof vaultImportRefsSchema>;

export const vaultCustomFieldTypeSchema = z.enum(["text", "hidden", "boolean"]);
export type VaultCustomFieldType = z.infer<typeof vaultCustomFieldTypeSchema>;

export const vaultCustomFieldSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  type: vaultCustomFieldTypeSchema.default("hidden"),
});

export const vaultCardSecretsSchema = z.object({
  brand: z.string().optional(),
  number: z.string().optional(),
  code: z.string().optional(),
  cardholder: z.string().optional(),
  exp_month: z.string().optional(),
  exp_year: z.string().optional(),
});
export type VaultCardSecrets = z.infer<typeof vaultCardSecretsSchema>;

export const vaultIdentitySecretsSchema = z.object({
  title: z.string().optional(),
  first_name: z.string().optional(),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  company: z.string().optional(),
  ssn: z.string().optional(),
  passport_number: z.string().optional(),
  license_number: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  address3: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});
export type VaultIdentitySecrets = z.infer<typeof vaultIdentitySecretsSchema>;

export const vaultItemBodySchema = z.object({
  item_type: vaultItemTypeSchema.default("login"),
  url: z.string().optional(),
  uris: z.array(vaultUriEntrySchema).optional(),
  username: z.string().optional(),
  /** 最近一次自动填充时间（ISO）；明文 meta，不进 secrets */
  last_used_at: z.string().optional(),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  custom_field_names: z.array(z.string()).default([]),
  import_refs: vaultImportRefsSchema.optional(),
});

export type VaultItemBody = z.infer<typeof vaultItemBodySchema>;

/** Decrypted secrets payload (client / Habitat memory only). */
export const vaultSecretsPayloadSchema = z
  .object({
    password: z.string().optional(),
    notes: z.string().optional(),
    totp: z.string().optional(),
    custom_fields: z.array(vaultCustomFieldSchema).optional(),
    card: vaultCardSecretsSchema.optional(),
    identity: vaultIdentitySecretsSchema.optional(),
  })
  .catchall(z.unknown());

export type VaultSecretsPayload = z.infer<typeof vaultSecretsPayloadSchema>;
