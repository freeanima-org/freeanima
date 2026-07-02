import { z } from "zod";

export const VAULT_CONFIG_COMPONENT = "vault_config" as const;

export const vaultConfigModeSchema = z.enum(["master_password", "machine"]);
export type VaultConfigMode = z.infer<typeof vaultConfigModeSchema>;

export const vaultConfigBodySchema = z.object({
  mode: vaultConfigModeSchema,
  kdf: z
    .object({
      name: z.string(),
      iterations: z.number().int().positive().optional(),
      memory: z.number().int().positive().optional(),
      parallelism: z.number().int().positive().optional(),
    })
    .optional(),
  salt: z.string().optional(),
  verifier: z.string().optional(),
  key_id: z.string().optional(),
});

export type VaultConfigBody = z.infer<typeof vaultConfigBodySchema>;
