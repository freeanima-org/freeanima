import { worldConfigBodySchema } from "@freeanima/host/core/db/schema/entity";
import { getEntity } from "./repos/entity-crud-repo.ts";

export class EntityWorldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityWorldError";
  }
}

export async function assertValidWorldId(worldId: number): Promise<void> {
  const world = await getEntity(worldId);
  if (!world || world.type !== "world") {
    throw new EntityWorldError(`world not found: ${worldId}`);
  }
}

export async function assertEntityInWorld(entityId: number, worldId: number): Promise<void> {
  const row = await getEntity(entityId);
  if (!row) {
    throw new EntityWorldError(`entity not found: ${entityId}`);
  }
  if (row.world_id !== worldId) {
    throw new EntityWorldError(`entity ${entityId} is not in world ${worldId}`);
  }
}

export async function assertSameWorldReferent(aId: number, bId: number): Promise<void> {
  const a = await getEntity(aId);
  const b = await getEntity(bId);
  if (!a || !b) {
    throw new EntityWorldError("referent entity not found");
  }
  if (a.world_id !== b.world_id) {
    throw new EntityWorldError(`cross-world referent: ${aId} vs ${bId}`);
  }
}

export async function assertPrivateWorldOwnedBySubject(
  worldId: number,
  subjectId: number,
): Promise<void> {
  const world = await getEntity(worldId);
  const parsed = worldConfigBodySchema.safeParse(world?.body);
  if (
    !world ||
    world.type !== "world" ||
    !parsed.success ||
    !parsed.data.private ||
    parsed.data.owner_subject_id !== subjectId
  ) {
    throw new EntityWorldError(
      `world ${worldId} is not a private world owned by subject ${subjectId}`,
    );
  }
}
