import { z } from "zod";

export const VAULT_ITEM_COMPONENT = "vault_item" as const;

export const vaultItemTypeSchema = z.enum(["login", "secure_note", "card", "identity", "custom"]);
export type VaultItemType = z.infer<typeof vaultItemTypeSchema>;

export const vaultCustomFieldTypeSchema = z.enum(["text", "hidden", "boolean"]);
export type VaultCustomFieldType = z.infer<typeof vaultCustomFieldTypeSchema>;

export const vaultCustomFieldSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  type: vaultCustomFieldTypeSchema.default("hidden"),
});

export const vaultItemBodySchema = z.object({
  item_type: vaultItemTypeSchema.default("login"),
  url: z.string().optional(),
  username: z.string().optional(),
  tags: z.array(z.string()).default([]),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  custom_field_names: z.array(z.string()).default([]),
});

export type VaultItemBody = z.infer<typeof vaultItemBodySchema>;

/** Decrypted secrets payload (client / hub memory only). */
export const vaultSecretsPayloadSchema = z
  .object({
    password: z.string().optional(),
    notes: z.string().optional(),
    totp: z.string().optional(),
    custom_fields: z.array(vaultCustomFieldSchema).optional(),
  })
  .catchall(z.unknown());

export type VaultSecretsPayload = z.infer<typeof vaultSecretsPayloadSchema>;
