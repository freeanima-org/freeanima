import { subscribeHubRpcConnectionState, whenHubRpcReady } from "@freeanima/hub-rpc";
import { z } from "zod";

import { getUserVaultSession } from "./user-vault-session.ts";

const resolveSecretUserInputSchema = z.object({
  item_id: z.number().int().positive(),
  field: z.string().min(1),
  secrets_enc: z.string().min(1),
  dek_wrapped: z.string().min(1),
  conversation_id: z.string().optional(),
});

let detachRequestHandler: (() => void) | null = null;
let registered = false;

async function attachResolveSecretUserHandler(): Promise<void> {
  detachRequestHandler?.();
  detachRequestHandler = null;

  const rpc = await whenHubRpcReady();
  detachRequestHandler = rpc.onRequest("vault.resolve_secret_user", async (payload) => {
    const input = resolveSecretUserInputSchema.parse(payload);
    const session = getUserVaultSession();
    if (!session.canResolve(input.conversation_id)) {
      throw new Error("vault_locked");
    }
    const value = await session.resolveSecret(
      input.item_id,
      input.field,
      input.secrets_enc,
      input.dek_wrapped,
    );
    if (value === undefined) {
      throw new Error("vault_field_not_found");
    }
    return { value };
  });
}

/** 注册 Hub → Shell 的 User 库解密 RPC（vault.resolve_secret_user） */
export function registerVaultRpcHandlers(): () => void {
  if (registered) {
    return () => {
      detachRequestHandler?.();
      detachRequestHandler = null;
      registered = false;
    };
  }
  registered = true;

  const offConnection = subscribeHubRpcConnectionState((state) => {
    if (state === "connected") {
      void attachResolveSecretUserHandler().catch(() => undefined);
    }
  });

  return () => {
    offConnection();
    detachRequestHandler?.();
    detachRequestHandler = null;
    registered = false;
  };
}

export function resetVaultRpcHandlersForTest(): void {
  detachRequestHandler?.();
  detachRequestHandler = null;
  registered = false;
}
