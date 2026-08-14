import { whenBundledRpcStreamClientReady } from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";
import type { VaultConfigRowPayload } from "@freeanima/shared/rpc-contract";

export async function getVaultCryptoConfig(
  subjectKind: "user" | "agent",
): Promise<VaultConfigRowPayload | null> {
  const client = await whenBundledRpcStreamClientReady();
  const data = await client.request(
    "vault.crypto.get" as never,
    {
      subject_kind: subjectKind,
    } as never,
  );
  return (data as { config: VaultConfigRowPayload | null }).config;
}
