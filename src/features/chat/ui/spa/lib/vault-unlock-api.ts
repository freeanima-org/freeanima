import { whenBundledSapClientReady } from "@freeanima/shared/sap-contract";
import type { VaultConfigRowPayload } from "@freeanima/shared/sap-contract";

export async function getVaultCryptoConfig(
  subjectKind: "user" | "agent",
): Promise<VaultConfigRowPayload | null> {
  const client = await whenBundledSapClientReady();
  const data = await client.request(
    "vault.crypto.get" as never,
    {
      subject_kind: subjectKind,
    } as never,
  );
  return (data as { config: VaultConfigRowPayload | null }).config;
}
