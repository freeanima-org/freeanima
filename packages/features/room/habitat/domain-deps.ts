import { habitatCtx } from "@freeanima/features/habitat/habitat/habitat-api/handlers/runtime.ts";

import type { RoomDomainDeps } from "../domain/room-service.ts";

/** 组合根上下文 → room 域依赖（联邦建群时由 hub 侧调用）。 */
export function resolveRoomDomainDeps(): RoomDomainDeps {
  const conversation = habitatCtx().conversation;
  return {
    newConversation: (...args) => conversation.newConversation(...args),
  };
}
