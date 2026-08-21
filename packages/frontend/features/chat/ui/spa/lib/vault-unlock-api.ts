import { whenBundledRpcStreamClientReady } from "@freeanima/shared/rpc-contract/bundled-rpc-stream-browser.ts";
import type { VaultConfigRowPayload } from "@freeanima/shared/rpc-contract";

export async function getVaultCryptoConfig(
  subjectKind: "user" | "agent",
): Promise<VaultConfigRowPayload | null> {
  const client = await whenBundledRpcStreamClientReady();
  const data = await client.request(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
    "vault.crypto.get" as never,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
    {
      subject_kind: subjectKind,
    } as never,
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC 响应边界
  return (data as { config: VaultConfigRowPayload | null }).config;
}
