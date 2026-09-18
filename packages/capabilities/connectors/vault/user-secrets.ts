import { getVaultItem } from "@freeanima/capabilities/connectors/vault/domain/item-store";
import { resolveVaultWorldId } from "@freeanima/capabilities/connectors/vault/domain/vault-world";
import { getResolvedWorldContext } from "@freeanima/core/config";
import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";
import {
  vaultResolveSecretUserInputSchema,
  vaultResolveSecretUserOutputSchema,
} from "@freeanima/shared/rpc-contract";

import {
  mountVaultShellSendRequestService,
  type ShellSendRequest,
} from "./shell-send-request-service.ts";

export function bindVaultShellSendRequest(fn: ShellSendRequest | null): void {
  mountVaultShellSendRequestService(ensureRootContext()).bind(fn);
}

export async function resolveUserVaultSecret(input: {
  item_id: number;
  field: string;
  conversation_id?: string;
  world_id?: number;
}): Promise<string> {
  const shellSendRequest = getRootContextOrNull()?.vaultShellSendRequest?.get() ?? null;
  if (!shellSendRequest) {
    throw new Error("VAULT_SHELL_OFFLINE");
  }

  const worldId =
    input.world_id ?? (await resolveVaultWorldId(getResolvedWorldContext().user_subject_id));
  const item = await getVaultItem(worldId, input.item_id, { include_secrets: true });
  if (!item || !("secrets_enc" in item) || !("dek_wrapped" in item)) {
    throw new Error("NOT_FOUND");
  }

  const payload = {
    item_id: input.item_id,
    field: input.field,
    secrets_enc: item.secrets_enc,
    dek_wrapped: item.dek_wrapped,
    ...(input.conversation_id ? { conversation_id: input.conversation_id } : {}),
  };
  vaultResolveSecretUserInputSchema.parse(payload);

  const raw = await shellSendRequest("vault.resolve_secret_user", payload);
  const parsed = vaultResolveSecretUserOutputSchema.parse(raw);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

export function parseVaultResolveSecretUserResponse(raw: unknown) {
  return vaultResolveSecretUserOutputSchema.parse(raw);
}
