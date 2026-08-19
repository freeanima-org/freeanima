import type { RuntimeConfigStore } from "@freeanima/habitat/platform/config";
import {
  deriveEd25519KeyPair,
  formatHabitatInstanceId,
  HABITAT_ED25519_INFO,
} from "@freeanima/shared/identity";
import { randomPublicId } from "@freeanima/shared/util";
import { identityConfigSchema, type IdentityConfig } from "@freeanima/habitat/core/config";

import { startupLog } from "./status.ts";

export type IdentityPhaseResult = { identity: IdentityConfig };

/** Phase：确保 fa_inst_* 与 Habitat Ed25519 密钥对（首次生成后只读） */
export async function bootIdentityPhase(config: RuntimeConfigStore): Promise<IdentityPhaseResult> {
  const existing = identityConfigSchema.safeParse(config.data.identity);
  if (existing.success) {
    startupLog(`Habitat identity ready (${existing.data.habitat_instance_id})`);
    return { identity: existing.data };
  }

  startupLog("Generating Habitat identity…");
  const habitat_instance_id = formatHabitatInstanceId(randomPublicId());
  const keys = deriveEd25519KeyPair({
    salt: habitat_instance_id,
    info: HABITAT_ED25519_INFO,
  });
  const identity: IdentityConfig = identityConfigSchema.parse({
    habitat_instance_id,
    public_key: keys.public_key,
    private_key: keys.private_key,
    subject_keys: {},
  });
  await config.replaceSection("identity", identity);
  startupLog(`Persisted Habitat identity (${habitat_instance_id})`);
  return { identity };
}
