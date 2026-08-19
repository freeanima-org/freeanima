import type { RuntimeConfigStore } from "@freeanima/habitat/platform/config";
import { resolveAndBindWorldContext } from "@freeanima/habitat/core/config/world-context-pg";
import { identityConfigSchema, type IdentityConfig } from "@freeanima/habitat/core/config";
import { ensureSubjectCryptoMaterial } from "@freeanima/habitat/core/identity";
import { getEntity, listEntities } from "@freeanima/habitat/core/db/pg/entity";
import { subjectConfigBodySchema } from "@freeanima/habitat/core/db/schema/entity";

import { startupLog } from "./status.ts";

export type WorldSubjectsPhaseResult = Record<string, never>;

/** 与 habitat_runtime_config.worlds 段比对（不含 legacy notifications 伪装） */
function worldsSectionNeedsPersist(
  worlds:
    | { user_subject_id?: number | undefined; agent_subject_id?: number | undefined }
    | undefined,
  resolved: { user_subject_id: number; agent_subject_id: number },
): boolean {
  return (
    worlds?.user_subject_id !== resolved.user_subject_id ||
    worlds?.agent_subject_id !== resolved.agent_subject_id
  );
}

async function ensureAllSubjectCrypto(config: RuntimeConfigStore): Promise<void> {
  const identityParsed = identityConfigSchema.safeParse(config.data.identity);
  if (!identityParsed.success) {
    throw new Error("habitat identity missing before subject crypto ensure");
  }
  const identity: IdentityConfig = identityParsed.data;
  const subjects = [
    ...(await listEntities({ type: "user", limit: 50 })),
    ...(await listEntities({ type: "agent", limit: 200 })),
  ];

  const subject_keys = { ...identity.subject_keys };
  let changed = false;

  for (const row of subjects) {
    const body = subjectConfigBodySchema.safeParse(row.body);
    const existingPublicId = body.success ? body.data.public_id : undefined;
    const existingPair = existingPublicId ? subject_keys[existingPublicId] : undefined;
    const { material } = await ensureSubjectCryptoMaterial(
      row,
      identity.habitat_instance_id,
      existingPair?.private_key,
    );
    const prev = subject_keys[material.public_id];
    if (
      !prev ||
      prev.public_key !== material.public_key ||
      prev.private_key !== material.private_key
    ) {
      subject_keys[material.public_id] = {
        public_key: material.public_key,
        private_key: material.private_key,
      };
      changed = true;
    } else if (!existingPublicId || !body.success || !body.data.public_key) {
      changed = true;
    }
  }

  // drop orphan keys for deleted public_ids
  const liveIds = new Set<string>();
  for (const row of subjects) {
    const refreshed = await getEntity(row.id);
    const parsed = subjectConfigBodySchema.safeParse(refreshed?.body);
    if (parsed.success && parsed.data.public_id) liveIds.add(parsed.data.public_id);
  }
  for (const key of Object.keys(subject_keys)) {
    if (!liveIds.has(key)) {
      delete subject_keys[key];
      changed = true;
    }
  }

  if (changed) {
    await config.replaceSection("identity", {
      ...identity,
      subject_keys,
    });
    startupLog(`Subject crypto ready (${liveIds.size} subjects)`);
  }
}

/** Phase 2.5: 确保 user/agent subject 与默认私有 world（迁移后、engine 前）；必要时回写 worlds */
export async function bootWorldSubjectsPhase(
  config: RuntimeConfigStore,
): Promise<WorldSubjectsPhaseResult> {
  startupLog("Ensuring world subjects…");
  const ctx = await resolveAndBindWorldContext(config.data);

  if (
    worldsSectionNeedsPersist(config.data.worlds, {
      user_subject_id: ctx.user_subject_id,
      agent_subject_id: ctx.agent_subject_id,
    })
  ) {
    await config.patchSection("worlds", {
      user_subject_id: ctx.user_subject_id,
      agent_subject_id: ctx.agent_subject_id,
    });
    startupLog(
      `Persisted worlds subject ids (user=${ctx.user_subject_id}, agent=${ctx.agent_subject_id})`,
    );
  }

  await ensureAllSubjectCrypto(config);

  startupLog(
    `World subjects ready (user=${ctx.user_subject_id}/world=${ctx.user_world_id}, agent=${ctx.agent_subject_id}/world=${ctx.agent_world_id}, commons=${ctx.commons_world_id})`,
  );
  return {};
}
