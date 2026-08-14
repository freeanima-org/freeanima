import { getResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";

export function testUserWorldId(): number {
  return getResolvedWorldContext().user_world_id;
}

export function testAgentWorldId(): number {
  return getResolvedWorldContext().agent_world_id;
}

export function testWorldToolArgs(): { world_id: number } {
  return { world_id: testUserWorldId() };
}
