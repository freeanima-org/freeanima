import {
  COMPANION_PROFILE_COMPONENT,
  asCompanionProfile,
  companionProfileBodySchema,
  type CompanionProfileBody,
} from "@freeanima/core/db/schema/entity";
import { resolveSubjectWorldId } from "@freeanima/core/config";
import { createEntity, listEntities, updateEntity } from "@freeanima/core/db/pg/entity";
import { DEFAULT_BEHAVIOR, emptyMotionSlots } from "./types.ts";
import { mergeBehavior } from "./behavior.ts";

export const DEFAULT_PROFILE: CompanionProfileBody = {
  active_model_id: "",
  models: [],
  motion_library: [],
  motion_slots: emptyMotionSlots(),
  behavior: { ...DEFAULT_BEHAVIOR },
};

export function resolveCompanionWorldId(): number {
  return resolveSubjectWorldId("agent");
}

export async function getOrCreateCompanionProfile(): Promise<
  CompanionProfileBody & { id: number }
> {
  const worldId = resolveCompanionWorldId();
  const rows = await listEntities({
    world_id: worldId,
    primary_component: COMPANION_PROFILE_COMPONENT,
    limit: 1,
  });
  const existing = rows[0] ? asCompanionProfile(rows[0]) : null;
  if (existing) return existing;

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [COMPANION_PROFILE_COMPONENT],
    primary_component: COMPANION_PROFILE_COMPONENT,
    title: "桌面伴侣",
    body: DEFAULT_PROFILE,
  });
  const profile = asCompanionProfile(row);
  if (!profile) throw new Error("companion profile create failed");
  return profile;
}

export async function saveCompanionProfile(
  patch: Partial<CompanionProfileBody>,
): Promise<CompanionProfileBody & { id: number }> {
  const current = await getOrCreateCompanionProfile();
  const nextBody = companionProfileBodySchema.parse({
    ...current,
    ...patch,
    behavior: mergeBehavior({ ...current.behavior, ...patch.behavior }),
    motion_slots: patch.motion_slots ?? current.motion_slots,
    models: patch.models ?? current.models,
    motion_library: patch.motion_library ?? current.motion_library,
    active_model_id: patch.active_model_id ?? current.active_model_id,
  });
  const updated = await updateEntity({ id: current.id, body: nextBody });
  if (!updated) throw new Error("companion profile update failed");
  const profile = asCompanionProfile(updated);
  if (!profile) throw new Error("companion profile parse failed");
  return profile;
}
