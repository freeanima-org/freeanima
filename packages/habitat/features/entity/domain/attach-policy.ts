import type { EntityRow } from "@freeanima/habitat/core/db/pg/entity";
import {
  AGENT_CONFIG_COMPONENT,
  USER_CONFIG_COMPONENT,
  WORLD_CONFIG_COMPONENT,
  isKnownComponent,
} from "@freeanima/habitat/core/db/schema/entity";

/** 定义实体身份的组件，不可经通用 Morph attach / promote。 */
const IDENTITY_COMPONENTS = new Set<string>([
  WORLD_CONFIG_COMPONENT,
  AGENT_CONFIG_COMPONENT,
  USER_CONFIG_COMPONENT,
]);

export class EntityAttachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityAttachError";
  }
}

function assertAliveContentCarrier(entity: EntityRow, op: "attach" | "promote"): void {
  if (entity.deleted_at != null) {
    throw new EntityAttachError("entity is deleted");
  }
  if (entity.type !== "content") {
    throw new EntityAttachError(`${op} only allowed on content entities`);
  }
}

function assertNotIdentityComponent(component: string, op: "attach" | "promote"): void {
  if (!isKnownComponent(component)) {
    throw new EntityAttachError(`unknown component: ${component}`);
  }
  if (IDENTITY_COMPONENTS.has(component)) {
    throw new EntityAttachError(`cannot ${op} identity component: ${component}`);
  }
}

/** 通用 attach：content 载体 + 非身份组件。重复组件由 repo 拒绝。 */
export function assertAttachAllowed(entity: EntityRow, component: string): void {
  assertAliveContentCarrier(entity, "attach");
  assertNotIdentityComponent(component, "attach");
}

/** 通用 promote：content 载体 + 目标已在 components[] + 非身份组件。 */
export function assertPromoteAllowed(entity: EntityRow, component: string): void {
  assertAliveContentCarrier(entity, "promote");
  assertNotIdentityComponent(component, "promote");
  if (!entity.components.includes(component)) {
    throw new EntityAttachError(`component not present: ${component}`);
  }
}
